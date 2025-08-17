Online Check-in System — セットアップ & 運用 README

このドキュメントは、ここまであなたと一緒に構築した内容を 再現できる手順 と 運用ポイント にまとめたものです。
（Firebase / Google Cloud Functions（Gen2）/ Firestore / Cloud Storage / Next.js（App Router）/ Vercel or Firebase App Hosting）


---

0. リポジトリ構成（最終）

checkin-system/
├─ functions/                 # Cloud Functions (Node 20, TypeScript)
│  ├─ src/
│  │  └─ index.ts             # API本体（/api/*）
│  ├─ package.json
│  ├─ package-lock.json       # ← functions デプロイに必須。ローカルで再生成後、必ずコミット
│  └─ .env                    # ADMIN_KEY / APP_ALLOWED_ORIGINS を格納（CIで書き出しでもOK）
│
├─ web/                       # Next.js 14 (App Router)
│  ├─ src/
│  │  ├─ app/
│  │  │  └─ checkin/page.tsx  # フロント最小画面
│  │  └─ lib/
│  │     └─ firebase.ts       # Firebase SDK 初期化（遅延 & バケット正規化）
│  ├─ package.json
│  ├─ package-lock.json       # ← Vercel / App Hosting のビルドで必須。必ずコミット
│  └─ tsconfig.json
│
└─ .gitignore                 # node_modules / .next / functions/lib などを除外

node_modules / .next / functions/lib は コミットしない（.gitignore 済）

過去の履歴に混入している場合は git filter-repo で履歴からも除去



---

1. GCP / Firebase プロジェクト準備

1-1. 必須APIの有効化

gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  eventarc.googleapis.com \
  pubsub.googleapis.com \
  storage.googleapis.com \
  firebaseextensions.googleapis.com \
  cloudresourcemanager.googleapis.com

1-2. 課金

プロジェクトに 請求アカウントをリンク（Cloud Billing API 有効化も）


1-3. Functions サービスアイデンティティ作成（Not found 対策）

「gcf-admin-robot が Not found」404 の対策として一度だけ実行：

gcloud beta services identity create \
  --service=cloudfunctions.googleapis.com \
  --project=${PROJECT_ID}
# => service-${PROJECT_NUMBER}@gcf-admin-robot.iam.gserviceaccount.com が作成される

1-4. カスタムトークン用の権限（signBlob）

admin.auth().createCustomToken() で必要な signBlob を許可：

# Gen2 のデフォルト実行 SA は ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"

> 別の実行サービスアカウントで動かす場合は、そのSA に上記ロールを付与。




---

2. Firestore

2-1. コレクション

reservations：予約データ（date, roomNumber, guestName, guestCount, passkey, status, searchKey）

checkinSessions：チェックイン中セッション（reservationId, expiresAt, expectedUploads など）


2-2. 予約データの投入（GAS 連携）

Functions エンドポイント /api/admin/syncReservations に 管理用キー で投入
ヘッダ：x-admin-key: <ADMIN_KEY>



---

3. Cloud Storage（バケット & ルール & CORS）

3-1. バケット名の注意（新ドメイン）

<project>.firebasestorage.app が標準
例：online-check-in-23087.firebasestorage.app

<project>.appspot.com は旧ドメイン（混在させない）


3-2. セキュアなルール（最終）

rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /checkins/{sessionId}/{filename} {
      allow write: if isValidImage() && sessionActive(sessionId);
      allow read: if false;

      function sessionActive(sessionId) {
        // Firestore: checkinSessions/{sessionId} が存在 & 未期限切れ
        return exists(/databases/$(database)/documents/checkinSessions/$(sessionId))
          && get(/databases/$(database)/documents/checkinSessions/$(sessionId)).data.expiresAt > request.time;
      }

      function isValidImage() {
        return request.resource.size < 8 * 1024 * 1024
          && request.resource.contentType.matches('image/.*');
      }
    }
    match /{allPaths=**} { allow read, write: if false; }
  }
}

