// web/src/i18n.ts
import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

// 対応言語
export const locales = ['en', 'ja', 'zh', 'ko'] as const;
export type Locale = typeof locales[number];

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocaleを使用（新しいAPI）
  const locale = await requestLocale;
  
  // 対応していない言語の場合は404
  if (!locale || !locales.includes(locale as any)) notFound();

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});