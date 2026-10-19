'use client';

import { useEffect, useState } from 'react';
import { Building2, ChevronRight, KeyRound, Pencil, Plus, X } from 'lucide-react';
import { Button, CompanyLogo, Field } from '@/components/ui';
import { forgetMypage, openMypage, useExtension } from '@/lib/extension';
import { logoByName, logoFor } from '@/lib/logo';
import { emptyCompany } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { Company } from '@/lib/types';

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** このページを開いている間に、ロゴを探した会社（見つからなくても何度も探さない） */
const tried = new Set<string>();

/**
 * 受けている企業のマイページ一覧。押すとマイページを開き、拡張機能に保存した ID とパスワードが入った状態にする。
 * パスワードはこのページには来ない（拡張機能の中にだけある）。
 */
export default function CompaniesPage() {
  const { companies, upsertCompany } = useStore();
  const { connected, notice } = useExtension();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState('');

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => useExtension.setState({ notice: '' }), 2400);
    return () => clearTimeout(t);
  }, [notice]);

  // 会社名を打ち終わったら、少し待ってからロゴを探して入力欄の左に出す
  const [preview, setPreview] = useState<{ name: string; logo: string; loading: boolean }>({ name: '', logo: '', loading: false });
  useEffect(() => {
    const n = name.trim();
    if (!n) return setPreview({ name: '', logo: '', loading: false });
    setPreview((p) => ({ name: n, logo: p.name === n ? p.logo : '', loading: true }));
    let alive = true;
    const t = setTimeout(async () => {
      const logo = await logoByName(n);
      if (alive) setPreview({ name: n, logo, loading: false });
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [name]);

  // ロゴのない会社（拡張機能から入った会社など）は、裏で順番に探しておく
  useEffect(() => {
    const todo = companies.filter((c) => !c.logo && !tried.has(c.id));
    if (!todo.length) return;
    todo.forEach((c) => tried.add(c.id));
    (async () => {
      for (const c of todo) {
        const logo = await logoFor(c);
        if (logo) useStore.getState().patchCompany(c.id, { logo });
      }
    })();
  }, [companies]);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const c = { ...emptyCompany(n), logo: preview.name === n ? preview.logo : '' };
    // ロゴがまだ見つかっていなければ、あとで裏で探す（tried に入れない）
    upsertCompany(c);
    setName('');
    setEditing(c.id);
  };

  const open = (c: Company) => {
    if (connected && c.hasPassword) openMypage(c.id);
    else if (c.mypageUrl) window.open(c.mypageUrl, '_blank', 'noopener');
    else setEditing(c.id);
  };

  const sorted = [...companies].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const current = companies.find((c) => c.id === editing);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
      <div className="mb-5 flex items-center gap-3">
        <h1 className="flex-1 text-[28px] font-extrabold tracking-tight">マイページ</h1>
        {connected && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-okbg px-3 py-1 text-xs font-bold text-ok">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            拡張機能と連携中
          </span>
        )}
      </div>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="pointer-events-none absolute left-2 flex h-8 w-8 items-center justify-center">
            {preview.name ? (
              <span className={preview.loading && !preview.logo ? 'animate-pulse' : ''}>
                <CompanyLogo company={{ name: preview.name, logo: preview.logo }} size={30} />
              </span>
            ) : (
              <Building2 size={18} className="text-mute" />
            )}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="会社名を入力"
            className="h-12 w-full rounded-xl border border-box pl-12 pr-4 text-[15px] outline-none focus:border-ind"
          />
        </label>
        <Button variant="primary" className="h-12" disabled={!name.trim()}>
          <Plus size={16} />
          追加
        </Button>
      </form>

      {sorted.length > 0 && (
        <ul className="overflow-hidden rounded-2xl border border-line">
          {sorted.map((c) => (
            <li key={c.id} className="flex items-center border-b border-line last:border-b-0">
              <button onClick={() => open(c)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-fill">
                <CompanyLogo company={c} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{c.name}</span>
                  <span className="block truncate text-[13px] text-sub">
                    {[c.mypageUrl && host(c.mypageUrl), c.loginId].filter(Boolean).join(' · ') || 'マイページ未登録'}
                  </span>
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    c.hasPassword ? 'bg-ink text-white' : 'bg-fill text-mute'
                  }`}
                >
                  <KeyRound size={12} />
                  {c.hasPassword ? '保存済み' : '未保存'}
                </span>
                {c.mypageUrl && <ChevronRight size={18} className="shrink-0 text-mute" />}
              </button>
              <button aria-label={`${c.name} を編集`} onClick={() => setEditing(c.id)} className="mr-2 rounded-full p-2 text-sub hover:bg-fill">
                <Pencil size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {current && <EditSheet key={current.id} company={current} onClose={() => setEditing('')} />}

      {notice && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white shadow-lg md:bottom-8">
          {notice}
        </div>
      )}
    </div>
  );
}

function EditSheet({ company, onClose }: { company: Company; onClose: () => void }) {
  const { patchCompany, removeCompany } = useStore();
  const [form, setForm] = useState({ name: company.name, mypageUrl: company.mypageUrl, loginId: company.loginId });

  const save = () => {
    const name = form.name.trim() || company.name;
    // 会社名を変えたら、ロゴも探し直す
    const renamed = name !== company.name;
    if (renamed) tried.delete(company.id);
    patchCompany(company.id, { name, mypageUrl: form.mypageUrl.trim(), loginId: form.loginId.trim(), ...(renamed ? { logo: '' } : {}) });
    onClose();
  };
  const remove = () => {
    if (!confirm(`${company.name} を削除しますか？`)) return;
    forgetMypage(company.id);
    removeCompany(company.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <div
        className="w-full rounded-t-[22px] bg-white p-5 shadow-2xl md:max-w-[440px] md:rounded-[22px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <CompanyLogo company={company} size={36} />
          <h2 className="flex-1 truncate text-lg font-extrabold">{company.name}</h2>
          <button aria-label="閉じる" onClick={onClose} className="rounded-full p-1.5 text-sub hover:bg-fill">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <Field label="会社名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Field label="マイページの URL" value={form.mypageUrl} placeholder="https://" onChange={(e) => setForm({ ...form, mypageUrl: e.target.value })} />
          <Field label="ID" value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })} />
          <div className="flex items-center gap-2 rounded-xl bg-fill px-3 py-2.5 text-[13px] text-sub">
            <KeyRound size={14} />
            {company.hasPassword ? 'パスワードは拡張機能に保存済み' : 'パスワードはマイページで拡張機能から保存'}
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="danger" onClick={remove}>
            削除
          </Button>
          <span className="flex-1" />
          <Button onClick={onClose}>キャンセル</Button>
          <Button variant="primary" onClick={save}>
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
