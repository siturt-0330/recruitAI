'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Calendar, Home, IdCard } from 'lucide-react';

const NAV = [
  { href: '/', label: 'ホーム', icon: Home },
  { href: '/companies', label: '企業', icon: Building2 },
  { href: '/schedule', label: '予定', icon: Calendar },
  { href: '/profile', label: 'プロフィール', icon: IdCard },
];

export function Sidebar() {
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href) || (href === '/companies' && path.startsWith('/board')));

  return (
    <aside className="sticky top-0 flex h-screen flex-col items-center gap-1 px-3 py-4 xl:items-stretch">
      <Link href="/" className="mb-4 flex items-center gap-2.5 px-2 py-1">
        <span className="orb h-8 w-8" />
        <span className="hidden text-lg font-extrabold xl:inline">Sophon</span>
      </Link>
      {NAV.map(({ href, label, icon: Icon }) => {
        const on = active(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={`flex h-12 items-center gap-4 rounded-full px-3 text-[15px] transition-colors hover:bg-fill xl:px-4 ${
              on ? 'bg-indbg font-bold text-indtext' : 'text-ink'
            }`}
          >
            <Icon size={22} strokeWidth={on ? 2.4 : 1.8} className={on ? 'text-ind' : ''} />
            <span className="hidden xl:inline">{label}</span>
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
      {NAV.map(({ href, label, icon: Icon }) => {
        const on = active(href);
        return (
          <Link key={href} href={href} className={`flex h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${on ? 'text-ind' : 'text-[#8e8e93]'}`}>
            <Icon size={23} strokeWidth={on ? 2.3 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
