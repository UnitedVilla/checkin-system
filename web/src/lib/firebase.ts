// web/src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

type Env = string | undefined;
function req(v: Env, name: string): string {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/**
 * 入力を Storage の正式バケット URL に正規化します。
 * - "online-check-in-23087.appspot.com"            -> "gs://online-check-in-23087.appspot.com"
 * - "gs://online-check-in-23087.appspot.com"       -> そのまま
 * - "online-check-in-23087"                        -> "gs://online-check-in-23087.appspot.com"
 * - "online-check-in-23087.firebasestorage.app"    -> "gs://online-check-in-23087.appspot.com"
 */
function toGsBucket(input: string): string {
  let b = input.trim();

  // すでに gs:// ならそのまま
  if (b.startsWith('gs://')) return b;

  // firebasestorage.app を入れた場合は projectId を抽出して appspot.com に寄せる
  if (b.endsWith('.firebasestorage.app')) {
    const projectId = b.split('.')[0]; // 先頭ラベル=projectId
    return `gs://${projectId}.appspot.com`;
  }

  // すでに appspot.com なら gs:// を付ける
  if (b.endsWith('.appspot.com')) return `gs://${b}`;

  // projectId のみ指定された場合
  return `gs://${b}.appspot.com`;
}

const config = {
  apiKey: req(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, 'NEXT_PUBLIC_FIREBASE_API_KEY'),
  authDomain: req(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: req(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: req(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  appId: req(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, 'NEXT_PUBLIC_FIREBASE_APP_ID'),
};

const app = getApps().length ? getApp() : initializeApp(config);

// ★ フォールバックを避けるため、必ず gs://<bucket> を明示
const gsBucket = toGsBucket(config.storageBucket);

export const auth = getAuth(app);
export const storage = getStorage(app, gsBucket);

// デバッグ: 実際にどこへ向くか確認（開発時のみ）
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  console.log('[firebase] storageBucket from config:', (getApp().options?.storageBucket ?? '(none)'));
  console.log('[firebase] storage forced bucket:', gsBucket);
}

// 他で使いたい場合に備えて export
export { app as firebaseApp };
