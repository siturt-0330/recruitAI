'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Calendar,
  CalendarClock,
  Check,
  CircleDot,
  ExternalLink,
  KeyRound,
  Link2,
  Maximize2,
  MoreHorizontal,
  Plus,
  Tag,
  Text,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { BlockEditor } from './BlockEditor';
import { DEFAULT_INDUSTRIES } from './IndustrySelect';
import { CompanyLogo } from './ui';
import { forgetMypage, openMypage, setPassword, useExtension } from '@/lib/extension';
import { companyHref } from '@/lib/links';
import { logoFor } from '@/lib/logo';
import { uid } from '@/lib/seed';
import { STAGES, stageInfo } from '@/lib/stages';
import { useStore } from '@/lib/store';
import type { Block, Company, CustomProp } from '@/lib/types';

/** マイページを開く。拡張機能にパスワードがあれば、ID とパスワードを入れた状態で開く */
export function openCompanyMypage(c: Company, connected: boolean) {
  if (connected && c.hasPassword) openMypage(c.id);
  else if (c.mypageUrl) window.open(c.mypageUrl, '_blank', 'noopener');
}

/**
 * 会社のページ（Notion のページのように、タイトル・プロパティ・メモを直接書き換える）。
 * 一覧の右に出す（peek）か、1ページ全体に出す（full）。保存ボタンはなく、書いたらすぐ保存する。
 */
