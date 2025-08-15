// functions/src/index.ts
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin from "firebase-admin";
import corsLib from "cors";
import { z } from "zod";

// --- Firebase Admin 初期化 ---
if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

// --- 環境変数 ---
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const ALLOWED_ORIGINS = (process.env.APP_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// --- Origin 許可（完全一致 + ワイルドカード *.example.com）---
function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.length === 0) return true;
  return ALLOWED_ORIGINS.some((rule) => {
    if (rule === origin) return true;
    if (rule.startsWith("*.")) {
      const suffix = rule.slice(1);
      return origin.endsWith(suffix);
    }
    return false;
  });
}

// --- CORS ---
const cors = corsLib({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (isAllowedOrigin(origin)) return cb(null, true);
    cb(new Error(`CORS not allowed: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Key", "x-admin-key"],
  credentials: false,
  maxAge: 600,
});

// --- ユーティリティ ---
function normalizeName(s: string): string {
  return (s || "").toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim();
}

/** 受け取った文字列から日付を抽出し YYYY-MM-DD に正規化。 */
function normalizeDate(v: string): string {
  if (!v) return v;
  let m = v.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) m = v.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return v;
  const y = Number(m[1]);
  const mo = String(Number(m[2])).padStart(2, "0");
  const d = String(Number(m[3])).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function setJson(res: any) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Vary", "Origin");
}

// ★ 追加：安全に JSON Body を取り出す
function readJsonBody(req: any): any {
  try {
    if (req.body == null) {
      if (req.rawBody) {
        const s = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : String(req.rawBody || "");
        return s ? JSON.parse(s) : {};
      }
      return {};
    }
    if (typeof req.body === "string") {
      return req.body ? JSON.parse(req.body) : {};
    }
    return req.body; // 既にオブジェクト
  } catch {
    return {};
  }
}

// --- 入力スキーマ ---
const SearchSchema = z
  .object({
    date: z.string().min(4),
    name: z.string().min(1).optional(),
    guestName: z.string().min(1).optional(),
    guestCount: z.number().int().min(1).optional(),
  })
  .refine((v) => !!(v.name || v.guestName), { message: "name required" })
  .transform((v) => ({
    date: normalizeDate(v.date),
    name: normalizeName((v.name ?? v.guestName)!),
    guestCount: v.guestCount,
  }));

const StartCheckinSchema = z.object({ reservationId: z.string().min(1) });

const UploadCompleteSchema = z.object({
  sessionId: z.string().min(1),
  uploadedPaths: z.array(z.string().min(1)).min(1),
});

const SyncSchema = z.object({
  records: z
    .array(
      z.object({
        date: z.string().min(4),
        roomNumber: z.string().min(1),
        guestName: z.string().min(1),
        guestCount: z.union([z.number().int().min(1), z.string()]),
        passkey: z.string().min(1),
      })
    )
    .min(1),
});

// --- ルーティング本体 ---
async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const path: string = (req.path as string) || "/";
  setJson(res);

  try {
    // 0) ヘルスチェック
    if (path.endsWith("/healthz") && req.method === "GET") {
      res.status(200).json({ ok: true, ts: new Date().toISOString() });
      return;
    }

    // 1) 予約照合
    if (path.endsWith("/searchReservation") && req.method === "POST") {
      const raw = readJsonBody(req);
      logger.info("searchReservation.body", { type: typeof raw, keys: Object.keys(raw || {}) });

      const p = SearchSchema.parse(raw);
      logger.info("searchReservation", { date: p.date, name: p.name });

      const q = await db.collection("reservations").where("date", "==", p.date).get();

      const rows = q.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((r) => String(r.searchKey || "").includes(p.name));

      logger.info("searchReservationResult", { total: q.size, matched: rows.length });

      res.status(200).json({
        matches: rows.slice(0, 10).map((r) => ({
          reservationId: r.id,
          date: r.date,
          roomNumber: r.roomNumber,
          guestName: r.guestName,
          guestCount: Number(r.guestCount),
          status: r.status || "pending",
        })),
      });
      return;
    }

    // 2) セッション発行
    if (path.endsWith("/startCheckin") && req.method === "POST") {
      const raw = readJsonBody(req);
      logger.info("startCheckin.body", { type: typeof raw, keys: Object.keys(raw || {}) });

      const { reservationId } = StartCheckinSchema.parse(raw);
      const ref = db.collection("reservations").doc(reservationId);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: "reservation_not_found" });
        return;
      }
      const r = snap.data() as any;
      if ((r.status || "pending") === "checked_in") {
        res.status(409).json({ error: "already_checked_in" });
        return;
      }

      const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 20 * 60 * 1000));
      const sessionRef = db.collection("checkinSessions").doc();
      const expectedUploads = Math.max(1, Number(r.guestCount) * 2);

      await sessionRef.set({
        reservationId: ref.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
        expectedUploads,
      });

      const customToken = await admin.auth().createCustomToken(sessionRef.id);

      res.status(200).json({
        sessionId: sessionRef.id,
        expectedUploads,
        uploadBasePath: `checkins/${sessionRef.id}/`,
        customToken,
      });
      return;
    }

    // 3) アップロード完了
    if (path.endsWith("/uploadPhotos") && req.method === "POST") {
      const raw = readJsonBody(req);
      logger.info("uploadPhotos.body", { type: typeof raw, keys: Object.keys(raw || {}) });

      const { sessionId, uploadedPaths } = UploadCompleteSchema.parse(raw);
      const sSnap = await db.collection("checkinSessions").doc(sessionId).get();
      if (!sSnap.exists) {
        res.status(404).json({ error: "session_not_found" });
        return;
      }
      const s = sSnap.data() as any;

      const nowMs = admin.firestore.Timestamp.now().toMillis();
      const expOk = s && s.expiresAt && typeof s.expiresAt.toMillis === "function" && s.expiresAt.toMillis() > nowMs;
      if (!expOk) {
        res.status(410).json({ error: "session_expired" });
        return;
      }

      const okPrefix = uploadedPaths.every((p: string) => p.startsWith(`checkins/${sessionId}/`));
      if (!okPrefix) {
        res.status(400).json({ error: "invalid_paths" });
        return;
      }

      const bucket = storage.bucket();
      let okCount = 0;
      for (const p of uploadedPaths) {
        const [exists] = await bucket.file(p).exists();
        if (exists) okCount++;
      }
      const required = Math.max(1, Number(s.expectedUploads) || 1);
      if (okCount < required) {
        res.status(400).json({ error: "insufficient_uploads", required, found: okCount });
        return;
      }

      const rRef = db.collection("reservations").doc(String(s.reservationId));
      const rSnap = await rRef.get();
      if (!rSnap.exists) {
        res.status(404).json({ error: "reservation_not_found" });
        return;
      }
      const r = rSnap.data() as any;

      await rRef.update({
        status: "checked_in",
        checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
        uploadCount: okCount,
      });

      res.status(200).json({ ok: true, roomNumber: r.roomNumber, passkey: r.passkey });
      return;
    }

    // 4) 管理同期（GAS → Firestore）
    if (path.endsWith("/admin/syncReservations") && req.method === "POST") {
      const key = req.header("x-admin-key") || req.header("X-Admin-Key");
      if (!ADMIN_KEY || key !== ADMIN_KEY) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const raw = readJsonBody(req);
      logger.info("syncReservations.body", { type: typeof raw, keys: Object.keys(raw || {}) });

      const { records } = SyncSchema.parse(raw);
      const batch = db.batch();
      const nowServer = admin.firestore.FieldValue.serverTimestamp();

      for (const rec of records) {
        const dateStr = normalizeDate(rec.date);
        const guestCountNum = Number(rec.guestCount);
        const searchKey = normalizeName(rec.guestName);

        const safeRoom = String(rec.roomNumber).trim();
        const safeKey = searchKey.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "-");
        let docId = `${dateStr}_${safeRoom}_${safeKey}`;
        if (docId.length > 200) docId = docId.slice(0, 200);

        const ref = db.collection("reservations").doc(docId);
        batch.set(
          ref,
          {
            date: dateStr,
            roomNumber: safeRoom,
            guestName: rec.guestName,
            guestCount: guestCountNum,
            passkey: String(rec.passkey),
            status: "pending",
            searchKey,
            updatedAt: nowServer,
            createdAt: nowServer,
          },
          { merge: true }
        );
      }

      await batch.commit();
      res.status(200).json({ ok: true, count: records.length });
      return;
    }

    res.status(404).json({ error: "not_found" });
  } catch (e: any) {
    logger.error(e);
    const detail = e?.issues ?? e?.message ?? String(e);
    res.status(400).json({ error: "bad_request", detail });
  }
}

// --- エクスポート ---
export const api = onRequest(
  { region: "asia-northeast1", memory: "256MiB", cors: false },
  (req, res) => cors(req as any, res as any, () => handler(req, res))
);
