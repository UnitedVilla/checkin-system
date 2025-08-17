'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, FileImage, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { ref, uploadBytes } from 'firebase/storage';
import { getFirebaseAuth, getFirebaseStorage } from '@/lib/firebase';
import Link from 'next/link';
import StepProgress from '@/components/StepProgress';

type SessionPayload = {
  sessionId: string;
  uploadBasePath: string;
  expectedUploads: number;
  customToken: string;
};

const UploadPage = () => {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;

  const [reservationInfo, setReservationInfo] = useState<any>(null);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const API = process.env.NEXT_PUBLIC_API_BASE || '';

  useEffect(() => {
    // URLパラメータから予約情報を取得
    const reservationId = searchParams.get('reservationId');
    const guestName = searchParams.get('guestName');
    const guestCount = searchParams.get('guestCount');
    const roomNumber = searchParams.get('roomNumber');

    if (!reservationId || !guestName) {
      router.push(`/${locale}/checkin/search`);
      return;
    }

    setReservationInfo({
      reservationId,
      guestName,
      guestCount: parseInt(guestCount || '1'),
      roomNumber
    });
  }, [searchParams, router, locale]);

  const startCheckin = async () => {
    if (!reservationInfo) return;
    
    setIsStarting(true);
    try {
      const res = await fetch(`${API}/startCheckin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: reservationInfo.reservationId }),
      });
      
      const sessionData: SessionPayload = await res.json();
      if (!res.ok || !sessionData.sessionId || !sessionData.customToken) {
        throw new Error((sessionData as any)?.error || 'チェックイン開始に失敗しました');
      }

      // Firebase Authにサインイン
      const auth = getFirebaseAuth();
      await signInWithCustomToken(auth, sessionData.customToken);
      await auth.currentUser?.getIdToken(true);

      setSession(sessionData);
    } catch (e: any) {
      alert(e?.message || e);
    } finally {
      setIsStarting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
  };

  const handleUpload = async () => {
    if (!session || files.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const storage = getFirebaseStorage();
      const MAX_SIZE = 8 * 1024 * 1024; // 8MB

      // ファイル検証
      for (const file of files) {
        if (!/^image\//.test(file.type)) {
          throw new Error(t('errors.invalidFile', { filename: file.name }));
        }
        if (file.size > MAX_SIZE) {
          const sizeMB = (file.size / 1024 / 1024).toFixed(1);
          throw new Error(t('errors.fileTooLarge', { size: sizeMB, filename: file.name }));
        }
      }

      const uploadedPaths: string[] = [];
      
      // ファイルアップロード
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.type.includes('png') ? 'png'
                  : file.type.includes('webp') ? 'webp'
                  : 'jpg';
        const filename = i === 0 ? `face-1.${ext}` : `passport-${i}.${ext}`;
        const path = `${session.uploadBasePath}${filename}`;

        await uploadBytes(ref(storage, path), file, { contentType: file.type });
        uploadedPaths.push(path);
        
        setUploadProgress(((i + 1) / files.length) * 100);
      }

      // 完了API呼び出し
      const res = await fetch(`${API}/uploadPhotos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: session.sessionId, 
          uploadedPaths 
        }),
      });
      
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result?.error || '完了APIでエラーが発生しました');
      }

      // 結果ページに遷移
      const resultParams = new URLSearchParams();
      resultParams.set('roomNumber', result.roomNumber);
      resultParams.set('passkey', result.passkey);
      resultParams.set('guestName', reservationInfo.guestName);
      
      router.push(`/${locale}/checkin/result?${resultParams.toString()}`);
      
    } catch (e: any) {
      alert(t('errors.uploadFailed', { message: e?.message || e }));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (!reservationInfo) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-wa-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p>{t('common.loading')}</p>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen py-8">
      <StepProgress currentStep={3} />
      
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-wa-accent-100 rounded-wa-lg mb-4"
          >
            <Camera className="w-8 h-8 text-wa-accent-600" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-wa-serif font-bold text-wa-neutral-800 mb-2">
            {t('upload.title')}
          </h1>
          <p className="text-wa-neutral-600">
            {t('upload.instruction')}
          </p>
        </motion.div>

        {/* 予約情報表示 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="card-wa p-6 mb-6"
        >
          <h3 className="font-semibold text-wa-neutral-800 mb-3">予約情報</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-wa-neutral-600">お名前:</span>
              <div className="font-medium">{reservationInfo.guestName}</div>
            </div>
            <div>
              <span className="text-wa-neutral-600">人数:</span>
              <div className="font-medium">{reservationInfo.guestCount}名</div>
            </div>
          </div>
        </motion.div>

        {!session ? (
          /* チェックイン開始 */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="card-wa p-8 text-center"
          >
            <div className="mb-6">
              <CheckCircle className="w-12 h-12 text-wa-primary-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-wa-neutral-800 mb-2">
                チェックイン準備完了
              </h3>
              <p className="text-wa-neutral-600 text-sm">
                書類撮影を開始するには、下のボタンをクリックしてください
              </p>
            </div>
            
            <motion.button
              onClick={startCheckin}
              disabled={isStarting}
              className="btn-wa-primary py-4 px-8 text-lg w-full sm:w-auto"
              whileHover={{ scale: isStarting ? 1 : 1.05 }}
              whileTap={{ scale: isStarting ? 1 : 0.95 }}
            >
              {isStarting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>準備中...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <Camera size={20} />
                  <span>撮影開始</span>
                </div>
              )}
            </motion.button>
          </motion.div>
        ) : (
          /* ファイルアップロード */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            {/* セッション情報 */}
            <div className="card-wa p-4 bg-wa-gradient-warm">
              <div className="text-sm">
                <div className="text-wa-neutral-600">{t('upload.sessionId', { id: session.sessionId })}</div>
                <div className="text-wa-neutral-600">{t('upload.expectedUploads', { count: session.expectedUploads })}</div>
              </div>
            </div>

            {/* 撮影ガイド */}
            <div className="card-wa p-6">
              <h3 className="font-semibold text-wa-neutral-800 mb-4">撮影ガイド</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-wa-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-wa-primary-600 font-bold text-xs">1</span>
                  </div>
                  <div>
                    <strong>{t('upload.facePhoto')}</strong>
                    <p className="text-wa-neutral-600 mt-1">正面を向いた鮮明な顔写真</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-wa-secondary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-wa-secondary-600 font-bold text-xs">2</span>
                  </div>
                  <div>
                    <strong>{t('upload.passportPhoto')}</strong>
                    <p className="text-wa-neutral-600 mt-1">身分証明書の写真面</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ファイル選択 */}
            <div className="card-wa p-6">
              <label className="block">
                <div className="border-2 border-dashed border-wa-neutral-300 rounded-wa-lg p-8 text-center hover:border-wa-primary-400 transition-colors cursor-pointer">
                  <FileImage className="w-12 h-12 text-wa-neutral-400 mx-auto mb-4" />
                  <div className="text-lg font-medium text-wa-neutral-700 mb-2">
                    {t('upload.selectFiles')}
                  </div>
                  <div className="text-sm text-wa-neutral-500">
                    JPG, PNG, WEBP (最大8MB)
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              
              {files.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4"
                >
                  <div className="text-sm text-wa-neutral-600 mb-2">
                    {t('upload.filesSelected', { count: files.length })}
                  </div>
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-wa-neutral-50 rounded">
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-wa-neutral-500">
                          {(file.size / 1024 / 1024).toFixed(1)}MB
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* アップロードボタン */}
            <motion.button
              onClick={handleUpload}
              disabled={files.length === 0 || isUploading}
              className="w-full btn-wa-accent py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: files.length === 0 || isUploading ? 1 : 1.02 }}
              whileTap={{ scale: files.length === 0 || isUploading ? 1 : 0.98 }}
            >
              {isUploading ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center space-x-2">
                    <Upload size={20} />
                    <span>アップロード中... {Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-white/30 rounded-full h-2">
                    <motion.div
                      className="bg-white h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <Upload size={20} />
                  <span>{t('upload.uploadButton')}</span>
                </div>
              )}
            </motion.button>
          </motion.div>
        )}

        {/* 戻るボタン */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8"
        >
          <Link href={`/${locale}/checkin/select?reservationId=${reservationInfo?.reservationId}&guestName=${reservationInfo?.guestName}&guestCount=${reservationInfo?.guestCount}&roomNumber=${reservationInfo?.roomNumber}`}>
            <motion.button
              className="w-full btn-wa-outline py-3"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-center space-x-2">
                <ArrowLeft size={18} />
                <span>{t('common.back')}</span>
              </div>
            </motion.button>
          </Link>
        </motion.div>

        {/* 注意事項 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-8 card-wa p-6"
        >
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-wa-accent-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-wa-neutral-600">
              <strong>ご注意:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>写真は鮮明で、顔がはっきりと見えるものをご使用ください</li>
                <li>身分証明書は文字が読み取れる解像度でお撮りください</li>
                <li>ファイルサイズは8MB以下にしてください</li>
                <li>アップロード完了まで画面を閉じないでください</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default UploadPage;