3-3. CORS（バケットに設定）

cors.json（例）：

[
  {
    "origin": [
      "https://checkin-system-gules.vercel.app",
      "http://localhost:3000"
    ],
    "method": ["GET","HEAD","PUT","POST","DELETE","PATCH","OPTIONS"],
    "responseHeader": [
      "Content-Type",
      "Authorization",
      "X-Firebase-AppCheck",
      "X-Firebase-GMPID",
      "X-Firebase-Storage-Version",
      "X-Goog-Upload-Command",
      "X-Goog-Upload-Header-Content-Length",
      "X-Goog-Upload-Header-Content-Type",
      "X-Goog-Upload-Protocol",
      "Range"
    ],
    "maxAgeSeconds": 3600
  }
]

適用：

gcloud storage buckets update gs://online-check-in-23087.firebasestorage.app \
  --cors-file=cors.json

動作確認（プリフライト）

curl -i -X OPTIONS \
  -H "Origin: https://checkin-system-gules.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" \
  "https://firebasestorage.googleapis.com/v0/b/online-check-in-23087.firebasestorage.app/o?name=test.txt"
# 200 / access-control-allow-origin が返ること


---

4. Cloud Functions（バックエンド API）

4-1. エンドポイント（asia-northeast1 / 関数名 api）

POST /api/searchReservation
入力：{ date: string, name: string }（date は YYYY-MM-DD or YYYY/MM/DD）
出力：{ matches: { reservationId, date, roomNumber, guestName, guestCount, status }[] }

POST /api/startCheckin
入力：{ reservationId: string }
出力：{ sessionId, expectedUploads, uploadBasePath, customToken }

> customToken を使ってフロントで signInWithCustomToken し、UID= sessionId で一時ログイン。



POST /api/uploadPhotos
入力：{ sessionId, uploadedPaths: string[] }
挙動：Storage 上の実体確認（不足なら 400）、予約の status=checked_in に更新
出力：{ ok: true, roomNumber, passkey }

POST /api/admin/syncReservations
ヘッダ：x-admin-key: <ADMIN_KEY>
入力：{ records: [{ date, roomNumber, guestName, guestCount, passkey }, ...] }
挙動：予約ドキュメントを Upsert（searchKey は正規化した氏名）


4-2. 環境変数（functions/.env）

ADMIN_KEY=（管理連携の共有鍵）
APP_ALLOWED_ORIGINS=https://checkin-system-gules.vercel.app,http://localhost:3000

> CORS 許可は 完全一致 および *.example.com のワイルドカードに対応。
仕上げでは テスト用 localhost を外す ことを推奨。



4-3. デプロイ

cd functions
npm ci
# package-lock.json が functions 配下に存在＆同期していること
firebase deploy --only functions --project online-check-in-23087

> npm ci EUSAGE が出る場合：
rm -rf node_modules package-lock.json && npm install で再生成 → コミット。




---

5. フロントエンド（Next.js / App Router）

5-1. Firebase SDK 初期化（遅延 + バケット正規化）

web/src/lib/firebase.ts（要約）

NEXT_PUBLIC_* が揃っていればそれを使用

無ければ App Hosting が注入する FIREBASE_WEBAPP_CONFIG（JSON）を使用

バケット名は .firebasestorage.app を優先
getStorage(app, "gs://<project>.firebasestorage.app") を明示

export const auth / export const storage を提供


5-2. 画面（/checkin）

検索 → 予約選択 → 開始（customToken でログイン）→ 撮影（2×人数）→ アップロード

アップロードは uploadBasePath（checkins/<sessionId>/）配下に
MIME と 8MB 制限をクライアント側でもチェック


5-3. 環境変数（フロント）

共通：

NEXT_PUBLIC_API_BASE=https://asia-northeast1-online-check-in-23087.cloudfunctions.net/api

Vercel（Project Settings → Environment Variables）：

NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET   # 例: online-check-in-23087.firebasestorage.app
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_API_BASE

