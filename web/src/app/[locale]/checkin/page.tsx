// web/src/app/checkin/page.tsx
'use client';

import { useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { ref, uploadBytes } from 'firebase/storage';
import { getFirebaseAuth, getFirebaseStorage } from '@/lib/firebase';

// App Hosting / Vercel などでビルド時に静的化されないよう保険
export const dynamic = 'force-dynamic';

type Match = {
  reservationId: string;
  date: string;
  roomNumber: string;
  guestName: string;
  guestCount: number;
  status: string;
};

type SessionPayload = {
  sessionId: string;
  uploadBasePath: string;
  expectedUploads: number;
  customToken: string;
};

const API = process.env.NEXT_PUBLIC_API_BASE || '';

export default function CheckinPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [name, setName] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [reservationId, setReservationId] = useState('');
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  function ensureApi() {
    if (!API) throw new Error('NEXT_PUBLIC_API_BASE が未設定です');
  }

  async function search() {
    try {
      ensureApi();
      setBusy(true);
      setMatches([]);
      setReservationId('');

      const res = await fetch(`${API}/searchReservation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, name }),
      });
      const text = await res.text();
      let json: any;
      try { json = JSON.parse(text); } catch { throw new Error(text); }
      if (!res.ok) throw new Error(json?.detail || text);

      const list: Match[] = json.matches || [];
      setMatches(list);
      if (!list.length) {
        alert('該当の予約が見つかりません');
      } else {
        setReservationId(list[0].reservationId); // ひとまず先頭を選択
      }
    } catch (e: any) {
      alert(`検索に失敗: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!reservationId) return alert('先に予約照合してください');
    setBusy(true);
    try {
      const res = await fetch(`${API}/startCheckin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId }),
      });
      const s: SessionPayload = await res.json();
      if (!res.ok || !s.sessionId || !s.customToken) {
        throw new Error((s as any)?.error || 'チェックイン開始に失敗しました');
      }

      // Firebase Auth にサインイン（UID=sessionId）
      const auth = getFirebaseAuth();
      await signInWithCustomToken(auth, s.customToken);
      await auth.currentUser?.getIdToken(true); // 403回避のためトークン確定

      setSession(s);
    } catch (e: any) {
      alert(e?.message || e);
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    if (!session) return;
    setBusy(true);
    try {
      const storage = getFirebaseStorage();

      // 8MB 制限チェック（Storage ルールと同じ）
      const MAX = 8 * 1024 * 1024;

      // 顔・パスポート最小2枚を想定（多くてもOK）
      const chosen = files.slice(0, Math.max(2, files.length));
      const uploadedPaths: string[] = [];

      for (let i = 0; i < chosen.length; i++) {
        const f = chosen[i];
        if (!/^image\//.test(f.type)) {
          throw new Error(`画像ではないファイルが含まれています: ${f.name}`);
        }
        if (f.size > MAX) {
          throw new Error(`画像サイズが大きすぎます（${(f.size / 1024 / 1024).toFixed(1)}MB）。8MB以下にしてください: ${f.name}`);
        }

        const ext = f.type.includes('png') ? 'png'
                  : f.type.includes('webp') ? 'webp'
                  : 'jpg';
        const filename = i === 0 ? `face-1.${ext}` : `passport-1.${ext}`;
        const path = `${session.uploadBasePath}${filename}`;

        await uploadBytes(ref(storage, path), f, { contentType: f.type });
        uploadedPaths.push(path);
      }

      const res2 = await fetch(`${API}/uploadPhotos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, uploadedPaths }),
      });
      const json2 = await res2.json();
      if (!res2.ok) throw new Error(json2?.error || '完了APIでエラーが発生しました');

      setResult(json2);
    } catch (e: any) {
      alert(e?.message || e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6 space-y-5 max-w-xl mx-auto">
      <h1 className="text-xl font-bold">オンラインチェックイン</h1>

      <section className="space-y-2">
        <label className="block text-sm">チェックイン日</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <label className="block text-sm mt-2">代表者氏名</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 rounded w-full"
          placeholder="Taro Yamada"
        />
        <button
          disabled={busy}
          onClick={search}
          className="px-3 py-2 bg-black text-white rounded mt-2"
        >
          予約照合
        </button>
      </section>

      {matches.length > 0 && (
        <section className="space-y-2">
          <div className="text-sm text-gray-600">候補：{matches.length} 件</div>
          <select
            value={reservationId}
            onChange={(e) => setReservationId(e.target.value)}
            className="border p-2 rounded w-full"
          >
            {matches.map((m) => (
              <option key={m.reservationId} value={m.reservationId}>
                {m.guestName}（{m.guestCount}名） / {m.date} / 部屋{m.roomNumber}
              </option>
            ))}
          </select>
          <button
            disabled={!reservationId || busy}
            onClick={start}
            className="px-3 py-2 bg-indigo-600 text-white rounded"
          >
            チェックイン開始
          </button>
          {session && (
            <>
              <div className="text-green-700 text-sm">
                セッションID: {session.sessionId}
              </div>
              <div className="text-sm text-gray-600">
                必要枚数の目安: {session.expectedUploads} 枚
              </div>
            </>
          )}
        </section>
      )}

      <section className="space-y-2">
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
        />
        <div className="text-sm text-gray-600">選択中：{files.length} 枚</div>
        <button
          disabled={!session || files.length === 0 || busy}
          onClick={upload}
          className="px-3 py-2 bg-emerald-600 text-white rounded"
        >
          アップロードして完了
        </button>
      </section>

      {result && (
        <section className="p-4 border rounded">
          <div className="font-semibold">結果</div>
          <pre className="text-sm whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
