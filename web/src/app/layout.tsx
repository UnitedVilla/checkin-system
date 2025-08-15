import './globals.css'

// ルートレイアウト（必須）
export const metadata = {
    title: 'Online Check-in',
    description: 'Guest online check-in',
  };
  
  export default function RootLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <html lang="ja">
        <body>{children}</body>
      </html>
    );
  }