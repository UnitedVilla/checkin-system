'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { CheckCircle, Users, Calendar, MapPin, ArrowLeft } from 'lucide-react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import StepProgress from '@/components/StepProgress';

type Match = {
  reservationId: string;
  date: string;
  roomNumber: string;
  guestName: string;
  guestCount: number;
  status: string;
};

const SelectPage = () => {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;

  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<Match | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // URLパラメータから予約情報を取得
    const matchesParam = searchParams.get('matches');
    const reservationId = searchParams.get('reservationId');
    
    if (matchesParam) {
      // 複数の予約がある場合
      try {
        const parsedMatches = JSON.parse(matchesParam);
        setMatches(parsedMatches);
      } catch (e) {
        console.error('Failed to parse matches:', e);
        router.push(`/${locale}/checkin/search`);
      }
    } else if (reservationId) {
      // 単一の予約の場合
      const match: Match = {
        reservationId,
        guestName: searchParams.get('guestName') || '',
        guestCount: parseInt(searchParams.get('guestCount') || '1'),
        roomNumber: searchParams.get('roomNumber') || '',
        date: searchParams.get('date') || '',
        status: 'confirmed'
      };
      setMatches([match]);
      setSelectedReservation(match);
    } else {
      // パラメータがない場合は検索ページに戻る
      router.push(`/${locale}/checkin/search`);
    }
  }, [searchParams, router, locale]);

  const handleConfirm = async () => {
    if (!selectedReservation) return;
    
    setIsLoading(true);
    
    try {
      // アップロードページに遷移
      const uploadParams = new URLSearchParams();
      uploadParams.set('reservationId', selectedReservation.reservationId);
      uploadParams.set('guestName', selectedReservation.guestName);
      uploadParams.set('guestCount', selectedReservation.guestCount.toString());
      uploadParams.set('roomNumber', selectedReservation.roomNumber);
      
      router.push(`/${locale}/checkin/upload?${uploadParams.toString()}`);
    } catch (e: any) {
      alert(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-8">
      <StepProgress currentStep={2} />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
            className="inline-flex items-center justify-center w-16 h-16 bg-wa-secondary-100 rounded-wa-lg mb-4"
          >
            <CheckCircle className="w-8 h-8 text-wa-secondary-600" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-wa-serif font-bold text-wa-neutral-800 mb-2">
            {t('select.title')}
          </h1>
          <p className="text-wa-neutral-600">
            {matches.length > 1 
              ? t('search.reservationFound', { count: matches.length })
              : '予約内容をご確認ください'
            }
          </p>
        </motion.div>

        {/* 予約一覧 */}
        <div className="space-y-4 mb-8">
          {matches.map((match, index) => (
            <motion.div
              key={match.reservationId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`card-wa p-6 cursor-pointer transition-all duration-300 ${
                selectedReservation?.reservationId === match.reservationId
                  ? 'ring-2 ring-wa-primary-400 bg-wa-primary-50/50'
                  : 'hover:shadow-wa-medium'
              }`}
              onClick={() => setSelectedReservation(match)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-4 mb-3">
                    <h3 className="text-xl font-semibold text-wa-neutral-800">
                      {match.guestName}
                    </h3>
                    {selectedReservation?.reservationId === match.reservationId && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 bg-wa-primary-500 rounded-full flex items-center justify-center"
                      >
                        <CheckCircle className="w-4 h-4 text-white" />
                      </motion.div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center text-wa-neutral-600">
                      <Calendar size={16} className="mr-2 text-wa-primary-500" />
                      <span>{match.date}</span>
                    </div>
                    <div className="flex items-center text-wa-neutral-600">
                      <MapPin size={16} className="mr-2 text-wa-secondary-500" />
                      <span>{t('select.room', { number: match.roomNumber })}</span>
                    </div>
                    <div className="flex items-center text-wa-neutral-600">
                      <Users size={16} className="mr-2 text-wa-accent-500" />
                      <span>{t('select.guestCount', { count: match.guestCount })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* アクションボタン */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Link href={`/${locale}/checkin/search`} className="flex-1">
            <motion.button
              className="w-full btn-wa-outline py-4 text-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-center space-x-2">
                <ArrowLeft size={20} />
                <span>{t('common.back')}</span>
              </div>
            </motion.button>
          </Link>
          
          <motion.button
            onClick={handleConfirm}
            disabled={!selectedReservation || isLoading}
            className="flex-1 btn-wa-primary py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: !selectedReservation || isLoading ? 1 : 1.02 }}
            whileTap={{ scale: !selectedReservation || isLoading ? 1 : 0.98 }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('common.loading')}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <CheckCircle size={20} />
                <span>{t('select.confirmButton')}</span>
              </div>
            )}
          </motion.button>
        </motion.div>

        {/* 選択された予約の詳細表示 */}
        {selectedReservation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-8 card-wa p-6 bg-wa-gradient-warm"
          >
            <h3 className="text-lg font-semibold text-wa-neutral-800 mb-4">
              選択中の予約詳細
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-wa-neutral-600">予約ID:</span>
                <div className="font-mono text-wa-neutral-800 mt-1">
                  {selectedReservation.reservationId}
                </div>
              </div>
              <div>
                <span className="text-wa-neutral-600">ステータス:</span>
                <div className="text-wa-accent-600 font-medium mt-1">
                  確認済み
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SelectPage;