export function CompanyPage({ company, mode, onClose }: { company: Company; mode: 'peek' | 'full'; onClose(): void }) {
  const { patchCompany, removeCompany, industries, addIndustry } = useStore();
  const connected = useExtension((s) => s.connected);
  const set = (patch: Partial<Company>) => patchCompany(company.id, patch);
  const nameAtFocus = useRef(company.name);

  const remove = () => {
    if (!confirm(`${company.name} を削除しますか？`)) return;
    forgetMypage(company.id);
    removeCompany(company.id);
    onClose();
  };

  const setBlocks = (blocks: Block[]) => set({ blocks, memo: blocks.map((b) => b.text).filter(Boolean).join('\n') });
  const setProp = (id: string, patch: Partial<CustomProp>) => set({ props: company.props.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const [newProp, setNewProp] = useState('');

  const industryOptions = [...new Set([...DEFAULT_INDUSTRIES, ...industries])];

  return (
    <div className={mode === 'full' ? 'mx-auto max-w-[760px] px-5 py-5 md:px-12' : 'max-w-[720px] px-7 py-4'}>
      <div className="mb-3 flex items-center gap-1 text-sub">
        {mode === 'full' ? (
          <Link href="/companies" className="mr-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] hover:bg-fill">
            <ArrowLeft size={15} />
            マイページ
          </Link>
        ) : (
          <>
            <span className="mr-auto" />
            <Link href={companyHref(company.id, true)} aria-label="全画面で開く" className="rounded-md p-1.5 hover:bg-fill">
              <Maximize2 size={16} />
            </Link>
          </>
        )}
        <MoreMenu onDelete={remove} />
        {mode === 'peek' && (
          <button aria-label="閉じる" onClick={onClose} className="rounded-md p-1.5 hover:bg-fill">
            <X size={17} />
          </button>
        )}
      </div>

      <div className="mt-2">
        <div className="inline-block rounded-2xl border border-line bg-white p-1">
          <CompanyLogo company={company} size={56} />
        </div>
      </div>
      <input
        value={company.name}
        onChange={(e) => set({ name: e.target.value })}
        onFocus={() => (nameAtFocus.current = company.name)}
        onBlur={async () => {
          // 会社名を変えたら、ロゴを探し直す
          if (!company.name.trim()) set({ name: nameAtFocus.current });
          else if (company.name !== nameAtFocus.current) {
            const logo = await logoFor({ ...company, url: '', mypageUrl: '' });
            useStore.getState().patchCompany(company.id, { logo });
          }
        }}
        placeholder="会社名"
        className="mt-3 mb-3 w-full bg-transparent text-[30px] font-extrabold tracking-tight outline-none placeholder:text-box"
      />

      <div className="flex flex-col">
        <Prop icon={<Link2 size={15} />} label="マイページ">
          <PlainInput value={company.mypageUrl} placeholder="https://" onChange={(v) => set({ mypageUrl: v })} className="text-link" />
          {company.mypageUrl && (
            <button
              onClick={() => openCompanyMypage(company, connected)}
              className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-0.5 text-[12px] font-bold text-ink hover:bg-fill"
            >
              {connected && company.hasPassword ? <KeyRound size={12} /> : <ExternalLink size={12} />}
              開く
            </button>
          )}
        </Prop>
        <Prop icon={<User size={15} />} label="ID">
          <PlainInput value={company.loginId} placeholder="空" onChange={(v) => set({ loginId: v })} />
        </Prop>
        <Prop icon={<KeyRound size={15} />} label="パスワード">
          <PasswordInput company={company} connected={connected} />
        </Prop>
        <Prop icon={<CircleDot size={15} />} label="選考状況">
          <TagSelect
            value={stageInfo(company.stage).label}
            options={STAGES.map((s) => s.label)}
            onChange={(label) => {
              const s = STAGES.find((x) => x.label === label);
              if (s) set({ stage: s.id });
            }}
          />
        </Prop>
        <Prop icon={<Calendar size={15} />} label="締切">
          <DateWithLabel
            type="date"
            date={company.deadline}
            label={company.deadlineLabel}
            placeholder="ES・Web テストなど"
            onDate={(deadline) => set({ deadline })}
            onLabel={(deadlineLabel) => set({ deadlineLabel })}
          />
        </Prop>
        <Prop icon={<CalendarClock size={15} />} label="次の予定">
          <DateWithLabel
            type="datetime-local"
            date={company.nextAt}
            label={company.nextLabel}
            placeholder="一次面接・説明会など"
            onDate={(nextAt) => set({ nextAt })}
            onLabel={(nextLabel) => set({ nextLabel })}
          />
        </Prop>
        <Prop icon={<Tag size={15} />} label="業界">
          <TagSelect
            value={company.industry}
            options={industryOptions}
            creatable
            onChange={(v) => {
              if (v && !industryOptions.includes(v)) addIndustry(v);
              set({ industry: v });
            }}
          />
        </Prop>
        {company.props.map((p) => (
          <Prop
            key={p.id}
            icon={<Text size={15} />}
            label={
              <input
                value={p.name}
                autoFocus={p.id === newProp}
                onFocus={(e) => p.id === newProp && e.target.select()}
                onChange={(e) => setProp(p.id, { name: e.target.value })}
                className="w-full bg-transparent outline-none"
              />
            }
            onRemove={() => set({ props: company.props.filter((x) => x.id !== p.id) })}
          >
            <PlainInput value={p.value} placeholder="空" onChange={(v) => setProp(p.id, { value: v })} />
          </Prop>
        ))}
        <button
          onClick={() => {
            const p = { id: uid(), name: '新しいプロパティ', value: '' };
            setNewProp(p.id);
            set({ props: [...company.props, p] });
          }}
          className="flex h-9 items-center gap-2 rounded-md px-1.5 text-[14px] text-mute hover:bg-fill hover:text-sub"
        >
          <Plus size={15} />
          プロパティを追加
        </button>
      </div>

      <div className="my-4 border-t border-line" />
      <BlockEditor blocks={company.blocks} onChange={setBlocks} />
    </div>
  );
}

/**
 * パスワードの欄。打ったパスワードは拡張機能にだけ渡して保存し、このページには残さない。
 * 拡張機能とつながっていないとき・マイページの URL がないときは保存できない
 */
/** Web 版からパスワードを受け取れるのは、拡張機能の 1.1.2 から */
const PASSWORD_FROM_WEB = [1, 1, 2];
const supports = (version: string) => {
  const v = version.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((v[i] ?? 0) !== PASSWORD_FROM_WEB[i]) return (v[i] ?? 0) > PASSWORD_FROM_WEB[i]!;
  return true;
};

function PasswordInput({ company, connected }: { company: Company; connected: boolean }) {
  const version = useExtension((s) => s.version);
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);

  if (company.hasPassword && !editing) {
    return (
      <span className="flex items-center gap-2">
        <span className="tracking-widest">••••••••</span>
        <span className="rounded bg-fill px-1.5 py-px text-[12px] text-sub">拡張機能に保存済み</span>
        <button onClick={() => setEditing(true)} className="rounded px-1.5 py-0.5 text-[12px] text-sub hover:bg-white hover:text-ink">
          変更
        </button>
      </span>
    );
  }
  const updated = connected && supports(version);
  const ready = updated && !!company.mypageUrl;
  const save = () => {
    if (!ready || !value) return;
    setPassword(company, value);
    setValue('');
    setEditing(false);
  };
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <input
        type="password"
        value={value}
        disabled={!ready}
        autoComplete="new-password"
        placeholder={
          !connected ? '拡張機能と連携すると保存できます' : !updated ? '拡張機能を更新すると保存できます' : !company.mypageUrl ? '先にマイページの URL を入力' : 'パスワードを入力'
        }
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === 'Enter' && save()}
        className="h-9 min-w-0 flex-1 bg-transparent outline-none placeholder:text-mute disabled:cursor-not-allowed"
      />
      {value && (
        <button onClick={save} className="shrink-0 rounded-md bg-ink px-2.5 py-1 text-[12px] font-bold text-white">
          保存
        </button>
      )}
      {editing && !value && (
        <button onClick={() => setEditing(false)} className="shrink-0 rounded px-1.5 py-0.5 text-[12px] text-sub hover:bg-white">
          やめる
        </button>
      )}
    </span>
  );
}

