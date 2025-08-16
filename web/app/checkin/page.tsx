'use client';
import { useState } from 'react';
import { auth, storage } from '@/lib/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { ref, uploadBytes } from 'firebase/storage';

const API = process.env.NEXT_PUBLIC_API_BASE || '';

type Match = {
  reservationId: string;
  date: string;
  roomNumber: string;
  guestName: string;
  guestCount: number;
  status: string;
};

export default function CheckinPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [name, setName] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [reservationId, setReservationId] = useState('');
  const [session, setSession] = useState<{sessionId:string; uploadBasePath:string; expectedUploads:number; customToken:string} | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const ensureApi = () => {
    if (!API) throw new Error('NEXT_PUBLIC_API_BASE が未設定です');
  };

  async function search() {
    try {
      ensureApi();
      setBusy(true);
      setMatches([]);
      setReservationId('');
      const res = await fetch(`${API}/searchReservation`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
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
        setReservationId(list[0].reservationId); // とりあえず先頭を自動選択
      }
    } catch (e: any) {
      alert(`検索に失敗: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!reservationId) return alert('先に予約照合してください');
    setBusy(true);
    const res = await fetch(`${API}/startCheckin`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ reservationId })
    });
    const s = await res.json();
    if (!s.sessionId || !s.customToken) { alert('開始に失敗'); setBusy(false); return; }

    // ★ 確実にサインイン反映を待つ
    await signInWithCustomToken(auth, s.customToken);
    await auth.currentUser?.getIdToken(true); // トークン取得でレースを避ける
    const ok = auth.currentUser?.uid === s.sessionId;
    console.log('[checkin] uid === sessionId ?', ok, { uid: auth.currentUser?.uid, sessionId: s.sessionId });
    (window as any).__SESSION_DEBUG__ = { uid: auth.currentUser?.uid, sessionId: s.sessionId };

    setSession(s);
    setBusy(false);
  }

  async function upload() {
    if (!session) return;
    setBusy(true);

    // 8MB 制限に合わせたクライアントチェック
    const MAX = 8 * 1024 * 1024;

    const chosen = files.slice(0, Math.max(2, files.length));
    const uploadedPaths: string[] = [];

    for (let i = 0; i < chosen.length; i++) {
      const f = chosen[i];

      if (!/^image\//.test(f.type)) {
        alert(`画像ではないファイルが含まれています: ${f.name}`);
        setBusy(false); return;
      }
      if (f.size > MAX) {
        alert(`画像サイズが大きすぎます（${(f.size/1024/1024).toFixed(1)}MB）。8MB以下にしてください: ${f.name}`);
        setBusy(false); return;
      }

      const ext = f.type.includes('png') ? 'png'
                : f.type.includes('webp') ? 'webp'
                : 'jpg';
      const filename = i === 0 ? `face-1.${ext}` : `passport-1.${ext}`;
      const path = `${session.uploadBasePath}${filename}`;

      // ★ MIME を明示
      await uploadBytes(ref(storage, path), f, { contentType: f.type });
      uploadedPaths.push(path);
    }

    const res2 = await fetch(`${API}/uploadPhotos`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ sessionId: session.sessionId, uploadedPaths })
    });
    const json2 = await res2.json();
    setResult(json2);
    setBusy(false);
  }
  
  return (
    <main className="p-6 space-y-5 max-w-xl mx-auto">
      <h1 className="text-xl font-bold">オンラインチェックイン</h1>

      <section className="space-y-2">
        <label className="block text-sm">チェックイン日</label>
        <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="border p-2 rounded w-full" />
        <label className="block text-sm mt-2">代表者氏名</label>
        <input value={name} onChange={(e)=>setName(e.target.value)} className="border p-2 rounded w-full" placeholder="Taro Yamada" />
        <button disabled={busy} onClick={search} className="px-3 py-2 bg-black text-white rounded mt-2">予約照合</button>
      </section>

      {matches.length > 0 && (
        <section className="space-y-2">
          <div className="text-sm text-gray-600">候補：{matches.length} 件</div>
          <select
            value={reservationId}
            onChange={(e)=>setReservationId(e.target.value)}
            className="border p-2 rounded w-full"
          >
            {matches.map((m)=>(
              <option key={m.reservationId} value={m.reservationId}>
                {m.guestName}（{m.guestCount}名） / {m.date} / 部屋{m.roomNumber}
              </option>
            ))}
          </select>
          <button disabled={!reservationId || busy} onClick={start} className="px-3 py-2 bg-indigo-600 text-white rounded">
            チェックイン開始
          </button>
          {session && <div className="text-green-700 text-sm">セッションID: {session.sessionId}</div>}
          {session && <div className="text-sm text-gray-600">必要枚数の目安: {session.expectedUploads} 枚</div>}
        </section>
      )}

      <section className="space-y-2">
        <input type="file" accept="image/*" multiple capture="environment"
          onChange={(e)=>setFiles(Array.from(e.target.files||[]))}
        />
        <div className="text-sm text-gray-600">選択中：{files.length} 枚</div>
        <button disabled={!session || files.length===0 || busy} onClick={upload} className="px-3 py-2 bg-emerald-600 text-white rounded">
          アップロードして完了
        </button>
      </section>

      {result && (
        <section className="p-4 border rounded">
          <div className="font-semibold">結果</div>
          <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
