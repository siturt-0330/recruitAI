'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import { Button, Chip, CompanyLogo, Empty, Field, PageHeader } from '@/components/ui';
import { emptyEsAnswer } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { EsAnswer } from '@/lib/types';

const CATEGORIES: EsAnswer['category'][] = ['志望動機', '自己PR', 'ガクチカ', '長所・短所', 'その他'];

export default function EsPage() {
  return (
    <Suspense>
      <EsView />
    </Suspense>
  );
}

function EsView() {
  const { esAnswers, upsertEsAnswer } = useStore();
  const search = useSearchParams();
  const [filter, setFilter] = useState<EsAnswer['category'] | 'all'>('all');
  const [selected, setSelected] = useState(search.get('id') ?? esAnswers[0]?.id ?? '');
  const list = esAnswers.filter((a) => filter === 'all' || a.category === filter).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const current = esAnswers.find((a) => a.id === selected) ?? list[0];

  const add = () => {
    const a = emptyEsAnswer(filter === 'all' ? '志望動機' : filter);
    upsertEsAnswer(a);
    setSelected(a.id);
  };

  return (
    <div>
      <PageHeader
        title="ES"
        actions={
          <Button variant="primary" onClick={add}>
            <Plus size={16} />
            回答を追加
          </Button>
        }
      />
      <div className="px-6 py-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip on={filter === 'all'} onClick={() => setFilter('all')}>
            すべて {esAnswers.length}
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} on={filter === c} onClick={() => setFilter(c)}>
              {c} {esAnswers.filter((a) => a.category === c).length}
            </Chip>
          ))}
        </div>
        {!current ? (
          <Empty title="ES の回答をためましょう" action={<Button variant="primary" onClick={add}><Plus size={15} />回答を追加</Button>} />
        ) : (
          <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-5">
            <ul className="flex flex-col gap-1.5">
              {list.map((a) => (
                <li key={a.id}>
                  <button onClick={() => setSelected(a.id)} className={`w-full rounded-xl border px-3 py-2.5 text-left ${a.id === current.id ? 'border-indline bg-indbg' : 'border-line hover:bg-fill'}`}>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-indtext ring-1 ring-indline">{a.category}</span>
                      <span className="ml-auto text-[11px] text-mute">
                        {[...a.text].length}
                        {a.charLimit ? `/${a.charLimit}` : ''}字
                      </span>
                    </div>
                    <div className="mt-1 truncate text-sm font-bold">{a.title || '無題'}</div>
                    <div className="truncate text-xs text-sub">{a.text || 'まだ書いていません'}</div>
                  </button>
                </li>
              ))}
            </ul>
            <EsEditor key={current.id} answer={current} />
          </div>
        )}
      </div>
    </div>
  );
}

function EsEditor({ answer }: { answer: EsAnswer }) {
  const { patchEsAnswer, removeEsAnswer, companies, episodes } = useStore();
  const [copied, setCopied] = useState(false);
  const set = (p: Partial<EsAnswer>) => patchEsAnswer(answer.id, p);
  const length = [...answer.text].length;
  const over = answer.charLimit > 0 && length > answer.charLimit;
  const ratio = answer.charLimit ? Math.min(1, length / answer.charLimit) : 0;
  const toggle = (key: 'companyIds' | 'episodeIds', id: string) =>
    set({ [key]: answer[key].includes(id) ? answer[key].filter((x) => x !== id) : [...answer[key], id] });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Chip key={c} on={answer.category === c} onClick={() => set({ category: c })}>
            {c}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <Field label="タイトル" value={answer.title} placeholder="B商事 志望動機（400字）" onChange={(e) => set({ title: e.target.value })} />
        <Field label="字数制限（0 はなし）" type="number" min={0} value={answer.charLimit} onChange={(e) => set({ charLimit: Math.max(0, Number(e.target.value) || 0) })} />
      </div>
      <div>
        <label className="fl">
          <span>本文</span>
          <textarea rows={12} value={answer.text} onChange={(e) => set({ text: e.target.value })} />
        </label>
        <div className="mt-2 flex items-center gap-3">
          {answer.charLimit > 0 && (
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <span className={`block h-full ${over ? 'bg-danger' : 'bg-ind'}`} style={{ width: `${ratio * 100}%` }} />
            </span>
          )}
          <span className={`text-sm ${over ? 'font-bold text-danger' : 'text-sub'}`}>
            {length}
            {answer.charLimit > 0 && ` / ${answer.charLimit}`}字{over && `（${length - answer.charLimit}字オーバー）`}
          </span>
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(answer.text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'コピーしました' : 'コピー'}
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-bold text-sub">使った企業</div>
        <div className="flex flex-wrap gap-1.5">
          {companies.length === 0 && <span className="text-xs text-mute">—</span>}
          {companies.map((c) => {
            const on = answer.companyIds.includes(c.id);
            return (
              <button key={c.id} onClick={() => toggle('companyIds', c.id)} className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs ${on ? 'border-ind bg-indbg text-indtext' : 'border-box text-sub hover:bg-fill'}`}>
                <CompanyLogo company={c} size={20} />
                {c.name}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-xs font-bold text-sub">もとにしたエピソード</div>
        <div className="flex flex-wrap gap-1.5">
          {episodes.length === 0 && <span className="text-xs text-mute">—</span>}
          {episodes.map((e) => (
            <Chip key={e.id} on={answer.episodeIds.includes(e.id)} onClick={() => toggle('episodeIds', e.id)} className="h-7 text-xs">
              {e.title}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex justify-end border-t border-line pt-3">
        <Button variant="danger" onClick={() => confirm('この回答を削除しますか？') && removeEsAnswer(answer.id)}>
          <Trash2 size={14} />
          削除
        </Button>
      </div>
    </div>
  );
}
