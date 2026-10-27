import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Loader2, MoreHorizontal, Plus, Trash2, X } from 'lucide-react';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { essentialProgress } from '@/lib/essentials';
import { PREFECTURES } from '@/lib/prefectures';
import { activeProfileIdItem, emptyProfile, getProfiles, getSettings, normalizeProfile, profilesItem, settingsItem } from '@/lib/store';
import { DEFAULT_SETTINGS, type Profile, type Settings } from '@/lib/types';
import { ESSENTIALS, PAGES, isFilled, pageProgress, type FieldDef, type PageDef } from './pages';

type PageId = PageDef['id'] | 'ai';

const readHash = (): PageId => {
  const h = location.hash.slice(1);
  return h === 'ai' || PAGES.some((p) => p.id === h) ? (h as PageId) : 'basic';
};

const isEssential = (key: string) => (ESSENTIALS as readonly string[]).includes(key);

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState('');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [page, setPage] = useState<PageId>(readHash);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [toast, setToast] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [ps, id, s] = await Promise.all([getProfiles(), activeProfileIdItem.getValue(), getSettings()]);
        setSettings(s);
        if (!ps.length) {
          const first = emptyProfile('新卒用');
          await profilesItem.setValue([first]);
          await activeProfileIdItem.setValue(first.id);
          setProfiles([first]);
          setActiveId(first.id);
          return;
        }
        setProfiles(ps);
        setActiveId(ps.some((p) => p.id === id) ? id : ps[0]!.id);
      } catch (e) {
        // 保存データを読めなくても真っ白にしない。空のプロフィールで開き、入力すればそれを保存する
        console.error('[らくらくエントリー] 保存したプロフィールを読めませんでした', e);
        const first = emptyProfile('新卒用');
        setProfiles([first]);
        setActiveId(first.id);
        setToast('保存したプロフィールを読めませんでした');
      }
    })();
    // Sophon でプロフィールを直したときは、保存待ちの編集がなければ画面にも反映する
    const unwatch = profilesItem.watch((ps) => {
      if (!saveTimer.current && ps) setProfiles(ps.map(normalizeProfile));
    });
    const onHash = () => setPage(readHash());
    addEventListener('hashchange', onHash);
    return () => {
      unwatch();
      removeEventListener('hashchange', onHash);
    };
  }, []);

  // 操作メニューは、外側を押したとき・Esc を押したときにも閉じる
  useEffect(() => {
    const close = () => menuRef.current?.removeAttribute('open');
    const onDown = (e: PointerEvent) => {
      if (menuRef.current?.open && !menuRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  // ほかの画面で使っているプロフィールが消されたら、残っているものを出す
  const profile = profiles.find((p) => p.id === activeId) ?? profiles[0];

  /** 入力のたびに少し待ってから自動保存する */
  const persist = (next: Profile[], immediate = false) => {
    setProfiles(next);
    setSaveState('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      async () => {
        await profilesItem.setValue(next);
        saveTimer.current = undefined;
        setSaveState('saved');
      },
      immediate ? 0 : 500,
    );
  };

  const update = (patch: Partial<Profile>) => {
    if (!profile) return;
    persist(profiles.map((p) => (p.id === profile.id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)));
  };

  const switchProfile = async (id: string) => {
    setActiveId(id);
    await activeProfileIdItem.setValue(id);
  };

  const addProfile = async (base?: Profile) => {
    const p = base ? { ...structuredClone(base), id: crypto.randomUUID(), label: `${base.label} のコピー` } : emptyProfile();
    persist([...profiles, p], true);
    await switchProfile(p.id);
    setToast(base ? '複製しました' : 'プロフィールを追加しました');
  };

  const removeProfile = async () => {
    if (!profile || profiles.length <= 1) return;
    if (!confirm(`「${profile.label}」を削除しますか？`)) return;
    const next = profiles.filter((p) => p.id !== profile.id);
    persist(next, true);
    await switchProfile(next[0]!.id);
  };

  const go = (id: PageId) => {
    location.hash = id;
    setPage(id);
    scrollTo({ top: 0 });
  };

  const saveSettings = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await settingsItem.setValue(next);
    setToast('保存しました');
  };

  // 読み込みが終わるまでも、真っ白にしない
  if (!profile) return <p className="loading">読み込み中… / Loading…</p>;

  const essentials = essentialProgress(profile);
  const pageIndex = PAGES.findIndex((p) => p.id === page);
  const nextPage = PAGES[pageIndex + 1];

  return (
    <div className="layout">
      <aside className="side">
        <div className="me">
          <ProfileAvatar profile={profile} size={60} progress={essentials.ratio} />
          <div className="me-pct">{Math.round(essentials.ratio * 100)}% 完成</div>
          <div className="me-left">
            {essentials.done < essentials.total ? `よく使う項目 あと${essentials.total - essentials.done}つ` : 'よく使う項目はすべて入力済み'}
          </div>
          <div className="me-switch">
            <span>@{profile.label}</span>
            <ChevronDown size={14} />
            <select aria-label="プロフィールを切り替え" value={activeId} onChange={(e) => switchProfile(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <details className="menu" ref={menuRef}>
            <summary aria-label="プロフィールの操作">
              <MoreHorizontal size={18} />
            </summary>
            <div className="menu-pop" onClick={() => menuRef.current?.removeAttribute('open')}>
              <button onClick={() => addProfile()}>
                <Plus size={15} />
                新しいプロフィール
              </button>
              <button onClick={() => addProfile(profile)}>
                <Copy size={15} />
                このプロフィールを複製
              </button>
              {profiles.length > 1 && (
                <button className="danger" onClick={removeProfile}>
                  <Trash2 size={15} />
                  削除
                </button>
              )}
            </div>
          </details>
        </div>

        <nav>
          {PAGES.map((p) => {
            const { filled, total } = pageProgress(p, profile);
            const Icon = p.icon;
            return (
              <button key={p.id} className={page === p.id ? 'nav on' : 'nav'} onClick={() => go(p.id)}>
                <Icon size={20} strokeWidth={page === p.id ? 2.4 : 1.8} />
                <span className="nav-label">{p.label}</span>
                <span className="count">{filled === total ? <Check size={14} /> : `${filled}/${total}`}</span>
              </button>
            );
          })}
          <button className={page === 'ai' ? 'nav on' : 'nav'} onClick={() => go('ai')}>
            <span className="orb" style={{ width: 22, height: 22, ['--ring' as string]: '1.2px', ['--glow' as string]: '3px' }} />
            <span className="nav-label">Sophon</span>
          </button>
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <input
            className="label-input"
            value={profile.label}
            onChange={(e) => update({ label: e.target.value })}
            aria-label="プロフィール名"
          />
          <span className={`save-state ${saveState}`}>
            {saveState === 'saving' ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            {saveState === 'saving' ? '保存中…' : '保存済み'}
          </span>
          {/* 入力は自動で保存するが、保存できたことを確かめたい人のために押せる「保存」も置く */}
          <button
            type="button"
            className="btn btn-primary btn-save"
            onClick={() => {
              persist(profiles, true);
              setToast('保存しました');
            }}
          >
            保存
          </button>
        </div>

        {page === 'ai' ? (
          <AiSettings settings={settings} onSave={saveSettings} />
        ) : (
          <PageView
            page={PAGES[pageIndex]!}
            profile={profile}
            update={update}
            essentials={page === 'basic' ? essentials : undefined}
            next={nextPage ? { label: nextPage.label, go: () => go(nextPage.id) } : undefined}
          />
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}

function PageView(props: {
  page: PageDef;
  profile: Profile;
  update(patch: Partial<Profile>): void;
  essentials?: { done: number; total: number };
  next?: { label: string; go(): void };
}) {
  const { page, profile, update, essentials } = props;
  const { filled, total } = pageProgress(page, profile);

  return (
    <>
      <header className="page-head">
        <div className="page-title">
          <h1>{page.label}</h1>
          <span className="page-count">
            {filled} / {total}
          </span>
        </div>
        <p>{page.description}</p>
      </header>

      {essentials && essentials.done < essentials.total && (
        <div className="hint">
          <div className="hint-text">
            <strong>まずは「よく使う」項目だけで大丈夫</strong>
            <span>
              残りは、応募フォームで必要になったときにポップアップでお知らせします。あと {essentials.total - essentials.done} 項目。
            </span>
          </div>
          <div className="hint-bar">
            <div style={{ width: `${(essentials.done / essentials.total) * 100}%` }} />
          </div>
        </div>
      )}

      {page.sections.map((s) => (
        <section className="section" key={s.title}>
          <h2>{s.title}</h2>
          {s.fields.length > 0 && (
            <div className="grid">
              {s.fields.map((f) => (
                <FieldView key={fieldId(f)} field={f} profile={profile} update={update} />
              ))}
            </div>
          )}
          {s.detail && <More section={s} profile={profile} update={update} />}
        </section>
      ))}

      {props.next && (
        <div className="next-row">
          <button className="btn btn-primary" onClick={props.next.go}>
            次へ：{props.next.label}
          </button>
        </div>
      )}
    </>
  );
}

/** X の「さらに表示」のように、細かい項目を開閉する */
function More({ section, profile, update }: { section: PageDef['sections'][number]; profile: Profile; update(patch: Partial<Profile>): void }) {
  const detail = section.detail ?? [];
  const filledCount = detail.filter((f) => isFilled(f, profile)).length;
  const [open, setOpen] = useState(filledCount > 0 || section.fields.length === 0);
  return (
    <div className={section.fields.length ? 'more' : 'more only'}>
      <button className="more-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="more-link">{open ? '表示を減らす' : section.fields.length ? 'さらに表示' : '入力する'}</span>
        <span className="more-label">{section.detailLabel}</span>
        <span className="more-count">
          {filledCount}/{detail.length}
        </span>
      </button>
      {open && (
        <div className="grid more-body">
          {detail.map((f) => (
            <FieldView key={fieldId(f)} field={f} profile={profile} update={update} />
          ))}
        </div>
      )}
    </div>
  );
}

const fieldId = (f: FieldDef) => (f.key === 'custom' ? f.render : f.key);

/** 選択肢が少ないプルダウンは、押すだけで選べるピル型のボタンにする */
const CHIP_LIMIT = 5;

function FieldView({ field, profile, update }: { field: FieldDef; profile: Profile; update(patch: Partial<Profile>): void }) {
  if (field.key === 'custom') {
    return (
      <div className="field wide">
        {field.render === 'kisei' && <KiseiEditor profile={profile} update={update} />}
        {field.render === 'qualifications' && <QualificationsEditor profile={profile} update={update} />}
        {field.render === 'locations' && <LocationsEditor profile={profile} update={update} />}
        {field.render === 'photo' && <PhotoEditor profile={profile} update={update} />}
      </div>
    );
  }

  const key = field.key;
  const value = profile[key];
  const set = (v: string) => update({ [key]: v } as Partial<Profile>);
  const essential = isEssential(key);

  if (field.type === 'select') {
    const options = field.options.map((o): [string, string] => (Array.isArray(o) ? o : [o, o]));
    if (options.filter(([v]) => v !== '').length <= CHIP_LIMIT) {
      return (
        <div className={field.wide ? 'field wide' : 'field'}>
          <div className="field-title">
            {field.label}
            {essential && <i className="dot" title="よく使う項目" />}
          </div>
          <div className="seg">
            {options
              .filter(([v]) => v !== '')
              .map(([v, l]) => (
                <button key={v} aria-pressed={value === v} onClick={() => set(value === v ? '' : v)}>
                  {l}
                </button>
              ))}
          </div>
          {field.hint && <small>{field.hint}</small>}
        </div>
      );
    }
    return (
      <label className={field.wide ? 'field wide' : 'field'}>
        <span className={value ? 'fl filled' : 'fl'}>
          <span className="fl-label">
            {field.label}
            {essential && <i className="dot" title="よく使う項目" />}
          </span>
          <select value={value} onChange={(e) => set(e.target.value)}>
            {options.map(([v, l]) => (
              <option key={v} value={v}>
                {v === '' ? '' : l}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="fl-chev" />
        </span>
        {field.hint && <small>{field.hint}</small>}
      </label>
    );
  }

  return (
    <label className={field.wide ? 'field wide' : 'field'}>
      <span className={value || field.type === 'date' || field.type === 'month' ? 'fl filled' : 'fl'}>
        <span className="fl-label">
          {field.label}
          {essential && <i className="dot" title="よく使う項目" />}
        </span>
        {field.type === 'textarea' ? (
          <textarea rows={3} value={value} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} />
        ) : (
          <input type={field.type ?? 'text'} value={value} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} />
        )}
      </span>
      {field.hint && <small>{field.hint}</small>}
    </label>
  );
}

/** 枠の中に項目名を小さく出す入力欄（X の入力欄の形） */
function Float(props: { label: string; value: string; onChange(v: string): void; type?: string; placeholder?: string }) {
  return (
    <label className="field">
      <span className={props.value || props.type === 'month' ? 'fl filled' : 'fl'}>
        <span className="fl-label">{props.label}</span>
        <input type={props.type ?? 'text'} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
      </span>
    </label>
  );
}

type EditorProps = { profile: Profile; update(patch: Partial<Profile>): void };

function KiseiEditor({ profile, update }: EditorProps) {
  return (
    <div className="sub">
      <label className="switch-row">
        <span>
          <strong>帰省先は現住所と同じ</strong>
          <small>休暇中の連絡先として、現住所をそのまま使います</small>
        </span>
        <input type="checkbox" role="switch" checked={profile.kiseiSame} onChange={(e) => update({ kiseiSame: e.target.checked })} />
      </label>
      {!profile.kiseiSame && (
        <div className="grid">
          <Float label="郵便番号" value={profile.kiseiPostalCode} placeholder="530-0001" onChange={(v) => update({ kiseiPostalCode: v })} />
          <label className="field">
            <span className={profile.kiseiPrefecture ? 'fl filled' : 'fl'}>
              <span className="fl-label">都道府県</span>
              <select value={profile.kiseiPrefecture} onChange={(e) => update({ kiseiPrefecture: e.target.value })}>
                <option value="" />
                {PREFECTURES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <ChevronDown size={16} className="fl-chev" />
            </span>
          </label>
          <Float label="市区町村" value={profile.kiseiCity} onChange={(v) => update({ kiseiCity: v })} />
          <Float label="町名・番地" value={profile.kiseiAddressLine} onChange={(v) => update({ kiseiAddressLine: v })} />
          <Float label="建物名" value={profile.kiseiBuilding} onChange={(v) => update({ kiseiBuilding: v })} />
          <Float label="電話番号" type="tel" value={profile.kiseiPhone} placeholder="06-1234-5678" onChange={(v) => update({ kiseiPhone: v })} />
        </div>
      )}
    </div>
  );
}

function QualificationsEditor({ profile, update }: EditorProps) {
  const items = profile.qualifications;
  const set = (i: number, patch: Partial<Profile['qualifications'][number]>) =>
    update({ qualifications: items.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  return (
    <div className="sub">
      <div className="field-title">その他の資格</div>
      {items.map((q, i) => (
        <div className="row-item" key={i}>
          <Float label="資格名" value={q.name} placeholder="日商簿記検定2級 合格" onChange={(v) => set(i, { name: v })} />
          <Float label="取得年月" type="month" value={q.date} onChange={(v) => set(i, { date: v })} />
          <button className="icon-round" aria-label="削除" onClick={() => update({ qualifications: items.filter((_, j) => j !== i) })}>
            <X size={16} />
          </button>
        </div>
      ))}
      <button className="text-btn" onClick={() => update({ qualifications: [...items, { name: '', date: '' }] })}>
        <Plus size={15} />
        資格を追加
      </button>
      <small>運転免許・TOEIC・英検は、上の欄から自動で一覧に入ります</small>
    </div>
  );
}

function LocationsEditor({ profile, update }: EditorProps) {
  const set = (i: number, v: string) => update({ desiredLocations: profile.desiredLocations.map((l, j) => (j === i ? v : l)) });
  return (
    <div className="sub">
      <div className="field-title">希望勤務地</div>
      <div className="locations">
        {['第1希望', '第2希望', '第3希望'].map((label, i) => (
          <label className="field" key={label}>
            <span className={profile.desiredLocations[i] ? 'fl filled' : 'fl'}>
              <span className="fl-label">{label}</span>
              <input list="prefectures" value={profile.desiredLocations[i] ?? ''} onChange={(e) => set(i, e.target.value)} placeholder={['東京都', '大阪府', '全国'][i]} />
            </span>
          </label>
        ))}
      </div>
      <datalist id="prefectures">
        {['全国', '首都圏', '関西', ...PREFECTURES].map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </div>
  );
}

/** 顔写真は長辺 800px の JPEG に縮小して保存する（ストレージの容量を節約するため） */
async function resizePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}

/** Instagram の「写真を追加」と同じ形 */
function PhotoEditor({ profile, update }: EditorProps) {
  const [error, setError] = useState('');
  return (
    <div className="photo">
      <span className="avatar photo-thumb">{profile.photo ? <img src={profile.photo} alt="顔写真" /> : [...(profile.lastName || '?')][0]}</span>
      <div className="photo-text">
        <strong>顔写真</strong>
        <div className="photo-actions">
          <label className="text-link">
            {profile.photo ? '写真を変更' : '写真を追加'}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                // 同じ写真を選び直しても change が届くように、選んだファイルを空にしておく
                e.target.value = '';
                if (!file) return;
                try {
                  update({ photo: await resizePhoto(file) });
                  setError('');
                } catch {
                  setError('画像を読み込めませんでした。JPEG か PNG を選んでください。');
                }
              }}
            />
          </label>
          {profile.photo && (
            <button className="text-link danger" onClick={() => update({ photo: '' })}>
              削除
            </button>
          )}
        </div>
        <small>{error || '写真はこの端末の中にだけ保存されます'}</small>
      </div>
    </div>
  );
}

function AiSettings({ settings, onSave }: { settings: Settings; onSave(patch: Partial<Settings>): void }) {
  const on = settings.engine === 'openai';
  return (
    <>
      {/* Sophon の部屋：白黒の画面の中で、ここだけ濃紺にする */}
      <section className="sophon-hero">
        <span className="orb live hero-orb" />
        <div className="hero-body">
          <div className="hero-kicker">POWERED BY</div>
          <div className="hero-name">Sophon</div>
          <div className="hero-row">
            <span className={on ? 'hero-status on' : 'hero-status'}>
              <i />
              {on ? 'オン' : 'オフ'}
            </span>
            <div className="hero-seg">
              <button aria-pressed={!on} onClick={() => onSave({ engine: 'rules' })}>
                ルールのみ
              </button>
              <button aria-pressed={on} onClick={() => onSave({ engine: 'openai' })}>
                ルール + Sophon
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
