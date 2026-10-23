'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Calendar, CalendarClock, CircleDot, ExternalLink, KeyRound, Link2, Plus, Tag, Trash2, Type, User } from 'lucide-react';
import { CompanyPage, TagSelect, openCompanyMypage } from '@/components/CompanyPage';
import { DEFAULT_INDUSTRIES } from '@/components/IndustrySelect';
import { CompanyLogo, Empty } from '@/components/ui';
import { forgetMypage, useExtension } from '@/lib/extension';
import { companyHref } from '@/lib/links';
import { logoFor } from '@/lib/logo';
import { emptyCompany } from '@/lib/seed';
import { STAGES, stageInfo } from '@/lib/stages';
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

/** 会社のページを右に重ねて出せる幅か（狭い画面では1ページ全体で開く） */
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

/** 表の列。幅は Notion のデータベースに近い固定幅（はみ出したら横にスクロール） */
const COLUMNS: { label: string; icon: ReactNode; width: number }[] = [
  { label: '会社名', icon: <Type size={14} />, width: 220 },
  { label: 'マイページ', icon: <Link2 size={14} />, width: 190 },
  { label: 'ID', icon: <User size={14} />, width: 150 },
  { label: 'パスワード', icon: <KeyRound size={14} />, width: 104 },
  { label: '選考状況', icon: <CircleDot size={14} />, width: 120 },
  { label: '締切', icon: <Calendar size={14} />, width: 130 },
  { label: '次の予定', icon: <CalendarClock size={14} />, width: 180 },
  { label: '業界', icon: <Tag size={14} />, width: 130 },
];
/** 日付の欄。カレンダーのアイコンは、行にマウスを乗せたときだけ出す（Notion のように日付の文字だけを見せる） */
const DATE_INPUT =
  'w-full bg-transparent text-[13px] outline-none [&::-webkit-calendar-picker-indicator]:opacity-0 group-hover:[&::-webkit-calendar-picker-indicator]:opacity-60';
const TABLE_WIDTH = COLUMNS.reduce((n, c) => n + c.width, 0) + 44;

/**
 * 受けている企業のマイページ（Notion のテーブルのように、セルをその場で書き換える）。
 * 会社名の「開く」で、右側に会社のページが開く。パスワードはこのページには来ない（拡張機能の中にだけある）。
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
  const { companies, upsertCompany } = useStore();
  const { connected, notice } = useExtension();
  // 開いている会社は URL（/companies?id=...）で持つ。ホームや予定のリンクからも開ける
  const selected = params.get('id') ?? '';
  const full = params.get('full') === '1' || !wide;
  const [focusId, setFocusId] = useState('');

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => useExtension.setState({ notice: '' }), 2400);
    return () => clearTimeout(t);
  }, [notice]);

  // ロゴのない会社（拡張機能から入った会社など）は、裏で順番に探しておく
  useEffect(() => {
    const todo = companies.filter((c) => c.name.trim() && !c.logo && !tried.has(c.id));
    if (!todo.length) return;
    todo.forEach((c) => tried.add(c.id));
    (async () => {
      for (const c of todo) {
        const logo = await logoFor(c);
        if (logo) useStore.getState().patchCompany(c.id, { logo });
      }
    })();
  }, [companies]);

  const open = (id: string) => router.push(companyHref(id));
  const close = () => router.push('/companies');

  /** 「＋ 新規」：空の行を足して、会社名のセルに入力できるようにする */
  const add = () => {
    const c = emptyCompany('');
    upsertCompany(c);
    setFocusId(c.id);
  };

  // Notion と同じく、新しい行は下に増える
  const rows = [...companies].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
    <div className="px-4 py-6 md:px-8">
      <div className="mb-5 flex items-center gap-3">
        <h1 className="flex-1 text-[28px] font-extrabold tracking-tight">マイページ</h1>
        {connected && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-okbg px-3 py-1 text-xs font-bold text-ok">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            拡張機能と連携中
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <div style={{ width: TABLE_WIDTH }} className="text-[14px]">
          <div className="flex border-y border-line text-[13px] text-sub">
            {COLUMNS.map((c, i) => (
              <div key={c.label} style={{ width: c.width }} className={`flex h-9 shrink-0 items-center gap-1.5 px-2 ${i ? 'border-l border-line' : ''}`}>
                {c.icon}
                {c.label}
              </div>
            ))}
            <div className="w-11 shrink-0 border-l border-line" />
          </div>
          {rows.map((c) => (
            <Row
              key={c.id}
              company={c}
              active={c.id === selected}
              connected={connected}
              autoFocus={c.id === focusId}
              onOpen={() => open(c.id)}
            />
          ))}
          <button onClick={add} className="flex h-9 w-full items-center gap-2 border-b border-line px-2 text-[14px] text-mute hover:bg-fill hover:text-sub">
            <Plus size={15} />
            新規
          </button>
        </div>
      </div>

      {/* Notion のサイドピークのように、表の上に右から重ねて出す */}
      {current && (
        <div className="fixed inset-y-0 right-0 z-40 w-[min(600px,100%)] overflow-y-auto border-l border-line bg-white shadow-[-12px_0_40px_rgba(15,20,25,0.10)]">
          <CompanyPage key={current.id} company={current} mode="peek" onClose={close} />
        </div>
      )}

      {notice && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white shadow-lg md:bottom-8">
          {notice}
        </div>
      )}
    </div>
  );
}

