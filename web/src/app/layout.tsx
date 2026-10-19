import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import './globals.css';

const noto = Noto_Sans_JP({ variable: '--font-noto', subsets: ['latin'], weight: ['400', '500', '700', '800'] });

export const metadata: Metadata = {
  title: 'らくらくエントリー',
  description: '就活の情報をひとつにまとめる',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ja" className={`${noto.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
