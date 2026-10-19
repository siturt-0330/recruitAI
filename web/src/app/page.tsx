'use client';

import Link from 'next/link';
import { Check, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DueBadge, Empty, SophonCard } from '@/components/ui';
import { addDays, md, today, weekday } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { eventsBetween, todayTasks } from '@/lib/tasks';
import { companyHref } from '@/lib/links';

const KIND_STYLE = {
  deadline: 'bg-dangerbg text-danger',
  interview: 'bg-okbg text-ok',
  event: 'bg-[#E8F0FE] text-[#1A56C4]',
};

export default function HomePage() {
  const data = useStore();
  const t = today();
  const tasks = useMemo(() => todayTasks(data), [data]);
  const done = data.doneTasks[t] ?? [];
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, i));
  const events = useMemo(() => eventsBetween(data, days[0]!, days[6]!), [data, days]);
  const [query, setQuery] = useState('');
  const hits = query.trim()
    ? data.companies.filter((c) => `${c.name}${c.industry}${c.memo}`.includes(query.trim())).slice(0, 6)
    : [];

  return (
    <div className="mx-auto max-w-[920px] px-6 py-6">
      {data.sample && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-line bg-fill px-4 py-2.5 text-[13px] text-sub">
          <span className="flex-1">サンプルデータ</span>
          <button className="font-bold text-ind" onClick={() => confirm('サンプルデータを消して、まっさらな状態から始めますか？') && data.clearSample()}>
            消して始める
          </button>
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">こんにちは</h1>
          <p className="text-sm text-sub">
            {md(t)}（{weekday(t)}） · 選考中 {data.companies.filter((c) => c.stage !== 'closed' && c.stage !== 'offer').length}社
          </p>
        </div>
        <div className="relative w-64">
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

      <SophonCard title="今日やること" className="mb-7">
        {tasks.length === 0 ? (
          <p className="py-3 text-sm text-sub">今日やることはありません</p>
        ) : (
          <ul>
            {tasks.map((task) => {
              const isDone = done.includes(task.id);
              return (
                <li key={task.id} className="flex items-center gap-3 border-t border-indline py-3 first:border-t-0">
                  <button
                    aria-label={isDone ? '未完了に戻す' : '完了にする'}
                    onClick={() => data.toggleTask(t, task.id)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ind ${isDone ? 'bg-ind text-white' : ''}`}
                  >
                    {isDone && <Check size={13} strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[15px] font-bold ${isDone ? 'text-mute line-through' : ''}`}>{task.title}</div>
                    <div className="text-xs text-sub">{task.detail}</div>
                  </div>
                  <DueBadge badge={task.badge} />
                  <Link href={task.href} className="text-[13px] font-bold text-link hover:underline">
                    {task.action}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {tasks.length > 0 && (
          <div className="mt-1 text-right text-xs text-indtext">
            {tasks.filter((x) => done.includes(x.id)).length} / {tasks.length} 完了
          </div>
        )}
      </SophonCard>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[17px] font-extrabold">今週の予定</h2>
        <Link href="/schedule" className="text-[13px] text-link hover:underline">
          予定をすべて見る
        </Link>
      </div>
      {data.companies.length === 0 ? (
        <Empty title="まずは企業を追加しましょう" action={<Link href="/companies" className="font-bold text-link">マイページへ</Link>} />
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => (
            <div key={d} className={`min-h-32 min-w-0 rounded-2xl border p-2.5 ${i === 0 ? 'border-ind ring-1 ring-ind' : 'border-line'}`}>
              <div className={`text-xs ${i === 0 ? 'text-ind' : 'text-mute'}`}>{weekday(d)}</div>
              <div className={`text-lg font-extrabold ${i === 0 ? 'text-ind' : ''}`}>{Number(d.slice(8))}</div>
              {events
                .filter((e) => e.date === d)
                .map((e, j) => (
                  <Link
                    key={j}
                    href={companyHref(e.company.id)}
                    title={`${e.company.name} ${e.label}`}
                    className={`mt-1.5 block truncate rounded-md px-1.5 py-1 text-[11px] ${KIND_STYLE[e.kind]}`}
                  >
                    {e.time && `${e.time} `}
                    {e.company.name} {e.label}
                  </Link>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
