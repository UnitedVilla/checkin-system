import { setRequestLocale } from 'next-intl/server';
import { locales } from '@/i18n';
import SelectPageClient from './ResultPageClient';

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function SelectPage({ params }: Props) {
  const { locale } = await params;
  
  // 静的レンダリングを有効にする
  setRequestLocale(locale);

  return <SelectPageClient />;
}