'use client';
import { useMemo, useState } from 'react';
import { searchReservation, startCheckin, uploadPhotosComplete } from '@/lib/api';
import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { initializeApp, getApps } from 'firebase/app';
const app = getApps().length ? getApps()[0] : initializeApp({ apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID });
const storage = getStorage(app);

type Step = 'start' | 'select' | 'capture' | 'complete';
export default function Page(){
  const [date,setDate]=useState(''); const [name,setName]=useState(''); const [guestCount,setGuestCount]=useState(1);
  const [matches,setMatches]=useState<any[]>([]); const [selected,setSelected]=useState<any>(null);
  const [session,setSession]=useState<any>(null); const [files,setFiles]=useState<File[]>([]);
  const [error,setError]=useState(''); const [step,setStep]=useState<Step>('start');
  const today = useMemo(()=>{const d=new Date();const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const da=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${da}`;},[]);

  return (<main className='max-w-screen-sm mx-auto p-4'>
    {step==='start' && (<section className='space-y-3'>
      <h1 className='text-xl font-bold'>オンラインチェックイン</h1>
      <input type='date' value={date||today} onChange={e=>setDate(e.target.value)} className='border rounded p-2 w-full'/>
      <input placeholder='氏名' value={name} onChange={e=>setName(e.target.value)} className='border rounded p-2 w-full'/>
      <input type='number' min={1} value={guestCount} onChange={e=>setGuestCount(parseInt(e.target.value||'1'))} className='border rounded p-2 w-full'/>
      <button className='bg-black text-white rounded p-3 w-full' onClick={async()=>{try{const res=await searchReservation({date:date||today,name,guestCount});setMatches(res.matches);setStep('select');}catch(e:any){setError(e.message||'検索失敗')}}}>予約を照合</button>
      {error && <p className='text-red-600 text-sm'>{error}</p>}
    </section>)}

    {step==='select' && (<section className='space-y-3'>
      <h2 className='font-semibold'>予約を選択</h2>
      <ul className='space-y-2'>{matches.map(m=>(<li key={m.reservationId}>
        <button className='w-full text-left border rounded p-3' onClick={async()=>{const s=await startCheckin({reservationId:m.reservationId});setSelected(m);setSession(s);setStep('capture');}}> {m.guestName}（{m.guestCount}名） / {m.date} / 部屋 {m.roomNumber}</button>
      </li>))}</ul>
      <button className='border rounded p-3 w-full' onClick={()=>setStep('start')}>戻る</button>
    </section>)}

    {step==='capture' && (<section className='space-y-3'>
      <h2 className='font-semibold'>本人確認の撮影</h2>
      <input type='file' accept='image/*' multiple onChange={e=>{const arr=Array.from(e.target.files||[]); setFiles(arr)}} />
      <button className='bg-black text-white rounded p-3 w-full' onClick={async()=>{
        if(!session) return; const base=session.uploadBasePath; const paths:string[]=[];
        for(let i=0;i<files.length;i++){const f=files[i]; const filename=`${Date.now()}_${i}_${(f.name||'photo.jpg').replace(/[^a-zA-Z0-9._-]/g,'')}`; const objectPath=`${base}${filename}`; await uploadBytes(ref(storage, objectPath), f, {contentType:f.type}); paths.push(objectPath);}
        const result=await uploadPhotosComplete({sessionId:session.sessionId, uploadedPaths:paths}); (window as any).__RESULT__=result; setStep('complete');
      }}>アップロードして完了</button>
      <button className='border rounded p-3 w-full' onClick={()=>setStep('select')}>戻る</button>
    </section>)}

    {step==='complete' && (<section className='space-y-3 text-center'>
      <h2 className='font-semibold'>チェックイン完了</h2>
      <div className='border rounded p-4'><div>部屋番号</div><div className='text-2xl font-bold'>{selected?.roomNumber}</div><div className='mt-2'>パスキー</div><div className='text-2xl font-bold'>{(window as any).__RESULT__?.passkey}</div></div>
      <button className='border rounded p-3 w-full' onClick={()=>window.location.href='/'}>はじめに戻る</button>
    </section>)}
  </main>);
}
