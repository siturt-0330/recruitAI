'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Loader2, Plus, Send, Sparkles, Trash2, X } from 'lucide-react';
import { Button, Empty, PageHeader, TextArea } from '@/components/ui';
import { companiesUsingEpisode } from '@/lib/analysis';
import { emptyEpisode } from '@/lib/seed';
import { deepDive } from '@/lib/sophon';
import { useStore } from '@/lib/store';
import type { Episode, SheetId } from '@/lib/types';

const SHEETS: { id: SheetId; label: string; questions: { id: string; label: string; placeholder?: string }[] }[] = [
  {
    id: 'history',
    label: '自分史',
    questions: [
      { id: 'elementary', label: '小学生のころ', placeholder: '熱中したこと・印象に残っている出来事' },
      { id: 'junior', label: '中学生のころ' },
      { id: 'high', label: '高校生のころ' },
      { id: 'univ', label: '大学生になってから' },
    ],
  },
  {
    id: 'strengths',
    label: '強み・弱み',
    questions: [
      { id: 'strength', label: '自分の強み', placeholder: '巻き込む力' },
      { id: 'strengthEpisode', label: '強みが表れたエピソード' },
      { id: 'weakness', label: '自分の弱み' },
      { id: 'weaknessCare', label: '弱みとどう向き合っているか' },
    ],
  },
  {
    id: 'values',
    label: '価値観',
    questions: [
      { id: 'work', label: '仕事で大切にしたいこと' },
      { id: 'joy', label: 'うれしいと感じる瞬間' },
      { id: 'avoid', label: '苦手な環境' },
      { id: 'respect', label: '尊敬する人と、その理由' },
      { id: 'future', label: '10年後どうなっていたいか' },
    ],
  },
  {
    id: 'gakuchika',
    label: 'ガクチカ',
    questions: [
      { id: 'theme', label: 'テーマ（一言で）', placeholder: 'サークルの新歓改革' },
      { id: 'summary', label: '30秒で話すとしたら' },
      { id: 'appeal', label: 'この話で伝えたい強み' },
    ],
  },
];

type View = 'episodes' | SheetId;

export default function SelfAnalysisPage() {
  const { episodes, sheets, upsertEpisode } = useStore();
  const [view, setView] = useState<View>('episodes');
  const [selected, setSelected] = useState(episodes[0]?.id ?? '');
  const current = episodes.find((e) => e.id === selected) ?? episodes[0];

  const addEpisode = () => {
    const e = emptyEpisode();
    upsertEpisode(e);
    setSelected(e.id);
    setView('episodes');
  };

  return (
    <div>
      <PageHeader title="自己分析" />
      <div className="grid grid-cols-[176px_minmax(0,1fr)] gap-5 px-6 py-5">
        <nav className="flex flex-col gap-1">
          <NavItem on={view === 'episodes'} onClick={() => setView('episodes')} label="エピソード" meta={String(episodes.length)} />
          {SHEETS.map((s) => {
            const filled = s.questions.filter((q) => sheets[s.id]?.[q.id]?.trim()).length;
            return <NavItem key={s.id} on={view === s.id} onClick={() => setView(s.id)} label={s.label} meta={filled === s.questions.length ? '✓' : `${filled}/${s.questions.length}`} />;
          })}
        </nav>

        {view === 'episodes' ? (
          episodes.length === 0 || !current ? (
            <Empty title="エピソードがありません" action={<Button variant="primary" onClick={addEpisode}><Plus size={15} />エピソードを追加</Button>} />
          ) : (
            <div className="flex min-w-0 flex-col gap-5">
              <EpisodeStrip episodes={episodes} selected={current.id} onSelect={setSelected} onAdd={addEpisode} />
              <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6">
                <EpisodeEditor key={current.id} episode={current} />
                <DeepDive key={`chat-${current.id}`} episode={current} />
              </div>
            </div>
          )
        ) : (
          <Sheet sheet={SHEETS.find((s) => s.id === view)!} />
        )}
      </div>
    </div>
  );
}

