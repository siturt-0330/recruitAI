'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useStore } from '@/lib/store';

export const DEFAULT_INDUSTRIES = [
  '商社',
  'メーカー',
  '自動車',
  '電機',
  '食品',
  '化学・素材',
  '医薬品',
  '金融',
  '保険',
  'コンサル',
  'IT・通信',
  '広告・マスコミ',
  '不動産・建設',
  'インフラ・エネルギー',
  '運輸・物流',
  '小売・流通',
  '人材',
  '公務員',
];

const ADD = '__add__';

/** 業界のプルダウン。選択肢になければ「＋ 業界を追加」で入力すると、次からは選択肢に出る */
export function IndustrySelect({ value, onChange, variant = 'field', className = '' }: { value: string; onChange(v: string): void; variant?: 'field' | 'cell'; className?: string }) {
  const { industries, companies, addIndustry } = useStore();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const options = [...new Set([...DEFAULT_INDUSTRIES, ...industries, ...companies.map((c) => c.industry).filter(Boolean)])];

  const commit = () => {
    const v = draft.trim();
    if (v) {
      if (!DEFAULT_INDUSTRIES.includes(v)) addIndustry(v);
      onChange(v);
    }
    setAdding(false);
    setDraft('');
  };

  const cell = variant === 'cell';
  const cellCls = 'w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-sub outline-none hover:border-box focus:border-ind focus:bg-white';

  const control = adding ? (
    <input
      autoFocus
      value={draft}
      placeholder="業界名を入力して Enter"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Escape') setAdding(false);
      }}
      className={cell ? cellCls : undefined}
    />
  ) : (
    <select
      value={value}
      onChange={(e) => (e.target.value === ADD ? setAdding(true) : onChange(e.target.value))}
      className={cell ? `${cellCls} appearance-none` : undefined}
    >
      <option value="">{cell ? '—' : '選択してください'}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={ADD}>＋ 業界を追加</option>
    </select>
  );

  if (cell) return control;
  return (
    <label className={`fl ${className}`}>
      <span>業界</span>
      {control}
      {!adding && <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mute" />}
    </label>
  );
}