/** 表の1行。セルを押すとその場で書き換えられる（書いたらすぐ保存） */
function Row({ company: c, active, connected, autoFocus, onOpen }: { company: Company; active: boolean; connected: boolean; autoFocus: boolean; onOpen(): void }) {
  const { patchCompany, removeCompany, industries, addIndustry } = useStore();
  const set = (patch: Partial<Company>) => patchCompany(c.id, patch);
  const nameAtFocus = useRef(c.name);
  const industryOptions = [...new Set([...DEFAULT_INDUSTRIES, ...industries])];

  const remove = () => {
    if (!confirm(`${c.name || '無題'} を削除しますか？`)) return;
    forgetMypage(c.id);
    removeCompany(c.id);
  };

  return (
    <div className={`group flex border-b border-line ${active ? 'bg-fill' : 'hover:bg-fill/60'}`}>
      <Cell width={COLUMNS[0]!.width} first>
        <CompanyLogo company={{ name: c.name || '無', logo: c.logo }} size={22} />
        <input
          value={c.name}
          autoFocus={autoFocus}
          placeholder="無題"
          onChange={(e) => set({ name: e.target.value })}
          onFocus={() => (nameAtFocus.current = c.name)}
          onBlur={async () => {
            // 会社名を変えたら、ロゴを探し直す
            if (c.name.trim() && c.name !== nameAtFocus.current) {
              const logo = await logoFor({ ...c, url: '', mypageUrl: '' });
              useStore.getState().patchCompany(c.id, { logo });
            }
          }}
          onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === 'Enter' && e.currentTarget.blur()}
          className="min-w-0 flex-1 bg-transparent font-bold outline-none placeholder:font-normal placeholder:text-mute"
        />
        <button
          onClick={onOpen}
          className="shrink-0 rounded-md border border-line bg-white px-1.5 py-0.5 text-[11px] font-bold text-sub shadow-sm hover:text-ink lg:invisible lg:group-hover:visible"
        >
          開く
        </button>
      </Cell>
      <Cell width={COLUMNS[1]!.width}>
        <CellInput value={c.mypageUrl} placeholder="" display={c.mypageUrl ? host(c.mypageUrl) : ''} onChange={(v) => set({ mypageUrl: v })} className="text-link" />
        {c.mypageUrl && (
          <button
            aria-label={`${c.name} のマイページを開く`}
            title="マイページを開く"
            onClick={() => openCompanyMypage(c, connected)}
            className="invisible shrink-0 rounded p-1 text-sub hover:bg-white hover:text-ink group-hover:visible"
          >
            <ExternalLink size={14} />
          </button>
        )}
      </Cell>
      <Cell width={COLUMNS[2]!.width}>
        <CellInput value={c.loginId} placeholder="" onChange={(v) => set({ loginId: v })} />
      </Cell>
      <Cell width={COLUMNS[3]!.width}>
        {c.hasPassword ? (
          <span className="inline-flex items-center gap-1 rounded bg-ink px-1.5 py-0.5 text-[11px] font-bold text-white">
            <KeyRound size={11} />
            保存済み
          </span>
        ) : (
          <button onClick={onOpen} className="text-[13px] text-mute hover:text-sub">
            未保存
          </button>
        )}
      </Cell>
      <Cell width={COLUMNS[4]!.width}>
        <TagSelect
          value={stageInfo(c.stage).label}
          options={STAGES.map((s) => s.label)}
          onChange={(label) => {
            const s = STAGES.find((x) => x.label === label);
            if (s) set({ stage: s.id });
          }}
        />
      </Cell>
      <Cell width={COLUMNS[5]!.width}>
        <input
          type="date"
          value={c.deadline}
          onChange={(e) => set({ deadline: e.target.value })}
          className={`${DATE_INPUT} ${c.deadline ? '' : 'text-transparent focus:text-mute group-hover:text-mute'}`}
        />
      </Cell>
      <Cell width={COLUMNS[6]!.width}>
        <input
          type="datetime-local"
          value={c.nextAt}
          onChange={(e) => set({ nextAt: e.target.value })}
          className={`${DATE_INPUT} ${c.nextAt ? '' : 'text-transparent focus:text-mute group-hover:text-mute'}`}
        />
      </Cell>
      <Cell width={COLUMNS[7]!.width}>
        <TagSelect
          value={c.industry}
          options={industryOptions}
          creatable
          onChange={(v) => {
            if (v && !industryOptions.includes(v)) addIndustry(v);
            set({ industry: v });
          }}
        />
      </Cell>
      <div className="flex w-11 shrink-0 items-center justify-center border-l border-line">
        <button aria-label={`${c.name || '無題'} を削除`} onClick={remove} className="invisible rounded p-1 text-mute hover:text-danger group-hover:visible">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function Cell({ width, first, children }: { width: number; first?: boolean; children: ReactNode }) {
  return (
    <div style={{ width }} className={`flex min-h-9 shrink-0 items-center gap-2 px-2 ${first ? '' : 'border-l border-line'}`}>
      {children}
    </div>
  );
}

/** 枠のない入力欄。触っていないときは display（URL ならドメインだけ）を見せる */
function CellInput({
  value,
  placeholder,
  display,
  onChange,
  className = '',
}: {
  value: string;
  placeholder: string;
  display?: string;
  onChange(v: string): void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <input
      value={editing || display === undefined ? value : display}
      placeholder={placeholder}
      onFocus={() => setEditing(true)}
      onBlur={() => setEditing(false)}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === 'Enter' && e.currentTarget.blur()}
      className={`h-9 min-w-0 flex-1 truncate bg-transparent text-[13px] outline-none ${value && !editing ? className : ''}`}
    />
  );
}
