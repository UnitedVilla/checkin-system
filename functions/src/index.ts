// functions/src/index.ts
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin from "firebase-admin";
import corsLib from "cors";
import { z } from "zod";

// --- Firebase Admin 初期化 ---
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const storage = admin.storage();

// --- 環境変数（GitHub Actions で functions/.env を生成して渡します）---
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const ALLOWED_ORIGINS = (process.env.APP_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// --- CORS 設定（許可オリジンに一致したときだけ許可）---
const cors = corsLib({
  origin: (origin, cb) => {
    // App Hosting などのヘルスチェックでは origin が無いことがある
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.length === 0) {
      // 明示設定が無い場合は許可（開発初期の利便性優先／本番は設定してください）
      return cb(null, true);
    }
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

// --- メイン：単一関数で /api/* をルーティング ---
// 例: https://asia-northeast1-<project>.cloudfunctions.net/api/searchReservation
export const api = onRequest(
  { region: "asia-northeast1", memory: "256MiB", cors: false },
  async (req, res) => {
    // CORS（プリフライト含む）
    return cors(req, res, async () => {
      try {
        if (req.method === "OPTIONS") {
          res.status(204).end();
          return;
        }

        // ルーティング（/api の後ろを見ます）
        // 例: /api/searchReservation, /api/startCheckin, /api/uploadPhotos, /api/admin/syncReservations
        const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
        const path = url.pathname || "/";

        // JSON を返すときの共通ヘッダ
        res.setHeader("Content-Type", "application/json; charset=utf-8");

        // --- 1) 予約照合 ---
        if (path.endsWith("/searchReservation") && req.method === "POST") {
          const p = SearchSchema.parse(req.body ?? {});
          const q = await db
            .collection("reservations")
            .where("date", "==", dateOnly(p.date))
            .get();

          const n = normalizeName(p.name);
          const rows = q.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .filter((r) => (String(r.searchKey || "") as string).includes(n));

          res.status(200).send(
            JSON.stringify({
              matches: rows.slice(0, 10).map((r) => ({
                reservationId: r.id,
                date: r.date,
                roomNumber: r.roomNumber,
                guestName: r.guestName,
                guestCount: Number(r.guestCount),
                status: r.status || "pending",
              })),
            })
          );
          return;
        }

        // --- 2) セッション発行 ---
        if (path.endsWith("/startCheckin") && req.method === "POST") {
          const { reservationId } = StartCheckinSchema.parse(req.body ?? {});
          const ref = db.collection("reservations").doc(reservationId);
          const snap = await ref.get();
          if (!snap.exists) {
            res.status(404).send(JSON.stringify({ error: "reservation_not_found" }))
