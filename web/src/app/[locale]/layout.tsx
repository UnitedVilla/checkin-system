// web/src/app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export default async function LocaleLayout({ children, params: { locale } }: Props) {
  // 対応していない言語は404
  if (!locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="min-h-screen flex flex-col">
        {/* ヘッダー */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-wa-neutral-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-wa-primary-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">チ</span>
                </div>
                <h1 className="text-xl font-wa-serif font-semibold text-wa-neutral-800">
                  Check-in System
                </h1>
              </div>
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="flex-1">
          {children}
        </main>

        {/* フッター */}
        <footer className="bg-white/60 backdrop-blur-sm border-t border-wa-neutral-200 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center text-sm text-wa-neutral-600">
              © 2024 Online Check-in System. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </NextIntlClientProvider>
  );
}