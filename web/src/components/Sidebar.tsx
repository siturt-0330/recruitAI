'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Building2, ExternalLink, Home, IdCard } from 'lucide-react';
import { SITE_URL } from '@/lib/site-url';

/** external は公式サイトのページ（SPI 用語集）。tab はスマホの下のタブに出す短い名前 */
const NAV = [
  { href: '/', label: 'ホーム', tab: 'ホーム', icon: Home },
  { href: '/companies', label: 'マイページ', tab: 'マイページ', icon: Building2 },
  { href: `${SITE_URL}/game`, label: 'SPI 用語集', tab: 'SPI', icon: BookOpen, external: true },
  { href: '/profile', label: 'プロフィール', tab: 'プロフィール', icon: IdCard },
];

export function Sidebar() {
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href) || (href === '/companies' && path.startsWith('/board')));

  return (
    <aside className="sticky top-0 flex h-screen flex-col items-center gap-1 px-3 py-4 xl:items-stretch">
      <Link href="/" className="mb-4 flex items-center gap-2.5 px-2 py-1">
        <span className="orb h-8 w-8" />
        <span className="hidden whitespace-nowrap text-[15px] font-extrabold xl:inline">らくらくエントリー</span>
      </Link>
      {NAV.map(({ href, label, icon: Icon, external }) => {
        const on = !external && active(href);
        const className = `flex h-12 items-center gap-4 rounded-full px-3 text-[15px] transition-colors hover:bg-fill xl:px-4 ${
          on ? 'bg-indbg font-bold text-indtext' : 'text-ink'
        }`;
        const inner = (
          <>
            <Icon size={22} strokeWidth={on ? 2.4 : 1.8} className={on ? 'text-ind' : ''} />
            <span className="hidden xl:inline">{label}</span>
            {external && <ExternalLink size={14} className="ml-auto hidden text-mute xl:inline" />}
          </>
        );
        return external ? (
          <a key={href} href={href} title={label} className={className}>
            {inner}
          </a>
        ) : (
          <Link key={href} href={href} title={label} className={className}>
            {inner}
          </Link>
        );
      })}
    </aside>
  );
}

/** スマホの下のタブ（移動だけ） */
export function TabBar() {
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href) || (href === '/companies' && path.startsWith('/board')));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t-[0.5px] border-[#d1d1d6] bg-[rgba(249,249,251,.94)] pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {NAV.map(({ href, tab, icon: Icon, external }) => {
        const on = !external && active(href);
        const className = `flex h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${on ? 'text-ind' : 'text-[#8e8e93]'}`;
        const inner = (
          <>
            <Icon size={23} strokeWidth={on ? 2.3 : 1.8} />
            {tab}
          </>
        );
        return external ? (
          <a key={href} href={href} className={className}>
            {inner}
          </a>
        ) : (
          <Link key={href} href={href} className={className}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
