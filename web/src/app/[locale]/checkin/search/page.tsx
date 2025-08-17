'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Search, Calendar, User } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import StepProgress from '@/components/StepProgress';

type Match = {
  reservationId: string;
  date: string;
  roomNumber: string;
  guestName: string;
  guestCount: number;
  status: string;
};

const SearchPage = () => {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [name, setName] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_BASE || '';

  const handleSearch = async () => {
    if (!API) {
      alert(t('errors.apiNotConfigured'));
      return;
    }

    setIsSearching(true);
    setHasSearched(false);
    
    try {
      const res = await fetch(`${API}/searchReservation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, name }),
      });
      
      const text = await res.text();
      let json: any;
      try { 
        json = JSON.parse(text); 
      } catch { 
        throw new Error(text); 
      }
      
      if (!res.ok) {
        throw new Error(json?.detail || text);
      }

      const list: Match[] = json.matches || [];
      setMatches(list);
      setHasSearched(true);
      
      if (list.length === 0) {
        // 結果なしの場合は何もしない（UIで表示）
      } else if (list.length === 1) {
        // 1件の場合は自動的に選択ページへ
        const searchParams = new URLSearchParams();
        searchParams.set('reservationId', list[0].reservationId);
        searchParams.set('guestName', list[0].guestName);
        searchParams.set('guestCount', list[0].guestCount.toString());
        searchParams.set('roomNumber', list[0].roomNumber);
        searchParams.set('date', list[0].date);
        
        router.push(`/${locale}/checkin/select?${searchParams.toString()}`);
      } else {
        // 複数件の場合は選択ページへ
        const searchParams = new URLSearchParams();
        searchParams.set('matches', JSON.stringify(list));
        router.push(`/${locale}/checkin/select?${searchParams.toString()}`);
      }
    } catch (e: any) {
      alert(t('errors.searchFailed', { message: e?.message || e }));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen py-8">
      <StepProgress currentStep={1} />
      
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="card-wa p-8"
        >
          {/* ヘッダー */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center justify-center w-16 h-16 bg-wa-primary-100 rounded-wa-lg mb-4"
            >
              <Search className="w-8 h-8 text-wa-primary-600" />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-wa-serif font-bold text-wa-neutral-800 mb-2">
              {t('search.title')}
            </h1>
            <p className="text-wa-neutral-600">
              {t('search.checkInDate')}と{t('search.guestName')}を入力してください
            </p>
          </div>

          {/* フォーム */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-6"
          >
            {/* チェックイン日 */}
            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-wa-neutral-700">
                <Calendar size={16} className="mr-2" />
                {t('search.checkInDate')}
              </label>
              <motion.input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-wa"
                whileFocus={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              />
            </div>

            {/* 代表者氏名 */}
            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-wa-neutral-700">
                <User size={16} className="mr-2" />
                {t('search.guestName')}
              </label>
              <motion.input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('search.guestNamePlaceholder')}
                className="input-wa"
                whileFocus={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            {/* 検索ボタン */}
            <motion.button
              onClick={handleSearch}
              disabled={isSearching || !date || !name.trim()}
              className="w-full btn-wa-primary py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: isSearching ? 1 : 1.02 }}
              whileTap={{ scale: isSearching ? 1 : 0.98 }}
            >
              {isSearching ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t('common.loading')}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <Search size={20} />
                  <span>{t('search.searchButton')}</span>
                </div>
              )}
            </motion.button>
          </motion.div>

          {/* 検索結果表示（結果なしの場合のみ） */}
          {hasSearched && matches.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-6 p-4 bg-wa-accent-50 border border-wa-accent-200 rounded-wa text-center"
            >
              <div className="text-wa-accent-700 font-medium">
                {t('search.noReservationFound')}
              </div>
              <div className="text-sm text-wa-accent-600 mt-1">
                入力内容をご確認の上、再度お試しください
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* ヘルプセクション */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 card-wa p-6"
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
                <strong>チェックイン日を選択</strong><br />
                宿泊予定日を正確に選択してください
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-wa-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-wa-primary-600 text-xs font-bold">2</span>
              </div>
              <div>
                <strong>代表者氏名を入力</strong><br />
                予約時に登録された代表者のお名前を入力してください
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-wa-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-wa-primary-600 text-xs font-bold">3</span>
              </div>
              <div>
                <strong>検索実行</strong><br />
                該当する予約が見つかったら、次のステップに進みます
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SearchPage;