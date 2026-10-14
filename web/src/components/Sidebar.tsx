'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, FileText, Home, IdCard, LayoutGrid, MessageCircle, UserSearch } from 'lucide-react';

const NAV = [
  { href: '/', label: 'ホーム', icon: Home },
  { href: '/board', label: '企業ボード', icon: LayoutGrid },
  { href: '/interviews', label: '面接ログ', icon: MessageCircle },
  { href: '/self-analysis', label: '自己分析', icon: UserSearch },
  { href: '/es', label: 'ES', icon: FileText },
  { href: '/schedule', label: '予定', icon: Calendar },
  { href: '/profile', label: 'プロフィール', icon: IdCard },
];

export function Sidebar() {
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href) || (href === '/board' && path.startsWith('/companies')));

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
