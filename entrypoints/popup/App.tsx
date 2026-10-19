import { useEffect, useMemo, useState } from 'react';
import { browser } from '#imports';
import { AlertTriangle, ChevronDown, ChevronRight, Settings as SettingsIcon, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { MypageCard } from './MypageCard';
import { essentialProgress } from '@/lib/essentials';
import { FIELD_KEYS, isFieldKey } from '@/lib/fieldKeys';
import { fetchSponsor, type Sponsor } from '@/lib/api';
import { WEB_URL } from '@/lib/app-config';
import { matchCompany, type LinkCompany } from '@/lib/sophon-link';
import { activeProfileIdItem, getProfiles, getSettings, settingsItem, sophonDataItem, sponsorCacheItem } from '@/lib/store';
import { activeTabId, runInTab, type Action, type FrameResult } from '@/lib/tab';
import type { Engine, Profile, Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';

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
  const [diagState, setDiagState] = useState<'idle' | 'copied' | 'error'>('idle');
  /** このページの企業（Web 版とつながっていれば分かる） */
  const [company, setCompany] = useState<LinkCompany>();
  const [companies, setCompanies] = useState<LinkCompany[]>([]);
  const [tabUrl, setTabUrl] = useState('');

  const copyDiagnosis = async () => {
    if (tabId == null) return;
    try {
      const res = await runInTab(tabId, 'diagnose');
      const text = res.map((f) => `--- frame ${f.frameId} ---\n${f.result.report ?? ''}`).join('\n\n');
      await navigator.clipboard.writeText(text);
      setDiagState('copied');
    } catch {
      setDiagState('error');
    }
  };

  useEffect(() => {
    (async () => {
      const [ps, id, s, tab, commands, link, [current]] = await Promise.all([
        getProfiles(),
        activeProfileIdItem.getValue(),
        getSettings(),
        activeTabId(),
        browser.commands.getAll(),
        sophonDataItem.getValue(),
        browser.tabs.query({ active: true, currentWindow: true }),
      ]);
      setCompanies(link?.companies ?? []);
      setTabUrl(current?.url ?? '');
      if (link && current?.url) setCompany(matchCompany(current.url, link.companies));
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

  /** 別のサイトから埋め込まれたフォーム枠のうち、まだ入力の許可をもらっていないもの */
  const [blockedOrigins, setBlockedOrigins] = useState<string[]>([]);
  useEffect(() => {
    const origins = frames.find((f) => f.frameId === 0)?.result.iframeOrigins ?? [];
    (async () => {
      const blocked: string[] = [];
      for (const o of origins) if (!(await browser.permissions.contains({ origins: [`${o}/*`] }))) blocked.push(o);
      setBlockedOrigins(blocked);
    })().catch(() => setBlockedOrigins([]));
  }, [frames]);

  /** 許可ダイアログはボタンを押した直後にしか出せないので、await より前に request を呼ぶ */
  const allowFrames = async () => {
    const granted = await browser.permissions.request({ origins: blockedOrigins.map((o) => `${o}/*`) }).catch(() => false);
    if (granted) await fill();
  };

  const run = async (action: Action, payload?: unknown, frameIds?: number[]) => {
    if (tabId == null) return;
    try {
      const res = await runInTab(tabId, action, payload, frameIds);
      setFrames((prev) => (frameIds ? prev.map((f) => res.find((r) => r.frameId === f.frameId) ?? f) : res));
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
    const page = key === 'ai' ? 'ai' : isFieldKey(key) ? FIELD_KEYS[key].page : 'basic';
    browser.tabs.create({ url: `${browser.runtime.getURL('/options.html')}#${page}` });
  };

  if (profiles === null) return <div className="popup" />;

  if (!profiles.length) {
    return (
      <div className="popup">
        <div className="empty">
          <ProfileAvatar size={64} progress={0} />
          <h1>プロフィールを作りましょう</h1>
          <p>氏名や生年月日を一度登録すると、応募フォームにワンクリックで入力できます。</p>
          <button className="btn btn-primary wide tall" onClick={openOptions}>
            プロフィールを作成
          </button>
        </div>
        {tabUrl && <MypageCard tabId={tabId} tabUrl={tabUrl} companies={companies} />}
        <Footer />
      </div>
    );
  }

  const progress = summary.detected ? summary.filled / summary.detected : 0;
  const fullName = profile ? `${profile.lastName} ${profile.firstName}`.trim() : '';
  const completeness = profile ? essentialProgress(profile) : { ratio: 0 };

  return (
    <div className="popup">
      <header className="head">
        <ProfileAvatar profile={profile} size={44} progress={completeness.ratio} />
        <div className="who">
          <div className="name">{fullName || '名前未登録'}</div>
          <div className="handle">
            @{profile?.label}
            <ChevronDown size={13} />
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
          <SettingsIcon size={19} />
        </button>
      </header>

      {company && (
        <a className="company-card" href={`${WEB_URL}/companies?id=${encodeURIComponent(company.id)}`} target="_blank" rel="noreferrer">
          <span className="company-logo">{[...company.name][0]}</span>
          <span className="company-body">
            <b>{company.name}</b>
            <span>{[company.stageLabel, company.deadline && `締切 ${Number(company.deadline.slice(5, 7))}/${Number(company.deadline.slice(8))}`].filter(Boolean).join(' · ')}</span>
          </span>
          <ChevronRight size={16} />
        </a>
      )}

      {tabUrl && !pageError && <MypageCard tabId={tabId} tabUrl={tabUrl} companies={companies} />}

      {pageError ? (
        <div className="notice">{pageError}</div>
      ) : (
        <>
          <section className="stats" aria-label="このページの入力状況">
            <div>
              <strong>{summary.detected}</strong>
              <span>検出</span>
            </div>
            <div>
              <strong>{summary.filled}</strong>
              <span>入力済み</span>
            </div>
            <div>
              <strong className={summary.warn ? 'warn' : ''}>{summary.warn}</strong>
              <span>要確認</span>
            </div>
          </section>
          <div className="bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${progress * 100}%` }} />
          </div>

          {phase === 'filling' ? (
            <button className="btn btn-primary wide tall thinking" disabled>
              <span className="orb live" style={{ width: 32, height: 32, ['--ring' as string]: '1.5px', ['--glow' as string]: '5px' }} />
              <span>Sophon がフォームを読んでいます…</span>
            </button>
          ) : (
            <button className="btn btn-primary wide tall" onClick={fill}>
              {phase === 'done' ? 'もう一度入力' : 'このページに入力'}
            </button>
          )}
          <div className="sub-actions">
            {phase === 'done' && summary.filled > 0 && (
              <button className="btn grow" onClick={undo}>
                元に戻す
              </button>
            )}
            {shortcut && <span className="kbd">{shortcut}</span>}
          </div>

          {blockedOrigins.length > 0 && (
            <div className="notice frame-permission">
              <AlertTriangle size={14} />
              <div>
                <span>
                  このページには別のサイト（{blockedOrigins.map((o) => new URL(o).host).join('、')}）の応募フォームが埋め込まれています。
                  入力するにはそのサイトへのアクセスの許可が必要です。
                </span>
                <button className="btn wide" onClick={allowFrames}>
                  許可して入力する
                </button>
              </div>
            </div>
          )}

          {summary.aiError && (
            <div className="notice error">
              <AlertTriangle size={14} />
              <span>Sophon の判定に失敗したので、ルールだけで入力しました（{summary.aiError}）</span>
            </div>
          )}

          {summary.reviews.length > 0 && (
            <section className="block">
              <h2>確認してください</h2>
              {summary.reviews.map((r) => (
                <div className="review sophon-msg" key={`${r.frameId}:${r.id}`}>
                  <span className="orb" style={{ width: 34, height: 34, ['--ring' as string]: '1.5px', ['--glow' as string]: '4px' }} />
                  <div className="msg">
                    <div className="msg-head">
                      <b>Sophon</b>
                      <span> · 確信度 {Math.round(r.confidence * 100)}%</span>
                    </div>
                    <p className="msg-text">{reviewMessage(r)}</p>
                    {r.label && r.label !== r.keyLabel && <div className="review-label">欄の見出し：{r.label}</div>}
                    <div className="chips">
                    {[r.current, ...r.alternatives].map((v, i) => (
                      <button
                        key={v}
                        className="chip"
                        aria-pressed={i === 0}
                        onClick={() => run('resolve', { id: r.id, value: v }, [r.frameId])}
                      >
                        {v}
                      </button>
                    ))}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {phase === 'done' && summary.missing.length > 0 && (
            <section className="block">
              <h2>
                未登録の項目 <span className="count">{summary.missing.length}</span>
              </h2>
              <p className="block-note">登録すると、次から自動で入ります。</p>
              <ul className="list">
                {summary.missing.slice(0, 6).map((m) => (
                  <li key={m.key}>
                    <button onClick={() => openOptionsAt(m.key)}>
                      <span>{m.label}</span>
                      <ChevronRight size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              {summary.missing.length > 6 && <p className="block-note">ほか {summary.missing.length - 6} 件</p>}
            </section>
          )}
        </>
      )}

      <SponsorCard />

      <details className="advanced">
        <summary>
          <SlidersHorizontal size={15} />
          詳細設定
          <ChevronDown size={15} className="chev" />
        </summary>
        <div className="advanced-body">
          <div className="label">判定エンジン</div>
          <div className="seg">
            {(
              [
                ['rules', 'ルールのみ'],
                ['openai', 'ルール + Sophon'],
              ] as [Engine, string][]
            ).map(([value, label]) => (
              <button key={value} aria-pressed={settings.engine === value} onClick={() => updateSettings({ engine: value })}>
                {label}
              </button>
            ))}
          </div>
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
          <button className="btn wide diag" onClick={copyDiagnosis} disabled={tabId == null || !!pageError}>
            {diagState === 'copied' ? '診断情報をコピーしました' : diagState === 'error' ? 'コピーできませんでした' : '診断情報をコピー'}
          </button>
          <p className="block-note">うまく入らないときに送ってください。見出しと判定結果だけで、入力した値は含まれません。</p>
        </div>
      </details>

      <Footer />
    </div>
  );
}

/** 要確認の項目を、Sophon からの問いかけの文にする */
function reviewMessage(r: { keyLabel: string; current: string; alternatives: string[]; source: 'rule' | 'ai' }): string {
  const choice = r.alternatives.length ? `ほかに「${r.alternatives.join('」「')}」の可能性もあります。` : '';
  const how = r.source === 'ai' ? 'フォームの見出しから判断して、' : '';
  return `「${r.keyLabel}」は、${how}「${r.current}」と入れました。${choice}合っていますか？`;
}

const SPONSOR_TTL = 12 * 3600_000;

/** スポンサー枠（広告）。中身は中継 API から取り、半日はそのまま使う。なければ何も出さない */
function SponsorCard() {
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  useEffect(() => {
    (async () => {
      const cache = await sponsorCacheItem.getValue();
      if (cache && Date.now() - cache.at < SPONSOR_TTL) return setSponsor(cache.sponsor);
      const s = await fetchSponsor();
      await sponsorCacheItem.setValue({ at: Date.now(), sponsor: s });
      setSponsor(s);
    })();
  }, []);
  if (!sponsor) return null;
  return (
    <a className="sponsor" href={sponsor.url} target="_blank" rel="noopener sponsored">
      <span className="sponsor-pr">PR</span>
      <span className="sponsor-body">
        <b>{sponsor.title}</b>
        {sponsor.body && <span>{sponsor.body}</span>}
      </span>
      <span className="sponsor-cta">{sponsor.cta}</span>
    </a>
  );
}

function Footer() {
  return (
    <footer className="foot">
      <ShieldCheck size={14} />
      個人情報はこの端末から出ません
      <a className="sophon-link" href={`${WEB_URL}/companies`} target="_blank" rel="noreferrer">
        マイページ管理
      </a>
    </footer>
  );
}
