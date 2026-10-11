import { useEffect, useMemo, useState } from 'react';
import { browser } from '#imports';
import { AlertTriangle, ChevronDown, CirclePlus, Settings as SettingsIcon, ShieldCheck, SlidersHorizontal, Sparkles, Undo2, UserPlus } from 'lucide-react';
import { FIELD_KEYS, isFieldKey } from '@/lib/fieldKeys';
import { activeProfileIdItem, getProfiles, getSettings, settingsItem } from '@/lib/store';
import { activeTabId, runInTab, type Action, type FrameResult } from '@/lib/tab';
import type { Engine, Profile, Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';

const RING = 2 * Math.PI * 38;

type Phase = 'idle' | 'filling' | 'done';

export default function App() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [activeId, setActiveId] = useState('');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tabId, setTabId] = useState<number>();
  const [frames, setFrames] = useState<FrameResult[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [pageError, setPageError] = useState('');
  const [shortcut, setShortcut] = useState('');

  useEffect(() => {
    (async () => {
      const [ps, id, s, tab, commands] = await Promise.all([
        getProfiles(),
        activeProfileIdItem.getValue(),
        getSettings(),
        activeTabId(),
        browser.commands.getAll(),
      ]);
      setProfiles(ps);
      setActiveId(ps.some((p) => p.id === id) ? id : (ps[0]?.id ?? ''));
      setSettings(s);
      setTabId(tab);
      setShortcut(commands.find((c) => c.name === 'fill-page')?.shortcut ?? '');
      if (tab == null) return;
      try {
        const res = await runInTab(tab, 'status');
        setFrames(res);
        if (res.some((f) => f.result.filled > 0)) setPhase('done');
      } catch {
        setPageError('このページでは使えません');
      }
    })();
  }, []);

  const profile = profiles?.find((p) => p.id === activeId);
  const summary = useMemo(() => {
    const sum = (k: 'detected' | 'filled' | 'warn') => frames.reduce((n, f) => n + f.result[k], 0);
    return {
      detected: sum('detected'),
      filled: sum('filled'),
      warn: sum('warn'),
      reviews: frames.flatMap((f) => f.result.reviews.map((r) => ({ ...r, frameId: f.frameId }))),
      aiError: frames.find((f) => f.result.aiError)?.result.aiError,
      missing: [...new Map(frames.flatMap((f) => f.result.missing ?? []).map((m) => [m.key, m])).values()],
    };
  }, [frames]);

  const run = async (action: Action, payload?: unknown, frameIds?: number[]) => {
    if (tabId == null) return;
    try {
      const res = await runInTab(tabId, action, payload, frameIds);
      setFrames((prev) =>
        frameIds ? prev.map((f) => res.find((r) => r.frameId === f.frameId) ?? f) : res,
      );
      return res;
    } catch {
      setPageError('このページでは使えません');
    }
  };

  const fill = async () => {
    setPhase('filling');
    await run('fill');
    setPhase('done');
  };

  const undo = async () => {
    await run('undo');
    setPhase('idle');
  };

  const changeProfile = (id: string) => {
    setActiveId(id);
    activeProfileIdItem.setValue(id);
  };

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    settingsItem.setValue(next);
  };

  const openOptions = () => browser.runtime.openOptionsPage();
  /** 設定画面を、未登録の項目があるページで開く */
  const openOptionsAt = (key: string) => {
    const page = isFieldKey(key) ? FIELD_KEYS[key].page : 'basic';
    browser.tabs.create({ url: `${browser.runtime.getURL('/options.html')}#${page}` });
  };

  if (profiles === null) return <div className="popup" />;

  if (!profiles.length) {
    return (
      <div className="popup">
        <div className="empty">
          <div className="empty-icon">
            <UserPlus size={22} />
          </div>
          <h1>プロフィールを登録しましょう</h1>
          <p>氏名や生年月日を一度登録すると、応募フォームにワンクリックで入力できます。</p>
          <button className="btn btn-primary wide" onClick={openOptions}>
            プロフィールを作成
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const progress = summary.detected ? summary.filled / summary.detected : 0;
  const fullName = profile ? `${profile.lastName} ${profile.firstName}`.trim() : '';

  return (
    <div className="popup">
      <header className="head">
        <div className="avatar">{(profile?.lastName || profile?.label || '?').slice(0, 1)}</div>
        <div className="who">
          <div className="name">{fullName || '名前未登録'}</div>
          <div className="profile-pick">
            {profile?.label}
            <ChevronDown size={14} />
            <select aria-label="プロフィールを切り替え" value={activeId} onChange={(e) => changeProfile(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="icon-btn" aria-label="プロフィールと設定" onClick={openOptions}>
          <SettingsIcon size={18} />
        </button>
      </header>

      {pageError ? (
        <div className="notice">{pageError}</div>
      ) : (
        <>
          <section className="stats">
            <svg width="92" height="92" viewBox="0 0 92 92" role="img" aria-label={`入力率 ${Math.round(progress * 100)}%`}>
              <circle cx="46" cy="46" r="38" fill="none" stroke="var(--surface-1)" strokeWidth="8" />
              <circle
                cx="46"
                cy="46"
                r="38"
                fill="none"
                stroke="var(--ok)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={RING}
                strokeDashoffset={RING * (1 - progress)}
                transform="rotate(-90 46 46)"
                className="ring"
              />
              <text x="46" y="51" textAnchor="middle" className="ring-text">
                {Math.round(progress * 100)}%
              </text>
            </svg>
            <dl>
              <div>
                <dt>検出した欄</dt>
                <dd>{summary.detected}</dd>
              </div>
              <div>
                <dt>入力済み</dt>
                <dd className="ok">{summary.filled}</dd>
              </div>
              <div>
                <dt>要確認</dt>
                <dd className="warn">{summary.warn}</dd>
              </div>
            </dl>
          </section>

          <button className="fill-btn" onClick={fill} disabled={phase === 'filling'}>
            <Sparkles size={16} />
            <span>{phase === 'filling' ? '入力中…' : phase === 'done' ? 'もう一度入力' : 'このページに入力'}</span>
            {shortcut && <kbd>{shortcut}</kbd>}
          </button>
          {phase === 'done' && summary.filled > 0 && (
            <button className="btn btn-ghost wide undo" onClick={undo}>
              <Undo2 size={14} />
              元に戻す
            </button>
          )}

          {phase === 'done' && summary.missing.length > 0 && (
            <section className="missing">
              <div className="missing-head">
                <CirclePlus size={14} />
                <span>このページで使える未登録の項目</span>
                <span className="missing-count">{summary.missing.length}件</span>
              </div>
              <div className="chips">
                {summary.missing.slice(0, 6).map((m) => (
                  <button key={m.key} className="chip" onClick={() => openOptionsAt(m.key)}>
                    {m.label}
                  </button>
                ))}
                {summary.missing.length > 6 && <span className="more-chip">ほか{summary.missing.length - 6}件</span>}
              </div>
              <button className="btn wide add-btn" onClick={() => openOptionsAt(summary.missing[0]!.key)}>
                プロフィールに追加する
              </button>
              <p className="missing-note">登録すると、次に入力したときから自動で入ります。</p>
            </section>
          )}

          {summary.aiError && (
            <div className="notice error">
              <AlertTriangle size={14} />
              <span>AI判定に失敗したため、ルールだけで入力しました（{summary.aiError}）</span>
            </div>
          )}

          {summary.reviews.length > 0 && (
            <section className="reviews">
              <h2>確認が必要な項目</h2>
              {summary.reviews.map((r) => (
                <div className="review" key={`${r.frameId}:${r.id}`}>
                  <div className="review-head">
                    <span className="review-title">{r.keyLabel}</span>
                    <span className="review-conf">
                      {r.source === 'ai' ? 'AI ' : ''}確信度 {Math.round(r.confidence * 100)}%
                    </span>
                  </div>
                  {r.label && <div className="review-label">欄: {r.label}</div>}
                  <div className="chips">
                    {[r.current, ...r.alternatives].map((v, i) => (
                      <button
                        key={v}
                        className={i === 0 ? 'chip current' : 'chip'}
                        onClick={() => run('resolve', { id: r.id, value: v }, [r.frameId])}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      <details className="advanced">
        <summary>
          <SlidersHorizontal size={14} />
          詳細設定
        </summary>
        <div className="advanced-body">
          <div className="label">判定エンジン</div>
          <div className="seg">
            {(
              [
                ['rules', 'ルールのみ'],
                ['openai', 'ルール + OpenAI'],
              ] as [Engine, string][]
            ).map(([value, label]) => (
              <button key={value} aria-pressed={settings.engine === value} onClick={() => updateSettings({ engine: value })}>
                {label}
              </button>
            ))}
          </div>
          {settings.engine === 'openai' && !settings.openaiApiKey && (
            <button className="link" onClick={openOptions}>
              OpenAI の API キーを設定してください
            </button>
          )}
          <div className="label">
            確認なしで入力する確信度 <strong>{Math.round(settings.threshold * 100)}%</strong>
          </div>
          <input
            type="range"
            min={50}
            max={99}
            step={1}
            value={Math.round(settings.threshold * 100)}
            onChange={(e) => updateSettings({ threshold: Number(e.target.value) / 100 })}
          />
        </div>
      </details>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="foot">
      <ShieldCheck size={14} />
      個人情報はこの端末から出ません
    </footer>
  );
}
