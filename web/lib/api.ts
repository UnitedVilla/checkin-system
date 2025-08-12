const API_BASE = process.env.NEXT_PUBLIC_API_BASE as string;

export type MatchItem = {
  reservationId: string;
  date: string;
  roomNumber: string;
  guestName: string;
  guestCount: number;
  status: string;
};

export async function searchReservation(payload: {date: string; name: string; guestCount?: number}) {
  const r = await fetch(`${API_BASE}/searchReservation`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('検索に失敗しました');
  return r.json() as Promise<{matches: MatchItem[]}>;
}

export async function startCheckin(payload: {reservationId: string}) {
  const r = await fetch(`${API_BASE}/startCheckin`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('開始に失敗しました');
  return r.json() as Promise<{sessionId:string; expectedUploads:number; uploadBasePath:string}>;
}

export async function uploadPhotosComplete(payload: {sessionId: string; uploadedPaths: string[]}) {
  const r = await fetch(`${API_BASE}/uploadPhotos`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('完了に失敗しました');
  return r.json() as Promise<{ ok: boolean; roomNumber: string; passkey: string }>;
}
