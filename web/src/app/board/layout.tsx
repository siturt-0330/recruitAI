import type { Metadata } from 'next';

export const metadata: Metadata = { title: '企業ボード' };

export default function Layout({ children }: LayoutProps<'/board'>) {
  return children;
}
