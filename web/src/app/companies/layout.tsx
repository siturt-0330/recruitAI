import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'マイページ' };

export default function Layout({ children }: LayoutProps<'/companies'>) {
  return children;
}