/** プロパティの1行：左に名前、右に値 */
function Prop({ icon, label, children, onRemove }: { icon: ReactNode; label: ReactNode; children: ReactNode; onRemove?(): void }) {
  return (
    <div className="group flex min-h-9 items-center gap-2 rounded-md px-1.5 text-[14px] hover:bg-fill">
      <span className="flex w-[132px] shrink-0 items-center gap-2 text-sub">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </span>
      <span className="flex min-w-0 flex-1 items-center">{children}</span>
      {onRemove && (
        <button aria-label="このプロパティを削除" onClick={onRemove} className="invisible rounded p-1 text-mute hover:text-danger group-hover:visible">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

/** 日付（日時）と、その中身（「ES」「一次面接」など）。ここに入れたものが「予定」と「今日やること」に出る */
function DateWithLabel({
  type,
  date,
  label,
  placeholder,
  onDate,
  onLabel,
}: {
  type: 'date' | 'datetime-local';
  date: string;
  label: string;
  placeholder: string;
  onDate(v: string): void;
  onLabel(v: string): void;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <input
        type={type}
        value={date}
        onChange={(e) => onDate(e.target.value)}
        className={`shrink-0 bg-transparent text-[14px] outline-none ${date ? '' : 'text-mute'}`}
      />
      <PlainInput value={label} placeholder={placeholder} onChange={onLabel} />
    </span>
  );
}

function PlainInput({ value, placeholder, onChange, className = '' }: { value: string; placeholder: string; onChange(v: string): void; className?: string }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 min-w-0 flex-1 truncate bg-transparent outline-none placeholder:text-mute ${value ? className : ''}`}
    />
  );
}

/** ポップオーバーの外を押したら閉じる */
function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);
  return ref;
}

/** Notion の選択プロパティ：タグを押すと一覧が開き、ないものは打てば新しく作れる */
export function TagSelect({ value, options, onChange, creatable }: { value: string; options: string[]; onChange(v: string): void; creatable?: boolean }) {
  const [open, setOpen] = useState(false);
  // 表のセルの中でも切れないよう、一覧は画面に対する位置（fixed）で出す
  const [at, setAt] = useState({ left: 0, top: 0 });
  const [q, setQ] = useState('');
  const ref = useOutside(open, () => setOpen(false));
  const shown = options.filter((o) => o.includes(q.trim()));
  const canCreate = creatable && q.trim() && !options.includes(q.trim());
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQ('');
  };

  return (
    <div ref={ref} className="relative w-full">
      <button
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt({ left: Math.min(r.left, window.innerWidth - 272), top: r.bottom + 4 });
          setOpen(!open);
        }}
        className="flex h-9 w-full items-center text-left"
      >
        {value ? <span className="rounded bg-fill px-2 py-0.5 text-[13px] ring-1 ring-line">{value}</span> : <span className="text-mute">空</span>}
      </button>
      {open && (
        <div style={at} className="fixed z-50 w-64 rounded-xl border border-line bg-white p-1.5 shadow-xl">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.key !== 'Enter') return;
              if (canCreate) pick(q.trim());
              else if (shown[0]) pick(shown[0]);
            }}
            placeholder={creatable ? '検索または新しく作る' : '検索'}
            className="mb-1 h-8 w-full rounded-md bg-fill px-2.5 text-[13px] outline-none"
          />
          <div className="max-h-64 overflow-y-auto">
            {shown.map((o) => (
              <button key={o} onClick={() => pick(o)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-fill">
                <span className="rounded bg-fill px-2 py-0.5 ring-1 ring-line">{o}</span>
                {o === value && <Check size={14} className="ml-auto" />}
              </button>
            ))}
            {canCreate && (
              <button onClick={() => pick(q.trim())} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-fill">
                <Plus size={14} />
                「{q.trim()}」を作る
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MoreMenu({ onDelete }: { onDelete(): void }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button aria-label="その他" onClick={() => setOpen(!open)} className="rounded-md p-1.5 hover:bg-fill">
        <MoreHorizontal size={17} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-40 rounded-xl border border-line bg-white p-1.5 shadow-xl">
          <button onClick={onDelete} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-danger hover:bg-dangerbg">
            <Trash2 size={14} />
            削除
          </button>
        </div>
      )}
    </div>
  );
}
