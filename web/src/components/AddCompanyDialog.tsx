'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { API_URL } from '@/lib/api-url';
import { emptyCompany } from '@/lib/seed';
import { STAGES } from '@/lib/stages';
import { useStore } from '@/lib/store';
import type { Stage } from '@/lib/types';
import { IndustrySelect } from './IndustrySelect';
import { Button, CompanyLogo, Field, Select } from './ui';

/** URL から推測した企業名の候補（「recruit.example-shoji.co.jp」→ 空。名前は利用者が入れる） */
const hostOf = (url: string) => {
  try {
    return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname;
  } catch {
    return '';
  }
};

export async function fetchLogo(url: string): Promise<{ logo?: string; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/v1/logo?url=${encodeURIComponent(url)}`);
    return (await res.json()) as { logo?: string; error?: string };
  } catch {
    return { error: 'ロゴを取得できませんでした' };
  }
}

export function AddCompanyDialog({ onClose, defaultStage = 'entry' }: { onClose(id?: string): void; defaultStage?: Stage }) {
  const upsertCompany = useStore((s) => s.upsertCompany);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [stage, setStage] = useState<Stage>(defaultStage);
  const [logo, setLogo] = useState('');
  const [logoState, setLogoState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // URL を入れ終わったら、少し待ってからロゴを取りに行く
  useEffect(() => {
    // URL として読めない間は、読み込み中の表示を残さない
    if (!hostOf(url).includes('.')) {
      setLogoState('idle');
      return;
    }
    setLogoState('loading');
    // URL を打ち直したあとに、前の URL の結果が遅れて届いても使わない
    let stale = false;
    const timer = setTimeout(async () => {
      const r = await fetchLogo(url);
      if (stale) return;
      if (r.logo) {
        setLogo(r.logo);
        setLogoState('idle');
      } else {
        setLogoState('error');
      }
    }, 600);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [url]);

  // Esc で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = () => {
    if (!name.trim()) {
      setError('企業名を入力してください');
      return;
    }
    const c = { ...emptyCompany(name.trim()), url: url.trim(), industry: industry.trim(), stage, logo };
    upsertCompany(c);
    onClose(c.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-6 pt-[12vh]" onClick={() => onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-company-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="add-company-title" className="text-lg font-extrabold">企業を追加</h2>
          <button className="rounded-full p-1.5 hover:bg-fill" onClick={() => onClose()} aria-label="閉じる">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <Field
            label="企業名"
            value={name}
            autoFocus
            placeholder="〇〇株式会社"
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            // 日本語入力の変換を確定する Enter では追加しない
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && submit()}
          />
          {error && <p className="-mt-1 text-xs text-danger">{error}</p>}
          <Field label="URL" value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} />
          <div className="flex items-center gap-3 rounded-xl bg-fill p-3">
            <CompanyLogo company={{ name: name || '?', logo }} size={40} />
            <div className="min-w-0 flex-1 text-xs text-sub">
              {logoState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : 'ロゴ'}
            </div>
            <button className="text-xs font-bold text-ind" onClick={() => fileRef.current?.click()}>
              画像を選ぶ
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => setLogo(String(reader.result));
                reader.readAsDataURL(f);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <IndustrySelect value={industry} onChange={setIndustry} />
            <Select label="選考状況" value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onClose()}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={submit}>
            追加
          </Button>
        </div>
      </div>
    </div>
  );
}
