'use client';

import { useState } from 'react';
import { ChevronDown, Loader2, Mic, Plus, Sparkles, Star, Trash2, X } from 'lucide-react';
import { mdTime } from '@/lib/dates';
import { uid } from '@/lib/seed';
import { organizeNotes, reviewInterview } from '@/lib/sophon';
import { useStore } from '@/lib/store';
import type { Interview, InterviewQuestion } from '@/lib/types';
import { Button } from './ui';

const FORMATS: Interview['format'][] = ['対面', 'Web', '電話'];

/** 手応えの星。読み取り専用にもできる */
export function Stars({ value, onChange, size = 18 }: { value: number; onChange?(v: number): void; size?: number }) {
  return (
    <span className="inline-flex items-center">
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Star size={size} className={n <= value ? 'fill-[#F5B301] text-[#F5B301]' : 'text-box'} />;
        return onChange ? (
          <button key={n} type="button" onClick={() => onChange(value === n ? 0 : n)} className="p-0.5" aria-label={`手応え ${n}`}>
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        );
      })}
    </span>
  );
}

/** 同じ企業の面接を横に並べたカード */
export function InterviewStrip({ interviews, selected, onSelect, onAdd }: { interviews: Interview[]; selected: string; onSelect(id: string): void; onAdd(): void }) {
  const ordered = [...interviews].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
      {ordered.map((i) => {
        const on = i.id === selected;
        const stuck = i.questions.filter((q) => q.stuck).length;
        return (
          <button
            key={i.id}
            onClick={() => onSelect(i.id)}
            className={`flex w-44 shrink-0 flex-col gap-1.5 rounded-2xl border p-3 text-left transition-colors ${on ? 'border-ind bg-indbg ring-1 ring-ind' : 'border-line hover:bg-fill'}`}
          >
            <div className={`truncate text-sm font-bold ${on ? 'text-indtext' : ''}`}>{i.round || '面接'}</div>
            <div className="text-xs text-sub">{mdTime(i.at)}</div>
            <div className="flex items-center justify-between">
              <Stars value={i.rating} size={12} />
              {stuck > 0 && <span className="rounded-full bg-dangerbg px-1.5 text-[11px] text-danger">詰 {stuck}</span>}
            </div>
          </button>
        );
      })}
      <button onClick={onAdd} className="flex w-14 shrink-0 items-center justify-center rounded-2xl border border-dashed border-box text-sub hover:bg-fill" aria-label="面接を追加">
        <Plus size={18} />
      </button>
    </div>
  );
}

const areaCls =
  'field-sizing-content w-full resize-none rounded-xl bg-fill px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-mute focus:bg-white focus:ring-1 focus:ring-ind';

