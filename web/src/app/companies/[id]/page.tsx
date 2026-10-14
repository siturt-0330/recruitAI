'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { fetchLogo } from '@/components/AddCompanyDialog';
import { IndustrySelect } from '@/components/IndustrySelect';
import { InterviewEditor, InterviewStrip, SophonReviewPanel } from '@/components/InterviewEditor';
import { Button, CompanyLogo, Empty, Field, Select, TextArea } from '@/components/ui';
import { emptyEsAnswer, emptyInterview } from '@/lib/seed';
import { STAGES, stageOrder } from '@/lib/stages';
import { useStore } from '@/lib/store';
import type { Company, Stage } from '@/lib/types';

type Tab = 'overview' | 'interviews' | 'es';

export default function CompanyPage() {
  return (
    <Suspense>
      <CompanyView />
    </Suspense>
  );
}

function CompanyView() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const data = useStore();
  const company = data.companies.find((c) => c.id === id);
  const interviews = data.interviews.filter((i) => i.companyId === id).sort((a, b) => b.at.localeCompare(a.at));
  const [tab, setTab] = useState<Tab>(search.get('interview') || interviews.length ? 'interviews' : 'overview');
  const [selected, setSelected] = useState(search.get('interview') ?? interviews[0]?.id ?? '');

  if (!company) {
    return <Empty title="企業が見つかりません" action={<Link href="/board" className="font-bold text-ind">企業ボードへ</Link>} />;
  }
  const current = interviews.find((i) => i.id === selected) ?? interviews[0];

  const addInterview = () => {
    const rounds = ['一次面接', '二次面接', '三次面接', '最終面接'];
    const i = emptyInterview(company.id, rounds[Math.min(interviews.length, rounds.length - 1)]);
    data.upsertInterview(i);
    setSelected(i.id);
    setTab('interviews');
  };

  return (
    <div className="px-6 py-4">
      <Link href="/board" className="mb-3 inline-flex items-center gap-1 text-[13px] text-sub hover:text-ink">
        <ArrowLeft size={14} />
        企業ボード
      </Link>
      <div className="flex items-center gap-3">
        <CompanyLogo company={company} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold">{company.name}</h1>
          <div className="flex items-center gap-2 text-[13px] text-sub">
            {company.industry}
            {company.mypageUrl && (
              <a href={company.mypageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ind hover:underline">
                マイページを開く <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </div>

      <Stepper stage={company.stage} onChange={(stage) => data.patchCompany(company.id, { stage })} />

      <nav className="mb-5 flex gap-6 border-b border-line text-sm">
        {(
          [
            ['overview', '概要'],
            ['interviews', `面接ログ ${interviews.length}`],
            ['es', 'ES'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-[3px] pb-2.5 ${tab === t ? 'border-[#1D9BF0] font-bold' : 'border-transparent text-sub hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <Overview company={company} onDeleted={() => router.push('/board')} />}

      {tab === 'interviews' &&
        (current ? (
          <div className="flex flex-col gap-5">
            <InterviewStrip interviews={interviews} selected={current.id} onSelect={setSelected} onAdd={addInterview} />
            <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-6">
              <InterviewEditor key={current.id} interview={current} />
              <div className="sticky top-4">
                <SophonReviewPanel interview={current} />
              </div>
            </div>
          </div>
        ) : (
          <Empty title="面接ログはまだありません" action={<Button variant="primary" onClick={addInterview}><Plus size={15} />面接を追加</Button>} />
        ))}

      {tab === 'es' && <CompanyEs company={company} />}
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
            if (!confirm(`「${company.name}」と、その面接ログを削除しますか？`)) return;
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

function CompanyEs({ company }: { company: Company }) {
  const { esAnswers, upsertEsAnswer } = useStore();
  const linked = esAnswers.filter((a) => a.companyIds.includes(company.id));
  return (
    <div className="max-w-3xl">
      <ul className="flex flex-col gap-2">
        {linked.map((a) => (
          <li key={a.id}>
            <Link href={`/es?id=${a.id}`} className="block rounded-2xl border border-line p-4 hover:bg-fill">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indbg px-2 py-0.5 text-xs text-indtext">{a.category}</span>
                <b className="text-sm">{a.title || '無題'}</b>
                <span className="ml-auto text-xs text-mute">
                  {[...a.text].length}
                  {a.charLimit ? ` / ${a.charLimit}字` : '字'}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm text-sub">{a.text}</p>
            </Link>
          </li>
        ))}
      </ul>
      <Button
        className="mt-3"
        onClick={() => {
          const a = { ...emptyEsAnswer('志望動機'), title: `${company.name} 志望動機`, companyIds: [company.id] };
          upsertEsAnswer(a);
          location.href = `/es?id=${a.id}`;
        }}
      >
        <Plus size={15} />
        この企業の ES を書く
      </Button>
    </div>
  );
}
