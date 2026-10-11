import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Eye, EyeOff, ImagePlus, KeyRound, Loader2, Plus, Trash2, X } from 'lucide-react';
import { PREFECTURES } from '@/lib/prefectures';
import { activeProfileIdItem, emptyProfile, getProfiles, getSettings, profilesItem, settingsItem } from '@/lib/store';
import { DEFAULT_SETTINGS, type Profile, type Settings } from '@/lib/types';
import { ESSENTIALS, PAGES, isFilled, pageProgress, type FieldDef, type PageDef } from './pages';

type PageId = PageDef['id'] | 'ai';

const readHash = (): PageId => {
  const h = location.hash.slice(1);
  return h === 'ai' || PAGES.some((p) => p.id === h) ? (h as PageId) : 'basic';
};

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState('');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [page, setPage] = useState<PageId>(readHash);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [toast, setToast] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    (async () => {
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
    })();
    const onHash = () => setPage(readHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const profile = profiles.find((p) => p.id === activeId);

  /** 入力のたびに少し待ってから自動保存する */
  const persist = (next: Profile[], immediate = false) => {
    setProfiles(next);
    setSaveState('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      async () => {
        await profilesItem.setValue(next);
        setSaveState('saved');
      },
      immediate ? 0 : 500,
    );
  };

  const update = (patch: Partial<Profile>) => {
    if (!profile) return;
    persist(profiles.map((p) => (p.id === profile.id ? { ...p, ...patch } : p)));
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

  if (!profile) return null;

  const essentialsDone = ESSENTIALS.filter((k) => !!profile[k]).length;

  return (
    <div className="layout">
      <aside className="side">
        <div className="brand">RecruitAI</div>

        <div className="profile-switch">
          <div className="avatar">{(profile.lastName || profile.label).slice(0, 1)}</div>
          <div className="ps-text">
            <span className="ps-name">{`${profile.lastName} ${profile.firstName}`.trim() || '名前未登録'}</span>
            <span className="ps-label">
              {profile.label}
              <ChevronDown size={12} />
            </span>
          </div>
          <select aria-label="プロフィールを切り替え" value={activeId} onChange={(e) => switchProfile(e.target.value)}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ps-actions">
          <button className="mini" onClick={() => addProfile()}>
            <Plus size={13} />
            追加
          </button>
          <button className="mini" onClick={() => addProfile(profile)}>
            <Copy size={13} />
            複製
          </button>
          {profiles.length > 1 && (
            <button className="mini danger" onClick={removeProfile}>
              <Trash2 size={13} />
              削除
            </button>
          )}
        </div>

        <nav>
          {PAGES.map((p) => {
            const { filled, total } = pageProgress(p, profile);
            const Icon = p.icon;
            return (
              <button key={p.id} className={page === p.id ? 'nav on' : 'nav'} onClick={() => go(p.id)}>
                <Icon size={16} />
                <span className="nav-label">{p.label}</span>
                <span className={filled === total ? 'count done' : 'count'}>
                  {filled === total ? <Check size={12} /> : `${filled}/${total}`}
                </span>
              </button>
            );
          })}
          <div className="nav-sep" />
          <button className={page === 'ai' ? 'nav on' : 'nav'} onClick={() => go('ai')}>
            <KeyRound size={16} />
            <span className="nav-label">AI 設定</span>
          </button>
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <input
            className="title-input"
            value={profile.label}
            onChange={(e) => update({ label: e.target.value })}
            aria-label="プロフィール名"
          />
          <span className={`save-state ${saveState}`}>
            {saveState === 'saving' ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
            {saveState === 'saving' ? '保存中…' : '自動保存済み'}
          </span>
        </div>

        {page === 'ai' ? (
          <AiSettings settings={settings} onSave={saveSettings} />
        ) : (
          <PageView
            page={PAGES.find((p) => p.id === page)!}
            profile={profile}
            update={update}
            essentials={page === 'basic' ? { done: essentialsDone, total: ESSENTIALS.length } : undefined}
            onNext={(() => {
              const i = PAGES.findIndex((p) => p.id === page);
              const next = PAGES[i + 1];
              return next ? () => go(next.id) : undefined;
            })()}
            nextLabel={PAGES[PAGES.findIndex((p) => p.id === page) + 1]?.label}
          />
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          <Check size={14} />
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
  onNext?: () => void;
  nextLabel?: string;
}) {
  const { page, profile, update, essentials } = props;
  const { filled, total } = pageProgress(page, profile);

  return (
    <>
      <header className="page-head">
        <h1>{page.label}</h1>
        <p>{page.description}</p>
        <div className="progress" aria-label={`${filled} / ${total} 項目入力済み`}>
          <div className="progress-bar" style={{ width: `${(filled / total) * 100}%` }} />
        </div>
        <span className="progress-text">
          {filled} / {total} 項目
        </span>
      </header>

      {essentials && essentials.done < essentials.total && (
        <div className="hint-card">
          <div className="hint-title">まずは「よく使う」項目だけで大丈夫です</div>
          <p>
            氏名・連絡先・学校など <strong>{essentials.total}</strong> 項目を埋めれば、多くの応募フォームに対応できます（あと
            {essentials.total - essentials.done} 項目）。それ以外は、応募フォームで必要になったときにポップアップでお知らせします。
          </p>
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
          {s.detail && (
            <details className="more" open={s.fields.length === 0 ? undefined : s.detail.some((f) => isFilled(f, profile)) || undefined}>
              <summary>
                <span>{s.fields.length ? '詳細を入力' : '入力する'}</span>
                <span className="more-label">{s.detailLabel}</span>
                <span className="more-count">
                  {s.detail.filter((f) => isFilled(f, profile)).length}/{s.detail.length}
                </span>
                <ChevronDown size={16} className="chev" />
              </summary>
              <div className="grid">
                {s.detail.map((f) => (
                  <FieldView key={fieldId(f)} field={f} profile={profile} update={update} />
                ))}
              </div>
            </details>
          )}
        </section>
      ))}

      {props.onNext && (
        <button className="next" onClick={props.onNext}>
          次へ：{props.nextLabel}
        </button>
      )}
    </>
  );
}

const fieldId = (f: FieldDef) => (f.key === 'custom' ? f.render : f.key);

function FieldView({ field, profile, update }: { field: FieldDef; profile: Profile; update(patch: Partial<Profile>): void }) {
  if (field.key === 'custom') {
    return (
      <div className="field wide">
        <span className="field-label">{field.label}</span>
        {field.render === 'kisei' && <KiseiEditor profile={profile} update={update} />}
        {field.render === 'qualifications' && <QualificationsEditor profile={profile} update={update} />}
        {field.render === 'locations' && <LocationsEditor profile={profile} update={update} />}
        {field.render === 'photo' && <PhotoEditor profile={profile} update={update} />}
      </div>
    );
  }

  const key = field.key;
  const value = profile[key];
  const essential = ESSENTIALS.includes(key);
  const set = (v: string) => update({ [key]: v } as Partial<Profile>);

  return (
    <label className={field.wide ? 'field wide' : 'field'}>
      <span className="field-label">
        {field.label}
        {essential && <span className="badge">よく使う</span>}
      </span>
      {field.type === 'select' ? (
        <select className="input" value={value} onChange={(e) => set(e.target.value)}>
          {field.options.map((o) => {
            const [v, l] = Array.isArray(o) ? o : [o, o];
            return (
              <option key={v} value={v}>
                {l}
              </option>
            );
          })}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea className="input textarea" rows={3} value={value} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} />
      ) : (
        <input
          className="input"
          type={field.type ?? 'text'}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => set(e.target.value)}
        />
      )}
      {field.hint && <small>{field.hint}</small>}
    </label>
  );
}

