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

// --- 環境変数（GitHub Actions で functions/.env を生成）---
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const ALLOWED_ORIGINS = (process.env.APP_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => !!s);

// --- CORS ミドルウェア ---
const cors = corsLib({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.length === 0) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS not allowed"), false);
  },
});

// --- ユーティリティ ---
function normalizeName(s: string): string {
  return (s || "").toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim();
}
function dateOnly(v: string): string {
  const m = (v || "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : v;
}

// --- 入力スキーマ ---
const SearchSchema = z.object({
  date: z.string().min(10),
  name: z.string().min(1),
  guestCount: z.number().int().min(1).optional(),
});
const StartCheckinSchema = z.object({ reservationId: z.string().min(1) });
const UploadCompleteSchema = z.object({
  sessionId: z.string().min(1),
  uploadedPaths: z.array(z.string().min(1)).min(1),
});
const SyncSchema = z.object({
  records: z
    .array(
      z.object({
        date: z.string().min(10),
        roomNumber: z.string().min(1),
        guestName: z.string().min(1),
        guestCount: z.union([z.number().int().min(1), z.string()]),
        passkey: z.string().min(1),
      })
    )
    .min(1),
});

// --- 共通レスポンスヘッダ ---
function setJson(res: any) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

// --- ルーティング本体 ---
async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const path: string = (req.path as string) || "/";
  setJson(res);

  try {
    // 1) 予約照合
    if (path.endsWith("/searchReservation") && req.method === "POST") {
      const p = SearchSchema.parse(req.body || {});
      const q = await db
        .collection("reservations")
        .where("date", "==", dateOnly(p.date))
        .get();
      const n = normalizeName(p.name);
      const rows = q.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((r) => String(r.searchKey || "").includes(n));

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
      const { reservationId } = StartCheckinSchema.parse(req.body || {});
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

      const expiresAt = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 20 * 60 * 1000)
      );
      const sessionRef = db.collection("checkinSessions").doc();
      const expectedUploads = Number(r.guestCount) * 2;

      await sessionRef.set({
        reservationId: ref.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: expiresAt,
        expectedUploads: expectedUploads,
      });

      res.status(200).json({
        sessionId: sessionRef.id,
        expectedUploads: expectedUploads,
        uploadBasePath: "checkins/" + sessionRef.id + "/",
      });
      return;
    }

    // 3) アップロード完了
    if (path.endsWith("/uploadPhotos") && req.method === "POST") {
      const { sessionId, uploadedPaths } = UploadCompleteSchema.parse(
        req.body || {}
      );

      const sSnap = await db.collection("checkinSessions").doc(sessionId).get();
      if (!sSnap.exists) {
        res.status(404).json({ error: "session_not_found" });
        return;
      }
      const s = sSnap.data() as any;

      const nowMs = admin.firestore.Timestamp.now().toMillis();
      const expOk =
        s &&
        s.expiresAt &&
        typeof s.expiresAt.toMillis === "function" &&
        s.expiresAt.toMillis() > nowMs;
      if (!expOk) {
        res.status(410).json({ error: "session_expired" });
        return;
      }

      // パス検証
      const okPrefix = uploadedPaths.every(function (p: string) {
        return p.indexOf("checkins/" + sessionId + "/") === 0;
      });
      if (!okPrefix) {
        res.status(400).json({ error: "invalid_paths" });
        return;
      }

      // Storage に存在確認
      const bucket = storage.bucket();
      let okCount = 0;
      for (const p of uploadedPaths) {
        const existsArr = await bucket.file(p).exists();
        const exists = Array.isArray(existsArr) ? existsArr[0] : false;
        if (exists) okCount++;
      }
      const required = Number(s.expectedUploads) || 1;
      if (okCount < required) {
        res
          .status(400)
          .json({ error: "insufficient_uploads", required: required, found: okCount });
        return;
      }

      // 予約更新
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

      res
        .status(200)
        .json({ ok: true, roomNumber: r.roomNumber, passkey: r.passkey });
      return;
    }

    // 4) 管理同期（GAS → Firestore）
    if (path.endsWith("/admin/syncReservations") && req.method === "POST") {
      const key = req.header("x-admin-key");
      if (!ADMIN_KEY || key !== ADMIN_KEY) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const { records } = SyncSchema.parse(req.body || {});
      const batch = db.batch();
      const nowServer = admin.firestore.FieldValue.serverTimestamp();

      for (const rec of records) {
        const dateStr = dateOnly(rec.date);
        const guestCountNum = Number(rec.guestCount);
        const searchKey = normalizeName(rec.guestName);

        const safeRoom = String(rec.roomNumber).trim();
        const safeKey = searchKey.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "-");
        let docId = dateStr + "_" + safeRoom + "_" + safeKey;
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
            searchKey: searchKey,
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

    // 未定義パス
    res.status(404).json({ error: "not_found" });
  } catch (e: any) {
    logger.error(e);
    res.status(400).json({ error: "bad_request", detail: e?.message || String(e) });
  }
}

// --- エクスポート（CORS ミドルウェアを適用）---
export const api = onRequest(
  { region: "asia-northeast1", memory: "256MiB", cors: false },
  (req, res) => cors(req as any, res as any, () => handler(req, res))
);
