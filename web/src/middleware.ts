// web/src/middleware.ts
import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n';

export default createMiddleware({
  // 対応言語のリスト
  locales,
  
  // デフォルト言語（英語）
  defaultLocale: 'en',
  
  // パスに言語プレフィックスを常に表示
  localePrefix: 'always'
});

export const config = {
  // 国際化が必要なパスを指定
  matcher: [
    // すべてのパスに適用（API routes, _next/static, _next/image, faviconを除く）
    '/((?!api|_next/static|_next/image|favicon.ico).*)'
  ]
};