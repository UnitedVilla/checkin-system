// functions/src/index.ts
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin from "firebase-admin";
import corsLib from "cors";
import { z } from "zod";
import type { Request, Response } from "express";

// --- Firebase Admin 初期化 ---
if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

// --- 環境変数（GitHub Actions で functions/.env を作成）---
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const ALLOWED_ORIGINS = (process.env.APP_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// --- CORS ミドルウェア ---
const cors = corsLib({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // ヘルスチェック等
    if (ALLOWED_ORIGINS.length === 0) return cb(null, true); // 初期段階は緩め
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS not allowed"), false);
  },
});

// --- ユーティリティ ---
const normalizeName = (s: string) =>
  (s || "").toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim();

const dateOnly = (v: string) => {
  const m = (v || "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : v;
};

// --- 入力スキーマ ---
const SearchSchema = z.object({
  date: z.string().min(10),
  name: z.string().min(1),
  guestCount: z.number().int().min(1).optional(),
});

const StartCheckinSchema = z.object({
  reservationId: z.string().min(1),
});

const UploadCompleteSchema = z.object({
  sessionId: z.string().min(1),
  uploadedPaths: z.array(z.string().min(1)).min(1),
});

const SyncSchema = z.object({
  records: z.array(z.object({
    date: z.string().min(10),
    roomNumber: z.string().min(1),
    guestName: z.string().min(1),
    guestCount: z.union([z.number().int().min(1), z.string()]),
    passkey: z.string().min(1),
  })).min(1),
});

// --- ルーティング本体 ---
async function handler(req: Request, res: Response) {
  // CORS プリフライト
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const path = req.path || "/"; // 例: /api/searchReservation
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    // 1) 予約照合
    if (path.endsWith("/searchReservation") && req.method === "POST") {
      const p = SearchSchema.parse(req.body ?? {});
      const q = await db.collection("reservations").where("date", "==", dateOnly(p.date)).get();
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
      const { reservationId } = StartCheckinSchema.parse(req.body ?? {});
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

      const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 20 * 60 * 1000)); // 20分
      const sessionRef = db.collection("checkinSessions").doc();
      const expectedUploads = Number(r.guestCount) * 2; // 顔+パスポート × 人数

      await sessionRef.set({
        reservationId: ref.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
        expectedUploads,
      });

      res.status(200).json({
        sessionId: sessionRef.id,
        expectedUploads,
        uploadBasePath: `checkins/${sessionRef.id}/`,
      });
      return;
    }

    // 3) アップロード完了
    if (path.endsWith("/uploadPhotos") && req.method === "POST") {
      const { sessionId, uploadedPaths } = UploadCompleteSchema.parse(req.body ?? {});
      const sSnap = await db.collection("checkinSessions").doc(sessionId).get();
      if (!sSnap.exists) {
        res.status(404).json({ error: "session_not_found" });
        return;
      }
      const s = sSnap.data() as any;

      const now = admin.firestore.Timestamp.now().toMillis();
      if (!s.expiresAt || typeof s.expiresAt.toMillis !== "function" || s.expiresAt.toMillis() <= now)