export function InterviewEditor({ interview }: { interview: Interview }) {
  const { patchInterview, removeInterview, episodes } = useStore();
  const [organizing, setOrganizing] = useState(false);
  const [notesOpen, setNotesOpen] = useState(!interview.questions.length);
  const [notice, setNotice] = useState('');
  const set = (p: Partial<Interview>) => patchInterview(interview.id, p);
  const setQ = (id: string, p: Partial<InterviewQuestion>) => set({ questions: interview.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) });
  const addQuestion = () => set({ questions: [...interview.questions, { id: uid(), question: '', answer: '', stuck: false, episodeId: '' }] });

  const organize = async () => {
    if (!interview.rawNotes.trim()) return;
    setOrganizing(true);
    const r = await organizeNotes(interview.rawNotes);
    setOrganizing(false);
    if (!r.questions.length) {
      setNotice('質問を見つけられませんでした');
      return;
    }
    set({
      questions: [...interview.questions, ...r.questions],
      reverseQuestions: [interview.reverseQuestions, r.reverseQuestions].filter(Boolean).join('\n'),
      improvements: [interview.improvements, r.improvements].filter(Boolean).join('\n'),
    });
    setNotice('');
    setNotesOpen(false);
  };

  return (
    <article className="min-w-0 rounded-2xl border border-line p-6">
      {/* 見出し：段階・日時・形式・手応え */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={interview.round}
            placeholder="一次面接"
            onChange={(e) => set({ round: e.target.value })}
            className="w-full bg-transparent text-2xl font-extrabold outline-none placeholder:text-mute"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            <input
              type="datetime-local"
              value={interview.at}
              onChange={(e) => set({ at: e.target.value })}
              className="rounded-full bg-fill px-3 py-1 outline-none focus:ring-1 focus:ring-ind"
            />
            <div className="flex rounded-full bg-fill p-0.5">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => set({ format: f })}
                  className={`rounded-full px-3 py-0.5 ${interview.format === f ? 'bg-white font-bold shadow-sm' : 'text-sub hover:text-ink'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <input
              value={interview.interviewers}
              placeholder="面接官"
              onChange={(e) => set({ interviewers: e.target.value })}
              className="w-40 rounded-full bg-fill px-3 py-1 outline-none placeholder:text-mute focus:ring-1 focus:ring-ind"
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={() => confirm('この面接ログを削除しますか？') && removeInterview(interview.id)}
            className="rounded-full p-2 text-mute hover:bg-dangerbg hover:text-danger"
            aria-label="面接ログを削除"
          >
            <Trash2 size={16} />
          </button>
          <Stars value={interview.rating} onChange={(rating) => set({ rating })} />
        </div>
      </div>

      {/* メモから作る */}
      <div className="mt-5 rounded-2xl border border-indline bg-indbg/50">
        <button onClick={() => setNotesOpen(!notesOpen)} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold text-indtext">
          <Mic size={15} />
          メモから作る
          <ChevronDown size={15} className={`ml-auto transition-transform ${notesOpen ? 'rotate-180' : ''}`} />
        </button>
        {notesOpen && (
          <div className="flex flex-col gap-2 px-4 pb-4">
            <textarea
              rows={4}
              value={interview.rawNotes}
              placeholder={'Q: 学生時代に力を入れたことは？\nサークルの新歓の話をした\nQ: チームで意見が割れたときは？\n詰まってしまった\n逆質問: 若手の海外駐在について'}
              onChange={(e) => {
                set({ rawNotes: e.target.value });
                setNotice('');
              }}
              className="w-full resize-y rounded-xl border border-indline bg-white px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-mute focus:border-ind"
            />
            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={organize} disabled={organizing || !interview.rawNotes.trim()}>
                {organizing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                Sophon で整理
              </Button>
              {notice && <span className="text-xs text-danger">{notice}</span>}
            </div>
          </div>
        )}
      </div>

      {/* 質問と答え */}
      <section className="mt-6">
        <h3 className="mb-3 text-sm font-bold">
          質問 <span className="font-normal text-mute">{interview.questions.length}</span>
        </h3>
        <ol className="flex flex-col gap-4">
          {interview.questions.map((q, n) => (
            <li key={q.id} className="group flex gap-3">
              <span
                className={`mt-0.5 flex h-7 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  q.stuck ? 'bg-dangerbg text-danger' : 'bg-indbg text-indtext'
                }`}
              >
                Q{n + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <input
                    value={q.question}
                    placeholder="聞かれた質問"
                    onChange={(e) => setQ(q.id, { question: e.target.value })}
                    className="min-w-0 flex-1 bg-transparent py-0.5 text-[15px] font-bold outline-none placeholder:font-normal placeholder:text-mute"
                  />
                  <button
                    onClick={() => set({ questions: interview.questions.filter((x) => x.id !== q.id) })}
                    className="rounded-full p-1 text-mute opacity-0 hover:bg-fill hover:text-danger group-hover:opacity-100"
                    aria-label="質問を削除"
                  >
                    <X size={15} />
                  </button>
                </div>
                <textarea
                  value={q.answer}
                  rows={1}
                  placeholder="自分の答え"
                  onChange={(e) => setQ(q.id, { answer: e.target.value })}
                  className={`${areaCls} mt-1.5 min-h-[2.75rem]`}
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <button
                    onClick={() => setQ(q.id, { stuck: !q.stuck })}
                    className={`rounded-full px-2.5 py-0.5 ${q.stuck ? 'bg-danger text-white' : 'border border-box text-sub hover:bg-fill'}`}
                  >
                    詰まった
                  </button>
                  <select
                    value={q.episodeId}
                    onChange={(e) => setQ(q.id, { episodeId: e.target.value })}
                    className={`rounded-full px-2.5 py-0.5 outline-none ${q.episodeId ? 'bg-ind text-white' : 'border border-box text-sub'}`}
                  >
                    <option value="">エピソード</option>
                    {episodes.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <button onClick={addQuestion} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-box py-2.5 text-sm text-sub hover:bg-fill">
          <Plus size={15} />
          質問を追加
        </button>
      </section>

      {/* 逆質問・次に直したいこと */}
      <section className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">逆質問</span>
          <textarea rows={2} value={interview.reverseQuestions} onChange={(e) => set({ reverseQuestions: e.target.value })} className={`${areaCls} min-h-[4.5rem]`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">次に直したいこと</span>
          <textarea rows={2} value={interview.improvements} onChange={(e) => set({ improvements: e.target.value })} className={`${areaCls} min-h-[4.5rem]`} />
        </label>
      </section>
    </article>
  );
}

/** Sophon による振り返り（良かった点・次に直したいこと・気づき） */
export function SophonReviewPanel({ interview }: { interview: Interview }) {
  const data = useStore();
  const [loading, setLoading] = useState(false);
  const review = interview.review;

  const run = async () => {
    setLoading(true);
    const r = await reviewInterview(data, interview);
    data.patchInterview(interview.id, { review: r });
    setLoading(false);
  };

  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-indline bg-indbg p-4">
      <div className="flex items-center gap-2.5">
        <span className={`orb h-9 w-9 ${loading ? 'live' : ''}`} />
        <div>
          <div className="text-[15px] font-extrabold text-indtext">Sophon</div>
          <div className="text-xs text-[#6B6FB0]">{loading ? '振り返り中…' : '振り返り'}</div>
        </div>
      </div>
      {review && (
        <>
          <Msg title="良かった点">{review.good}</Msg>
          <Msg title="次に直したいこと">{review.improve}</Msg>
          {review.notes.map((n, i) => (
            <Msg key={i} title="気づき" tone={/違い|食い違/.test(n) ? 'amber' : undefined}>
              {n}
            </Msg>
          ))}
        </>
      )}
      <Button variant="primary" onClick={run} disabled={loading || !interview.questions.length}>
        <Sparkles size={15} />
        {review ? 'もう一度振り返る' : 'Sophon に振り返ってもらう'}
      </Button>
    </aside>
  );
}

function Msg({ title, children, tone }: { title: string; children: string; tone?: 'amber' }) {
  return (
    <div className={`whitespace-pre-line rounded-xl border bg-white p-3 text-[13px] leading-relaxed ${tone === 'amber' ? 'border-[#F5D99A]' : 'border-indline'}`}>
      <div className={`mb-0.5 text-xs font-bold ${tone === 'amber' ? 'text-warn' : 'text-indtext'}`}>{title}</div>
      {children}
    </div>
  );
}