Firebase App Hosting の場合
FIREBASE_WEBAPP_CONFIG は自動注入。firebase.ts が遅延初期化のため、ビルド時に未定義でも OK。
追加で NEXT_PUBLIC_* を与えたい場合は App Hosting の環境変数に設定。



---

6. ホスティング

6-1. Vercel（Monorepo）

Project Root: /web

Install Command: npm ci

Build Command: npm run build

Output：Next.js デフォルト

必要な環境変数を設定（上記 5-3）


6-2. Firebase App Hosting（任意）

リポジトリの /web を対象に設定

ビルド時に FIREBASE_WEBAPP_CONFIG が注入される（preparer ログに出力）

NEXT_PUBLIC_API_BASE は App Hosting の環境変数で指定



---

7. CORS 最終化（リスクと対処）

Functions 側 CORS：APP_ALLOWED_ORIGINS に 本番ドメインのみ を列挙
→ 開発中の http://localhost:3000 は 本番では除外。
そのままだと 別サイトからの API 呼び出しリスク が残る。

Storage CORS：cors.json の origin に 本番ドメインのみ。
不要に * を許可しない。



---

8. E2E 確認フロー（本番）

1. 予約同期（管理）
POST /api/admin/syncReservations（x-admin-key ヘッダ必須）で当日分を投入


2. Web /checkin で 日付 + 氏名 → 候補から選択


3. チェックイン開始 → customToken でフロントが匿名ログイン（UID= sessionId）


4. 撮影 & アップロード

Network タブで Upload 先の b= が .firebasestorage.app であること

403 の場合：Storage ルール条件 / ログイン状態 / CORS を再確認



5. 完了レスポンスで 部屋番号 / パスキー を表示




---

9. よくあるエラーと対処

404: gcf-admin-robot Not found
→ gcloud beta services identity create --service=cloudfunctions.googleapis.com

FirebaseAuthError: signBlob denied
→ 実行SAに roles/iam.serviceAccountTokenCreator を付与

Functions デプロイ: npm ci EUSAGE
→ functions/package-lock.json をローカルで再生成し コミット

Vercel ビルド: npm ci lockfile 不在/不整合
→ web/package-lock.json を再生成して コミット

Next ビルド時 Missing env
→ firebase.ts を 遅延初期化（本書の最終版を使用） or 環境変数を設定

Storage 403（本体）
→ バケット名の不一致（.appspot.com に飛んでいないか）
→ Rules 条件（sessionActive & 8MB & image/*）
→ プリフライトは 200 でも本体が落ちることがある（CORS と Rules は別）



---

10. 運用メモ

予約同期の鍵（ADMIN_KEY） は Secret 管理（CI/ホスティングの秘密情報に保存）

Functions の Allowed Origins は最小化（本番のみ）

Artifact Registry の クリーンアップポリシー は設定済（古いイメージ自動削除）

デバッグ時はブラウザ DevTools の Disable cache を ON にし、CORS/プリフライトの挙動を確認



---

付録：コマンド集（抜粋）

# プロジェクト情報
gcloud config set project ${PROJECT_ID}
gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)"

# Functions テストデプロイ
cd functions
npm ci
firebase deploy --only functions --project ${PROJECT_ID}

# Storage CORS
gcloud storage buckets update gs://${PROJECT_ID}.firebasestorage.app --cors-file=cors.json

# プリフライト確認
curl -i -X OPTIONS \
  -H "Origin: https://<your-frontend-domain>" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" \
  "https://firebasestorage.googleapis.com/v0/b/${PROJECT_ID}.firebasestorage.app/o?name=test.txt"


---

置換用プレースホルダ

${PROJECT_ID}：online-check-in-23087

${PROJECT_NUMBER}：904673880099（例）

フロント本番URL：https://checkin-system-gules.vercel.app

Functions ベースURL：https://asia-northeast1-${PROJECT_ID}.cloudfunctions.net/api