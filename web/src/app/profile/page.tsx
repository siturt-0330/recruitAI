'use client';

import { useMemo, useState } from 'react';
import { Camera, ChevronDown, Plus, Puzzle, X } from 'lucide-react';
import { PREFECTURES } from '@ext/prefectures';
import { emptyProfile } from '@ext/profile';
import { PROFILE_PAGES, pageProgress, type FieldDef, type PageDef } from '@ext/profile-fields';
import type { ProfilePage } from '@ext/fieldKeys';
import { PageHeader } from '@/components/ui';
import { useExtension } from '@/lib/extension';
import { useStore } from '@/lib/store';
import type { Profile } from '@/lib/types';

type Update = (patch: Partial<Profile>) => void;

export default function ProfilePageView() {
  const stored = useStore((s) => s.profile);
  const patchProfile = useStore((s) => s.patchProfile);
  const connected = useExtension((s) => s.connected);
  const [pageId, setPageId] = useState<ProfilePage>('basic');
  // まだ保存していなければ空のプロフィールを表示し、最初の入力で作る
  const blank = useMemo(() => emptyProfile('Sophon'), []);
  const profile = stored ?? blank;
  const page = PROFILE_PAGES.find((p) => p.id === pageId)!;

  return (
    <div>
      <PageHeader
        title="プロフィール"
        actions={
          connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-okbg px-3 py-1 text-xs font-bold text-ok">
              <Puzzle size={13} />
              拡張機能と同期済み
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-fill px-3 py-1 text-xs text-sub">
              <Puzzle size={13} />
              拡張機能 未接続
            </span>
          )
        }
      />
      <div className="grid grid-cols-[176px_minmax(0,1fr)] gap-5 px-6 py-5">
        <nav className="flex flex-col gap-1">
          {PROFILE_PAGES.map((p) => {
            const { filled, total } = pageProgress(p, profile);
            const on = p.id === pageId;
            return (
              <button
                key={p.id}
                onClick={() => setPageId(p.id)}
                className={`flex items-center justify-between rounded-full px-4 py-2.5 text-left text-sm ${on ? 'bg-indbg font-bold text-indtext' : 'hover:bg-fill'}`}
              >
                {p.label}
                <span className="text-xs font-normal text-mute">{filled === total ? '✓' : `${filled}/${total}`}</span>
              </button>
            );
          })}
        </nav>
        <ProfileForm key={page.id} page={page} profile={profile} update={patchProfile} />
      </div>
    </div>
  );
}

function ProfileForm({ page, profile, update }: { page: PageDef; profile: Profile; update: Update }) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {page.sections.map((s) => (
        <Section key={s.title} title={s.title} fields={s.fields} detail={s.detail} detailLabel={s.detailLabel} profile={profile} update={update} />
      ))}
    </div>
  );
}

