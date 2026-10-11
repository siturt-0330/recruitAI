import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, Plus, Trash2, User } from 'lucide-react';
import { PREFECTURES } from '@/lib/prefectures';
import { activeProfileIdItem, emptyProfile, getSettings, profilesItem, settingsItem } from '@/lib/store';
import { DEFAULT_SETTINGS, type Profile, type Settings } from '@/lib/types';

type Tab = 'profile' | 'ai';

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<Tab>('profile');
  const [toast, setToast] = useState('');

  useEffect(() => {
    (async () => {
      const [ps, activeId, s] = await Promise.all([profilesItem.getValue(), activeProfileIdItem.getValue(), getSettings()]);
      setSettings(s);
      if (!ps.length) {
        const first = emptyProfile('新卒用');
        await persist([first]);
        await activeProfileIdItem.setValue(first.id);
        select(first);
        return;
      }
      setProfiles(ps);
      select(ps.find((p) => p.id === activeId) ?? ps[0]!);
    })();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const persist = async (next: Profile[]) => {
    setProfiles(next);
    await profilesItem.setValue(next);
  };

  const select = (p: Profile) => {
    setSelectedId(p.id);
    setDraft({ ...p });
  };

  const saved = profiles.find((p) => p.id === selectedId);
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);

  const save = async () => {
    if (!draft) return;
    await persist(profiles.map((p) => (p.id === draft.id ? draft : p)));
    setToast('保存しました');
  };

  const add = async (base?: Profile) => {
    const p = base ? { ...base, id: crypto.randomUUID(), label: `${base.label} のコピー` } : emptyProfile();
    await persist([...profiles, p]);
    select(p);
  };

  const remove = async () => {
    if (!draft || profiles.length <= 1) return;
    if (!confirm(`「${draft.label}」を削除しますか？`)) return;
    const next = profiles.filter((p) => p.id !== draft.id);
    await persist(next);
    if ((await activeProfileIdItem.getValue()) === draft.id) await activeProfileIdItem.setValue(next[0]!.id);
    select(next[0]!);
  };

  const set = <K extends keyof Profile>(key: K) => (value: Profile[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const saveSettings = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await settingsItem.setValue(next);
    setToast('保存しました');
  };

  return (
    <div className="layout">
      <aside className="side">
        <div className="brand">RecruitAI</div>
        <nav>
          <button className={tab === 'profile' ? 'nav on' : 'nav'} onClick={() => setTab('profile')}>
            <User size={16} />
            プロフィール
          </button>
          <button className={tab === 'ai' ? 'nav on' : 'nav'} onClick={() => setTab('ai')}>
            <KeyRound size={16} />
            AI 設定
          </button>
        </nav>
        {tab === 'profile' && (
          <>
            <div className="side-title">プロフィール</div>
            <div className="profile-list">
              {profiles.map((p) => (
                <button key={p.id} className={p.id === selectedId ? 'profile-item on' : 'profile-item'} onClick={() => select(p)}>
                  <span className="dot">{(p.lastName || p.label).slice(0, 1)}</span>
                  <span className="pl-text">
                    <span>{p.label}</span>
                    <small>{`${p.lastName} ${p.firstName}`.trim() || '未入力'}</small>
                  </span>
                </button>
              ))}
            </div>
            <button className="btn btn-ghost add" onClick={() => add()}>
              <Plus size={14} />
              プロフィールを追加
            </button>
          </>
        )}
      </aside>

      <main className="main">
        {tab === 'profile' && draft && (
          <>
            <div className="main-head">
              <input
                className="title-input"
                value={draft.label}
                onChange={(e) => set('label')(e.target.value)}
                aria-label="プロフィール名"
              />
              <div className="head-actions">
                <button className="btn btn-ghost" onClick={() => add(draft)}>
                  <Copy size={14} />
                  複製
                </button>
                {profiles.length > 1 && (
                  <button className="btn btn-ghost btn-danger" onClick={remove}>
                    <Trash2 size={14} />
                    削除
                  </button>
                )}
              </div>
            </div>

            <Section title="基本情報">
              <Row>
                <Field label="姓" value={draft.lastName} onChange={set('lastName')} placeholder="山田" />
                <Field label="名" value={draft.firstName} onChange={set('firstName')} placeholder="太郎" />
              </Row>
              <Row>
                <Field label="セイ" value={draft.lastNameKana} onChange={set('lastNameKana')} placeholder="ヤマダ" />
                <Field label="メイ" value={draft.firstNameKana} onChange={set('firstNameKana')} placeholder="タロウ" />
              </Row>
              <Row>
                <Field label="姓（ローマ字）" value={draft.lastNameRoman} onChange={set('lastNameRoman')} placeholder="Yamada" />
                <Field label="名（ローマ字）" value={draft.firstNameRoman} onChange={set('firstNameRoman')} placeholder="Taro" />
              </Row>
              <Row>
                <Field label="生年月日" type="date" value={draft.birthDate} onChange={set('birthDate')} />
                <label className="field">
                  <span>性別</span>
                  <select className="input" value={draft.gender} onChange={(e) => set('gender')(e.target.value as Profile['gender'])}>
                    <option value="">未設定</option>
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                    <option value="other">その他・回答しない</option>
                  </select>
                </label>
              </Row>
            </Section>

            <Section title="連絡先">
              <Row>
                <Field label="メールアドレス" type="email" value={draft.email} onChange={set('email')} placeholder="taro@example.com" />
                <Field
                  label="電話番号"
                  type="tel"
                  value={draft.phone}
                  onChange={set('phone')}
                  placeholder="090-1234-5678"
                  hint="ハイフンありで入力すると、3分割の欄にも正しく入ります"
                />
              </Row>
            </Section>

            <Section title="住所">
              <Row>
                <Field label="郵便番号" value={draft.postalCode} onChange={set('postalCode')} placeholder="123-4567" />
                <label className="field">
                  <span>都道府県</span>
                  <select className="input" value={draft.prefecture} onChange={(e) => set('prefecture')(e.target.value)}>
                    <option value="">選択してください</option>
                    {PREFECTURES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
              </Row>
              <Row>
                <Field label="市区町村" value={draft.city} onChange={set('city')} placeholder="渋谷区" />
                <Field label="町名・番地" value={draft.addressLine} onChange={set('addressLine')} placeholder="神南1-2-3" />
              </Row>
              <Field label="建物名・部屋番号" value={draft.building} onChange={set('building')} placeholder="サンプルマンション101" />
            </Section>

            <Section title="学歴">
              <Field label="学校名" value={draft.school} onChange={set('school')} placeholder="〇〇大学" />
              <Row>
                <Field label="学部・研究科" value={draft.faculty} onChange={set('faculty')} placeholder="経済学部" />
                <Field label="学科・専攻" value={draft.department} onChange={set('department')} placeholder="経済学科" />
              </Row>
              <Row>
                <Field label="卒業（見込み）年月" type="month" value={draft.graduation} onChange={set('graduation')} />
                <div />
              </Row>
            </Section>

            <div className={dirty ? 'save-bar show' : 'save-bar'}>
              <span>変更が保存されていません</span>
              <button className="btn btn-ghost" onClick={() => saved && select(saved)}>
                取り消す
              </button>
              <button className="btn btn-primary" onClick={save}>
                保存する
              </button>
            </div>
          </>
        )}

        {tab === 'ai' && <AiSettings settings={settings} onSave={saveSettings} />}
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

function AiSettings({ settings, onSave }: { settings: Settings; onSave(patch: Partial<Settings>): void }) {
  const [key, setKey] = useState(settings.openaiApiKey);
  const [show, setShow] = useState(false);
  useEffect(() => setKey(settings.openaiApiKey), [settings.openaiApiKey]);

  return (
    <>
      <div className="main-head">
        <h1>AI 設定</h1>
      </div>
      <Section title="OpenAI Decisions API">
        <p className="desc">
          ルールで判定できなかった欄を OpenAI の Decisions API（gpt-6-luna）で判定します。
          送信するのはフォームのラベルや name 属性などの構造だけで、プロフィールの内容は送りません。
        </p>
        <label className="field">
          <span>API キー</span>
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
        <div className="field">
          <span>判定エンジン</span>
          <div className="seg narrow">
            <button aria-pressed={settings.engine === 'rules'} onClick={() => onSave({ engine: 'rules' })}>
              ルールのみ
            </button>
            <button aria-pressed={settings.engine === 'openai'} onClick={() => onSave({ engine: 'openai' })}>
              ルール + OpenAI
            </button>
          </div>
        </div>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      <div className="section-body">{children}</div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="row">{children}</div>;
}

function Field(props: {
  label: string;
  value: string;
  onChange(v: string): void;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        className="input"
        type={props.type ?? 'text'}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.hint && <small>{props.hint}</small>}
    </label>
  );
}