type EditorProps = { profile: Profile; update(patch: Partial<Profile>): void };

function KiseiEditor({ profile, update }: EditorProps) {
  return (
    <div className="sub">
      <label className="check">
        <input type="checkbox" checked={profile.kiseiSame} onChange={(e) => update({ kiseiSame: e.target.checked })} />
        帰省先（休暇中の連絡先）は現住所と同じ
      </label>
      {!profile.kiseiSame && (
        <div className="grid">
          <label className="field">
            <span className="field-label">郵便番号</span>
            <input className="input" value={profile.kiseiPostalCode} placeholder="530-0001" onChange={(e) => update({ kiseiPostalCode: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">都道府県</span>
            <select className="input" value={profile.kiseiPrefecture} onChange={(e) => update({ kiseiPrefecture: e.target.value })}>
              <option value="">選択してください</option>
              {PREFECTURES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">市区町村</span>
            <input className="input" value={profile.kiseiCity} onChange={(e) => update({ kiseiCity: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">町名・番地</span>
            <input className="input" value={profile.kiseiAddressLine} onChange={(e) => update({ kiseiAddressLine: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">建物名</span>
            <input className="input" value={profile.kiseiBuilding} onChange={(e) => update({ kiseiBuilding: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">電話番号</span>
            <input className="input" type="tel" value={profile.kiseiPhone} placeholder="06-1234-5678" onChange={(e) => update({ kiseiPhone: e.target.value })} />
          </label>
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
      {items.map((q, i) => (
        <div className="row-item" key={i}>
          <input className="input" value={q.name} placeholder="日商簿記検定2級 合格" onChange={(e) => set(i, { name: e.target.value })} />
          <input className="input month" type="month" value={q.date} onChange={(e) => set(i, { date: e.target.value })} aria-label="取得年月" />
          <button className="icon" aria-label="削除" onClick={() => update({ qualifications: items.filter((_, j) => j !== i) })}>
            <X size={14} />
          </button>
        </div>
      ))}
      <button className="mini" onClick={() => update({ qualifications: [...items, { name: '', date: '' }] })}>
        <Plus size={13} />
        資格を追加
      </button>
      <small>運転免許・TOEIC・英検は上の欄から自動で一覧に入ります</small>
    </div>
  );
}

function LocationsEditor({ profile, update }: EditorProps) {
  const set = (i: number, v: string) => update({ desiredLocations: profile.desiredLocations.map((l, j) => (j === i ? v : l)) });
  return (
    <div className="locations">
      {['第1希望', '第2希望', '第3希望'].map((label, i) => (
        <label className="field" key={label}>
          <span className="field-label">{label}</span>
          <input className="input" list="prefectures" value={profile.desiredLocations[i] ?? ''} onChange={(e) => set(i, e.target.value)} placeholder={['東京都', '大阪府', '全国'][i]} />
        </label>
      ))}
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

function PhotoEditor({ profile, update }: EditorProps) {
  const [error, setError] = useState('');
  return (
    <div className="photo">
      {profile.photo ? (
        <img src={profile.photo} alt="顔写真" />
      ) : (
        <div className="photo-empty">
          <ImagePlus size={22} />
        </div>
      )}
      <div className="photo-actions">
        <label className="mini">
          <ImagePlus size={13} />
          {profile.photo ? '写真を変更' : '写真を選ぶ'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
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
          <button className="mini danger" onClick={() => update({ photo: '' })}>
            <Trash2 size={13} />
            削除
          </button>
        )}
        <small>{error || '写真はこの端末の中にだけ保存されます'}</small>
      </div>
    </div>
  );
}

function AiSettings({ settings, onSave }: { settings: Settings; onSave(patch: Partial<Settings>): void }) {
  const [key, setKey] = useState(settings.openaiApiKey);
  const [show, setShow] = useState(false);
  useEffect(() => setKey(settings.openaiApiKey), [settings.openaiApiKey]);

  return (
    <>
      <header className="page-head">
        <h1>AI 設定</h1>
        <p>
          ルールで判定できなかった欄を OpenAI の Decisions API（gpt-6-luna）で判定します。
          送信するのはフォームのラベルや name 属性などの構造だけで、プロフィールの内容は送りません。
        </p>
      </header>
      <section className="section">
        <h2>OpenAI Decisions API</h2>
        <div className="grid">
          <label className="field wide">
            <span className="field-label">API キー</span>
            <div className="key-row">
              <input
                className="input"
                type={show ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
              />
              <button className="btn" type="button" onClick={() => setShow((s) => !s)} aria-label={show ? '隠す' : '表示'}>
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button className="btn btn-primary" type="button" onClick={() => onSave({ openaiApiKey: key.trim() })}>
                保存
              </button>
            </div>
            <small>キーはこのブラウザの拡張機能ストレージにだけ保存されます。</small>
          </label>
          <div className="field wide">
            <span className="field-label">判定エンジン</span>
            <div className="seg narrow">
              <button aria-pressed={settings.engine === 'rules'} onClick={() => onSave({ engine: 'rules' })}>
                ルールのみ
              </button>
              <button aria-pressed={settings.engine === 'openai'} onClick={() => onSave({ engine: 'openai' })}>
                ルール + OpenAI
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
