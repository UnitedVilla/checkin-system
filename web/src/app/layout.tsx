// web/src/app/layout.tsx (ルートレイアウト)
import './globals.css';

export const metadata = {
  title: 'Online Check-in System',
  description: 'Guest online check-in experience',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body className="wa-bg-pattern">{children}</body>
    </html>
  );
}