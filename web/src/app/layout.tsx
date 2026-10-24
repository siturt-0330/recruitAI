import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import './globals.css';

const noto = Noto_Sans_JP({ variable: '--font-noto', subsets: ['latin'], weight: ['400', '500', '700', '800'] });

const description = '受けている会社のマイページ・ID・選考状況・締切をひとつにまとめる、就活生のための無料の Web 版。Chrome 拡張機能と組み合わせると、マイページの ID とパスワードも自動で入力できます。';

// 検索には載せない（web/public/_headers の X-Robots-Tag: noindex）。タブの名前と、SNS などでリンクを共有したときの見え方だけ整える
export const metadata: Metadata = {
  metadataBase: new URL('https://app.rakuraku-entry.com'),
  title: { default: 'マイページ管理｜らくらくエントリー', template: '%s｜らくらくエントリー' },
  description,
  applicationName: 'らくらくエントリー',
  openGraph: {
    type: 'website',
    siteName: 'らくらくエントリー',
    locale: 'ja_JP',
    title: 'マイページ管理｜らくらくエントリー',
    description,
    images: [{ url: 'https://rakuraku-entry.com/images/mypage.png', width: 1440, height: 640, alt: 'マイページ管理の画面' }],
  },
  twitter: { card: 'summary_large_image' },
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
