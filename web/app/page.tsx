'use client';
import { useMemo, useState } from 'react';
export default function Page(){
  const [name,setName]=useState('');
  const today = useMemo(()=>{const d=new Date();const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const da=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${da}`;},[]);
  return (<main className='max-w-screen-sm mx-auto p-6'>
    <h1 className='text-2xl font-bold mb-4'>オンラインチェックイン</h1>
    <p className='text-slate-600 mb-6'>まずはこの最小構成で App Hosting のビルドを通します。</p>
    <div className='space-y-3'>
      <label className='block'>
        <span className='text-sm'>チェックイン日</span>
        <input type='date' defaultValue={today} className='border rounded p-2 w-full' />
      </label>
      <label className='block'>
        <span className='text-sm'>代表者氏名</span>
        <input value={name} onChange={e=>setName(e.target.value)} className='border rounded p-2 w-full' />
      </label>
      <button className='rounded bg-black text-white px-4 py-2'>ダミー送信</button>
    </div>
  </main>);
}
