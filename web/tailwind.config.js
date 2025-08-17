/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // 和モダンカラーパレット
        'wa-primary': {
          50: '#f8f6f3',
          100: '#f0ebe3',
          200: '#e0d5c7',
          300: '#cdb9a3',
          400: '#b8997a',
          500: '#a6825c', // メインの茶色
          600: '#967250',
          700: '#7d5e44',
          800: '#674d3a',
          900: '#544030',
        },
        'wa-secondary': {
          50: '#f4f6f8',
          100: '#e8ecf1',
          200: '#d6dde6',
          300: '#bbc7d4',
          400: '#9bacc0',
          500: '#8194ae', // 落ち着いた青
          600: '#6f7fa0',
          700: '#636e92',
          800: '#525a78',
          900: '#454a62',
        },
        'wa-accent': {
          50: '#fef7f0',
          100: '#fdeee0',
          200: '#fbd9bf',
          300: '#f7bb93',
          400: '#f19866',
          500: '#eb7644', // 温かいオレンジ
          600: '#dc5c29',
          700: '#b84820',
          800: '#933c1e',
          900: '#77331c',
        },
        'wa-neutral': {
          50: '#f9f9f8',
          100: '#f2f2f0',
          200: '#e6e5e1',
          300: '#d5d4ce',
          400: '#b8b6ae',
          500: '#9b9890', // 温かいグレー
          600: '#847f76',
          700: '#6e6862',
          800: '#5a5651',
          900: '#4a4743',
        },
        // 特別な和色
        'sumi': '#2d2d2d', // 墨色
        'kinari': '#fffffb', // 生成り
        'warai': '#f4d03f', // 山吹色
        'shinryoku': '#227d51', // 深緑
      },
      fontFamily: {
        'wa-serif': ['Noto Serif JP', 'Georgia', 'serif'],
        'wa-sans': ['Noto Sans JP', 'Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.8s ease-out',
        'slide-down': 'slideDown 0.6s ease-out',
        'scale-in': 'scaleIn 0.5s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'gradient-x': 'gradient-x 15s ease infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          },
        },
        shimmer: {
          '0%': {
            'background-position': '-200% 0'
          },
          '100%': {
            'background-position': '200% 0'
          }
        },
      },
      backgroundImage: {
        'wa-gradient': 'linear-gradient(135deg, #f8f6f3 0%, #e8ecf1 100%)',
        'wa-gradient-warm': 'linear-gradient(135deg, #fef7f0 0%, #f8f6f3 50%, #e8ecf1 100%)',
        'wa-gradient-deep': 'linear-gradient(135deg, #2d2d2d 0%, #454a62 100%)',
        'shimmer-gradient': 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
      },
      boxShadow: {
        'wa-soft': '0 4px 12px rgba(45, 45, 45, 0.08)',
        'wa-medium': '0 8px 24px rgba(45, 45, 45, 0.12)',
        'wa-strong': '0 16px 40px rgba(45, 45, 45, 0.16)',
        'wa-inner': 'inset 0 2px 4px rgba(45, 45, 45, 0.06)',
      },
      borderRadius: {
        'wa': '12px',
        'wa-lg': '16px',
        'wa-xl': '20px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
};