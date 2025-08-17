'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { CheckCircle, Key, MapPin, Copy, RotateCcw, Sparkles } from 'lucide-react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import StepProgress from '@/components/StepProgress';

const ResultPage = () => {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;

  const [resultInfo, setResultInfo] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const roomNumber = searchParams.get('roomNumber');
    const passkey = searchParams.get('passkey');
    const guestName = searchParams.get('guestName');

    if (!roomNumber || !passkey) {
      router.push(`/${locale}/checkin/search`);
      return;
    }

    setResultInfo({
      roomNumber,
      passkey,
      guestName: guestName || ''
    });
  }, [searchParams, router, locale]);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      // フォールバック: テキストを選択状態にする
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  if (!resultInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-wa-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <StepProgress currentStep={4} />
      
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 成功アニメーション */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            duration: 0.8,
            type: "spring",
            bounce: 0.5
          }}
          className="text-center mb-8"
        >
          <div className="relative inline-block">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-24 h-24 bg-wa-accent-100 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle className="w-12 h-12 text-wa-accent-600" />
            </motion.div>
            
            {/* キラキラエフェクト */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-wa-accent-400 rounded-full"
                style={{
                  top: `${20 + Math.sin(i * 60 * Math.PI / 180) * 40}px`,
                  left: `${50 + Math.cos(i * 60 * Math.PI / 180) * 40}px`,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                  rotate: 360
                }}
                transition={{
                  duration: 2,
                  delay: 0.5 + i * 0.1,
                  repeat: Infinity,
                  repeatDelay: 3
                }}
              />
            ))}
          </div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-3xl sm:text-4xl font-wa-serif font-bold text-wa-neutral-800 mb-4"
          >
            {t('result.title')}
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-lg text-wa-neutral-600 mb-2"
          >
            {t('result.success')}
          </motion.p>
          
          {resultInfo.guestName && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="text-wa-primary-600 font-medium"
            >
              {resultInfo.guestName} 様
            </motion.p>
          )}
        </motion.div>

        {/* 重要な情報カード */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="card-wa p-8 mb-6 bg-wa-gradient-warm border-2 border-wa-accent-200"
        >
          <div className="flex items-center justify-center mb-6">
            <Sparkles className="w-6 h-6 text-wa-accent-600 mr-2" />
            <h2 className="text-xl font-semibold text-wa-neutral-800">
              {t('result.important')}
            </h2>
            <Sparkles className="w-6 h-6 text-wa-accent-600 ml-2" />
          </div>
          
          <div className="space-y-6">
            {/* 部屋番号 */}
            <div className="bg-white/70 rounded-wa p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-wa-secondary-100 rounded-wa flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-wa-secondary-600" />
                  </div>
                  <div>
                    <div className="text-sm text-wa-neutral-600 mb-1">
                      {t('result.roomNumber')}
                    </div>
                    <div className="text-2xl font-bold text-wa-neutral-800">
                      {resultInfo.roomNumber}
                    </div>
                  </div>
                </div>
                <motion.button
                  onClick={() => copyToClipboard(resultInfo.roomNumber, 'room')}
                  className="p-2 rounded-lg bg-wa-secondary-100 hover:bg-wa-secondary-200 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {copied === 'room' ? (
                    <CheckCircle className="w-5 h-5 text-wa-accent-600" />
                  ) : (
                    <Copy className="w-5 h-5 text-wa-secondary-600" />
                  )}
                </motion.button>
              </div>
            </div>

            {/* パスコード */}
            <div className="bg-white/70 rounded-wa p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-wa-primary-100 rounded-wa flex items-center justify-center">
                    <Key className="w-6 h-6 text-wa-primary-600" />
                  </div>
                  <div>
                    <div className="text-sm text-wa-neutral-600 mb-1">
                      {t('result.passcode')}
                    </div>
                    <div className="text-2xl font-bold text-wa-neutral-800 font-mono tracking-wider">
                      {resultInfo.passkey}
                    </div>
                  </div>
                </div>
                <motion.button
                  onClick={() => copyToClipboard(resultInfo.passkey, 'passkey')}
                  className="p-2 rounded-lg bg-wa-primary-100 hover:bg-wa-primary-200 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {copied === 'passkey' ? (
                    <CheckCircle className="w-5 h-5 text-wa-accent-600" />
                  ) : (
                    <Copy className="w-5 h-5 text-wa-primary-600" />
                  )}
                </motion.button>
              </div>
            </div>
          </div>

          {/* コピー成功メッセージ */}
          {copied && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-3 bg-wa-accent-100 rounded-wa text-center"
            >
              <span className="text-wa-accent-700 text-sm font-medium">
                {copied === 'room' ? '部屋番号' : 'パスコード'}をコピーしました！
              </span>
            </motion.div>
          )}
        </motion.div>

        {/* 使用方法の説明 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="card-wa p-6 mb-8"
        >
          <h3 className="text-lg font-semibold text-wa-neutral-800 mb-4">
            ご利用方法
          </h3>
          <div className="space-y-3 text-sm text-wa-neutral-600">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-wa-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-wa-primary-600 text-xs font-bold">1</span>
              </div>
              <div>
                表示された<strong>部屋番号</strong>にお進みください
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-wa-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-wa-primary-600 text-xs font-bold">2</span>
              </div>
              <div>
                ドアロックに<strong>パスコード</strong>を入力してください
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-wa-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-wa-primary-600 text-xs font-bold">3</span>
              </div>
              <div>
                ご滞在をお楽しみください
              </div>
            </div>
          </div>
        </motion.div>

        {/* アクションボタン */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="space-y-4"
        >
          <Link href={`/${locale}`}>
            <motion.button
              className="w-full btn-wa-primary py-4 text-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-center space-x-2">
                <CheckCircle size={20} />
                <span>完了</span>
              </div>
            </motion.button>
          </Link>
          
          <Link href={`/${locale}/checkin/search`}>
            <motion.button
              className="w-full btn-wa-outline py-3"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-center space-x-2">
                <RotateCcw size={18} />
                <span>{t('result.newCheckin')}</span>
              </div>
            </motion.button>
          </Link>
        </motion.div>

        {/* お困りの際の連絡先 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="mt-8 text-center"
        >
          <div className="text-sm text-wa-neutral-500">
            お困りの際は施設スタッフまでお気軽にお声がけください
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ResultPage;