'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Building2, ExternalLink, KeyRound, Plus } from 'lucide-react';
import { CompanyPage, openCompanyMypage } from '@/components/CompanyPage';
import { Button, CompanyLogo, Empty } from '@/components/ui';
import { useExtension } from '@/lib/extension';
import { companyHref } from '@/lib/links';
import { logoByName, logoFor } from '@/lib/logo';
import { emptyCompany } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { Company } from '@/lib/types';

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** このページを開いている間に、ロゴを探した会社（見つからなくても何度も探さない） */
const tried = new Set<string>();

/** 会社のページを右に出せる幅か（狭い画面では1ページ全体で開く） */
function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

/**
 * 受けている企業のマイページ一覧。会社を押すと、右側に Notion のような会社のページが開く。
 * パスワードはこのページには来ない（拡張機能の中にだけある）。
 */
export default function CompaniesPage() {
  // URL の ?id= を読むので Suspense で包む（HTML を書き出すときの決まり）
  return (
    <Suspense>
      <CompaniesView />
    </Suspense>
  );
}

function CompaniesView() {
  const router = useRouter();
  const params = useSearchParams();
  const wide = useWide();
  // 開いている会社は URL（/companies?id=...）で持つ。ホームや予定のリンクからも開ける
  const selected = params.get('id') ?? '';
  const full = params.get('full') === '1' || !wide;
  const { companies, upsertCompany } = useStore();
  const { connected, notice } = useExtension();
  const [name, setName] = useState('');

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => useExtension.setState({ notice: '' }), 2400);
    return () => clearTimeout(t);
  }, [notice]);

  // 会社名を打ち終わったら、少し待ってからロゴを探して入力欄の左に出す
  const [preview, setPreview] = useState<{ name: string; logo: string; loading: boolean }>({ name: '', logo: '', loading: false });
  useEffect(() => {
    const n = name.trim();
    if (!n) return setPreview({ name: '', logo: '', loading: false });
    setPreview((p) => ({ name: n, logo: p.name === n ? p.logo : '', loading: true }));
    let alive = true;
    const t = setTimeout(async () => {
      const logo = await logoByName(n);
      if (alive) setPreview({ name: n, logo, loading: false });
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [name]);

  // ロゴのない会社（拡張機能から入った会社など）は、裏で順番に探しておく
  useEffect(() => {
    const todo = companies.filter((c) => !c.logo && !tried.has(c.id));
    if (!todo.length) return;
    todo.forEach((c) => tried.add(c.id));
    (async () => {
      for (const c of todo) {
        const logo = await logoFor(c);
        if (logo) useStore.getState().patchCompany(c.id, { logo });
      }
    })();
  }, [companies]);

  const select = (id: string) => router.push(companyHref(id));
  const close = () => router.push('/companies');

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const c = { ...emptyCompany(n), logo: preview.name === n ? preview.logo : '' };
    upsertCompany(c);
    setName('');
    select(c.id);
  };

  // 新しく追加した会社が上に来るように（並びは作った順。書き換えても動かない）
  const sorted = [...companies].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const current = companies.find((c) => c.id === selected);

  if (selected && full) {
    return current ? (
      <CompanyPage key={current.id} company={current} mode="full" onClose={close} />
    ) : (
      <Empty
        title="企業が見つかりません"
        action={
          <Link href="/companies" className="font-bold text-link">
            マイページへ
          </Link>
        }
      />
    );
  }

  return (
    <div className={current ? 'lg:grid lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]' : ''}>
      <div className={current ? 'px-4 py-6 md:px-5' : 'mx-auto max-w-2xl px-4 py-6 md:px-6'}>
        <div className="mb-5 flex items-center gap-3">
          <h1 className="flex-1 text-[28px] font-extrabold tracking-tight">マイページ</h1>
          {connected && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-okbg px-3 py-1 text-xs font-bold text-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              拡張機能と連携中
            </span>
          )}
        </div>

        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="relative flex min-w-0 flex-1 items-center">
            <span className="pointer-events-none absolute left-2 flex h-8 w-8 items-center justify-center">
              {preview.name ? (
                <span className={preview.loading && !preview.logo ? 'animate-pulse' : ''}>
                  <CompanyLogo company={{ name: preview.name, logo: preview.logo }} size={30} />
                </span>
              ) : (
                <Building2 size={18} className="text-mute" />
              )}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="会社名を入力"
              className="h-12 w-full rounded-xl border border-box pl-12 pr-4 text-[15px] outline-none focus:border-ind"
            />
          </label>
          <Button variant="primary" className="h-12" disabled={!name.trim()}>
            <Plus size={16} />
            追加
          </Button>
        </form>

        {sorted.length > 0 && (
          <ul className="overflow-hidden rounded-2xl border border-line">
            {sorted.map((c) => (
              <Row key={c.id} company={c} active={c.id === selected} connected={connected} onSelect={() => select(c.id)} />
            ))}
          </ul>
        )}
      </div>

      {current && (
        <aside className="hidden border-l border-line lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto">
            <CompanyPage key={current.id} company={current} mode="peek" onClose={close} />
          </div>
        </aside>
      )}

      {notice && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white shadow-lg md:bottom-8">
          {notice}
        </div>
      )}
    </div>
  );
}

function Row({ company: c, active, connected, onSelect }: { company: Company; active: boolean; connected: boolean; onSelect(): void }) {
  return (
    <li className={`group flex items-center border-b border-line last:border-b-0 ${active ? 'bg-fill' : 'hover:bg-fill'}`}>
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left">
        <CompanyLogo company={c} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold">{c.name}</span>
          <span className="block truncate text-[13px] text-sub">
            {[c.mypageUrl && host(c.mypageUrl), c.loginId].filter(Boolean).join(' · ') || 'マイページ未登録'}
          </span>
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            c.hasPassword ? 'bg-ink text-white' : 'bg-fill text-mute'
          }`}
        >
          <KeyRound size={12} />
          {c.hasPassword ? '保存済み' : '未保存'}
        </span>
      </button>
      {/* 一覧からそのままマイページを開く（パスワードがあれば入力した状態で） */}
      <button
        aria-label={`${c.name} のマイページを開く`}
        title="マイページを開く"
        disabled={!c.mypageUrl}
        onClick={() => openCompanyMypage(c, connected)}
        className="mr-2 rounded-full p-2 text-sub hover:bg-white hover:text-ink disabled:invisible"
      >
        <ExternalLink size={16} />
      </button>
    </li>
  );
}
