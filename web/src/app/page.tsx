// web/src/app/page.tsx
import { redirect } from 'next/navigation';

export default function RootPage() {
  // デフォルト言語（英語）にリダイレクト
  redirect('/en');
}