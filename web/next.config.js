// web/next.config.js
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // デフォルト言語を英語に設定
  experimental: {
    typedRoutes: true,
  },
};

module.exports = withNextIntl(nextConfig);