function NavItem({ on, onClick, label, meta }: { on: boolean; onClick(): void; label: string; meta: string }) {
  return (
    <button onClick={onClick} className={`flex items-center justify-between rounded-full px-4 py-2.5 text-left text-sm ${on ? 'bg-indbg font-bold text-indtext' : 'hover:bg-fill'}`}>
      {label}
      <span className="text-xs font-normal text-mute">{meta}</span>
    </button>
  );
}

const STAR: { key: 'situation' | 'task' | 'action' | 'result'; label: string; placeholder: string }[] = [
  { key: 'situation', label: '状況', placeholder: 'どんな場面だったか' },
  { key: 'task', label: '課題', placeholder: '何が問題だったか' },
  { key: 'action', label: '行動', placeholder: '自分が具体的にしたこと' },
  { key: 'result', label: '結果', placeholder: 'どうなったか（数字があれば）' },
];

/** エピソードを横に並べたカード。4つの点は 状況・課題・行動・結果 が書けているか */
function EpisodeStrip({ episodes, selected, onSelect, onAdd }: { episodes: Episode[]; selected: string; onSelect(id: string): void; onAdd(): void }) {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
      {episodes.map((e) => {
        const on = e.id === selected;
        return (
          <button
            key={e.id}
            onClick={() => onSelect(e.id)}
            className={`flex w-48 shrink-0 flex-col gap-2 rounded-2xl border p-3 text-left transition-colors ${on ? 'border-ind bg-indbg ring-1 ring-ind' : 'border-line hover:bg-fill'}`}
          >
            <div className="min-w-0">
              <div className={`truncate text-sm font-bold ${on ? 'text-indtext' : ''}`}>{e.title || '無題'}</div>
              <div className="truncate text-xs text-sub">{e.period || '—'}</div>
            </div>
            <div className="flex items-center gap-1">
              {STAR.map((s) => (
                <span key={s.key} title={s.label} className={`h-1.5 flex-1 rounded-full ${e[s.key].trim() ? 'bg-ind' : 'bg-line'}`} />
              ))}
            </div>
          </button>
        );
      })}
      <button onClick={onAdd} className="flex w-14 shrink-0 items-center justify-center rounded-2xl border border-dashed border-box text-sub hover:bg-fill" aria-label="エピソードを追加">
        <Plus size={18} />
      </button>
    </div>
  );
}

