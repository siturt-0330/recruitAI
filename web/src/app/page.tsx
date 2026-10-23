'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Building2, Columns2, Keyboard, List, Plus, Search } from 'lucide-react';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { CompanyLogo } from '@/components/ui';
import { daysUntil, md, today, weekday } from '@/lib/dates';
import { companyHref } from '@/lib/links';
import { gameHref } from '@/lib/site-url';
import { useTodayWord } from '@/lib/spi';
import { stageInfo } from '@/lib/stages';
import { useStore } from '@/lib/store';
import type { Company } from '@/lib/types';

/** 会社のいちばん近い予定（締切か次の予定）。今日より前のものは数えない */
function nearest(c: Company, t: string): { date: string; text: string } | null {
  const list: { date: string; text: string }[] = [];
  if (c.deadline && daysUntil(c.deadline, t) >= 0) list.push({ date: c.deadline, text: `${md(c.deadline)} ${c.deadlineLabel || ''} 締切`.replace('  ', ' ') });
  if (c.nextAt && daysUntil(c.nextAt, t) >= 0) list.push({ date: c.nextAt.slice(0, 10), text: `${md(c.nextAt)} ${c.nextLabel}`.trim() });
  return list.sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

/**
 * ホーム。受けている企業のマイページと、SPI 用語集にすぐ移れるようにする。
 */
export default function HomePage() {
  const data = useStore();
  const t = today();
  const [query, setQuery] = useState('');
  const hits = query.trim()
    ? data.companies.filter((c) => `${c.name}${c.industry}${c.memo}`.includes(query.trim())).slice(0, 6)
    : [];
  const active = data.companies.filter((c) => c.stage !== 'closed');

  return (
    <div className="mx-auto max-w-[920px] px-5 py-6 md:px-6">
      {data.sample && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-line bg-fill px-4 py-2.5 text-[13px] text-sub">
          <span className="flex-1">サンプルデータ</span>
          <button className="font-bold text-ind" onClick={() => confirm('サンプルデータを消して、まっさらな状態から始めますか？') && data.clearSample()}>
            消して始める
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="whitespace-nowrap text-2xl font-extrabold">こんにちは</h1>
          <p className="text-sm text-sub">
            {md(t)}（{weekday(t)}） · 選考中 {active.filter((c) => c.stage !== 'offer').length}社
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <div className="flex items-center gap-2 rounded-full bg-fill px-4 py-2.5 text-sm">
            <Search size={16} className="text-mute" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="企業・メモを検索" className="w-full bg-transparent outline-none" />
          </div>
          {hits.length > 0 && (
            <div className="absolute left-0 right-0 top-12 z-20 rounded-2xl border border-line bg-white py-2 shadow-xl">
              {hits.map((c) => (
                <Link key={c.id} href={companyHref(c.id)} className="block px-4 py-2 text-sm hover:bg-fill">
                  {c.name}
                  <span className="ml-2 text-xs text-mute">{c.industry}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MypageCard companies={active} total={data.companies.length} t={t} />
        <SpiCard />
      </div>
    </div>
  );
}

/** カードの見出し。カードのどこを押しても href に移る（中のボタンは、それぞれの行き先へ） */
function CardHead({ icon, color, title, sub }: { icon: ReactNode; color: string; title: string; sub: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: `${color}1a`, color }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[17px] font-extrabold">{title}</div>
        <div className="text-xs text-mute">{sub}</div>
      </div>
      <ArrowRight size={18} className="text-mute" />
    </div>
  );
}

const CARD = 'flex cursor-pointer flex-col rounded-[20px] border border-line bg-white px-5 pb-4 pt-5 transition-shadow hover:shadow-[0_10px_30px_rgba(20,22,26,.07)]';
const PILL = 'flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-1 py-2.5 text-[13px] font-extrabold';

function MypageCard({ companies, total, t }: { companies: Company[]; total: number; t: string }) {
  const router = useRouter();
  // 近い予定がある会社を先に、なければ最近さわった会社から
  const rows = companies
    .map((c) => ({ c, next: nearest(c, t) }))
    .sort((a, b) => (a.next && b.next ? a.next.date.localeCompare(b.next.date) : a.next ? -1 : b.next ? 1 : b.c.updatedAt.localeCompare(a.c.updatedAt)))
    .slice(0, 4);
  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div className={CARD} onClick={() => router.push('/companies')}>
      <CardHead icon={<Building2 size={20} />} color="#1d9bf0" title="マイページ" sub={`${total} 社 ・ 選考中 ${companies.filter((c) => c.stage !== 'offer').length} 社`} />
      {rows.length === 0 ? (
        <p className="border-t border-line py-6 text-center text-sm text-sub">受けている企業を追加しましょう</p>
      ) : (
        rows.map(({ c, next }) => (
          <Link key={c.id} href={companyHref(c.id)} onClick={stop} className="flex items-center gap-2.5 border-t border-[#f0f0f3] py-2.5">
            <CompanyLogo company={c} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{c.name}</div>
              <div className="truncate text-xs text-mute">{next?.text || c.industry || ' '}</div>
            </div>
            <span className="whitespace-nowrap rounded-md px-2 py-0.5 text-xs" style={{ background: stageInfo(c.stage).bg, color: stageInfo(c.stage).fg }}>
              {stageInfo(c.stage).label}
            </span>
          </Link>
        ))
      )}
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
        <Link href="/companies?new=1" onClick={stop} className={`${PILL} bg-ink text-white`}>
          <Plus size={16} />
          企業を追加
        </Link>
        <Link href="/companies" onClick={stop} className={`${PILL} border border-line`}>
          <List size={16} />
          一覧を開く
        </Link>
      </div>
    </div>
  );
}

function SpiCard() {
  const word = useTodayWord();
  const stop = (e: MouseEvent) => e.stopPropagation();
  // 例文の中の言葉に印をつける
  const at = word ? word.e.indexOf(word.w) : -1;

  return (
    <div className={CARD} onClick={() => (location.href = gameHref())}>
      <CardHead icon={<BookOpen size={20} />} color="#5b4cf0" title="SPI 用語集" sub="300 語 ・ 毎日 1 語" />
      <div className="min-h-[124px] rounded-[14px] bg-[#f6f5fd] px-4 py-3.5">
        <div className="text-[11px] font-extrabold tracking-[.06em] text-[#5b4cf0]">今日の SPI 語</div>
        {word && (
          <>
            <div className="mt-1 flex items-baseline gap-2.5">
              <span className="text-[30px] font-black tracking-[.04em]">{word.w}</span>
              <span className="text-[13px] text-mute">{word.y}</span>
            </div>
            <div className="text-[15px] font-bold">{word.m}</div>
            <div className="mt-1 text-xs text-sub">
              例：
              {at >= 0 ? (
                <>
                  {word.e.slice(0, at)}
                  <b className="bg-[linear-gradient(transparent_55%,#ffe36e_55%)] text-ink">{word.w}</b>
                  {word.e.slice(at + word.w.length)}
                </>
              ) : (
                word.e
              )}
            </div>
          </>
        )}
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 pt-3">
        <a href={gameHref()} onClick={stop} className={`${PILL} bg-[#5b4cf0] text-white`}>
          <Keyboard size={15} />
          タイピング
        </a>
        <a href={gameHref('quiz')} onClick={stop} className={`${PILL} border border-line`}>
          <Columns2 size={15} />
          意味クイズ
        </a>
        <a href={gameHref('book')} onClick={stop} className={`${PILL} border border-line`}>
          <BookOpen size={15} />
          単語帳
        </a>
      </div>
    </div>
  );
}
