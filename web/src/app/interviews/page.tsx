'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Stars } from '@/components/InterviewEditor';
import { CompanyLogo, Empty, PageHeader, SophonCard } from '@/components/ui';
import { frequentQuestions } from '@/lib/analysis';
import { pad2, today, weekday } from '@/lib/dates';
import { useStore } from '@/lib/store';
import type { Company, Interview } from '@/lib/types';

export default function InterviewsPage() {
  const data = useStore();
  const freq = useMemo(() => frequentQuestions(data), [data]);
  const byId = new Map(data.companies.map((c) => [c.id, c]));
  const d = new Date();
  const now = `${today()}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const rows = data.interviews
    .map((i) => ({ i, c: byId.get(i.companyId) }))
    .filter((r): r is { i: Interview; c: Company } => !!r.c);
  const upcoming = rows.filter((r) => r.i.at >= now).sort((a, b) => a.i.at.localeCompare(b.i.at));
  const past = rows.filter((r) => r.i.at < now).sort((a, b) => b.i.at.localeCompare(a.i.at));

  return (
    <div>
      <PageHeader title="面接ログ" />
      <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6 px-6 py-5">
        <div className="flex flex-col gap-6">
          {rows.length === 0 && <Empty title="面接ログはまだありません" action={<Link href="/board" className="font-bold text-ind">企業ボードへ</Link>} />}
          {upcoming.length > 0 && <Group title="これから" rows={upcoming} />}
          {past.length > 0 && <Group title="終わった面接" rows={past} />}
        </div>

        <SophonCard title="よく聞かれる質問" className="sticky top-20">
          {freq.length === 0 ? (
            <p className="text-sm text-sub">まだありません</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {freq.slice(0, 8).map((f, n) => (
                <li key={f.topic} className="flex gap-2.5 rounded-xl border border-indline bg-white p-3">
                  <span className="text-sm font-extrabold text-indtext">{n + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <b className="flex-1 truncate text-sm">{f.topic}</b>
                      <span className="shrink-0 text-xs text-indtext">{f.companies.length}社</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-sub">{f.companies.join('・')}</div>
                    {f.stuck > 0 && <span className="mt-1 inline-block rounded-full bg-dangerbg px-2 py-0.5 text-[11px] text-danger">詰まった {f.stuck}</span>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </SophonCard>
      </div>
    </div>
  );
}

function Group({ title, rows }: { title: string; rows: { i: Interview; c: Company }[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-sub">
        {title} <span className="font-normal text-mute">{rows.length}</span>
      </h2>
      <ul className="overflow-hidden rounded-2xl border border-line">
        {rows.map(({ i, c }) => {
          const stuck = i.questions.filter((q) => q.stuck).length;
          const date = i.at.slice(0, 10);
          const unreviewed = title === '終わった面接' && !i.rating && !i.questions.length;
          return (
            <li key={i.id} className="border-t border-line first:border-t-0">
              <Link href={`/companies/${c.id}?interview=${i.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-fill">
                <div className="w-12 shrink-0 text-center">
                  <div className="text-[11px] text-mute">
                    {Number(date.slice(5, 7))}月 {weekday(date)}
                  </div>
                  <div className="text-xl font-extrabold leading-tight">{Number(date.slice(8))}</div>
                </div>
                <CompanyLogo company={c} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">
                    {c.name}
                    <span className="ml-2 font-normal text-sub">{i.round}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-sub">
                    <span>{i.at.slice(11, 16)}</span>
                    <span className="rounded-full bg-fill px-2 py-0.5">{i.format}</span>
                    {i.questions.length > 0 && <span className="rounded-full bg-fill px-2 py-0.5">質問 {i.questions.length}</span>}
                    {stuck > 0 && <span className="rounded-full bg-dangerbg px-2 py-0.5 text-danger">詰まった {stuck}</span>}
                  </div>
                </div>
                {unreviewed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indbg px-2.5 py-1 text-xs font-bold text-indtext">
                    <span className="orb h-3.5 w-3.5" />
                    振り返りを書く
                  </span>
                ) : (
                  i.rating > 0 && <Stars value={i.rating} size={14} />
                )}
                <ChevronRight size={16} className="shrink-0 text-mute" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
