'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';
import { locales } from '@/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const LanguageSwitcher = () => {
  const t = useTranslations('languages');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = (newLocale: string) => {
    const segments = pathname.split('/');
    segments[1] = newLocale; // [locale]の部分を置換
    const newPath = segments.join('/');
    router.push(newPath);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 lang-btn"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Globe size={16} />
        <span className="hidden sm:inline">{t(locale as any)}</span>
        <span className="sm:hidden">{locale.toUpperCase()}</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* オーバーレイ */}
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            
            {/* ドロップダウンメニュー */}
            <motion.div
              className="absolute right-0 mt-2 w-48 bg-white/90 backdrop-blur-md rounded-wa shadow-wa-medium border border-wa-neutral-200 z-50"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="py-2">
                {locales.map((lang) => (
                  <motion.button
                    key={lang}
                    onClick={() => handleLanguageChange(lang)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${
                      locale === lang
                        ? 'bg-wa-primary-50 text-wa-primary-700 font-medium'
                        : 'text-wa-neutral-700 hover:bg-wa-neutral-50'
                    }`}
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{t(lang as any)}</span>
                      {locale === lang && (
                        <motion.div
                          className="w-2 h-2 bg-wa-primary-500 rounded-full"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.1 }}
                        />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSwitcher;