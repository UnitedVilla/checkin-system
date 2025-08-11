import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import corsLib from "cors";
import admin from "firebase-admin";
import { z } from "zod";

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

const ADMIN_KEY = process.env.ADMIN_KEY || (process.env.FUNCTIONS_CONFIG as any)?.admin?.key;
const ALLOWED_ORIGINS = (process.env.APP_ALLOWED_ORIGINS || (process.env.FUNCTIONS_CONFIG as any)?.app?.allowed_origins || "")
  .split(",").map((s: string) => s.trim()).filter(Boolean);

const cors = corsLib({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS not allowed"), false);
  },
});

const normalizeName = (s: string) => (s || "").toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim();
const dateOnly = (v: string) => (v || "").match(/\d{4}-\d{2}-\d{2}/)?.[0] || v;

const SearchSchema = z.object({ date: z.string().min(10), name: z.string().min(1), guestCount: z.number().int().min(1).optional() });
const StartCheckinSchema = z.object({ reservationId: z.string().min(1) });
const UploadCompleteSchema = z.object({ sessionId: z.string().min(1), uploadedPaths: z.array(z.string().min(1)).min(1) });
const SyncSchema = z.object({
  records: z.array(z.object({
    date: z.string().min(10),
    roomNumber: z.string().min(1),
    guestName: z.string().min(1),
    guestCount: z.union([z.number().int().min(1), z.string()]),
    passkey: z.string().min(1),
  })).min(1)
});

export const api = onRequest({ region: "asia-northeast1" }, async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method === "OPTIONS") return res.status(204).end();

      if (req.path.endsWith("/searchReservation") && req.method === "POST") {
        const p = SearchSchema.parse(req.body);
        const q = await db.collection("reservations").where("date", "==", dateOnly(p.date)).get();
        const n = normalizeName(p.name);
        const rows = q.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(r => (r.searchKey || "").includes(n));
        return res.json({ matches: rows.slice(0, 10).map(r => ({ reservationId: r.id, date: r.date, roomNumber: r.roomNumber, guestName: r.guestName, guestCount: r.guestCount, status: r.status || "pending" })) });
      }

      if (req.path.endsWith("/startCheckin") && req.method === "POST") {
        const { reservationId } = StartCheckinSchema.parse(req.body);
        const ref = db.collection("reservations").doc(reservationId);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: "reservation_not_found" });
        const r = snap.data() as any;
        if ((r.status || "pending") === "checked_in") return res.status(409).json({ error: "already_checked_in" });

        const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 20 * 60 * 1000));
        const sessionRef = db.collection("checkinSessions").doc();
        const expectedUploads = Number(r.guestCount) * 2;
        await sessionRef.set({ reservationId: ref.id, createdAt: admin.firestore.FieldValue.serverTimestamp(), expiresAt, expectedUploads });
        return res.json({ sessionId: sessionRef.id, expectedUploads, uploadBasePath: `checkins/${sessionRef.id}/` });
      }

      if (req.path.endsWith("/uploadPhotos") && req.method === "POST") {
        const { sessionId, uploadedPaths } = UploadCompleteSchema.parse(req.body);
        const sSnap = await db.collection("checkinSessions").doc(sessionId).get();
        if (!sSnap.exists) return res.status(404).json({ error: "session_not_found" });
        const s = sSnap.data() as any;
        if (s.expiresAt.toMillis() <= admin.firestore.Timestamp.now().toMillis()) return res.status(410).json({ error: "session_expired" });
        if (!uploadedPaths.every((p: string) => p.startsWith(`checkins/${sessionId}/`))) return res.status(400).json({ error: "invalid_paths" });

        const bucket = storage.bucket();
        let ok = 0;
        for (const p of uploadedPaths) {
          const [exists] = await bucket.file(p).exists();
          if (exists) ok++;
        }
        if (ok < (s.expectedUploads || 1)) return res.status(400).json({ error: "insufficient_uploads", required: s.expectedUploads, found: ok });

        const rRef = db.collection("reservations").doc(s.reservationId);
        const rSnap = await rRef.get();
        if (!rSnap.exists) return res.status(404).json({ error: "reservation_not_found" });
        const r = rSnap.data() as any;
        await rRef.update({ status: "checked_in", checkedInAt: admin.firestore.FieldValue.serverTimestamp(), uploadCount: ok });

        return res.json({ ok: true, roomNumber: r.roomNumber, passkey: r.passkey });
      }

      if (req.path.endsWith("/admin/syncReservations") && req.method === "POST") {
        const key = req.header("x-admin-key");
        if (!ADMIN_KEY || key !== ADMIN_KEY) return res.status(401).json({ error: "unauthorized" });
        const { records } = SyncSchema.parse(req.body);
        const batch = db.batch();
        const now = admin.firestore.FieldValue.serverTimestamp();
        for (const rec of records) {
          const dateStr = dateOnly(rec.date);
          const guestCountNum = Number(rec.guestCount);
          const searchKey = normalizeName(rec.guestName);
          const docId = `${dateStr}_${String(rec.roomNumber).trim()}_${searchKey.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "-")}`.slice(0, 200);
          const ref = db.collection("reservations").doc(docId);
          batch.set(ref, { date: dateStr, roomNumber: String(rec.roomNumber), guestName: rec.guestName, guestCount: guestCountNum, passkey: String(rec.passkey), status: "pending", searchKey, updatedAt: now, createdAt: now }, { merge: True });
        }
        await batch.commit();
        return res.json({ ok: true, count: records.length });
      }

      return res.status(404).json({ error: "not_found" });
    } catch (e: any) {
      logger.error(e);
      return res.status(400).json({ error: "bad_request", detail: e?.message });
    }
  });
});
