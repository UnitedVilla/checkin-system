// web/src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

type WebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  appId: string;
};

// バケット名を gs:// に正規化
function toGsBucket(input: string): string {
  let b = (input || '').trim();
  if (!b) return '';
  if (b.startsWith('gs://')) return b;
  if (b.endsWith('.firebasestorage.app')) {
    const projectId = b.split('.')[0];
    return `gs://${projectId}.appspot.com`;
  }
  if (b.endsWith('.appspot.com')) return `gs://${b}`;
  return `gs://${b}.appspot.com`;
}

// 1) NEXT_PUBLIC_* が全部あるならそれを採用
// 2) 無ければ FIREBASE_WEBAPP_CONFIG(JSON) を採用
function readConfig(): WebConfig | null {
  const pub = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (Object.values(pub).every(Boolean)) {
    return pub as WebConfig;
  }
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (raw) {
    try {
      const j = JSON.parse(raw);
      return {
        apiKey: j.apiKey,
        authDomain: j.authDomain,
        projectId: j.projectId,
        storageBucket: j.storageBucket || `${j.projectId}.appspot.com`,
        appId: j.appId,
      };
    } catch {
      // noop
    }
  }
  return null;
}

// ---- 遅延初期化（import 時に throw しない！）----
let cachedApp: ReturnType<typeof initializeApp> | null = null;
let cachedCfg: WebConfig | null = null;

export function ensureFirebaseApp() {
  if (cachedApp) return cachedApp;
  if (!cachedCfg) cachedCfg = readConfig();
  if (!cachedCfg) {
    throw new Error(
      'Firebase web config is missing. Define NEXT_PUBLIC_FIREBASE_* or FIREBASE_WEBAPP_CONFIG.'
    );
  }
  cachedApp = getApps().length ? getApp() : initializeApp(cachedCfg);
  return cachedApp;
}

export function getFirebaseAuth() {
  return getAuth(ensureFirebaseApp());
}

export function getFirebaseStorage() {
  const cfg = cachedCfg ?? readConfig();
  const app = ensureFirebaseApp();
  const bucket = toGsBucket(cfg?.storageBucket || '');
  return bucket ? getStorage(app, bucket) : getStorage(app);
}
