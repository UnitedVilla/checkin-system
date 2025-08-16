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
 * さまざまな入力形式を Storage の正式バケット URL に正規化します。
 * - "online-check-in-23087.appspot.com"   -> "gs://online-check-in-23087.appspot.com"
 * - "gs://online-check-in-23087.appspot.com" -> そのまま
 * - "online-check-in-23087"                -> "gs://online-check-in-23087.appspot.com"
 * - "online-check-in-23087.firebasestorage.app" -> "gs://online-check-in-23087.appspot.com"
 */
function toGsBucket(input: string): string {
  let b = input.trim();

  // すでに gs:// ならそのまま
  if (b.startsWith('gs://')) return b;

  // firebasestorage.app を誤って入れた場合は projectId に変換
  if (b.endsWith('.firebasestorage.app')) {
    const projectId = b.split('.')[0];
    return `gs://${projectId}.appspot.com`;
  }

  // appspot.com が付いていれば gs:// を付ける
  if (b.endsWith('.appspot.com')) return `gs://${b}`;

  // projectId だけの場合は appspot.com を付与
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

export const auth = getAuth(app);
// どの形式でも正しいバケットを指すように正規化
export const storage = getStorage(app, toGsBucket(config.storageBucket));

// （必要なら他モジュール用にエクスポート）
export { app as firebaseApp };
