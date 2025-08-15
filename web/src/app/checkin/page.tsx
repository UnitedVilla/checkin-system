// 'use client';
// export default function CheckinPage() {
//   return <main style={{ padding: 16 }}>チェックイン画面（仮）</main>;
// }

'use client';
import { useState } from 'react';
import { auth, storage } from '@/lib/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { ref, uploadBytes } from 'firebase/storage';

const API = process.env.NEXT_PUBLIC_API_BASE!;

export default function CheckinPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [name, setName] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [session, setSession] = useState<{sessionId:string; uploadBasePath:string; expectedUploads:number; customToken:string} | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function search() {
    setBusy(true);
    const res = await fetch(`${API}/searchReservation`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ date, name })
    });
    const json = await res.json();
    const m = json.matches?.[0];
    if (!m) { alert('予約が見つかりません'); setBusy(false); return; }
    setReservationId(m.reservationId);
    setBusy(false);
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
    await signInWithCustomToken(auth, s.customToken); // uid=sessionId で一時ログイン
    setSession(s);
    setBusy(false);
  }

  async function upload() {
    if (!session) return;
    setBusy(true);
    const chosen = files.slice(0, Math.max(2, files.length));
    const uploadedPaths:string[] = [];
    for (let i=0; i<chosen.length; i++) {
      const f = chosen[i];
      const name = i===0 ? 'face-1.jpg' : 'passport-1.jpg';
      const path = `${session.uploadBasePath}${name}`;
      const r = ref(storage, path);
      await uploadBytes(r, f);
      uploadedPaths.push(path);
    }
    const res2 = await fetch(`${API}/uploadPhotos`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ sessionId: session.sessionId, uploadedPaths })
    });
    const json2 = await res2.json();
    setResult(json2);
    setBusy(false);
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">オンラインチェックイン</h1>

      <section className="space-y-2">
        <label className="block">チェックイン日</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border p-2 rounded" />
        <label className="block">お名前</label>
        <input value={name} onChange={e=>setName(e.target.value)} className="border p-2 rounded" placeholder="Taro Yamada" />
        <button disabled={busy} onClick={search} className="px-3 py-2 bg-black text-white rounded">予約照合</button>
        {reservationId && <div className="text-green-700">予約ID: {reservationId}</div>}
      </section>

      <section className="space-y-2">
        <button disabled={!reservationId || busy} onClick={start} className="px-3 py-2 bg-indigo-600 text-white rounded">チェックイン開始</button>
        {!!session && <div className="text-green-700">セッション: {session.sessionId}</div>}
      </section>

      <section className="space-y-2">
        <input type="file" accept="image/*" multiple capture="environment" onChange={e=>setFiles(Array.from(e.target.files||[]))} />
        <button disabled={!session || files.length===0 || busy} onClick={upload} className="px-3 py-2 bg-emerald-600 text-white rounded">アップロードして完了</button>
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


// //過去のページ
// 'use client';

// import { useEffect, useMemo, useState } from 'react';
// import { storage } from '@/lib/firebaseClient';
// import { ref, uploadBytes } from 'firebase/storage';
// import { searchReservation, startCheckin, uploadPhotosComplete, type MatchItem } from '@/lib/api';

// type Step = 'start' | 'select' | 'capture' | 'complete';

// export default function Page() {
//   const [date, setDate] = useState('');
//   const [name, setName] = useState('');
//   const [guestCount, setGuestCount] = useState(1);
//   const [matches, setMatches] = useState<MatchItem[]>([]);
//   const [selected, setSelected] = useState<MatchItem | null>(null);
//   const [session, setSession] = useState<{sessionId:string; expectedUploads:number; uploadBasePath:string} | null>(null);
//   const [files, setFiles] = useState<File[]>([]);
//   const [step, setStep] = useState<Step>('start');
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');

//   const today = useMemo(()=>{
//     const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const da=String(d.getDate()).padStart(2,'0');
//     return `${y}-${m}-${da}`;
//   },[]);

//   useEffect(()=>{ setDate(today); },[today]);

//   const onSearch = async () => {
//     setError(''); setLoading(true);
//     try {
//       const res = await searchReservation({ date, name, guestCount });
//       setMatches(res.matches || []);
//       if (!res.matches?.length) setError('該当する予約が見つかりませんでした。');
//       setStep('select');
//     } catch(e:any) {
//       setError(e?.message || '検索に失敗しました。');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const onPick = async (m: MatchItem) => {
//     setError(''); setLoading(true);
//     try {
//       const s = await startCheckin({ reservationId: m.reservationId });
//       setSelected(m); setSession(s); setStep('capture');
//     } catch(e:any) {
//       setError(e?.message || 'チェックイン開始に失敗しました。');
//     } finally { setLoading(false); }
//   };

