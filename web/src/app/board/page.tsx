'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, Download, LayoutGrid, Plus, Table2, Puzzle } from 'lucide-react';
import { AddCompanyDialog } from '@/components/AddCompanyDialog';
import { IndustrySelect } from '@/components/IndustrySelect';
import { Button, Chip, CompanyLogo, DueBadge, PageHeader, StagePill } from '@/components/ui';
import { dueBadge, md, mdTime, ymd } from '@/lib/dates';
import { emptyCompany } from '@/lib/seed';
import { COLUMNS, STAGES, stageOrder } from '@/lib/stages';
import { useStore } from '@/lib/store';
import { nextEventText } from '@/lib/tasks';
import type { Company, Stage } from '@/lib/types';

type Filter = 'all' | 'interview' | 'due' | 'offer';

export default function BoardPage() {
  const { companies, boardView, setBoardView } = useStore();
  const [adding, setAdding] = useState<Stage | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const router = useRouter();

  const visible = companies.filter((c) => {
    if (filter === 'interview') return ['interview1', 'interview2', 'final'].includes(c.stage);
    if (filter === 'due') return !!dueBadge(c.deadline);
    if (filter === 'offer') return c.stage === 'offer';
    return c.stage !== 'closed';
  });
  const count = (f: Filter) =>
    companies.filter((c) =>
      f === 'interview' ? ['interview1', 'interview2', 'final'].includes(c.stage) : f === 'due' ? !!dueBadge(c.deadline) : f === 'offer' ? c.stage === 'offer' : c.stage !== 'closed',
    ).length;

  return (
    <div>
      <PageHeader
        title="企業ボード"
        actions={
          <>
            <div className="flex rounded-full bg-fill p-1">
              {(
                [
                  ['board', 'ボード', LayoutGrid],
                  ['table', '表', Table2],
                ] as const
              ).map(([v, label, Icon]) => (
                <button
                  key={v}
                  onClick={() => setBoardView(v)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] ${boardView === v ? 'bg-white font-bold shadow-[0_0_0_1px_var(--color-box)]' : 'text-sub'}`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
            {boardView === 'table' && (
              <Button onClick={() => downloadCsv(companies)}>
                <Download size={15} />
                CSV
              </Button>
            )}
            <Button variant="primary" onClick={() => setAdding('entry')}>
              <Plus size={16} />
              企業を追加
            </Button>
          </>
        }
      />

      <div className="px-6 py-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ['all', 'すべて'],
              ['interview', '面接中'],
              ['due', '締切が近い'],
              ['offer', '内定'],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <Chip key={f} on={filter === f} onClick={() => setFilter(f)}>
              {label} {count(f)}
            </Chip>
          ))}
        </div>

        {boardView === 'board' ? (
          <Board companies={visible} onAdd={setAdding} />
        ) : (
          <CompanyTable companies={visible} />
        )}
      </div>

      {adding && (
        <AddCompanyDialog
          defaultStage={adding}
          onClose={(id) => {
            setAdding(null);
            if (id && boardView === 'board') router.prefetch(`/companies/${id}`);
          }}
        />
      )}
    </div>
  );
}

function Board({ companies, onAdd }: { companies: Company[]; onAdd(stage: Stage): void }) {
  const patchCompany = useStore((s) => s.patchCompany);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-3 gap-3">
      {COLUMNS.map((col) => {
        const items = companies.filter((c) => col.stages.includes(c.stage)).sort((a, b) => (a.deadline || '9').localeCompare(b.deadline || '9'));
        return (
          <section
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.id);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={() => {
              if (dragging) {
                const c = companies.find((x) => x.id === dragging);
                // 同じ列の中なら段階は変えない（「一次面接」を「面接中」に入れ直しても一次のまま）
                if (c && !col.stages.includes(c.stage)) patchCompany(dragging, { stage: col.dropTo });
              }
              setDragging(null);
              setOver(null);
            }}
            className={`min-h-[60vh] min-w-0 rounded-2xl p-2.5 transition-colors ${over === col.id ? 'bg-indbg ring-2 ring-indline' : 'bg-fill'}`}
          >
            <div className="flex items-center justify-between px-1.5 pb-2.5 pt-1 text-[13px] font-bold">
              {col.label}
              <span className="font-normal text-mute">{items.length}</span>
            </div>
            {items.map((c) => {
              const badge = dueBadge(c.deadline);
              return (
                <Link
                  key={c.id}
                  href={`/companies/${c.id}`}
                  draggable
                  onDragStart={() => setDragging(c.id)}
                  onDragEnd={() => setDragging(null)}
                  className={`mb-2 block rounded-xl border bg-white p-3 transition-shadow hover:shadow-md ${badge?.tone === 'red' ? 'border-[#F7C1C1]' : 'border-line'} ${dragging === c.id ? 'opacity-40' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <CompanyLogo company={c} size={30} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{c.name}</div>
                      <div className="truncate text-[11px] text-mute">{c.industry}</div>
                    </div>
                  </div>
                  {col.stages.length > 1 && <StagePill stage={c.stage} className="mt-2" />}
                  {c.deadline && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-sub">
                      <CalendarClock size={13} />
                      {c.deadlineLabel || '締切'} {md(c.deadline)}
                      <DueBadge badge={badge} />
                    </div>
                  )}
                  {(c.nextAt || c.nextLabel) && <div className="mt-1.5 truncate text-xs text-sub">{nextEventText(c)}</div>}
                  {c.submittedAt && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-indbg px-2 py-0.5 text-[11px] text-indtext">
                      <Puzzle size={11} />
                      {md(ymd(new Date(c.submittedAt)))} フォームから
                    </div>
                  )}
                </Link>
              );
            })}
            <button
              onClick={() => onAdd(col.dropTo)}
              className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-box py-2.5 text-xs text-mute hover:bg-white"
            >
              <Plus size={14} />
              追加
            </button>
          </section>
        );
      })}
    </div>
  );
}