function Section({
  title,
  fields,
  detail,
  detailLabel,
  profile,
  update,
}: {
  title: string;
  fields: FieldDef[];
  detail?: FieldDef[];
  detailLabel?: string;
  profile: Profile;
  update: Update;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-line p-5">
      <h2 className="mb-3 text-[15px] font-extrabold">{title}</h2>
      {fields.length > 0 && <Fields fields={fields} profile={profile} update={update} />}
      {detail && (
        <>
          <button onClick={() => setOpen(!open)} className={`flex items-center gap-1.5 text-sm font-bold text-ind ${fields.length ? 'mt-4' : ''}`}>
            <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            {detailLabel ?? '詳細'}
          </button>
          {open && (
            <div className="mt-3">
              <Fields fields={detail} profile={profile} update={update} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Fields({ fields, profile, update }: { fields: FieldDef[]; profile: Profile; update: Update }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((f) => (
        <div key={f.key === 'custom' ? f.render : f.key} className={f.wide ? 'col-span-2' : ''}>
          <FieldInput field={f} profile={profile} update={update} />
        </div>
      ))}
    </div>
  );
}

function FieldInput({ field, profile, update }: { field: FieldDef; profile: Profile; update: Update }) {
  if (field.key === 'custom') {
    switch (field.render) {
      case 'kisei':
        return <Kisei profile={profile} update={update} />;
      case 'qualifications':
        return <Qualifications profile={profile} update={update} />;
      case 'locations':
        return <Locations profile={profile} update={update} />;
      case 'photo':
        return <Photo profile={profile} update={update} />;
    }
  }
  const key = field.key;
  const value = (profile[key] as string | undefined) ?? '';
  const set = (v: string) => update({ [key]: v } as Partial<Profile>);

  if (field.type === 'select') {
    return (
      <label className="fl">
        <span>{field.label}</span>
        <select value={value} onChange={(e) => set(e.target.value)}>
          {field.options.map((o) => {
            const [v, label] = Array.isArray(o) ? o : [o, o];
            return (
              <option key={v} value={v}>
                {label}
              </option>
            );
          })}
        </select>
      </label>
    );
  }
  if (field.type === 'textarea') {
    return (
      <label className="fl">
        <span>{field.label}</span>
        <textarea rows={3} value={value} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} />
      </label>
    );
  }
  return (
    <label className="fl">
      <span>{field.label}</span>
      <input type={field.type ?? 'text'} value={value} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} />
    </label>
  );
}

const KISEI_FIELDS: { key: keyof Profile; label: string; wide?: boolean }[] = [
  { key: 'kiseiPostalCode', label: '郵便番号' },
  { key: 'kiseiPrefecture', label: '都道府県' },
  { key: 'kiseiCity', label: '市区町村' },
  { key: 'kiseiAddressLine', label: '町名・番地' },
  { key: 'kiseiBuilding', label: '建物名・部屋番号' },
  { key: 'kiseiPhone', label: '電話番号' },
];

function Kisei({ profile, update }: { profile: Profile; update: Update }) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={profile.kiseiSame} onChange={(e) => update({ kiseiSame: e.target.checked })} className="h-4 w-4 accent-ind" />
        帰省先は現住所と同じ
      </label>
      {!profile.kiseiSame && (
        <div className="grid grid-cols-2 gap-3">
          {KISEI_FIELDS.map((f) => (
            <label key={f.key} className="fl">
              <span>{f.label}</span>
              {f.key === 'kiseiPrefecture' ? (
                <select value={profile.kiseiPrefecture} onChange={(e) => update({ kiseiPrefecture: e.target.value })}>
                  <option value="">選択してください</option>
                  {PREFECTURES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              ) : (
                <input value={(profile[f.key] as string) ?? ''} onChange={(e) => update({ [f.key]: e.target.value } as Partial<Profile>)} />
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Locations({ profile, update }: { profile: Profile; update: Update }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <label key={i} className="fl">
          <span>希望勤務地 {i + 1}</span>
          <input
            value={profile.desiredLocations[i] ?? ''}
            onChange={(e) => update({ desiredLocations: profile.desiredLocations.map((v, j) => (j === i ? e.target.value : v)) })}
          />
        </label>
      ))}
    </div>
  );
}

function Qualifications({ profile, update }: { profile: Profile; update: Update }) {
  const list = profile.qualifications;
  const set = (next: Profile['qualifications']) => update({ qualifications: next });
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-bold text-sub">その他の資格</div>
      {list.map((q, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_160px_auto] items-center gap-2">
          <label className="fl">
            <span>資格名</span>
            <input value={q.name} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          </label>
          <label className="fl">
            <span>取得年月</span>
            <input type="month" value={q.date} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
          </label>
          <button onClick={() => set(list.filter((_, j) => j !== i))} className="rounded-full p-1.5 text-mute hover:bg-fill hover:text-danger" aria-label="資格を削除">
            <X size={15} />
          </button>
        </div>
      ))}
      <button onClick={() => set([...list, { name: '', date: '' }])} className="flex w-fit items-center gap-1 text-sm font-bold text-ind">
        <Plus size={15} />
        資格を追加
      </button>
    </div>
  );
}

/** 顔写真は長辺 800px の JPEG に縮小して保存する（拡張機能と同じ） */
async function resizePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}

function Photo({ profile, update }: { profile: Profile; update: Update }) {
  return (
    <div className="flex items-center gap-4">
      <label className="flex h-28 w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-box bg-fill text-mute hover:border-ind">
        {profile.photo ? <img src={profile.photo} alt="顔写真" className="h-full w-full object-cover" /> : <Camera size={22} />}
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) update({ photo: await resizePhoto(f) });
          }}
        />
      </label>
      {profile.photo && (
        <button onClick={() => update({ photo: '' })} className="text-sm text-danger">
          削除
        </button>
      )}
    </div>
  );
}