//   const onUpload = async () => {
//     if (!session) return;
//     if (files.length < session.expectedUploads) { setError(`画像が不足しています（必要: ${session.expectedUploads} 枚）`); return; }
//     setError(''); setLoading(true);
//     try {
//       const paths: string[] = [];
//       for (let i=0;i<files.length;i++) {
//         const f = files[i];
//         const filename = `${Date.now()}_${i}_${(f.name||'photo.jpg').replace(/[^a-zA-Z0-9._-]/g,'')}`;
//         const objectPath = `${session.uploadBasePath}${filename}`;
//         await uploadBytes(ref(storage, objectPath), f, { contentType: f.type });
//         paths.push(objectPath);
//       }
//       const res = await uploadPhotosComplete({ sessionId: session.sessionId, uploadedPaths: paths });
//       (window as any).__CHECKIN_RESULT__ = res;
//       setStep('complete');
//     } catch(e:any) {
//       setError(e?.message || 'アップロードに失敗しました。');
//     } finally { setLoading(false); }
//   };

//   return (
//     <main className="max-w-screen-sm mx-auto p-4">
//       <header className="py-6 text-center">
//         <h1 className="text-2xl font-bold">オンラインチェックイン</h1>
//         <p className="text-sm text-slate-600 mt-1">日付・氏名で予約照合 → 本人確認撮影 → 完了</p>
//       </header>

//       <section className="bg-white rounded-2xl shadow p-5 space-y-5">
//         {step==='start' && (<div className="space-y-4">
//           <label className="block">
//             <span className="text-sm">チェックイン日</span>
//             <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
//           </label>
//           <label className="block">
//             <span className="text-sm">代表者氏名</span>
//             <input value={name} onChange={e=>setName(e.target.value)} placeholder="例: John Smith" className="mt-1 w-full rounded-xl border px-3 py-2" />
//           </label>
//           <label className="block">
//             <span className="text-sm">人数</span>
//             <input type="number" min={1} value={guestCount} onChange={e=>setGuestCount(parseInt(e.target.value||'1',10))} className="mt-1 w-full rounded-xl border px-3 py-2" />
//           </label>
//           {error && <p className="text-red-600 text-sm">{error}</p>}
//           <button onClick={onSearch} disabled={loading || !name || !date} className="w-full rounded-xl bg-black text-white py-3 font-semibold disabled:opacity-50">
//             {loading ? '検索中…' : '予約を照合する'}
//           </button>
//         </div>)}

//         {step==='select' && (<div className="space-y-4">
//           <h2 className="font-semibold">予約を選択</h2>
//           {!matches.length && <p className="text-sm text-slate-500">候補がありません。</p>}
//           <ul className="space-y-2">
//             {matches.map(m=>(
//               <li key={m.reservationId}>
//                 <button onClick={()=>onPick(m)} className="w-full text-left border rounded-xl px-4 py-3 hover:bg-slate-50">
//                   <div className="font-medium">{m.guestName}（{m.guestCount}名）</div>
//                   <div className="text-sm text-slate-600">{m.date} / 部屋 {m.roomNumber}</div>
//                 </button>
//               </li>
//             ))}
//           </ul>
//           <button onClick={()=>setStep('start')} className="w-full border rounded-xl py-3">戻る</button>
//         </div>)}

//         {step==='capture' && (<div className="space-y-4">
//           <h2 className="font-semibold">本人確認の撮影</h2>
//           <p className="text-sm text-slate-600">人数 × 「顔 + パスポート」 = 合計 {session?.expectedUploads} 枚</p>
//           <input type="file" accept="image/*" capture="environment" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))} />
//           {files.length>0 && <div className="text-sm text-slate-700">選択中：{files.length} / {session?.expectedUploads} 枚</div>}
//           {error && <p className="text-red-600 text-sm">{error}</p>}
//           <div className="flex gap-2">
//             <button onClick={()=>setStep('select')} className="flex-1 border rounded-xl py-3">戻る</button>
//             <button onClick={onUpload} disabled={loading || (files.length < (session?.expectedUploads||1))} className="flex-1 rounded-xl bg-black text-white py-3 font-semibold disabled:opacity-50">
//               {loading ? 'アップロード中…' : 'アップロードして完了へ'}
//             </button>
//           </div>
//         </div>)}

//         {step==='complete' && (<div className="space-y-4 text-center">
//           <h2 className="font-semibold text-lg">チェックイン完了</h2>
//           <p className="text-sm text-slate-600">以下の情報でお部屋にお入りください。</p>
//           <div className="bg-slate-50 rounded-xl p-4">
//             <div className="text-sm text-slate-600">部屋番号</div>
//             <div className="text-2xl font-bold mt-1">{selected?.roomNumber}</div>
//             <div className="text-sm text-slate-600 mt-4">パスキー</div>
//             <div className="text-2xl font-bold mt-1">{(window as any).__CHECKIN_RESULT__?.passkey}</div>
//           </div>
//           <button onClick={()=>location.href='/'} className="w-full rounded-xl border py-3">はじめに戻る</button>
//         </div>)}
//       </section>
//     </main>
//   );
// }
