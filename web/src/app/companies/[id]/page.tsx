'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { fetchLogo } from '@/components/AddCompanyDialog';
import { IndustrySelect } from '@/components/IndustrySelect';
import { Button, CompanyLogo, Empty, Field, Select, TextArea } from '@/components/ui';
import { STAGES, stageOrder } from '@/lib/stages';
import { useStore } from '@/lib/store';
import type { Company, Stage } from '@/lib/types';

export default function CompanyPage() {
  return (
    <Suspense>
      <CompanyView />
    </Suspense>
  );
}

function CompanyView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const data = useStore();
  const company = data.companies.find((c) => c.id === id);

  if (!company) {
    return <Empty title="企業が見つかりません" action={<Link href="/companies" className="font-bold text-ind">企業へ</Link>} />;
  }

  return (
    <div className="px-6 py-4">
      <Link href="/companies" className="mb-3 inline-flex items-center gap-1 text-[13px] text-sub hover:text-ink">
        <ArrowLeft size={14} />
        企業
      </Link>
      <div className="flex items-center gap-3">
        <CompanyLogo company={company} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold">{company.name}</h1>
          <div className="flex items-center gap-2 text-[13px] text-sub">
            {company.industry}
            {company.mypageUrl && (
              <a href={company.mypageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-link hover:underline">
                マイページを開く <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </div>

      <Stepper stage={company.stage} onChange={(stage) => data.patchCompany(company.id, { stage })} />
      <Overview company={company} onDeleted={() => router.push('/companies')} />
    </div>
  );
}

const STEPS: { label: string; stages: Stage[] }[] = [
  { label: 'エントリー', stages: ['entry'] },
  { label: 'ES', stages: ['esSubmitted'] },
  { label: '一次', stages: ['interview1'] },
  { label: '二次', stages: ['interview2'] },
  { label: '最終', stages: ['final'] },
  { label: '内定', stages: ['offer'] },
];

function Stepper({ stage, onChange }: { stage: Stage; onChange(s: Stage): void }) {
  const currentIndex = STEPS.findIndex((s) => s.stages.includes(stage));
  return (
    <div className="my-5 flex flex-wrap items-center gap-2">
      {STEPS.map((s, i) => {
        const done = currentIndex > i || stage === 'offer';
        const now = currentIndex === i;
        return (
          <div key={s.label} className="flex items-center gap-2">
            {i > 0 && <span className={`h-px w-6 ${done || now ? 'bg-ind' : 'bg-box'}`} />}
            <button
              onClick={() => onChange(s.stages[s.stages.length - 1]!)}
              className={`flex items-center gap-1.5 text-[13px] ${now ? 'font-bold text-ind' : done ? 'text-ink' : 'text-mute'}`}
              title={`「${s.label}」にする`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] text-[10px] ${
                  done ? 'border-ind bg-ind text-white' : now ? 'border-ind text-ind' : 'border-box'
                }`}
              >
                {done ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              {s.label}
            </button>
          </div>
        );
      })}
      {stage === 'closed' && <span className="ml-2 rounded-full bg-fill px-2.5 py-0.5 text-xs text-sub">選考終了</span>}
    </div>
  );
}

function Overview({ company, onDeleted }: { company: Company; onDeleted(): void }) {
  const { patchCompany, removeCompany } = useStore();
  const [logoState, setLogoState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const set = (p: Partial<Company>) => patchCompany(company.id, p);

  const refetch = async () => {
    if (!company.url) return;
    setLogoState('loading');
    const r = await fetchLogo(company.url);
    if (r.logo) {
      set({ logo: r.logo });
      setLogoState('done');
    } else setLogoState('error');
  };

  return (
    <div className="grid max-w-3xl grid-cols-2 gap-3">
      <Field label="企業名" value={company.name} onChange={(e) => set({ name: e.target.value })} />
      <IndustrySelect value={company.industry} onChange={(v) => set({ industry: v })} />
      <div className="col-span-2 flex items-center gap-2">
        <Field label="採用ページ・公式サイト" className="flex-1" value={company.url} placeholder="https://" onChange={(e) => set({ url: e.target.value })} />
        <Button onClick={refetch} disabled={!company.url || logoState === 'loading'}>
          {logoState === 'loading' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          ロゴを取得
        </Button>
      </div>
      {logoState === 'error' && <p className="col-span-2 -mt-1 text-xs text-danger">ロゴが見つかりませんでした</p>}
      <Select label="選考状況" value={company.stage} onChange={(e) => set({ stage: e.target.value as Stage })}>
        {[...STAGES].sort((a, b) => stageOrder(a.id) - stageOrder(b.id)).map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </Select>
      <div />
      <Field label="締切" type="date" value={company.deadline} onChange={(e) => set({ deadline: e.target.value })} />
      <Field label="締切の内容" value={company.deadlineLabel} placeholder="ES・適性検査など" onChange={(e) => set({ deadlineLabel: e.target.value })} />
      <Field label="次の予定（日時）" type="datetime-local" value={company.nextAt} onChange={(e) => set({ nextAt: e.target.value })} />
      <Field label="次の予定の内容" value={company.nextLabel} placeholder="一次面接（Web）" onChange={(e) => set({ nextLabel: e.target.value })} />
      <Field label="マイページの URL" value={company.mypageUrl} placeholder="https://" onChange={(e) => set({ mypageUrl: e.target.value })} />
      <Field label="マイページのログイン ID" value={company.loginId} onChange={(e) => set({ loginId: e.target.value })} />
      <TextArea label="メモ" placeholder="パスワードは書かないでください" className="col-span-2" rows={6} value={company.memo} onChange={(e) => set({ memo: e.target.value })} />
      <div className="col-span-2 flex justify-end">
        <Button
          variant="danger"
          onClick={() => {
            if (!confirm(`「${company.name}」を削除しますか？`)) return;
            onDeleted();
            removeCompany(company.id);
          }}
        >
          <Trash2 size={14} />
          企業を削除
        </Button>
      </div>
    </div>
  );
}