function EpisodeEditor({ episode }: { episode: Episode }) {
  const data = useStore();
  const [tag, setTag] = useState('');
  const set = (p: Partial<Episode>) => data.patchEpisode(episode.id, p);
  const usedBy = companiesUsingEpisode(data, episode.id);

  return (
    <article className="min-w-0 rounded-2xl border border-line p-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={episode.title}
            placeholder="エピソードの名前"
            onChange={(e) => set({ title: e.target.value })}
            className="w-full bg-transparent text-2xl font-extrabold outline-none placeholder:text-mute"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <input
              value={episode.period}
              placeholder="時期"
              onChange={(e) => set({ period: e.target.value })}
              className="w-24 rounded-full bg-fill px-2.5 py-1 outline-none focus:ring-1 focus:ring-ind"
            />
            {usedBy.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indbg px-2.5 py-1 text-indtext">
                <Building2 size={12} />
                {usedBy.join('・')}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => confirm('このエピソードを削除しますか？') && data.removeEpisode(episode.id)}
          className="rounded-full p-2 text-mute hover:bg-dangerbg hover:text-danger"
          aria-label="エピソードを削除"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <ol className="mt-6">
        {STAR.map((s, i) => {
          const filled = !!episode[s.key].trim();
          const last = i === STAR.length - 1;
          return (
            <li key={s.key} className="relative flex gap-4 pb-5 last:pb-0">
              {!last && <span className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${filled ? 'bg-ind' : 'bg-line'}`} />}
              <span
                className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                  filled ? 'bg-ind text-white' : 'border-2 border-box bg-white text-mute'
                }`}
              >
                {s.label[0]}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <div className="text-sm font-bold">{s.label}</div>
                <textarea
                  value={episode[s.key]}
                  placeholder={s.placeholder}
                  rows={1}
                  onChange={(e) => set({ [s.key]: e.target.value })}
                  className="field-sizing-content mt-1 min-h-[2.75rem] w-full resize-none rounded-xl bg-fill px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-mute focus:bg-white focus:ring-1 focus:ring-ind"
                />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 border-t border-line pt-4">
        <div className="mb-2 text-sm font-bold">強み</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {episode.strengths.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-ind px-3 py-1 text-[13px] text-white">
              {s}
              <button onClick={() => set({ strengths: episode.strengths.filter((x) => x !== s) })} aria-label={`${s}を外す`} className="opacity-70 hover:opacity-100">
                <X size={12} />
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tag.trim() && !episode.strengths.includes(tag.trim())) set({ strengths: [...episode.strengths, tag.trim()] });
              setTag('');
            }}
          >
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="＋ 追加" className="w-24 rounded-full border border-dashed border-box px-3 py-1 text-[13px] outline-none focus:border-ind" />
          </form>
        </div>
      </div>
    </article>
  );
}

function DeepDive({ episode }: { episode: Episode }) {
  const { patchEpisode } = useStore();
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [episode.chat.length]);

  const askNext = async (e: Episode) => {
    setThinking(true);
    const r = await deepDive(e);
    setThinking(false);
    const strengths = [...new Set([...e.strengths, ...r.strengths])].slice(0, 6);
    patchEpisode(e.id, { chat: [...e.chat, { role: 'sophon', text: r.question }], strengths });
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    const next = { ...episode, chat: [...episode.chat, { role: 'me' as const, text }] };
    patchEpisode(episode.id, { chat: next.chat });
    await askNext(next);
  };

  return (
    <aside className="sticky top-20 flex max-h-[calc(100vh-110px)] flex-col rounded-2xl border border-indline bg-indbg">
      <div className="flex items-center gap-2.5 border-b border-indline p-3">
        <span className={`orb h-8 w-8 ${thinking ? 'live' : ''}`} />
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold text-indtext">Sophon</div>
          <div className="truncate text-xs text-[#6B6FB0]">{thinking ? '考え中…' : '深掘り'}</div>
        </div>
      </div>
      <div className="flex min-h-48 flex-1 flex-col gap-2 overflow-y-auto p-3 scrollbar-thin">
        {episode.chat.length === 0 && (
          <div className="flex flex-col items-start gap-2 text-sm text-indtext">
            <Button variant="primary" onClick={() => askNext(episode)} disabled={thinking}>
              {thinking ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              質問してもらう
            </Button>
          </div>
        )}
        {episode.chat.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
              m.role === 'sophon' ? 'self-start border border-indline bg-white' : 'self-end bg-ind text-white'
            }`}
          >
            {m.text}
          </div>
        ))}
        {thinking && <div className="self-start rounded-2xl border border-indline bg-white px-3 py-2 text-[13px] text-mute">…</div>}
        <div ref={bottom} />
      </div>
      {episode.chat.length > 0 && (
        <form
          className="flex items-center gap-2 border-t border-indline p-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="答えを入力…" className="min-w-0 flex-1 rounded-full border border-indline bg-white px-3.5 py-2 text-[13px] outline-none focus:border-ind" />
          <button type="submit" disabled={thinking || !input.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-ind text-white disabled:opacity-40" aria-label="送信">
            <Send size={15} />
          </button>
        </form>
      )}
    </aside>
  );
}

function Sheet({ sheet }: { sheet: (typeof SHEETS)[number] }) {
  const { sheets, setSheetAnswer } = useStore();
  const answers = sheets[sheet.id] ?? {};
  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 text-lg font-extrabold">{sheet.label}</h2>
      <div className="flex flex-col gap-3">
        {sheet.questions.map((q) => (
          <TextArea key={q.id} label={q.label} rows={3} placeholder={q.placeholder} value={answers[q.id] ?? ''} onChange={(e) => setSheetAnswer(sheet.id, q.id, e.target.value)} />
        ))}
      </div>
    </div>
  );
}
