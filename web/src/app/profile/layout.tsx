import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'プロフィール' };

export default function Layout({ children }: LayoutProps<'/profile'>) {
  return children;
}