type SortKey = 'name' | 'stage' | 'next' | 'deadline' | 'industry';

function CompanyTable({ companies }: { companies: Company[] }) {
  const { patchCompany, upsertCompany } = useStore();
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'deadline', asc: true });
  const [newName, setNewName] = useState('');

  const rows = useMemo(() => {
    const val = (c: Company): string | number =>
      sort.key === 'stage'
        ? stageOrder(c.stage)
        : sort.key === 'deadline'
          ? c.deadline || '9999'
          : sort.key === 'next'
            ? c.nextAt || '9999'
            : sort.key === 'name'
              ? c.name
              : c.industry;
    return [...companies].sort((a, b) => {
      const [x, y] = [val(a), val(b)];
      return (x > y ? 1 : x < y ? -1 : 0) * (sort.asc ? 1 : -1);
    });
  }, [companies, sort]);

  const head = (key: SortKey, label: string, width: string) => {
    const Icon = sort.key !== key ? ArrowUpDown : sort.asc ? ArrowUp : ArrowDown;
    return (
      <th style={{ width }} className="cursor-pointer select-none border-b border-box bg-fill px-3 py-2.5 text-left text-xs font-bold text-sub hover:text-ink" onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }))}>
        <span className="inline-flex items-center gap-1">
          {label}
          <Icon size={12} className={sort.key === key ? 'text-ind' : 'text-mute'} />
        </span>
      </th>
    );
  };

  const cell = 'border-b border-line px-3 py-2 align-middle';
  const inputCls = 'w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] outline-none hover:border-box focus:border-ind focus:bg-white';

  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <table className="w-full table-fixed border-collapse text-[13px]">
        <thead>
          <tr>
            {head('name', '企業', '28%')}
            {head('stage', '選考状況', '15%')}
            {head('next', '次の予定', '25%')}
            {head('deadline', '締切', '19%')}
            {head('industry', '業界', '13%')}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-[#FAFBFB]">
              <td className={cell}>
                <Link href={`/companies/${c.id}`} className="flex min-w-0 items-center gap-2.5">
                  <CompanyLogo company={c} size={30} />
                  <span className="min-w-0">
                    <span className="block truncate font-bold hover:underline">{c.name}</span>
                    <span className="block truncate text-[11px] text-mute">{hostname(c.url)}</span>
                  </span>
                </Link>
              </td>
              <td className={cell}>
                <select
                  value={c.stage}
                  onChange={(e) => patchCompany(c.id, { stage: e.target.value as Stage })}
                  className="cursor-pointer rounded-full px-2.5 py-1 text-xs font-bold outline-none"
                  style={{ background: STAGES.find((s) => s.id === c.stage)?.bg, color: STAGES.find((s) => s.id === c.stage)?.fg }}
                >
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className={cell}>
                <div className="flex items-center gap-1">
                                        <DateCell type="datetime-local" value={c.nextAt} onChange={(v) => patchCompany(c.id, { nextAt: v })} format={mdTime} className="w-[44%] shrink-0" />
                      <input value={c.nextLabel} placeholder="—" onChange={(e) => patchCompany(c.id, { nextLabel: e.target.value })} className={`${inputCls} text-sub`} />

                </div>
              </td>
              <td className={cell}>
                <div className="flex items-center gap-1.5">
                  <DateCell type="date" value={c.deadline} onChange={(v) => patchCompany(c.id, { deadline: v })} format={(v) => md(v, true)} />
                  <span className="whitespace-nowrap">
                    <DueBadge badge={dueBadge(c.deadline)} />
                  </span>
                </div>
              </td>
              <td className={cell}>
                <IndustrySelect variant="cell" value={c.industry} onChange={(v) => patchCompany(c.id, { industry: v })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        className="flex items-center gap-2 px-3 py-2 text-[13px]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          upsertCompany(emptyCompany(newName.trim()));
          setNewName('');
        }}
      >
        <Plus size={15} className="text-mute" />
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="行を追加（企業名を入力して Enter）" className="flex-1 bg-transparent py-1 outline-none" />
      </form>
    </div>
  );
}

/** ふだんは「10/16（木）」のような文字で見せ、押したときだけ日付の入力欄にする */
function DateCell({
  type,
  value,
  onChange,
  format,
  className = '',
}: {
  type: 'date' | 'datetime-local';
  value: string;
  onChange(v: string): void;
  format(v: string): string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        type={type}
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
        className={`rounded-md border border-ind bg-white px-1.5 py-1 text-xs outline-none ${className}`}
      />
    );
  }
  return (
    <button onClick={() => setEditing(true)} className={`truncate rounded-md border border-transparent px-1.5 py-1 text-left hover:border-box ${value ? '' : 'text-mute'} ${className}`}>
      {value ? format(value) : '—'}
    </button>
  );
}

function hostname(url: string) {
  try {
    return url ? new URL(url).hostname : '';
  } catch {
    return '';
  }
}

function downloadCsv(companies: Company[]) {
  const head = ['企業', '業界', '選考状況', '締切', '締切の内容', '次の予定', '次の予定の内容', 'URL', 'マイページ', 'メモ'];
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = companies.map((c) =>
    [c.name, c.industry, STAGES.find((s) => s.id === c.stage)?.label ?? '', c.deadline, c.deadlineLabel, c.nextAt.replace('T', ' '), c.nextLabel, c.url, c.mypageUrl, c.memo].map(esc).join(','),
  );
  // Excel で文字化けしないよう BOM を付ける
  const blob = new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\r\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sophon-companies-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
