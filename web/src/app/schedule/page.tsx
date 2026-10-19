'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, CompanyLogo, PageHeader } from '@/components/ui';
import { addDays, md, today, weekday } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { eventsBetween } from '@/lib/tasks';
import { companyHref } from '@/lib/links';

const KIND = {
  deadline: { label: '締切', cls: 'bg-dangerbg text-danger' },
  interview: { label: '面接', cls: 'bg-okbg text-ok' },
  event: { label: '予定', cls: 'bg-[#E8F0FE] text-[#1A56C4]' },
};

/** 月曜はじまりの週 */
function startOfWeek(date: string): string {
  const day = ['日', '月', '火', '水', '木', '金', '土'].indexOf(weekday(date));
  return addDays(date, -((day + 6) % 7));
}

export default function SchedulePage() {
  const data = useStore();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const events = useMemo(() => eventsBetween(data, weekStart, addDays(weekStart, 6)), [data, weekStart]);
  const upcoming = useMemo(() => eventsBetween(data, today(), addDays(today(), 60)), [data]);
  const t = today();

  return (
    <div>
      <PageHeader
        title="予定"
        actions={
          <div className="flex items-center gap-1">
            <Button variant="ghost" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="前の週">
              <ChevronLeft size={16} />
            </Button>
            <Button onClick={() => setWeekStart(startOfWeek(today()))}>今週</Button>
            <Button variant="ghost" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="次の週">
              <ChevronRight size={16} />
            </Button>
          </div>
        }
      />
      <div className="px-6 py-5">
        <div className="mb-2 text-sm font-bold">
          {md(days[0]!)} 〜 {md(days[6]!)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => (
            <div key={d} className={`min-h-40 min-w-0 rounded-2xl border p-2.5 ${d === t ? 'border-ind ring-1 ring-ind' : 'border-line'}`}>
              <div className={`text-xs ${d === t ? 'text-ind' : 'text-mute'}`}>{weekday(d)}</div>
              <div className={`text-lg font-extrabold ${d === t ? 'text-ind' : ''}`}>{Number(d.slice(8))}</div>
              {events
                .filter((e) => e.date === d)
                .map((e, i) => (
                  <Link key={i} href={companyHref(e.company.id)} className={`mt-1.5 block truncate rounded-md px-1.5 py-1 text-[11px] ${KIND[e.kind].cls}`} title={`${e.company.name} ${e.label}`}>
                    {e.time && `${e.time} `}
                    {e.company.name} {e.label}
                  </Link>
                ))}
            </div>
          ))}
        </div>

        <h2 className="mb-3 mt-8 text-[17px] font-extrabold">これからの予定</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-sub">予定はありません</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {upcoming.map((e, i) => (
              <li key={i}>
                <Link href={companyHref(e.company.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-fill">
                  <div className="w-24 shrink-0 text-sm">
                    <b>{md(e.date)}</b>
                    <span className="text-sub">（{weekday(e.date)}）</span>
                    {e.time && <div className="text-xs text-sub">{e.time}</div>}
                  </div>
                  <CompanyLogo company={e.company} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{e.company.name}</div>
                    <div className="truncate text-xs text-sub">{e.label}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${KIND[e.kind].cls}`}>{KIND[e.kind].label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
