'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ChevronRight, Camera, Shield, Clock } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const HomePage = () => {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;

  const features = [
    {
      icon: Camera,
      title: 'デジタル撮影',
      description: '簡単な写真撮影でスムーズなチェックイン',
    },
    {
      icon: Shield,
      title: 'セキュア',
      description: 'あなたの情報を安全に保護',
    },
    {
      icon: Clock,
      title: '24時間対応',
      description: 'いつでもチェックイン可能',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* ヒーローセクション */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 wa-bg-pattern opacity-60" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mb-8"
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-wa-serif font-bold text-wa-neutral-800 mb-6">
                <span className="block">{t('home.title')}</span>
              </h1>
              <p className="text-lg sm:text-xl text-wa-neutral-600 max-w-3xl mx-auto leading-relaxed">
                {t('home.subtitle')}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-16"
            >
              <Link href={`/${locale}/checkin/search`}>
                <motion.button
                  className="btn-wa-primary text-lg px-8 py-4 inline-flex items-center space-x-3"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>{t('home.startCheckin')}</span>
                  <ChevronRight size={20} />
                </motion.button>
              </Link>
            </motion.div>

            {/* 特徴カード */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
            >
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  className="card-wa p-6 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
                  whileHover={{ 
                    scale: 1.05,
                    transition: { duration: 0.2 }
                  }}
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-wa-primary-100 rounded-wa mb-4">
                    <feature.icon className="w-6 h-6 text-wa-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-wa-neutral-800 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-wa-neutral-600 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* 装飾的な要素 */}
        <motion.div
          className="absolute top-20 left-10 w-20 h-20 bg-wa-accent-200 rounded-full opacity-20"
          animate={{ 
            y: [0, -20, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-16 h-16 bg-wa-secondary-200 rounded-full opacity-20"
          animate={{ 
            y: [0, 20, 0],
            scale: [1, 0.9, 1]
          }}
          transition={{ 
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        />
      </section>

      {/* プロセス説明セクション */}
      <section className="py-20 bg-white/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-wa-serif font-bold text-wa-neutral-800 mb-4">
              簡単3ステップ
            </h2>
            <p className="text-lg text-wa-neutral-600 max-w-2xl mx-auto">
              {t('home.description')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: '予約検索', desc: '日付と氏名で予約を検索' },
              { step: '02', title: '書類撮影', desc: '顔写真とIDを撮影' },
              { step: '03', title: 'チェックイン完了', desc: '部屋番号とパスコードを取得' },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-wa-gradient-warm rounded-full mb-6 font-wa-serif font-bold text-wa-primary-700 text-lg">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-wa-neutral-800 mb-3">
                  {item.title}
                </h3>
                <p className="text-wa-neutral-600">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;