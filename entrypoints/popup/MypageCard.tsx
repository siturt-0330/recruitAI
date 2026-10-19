import { useEffect, useState } from 'react';
import { browser } from '#imports';
import { Check, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react';
import { cleanUrl, findMypage, originPattern, type Mypage } from '@/lib/mypages';
import { matchCompany, type LinkCompany } from '@/lib/sophon-link';
import { mypagesItem } from '@/lib/store';
import { runInTab } from '@/lib/tab';

interface Props {
  tabId?: number;
  tabUrl: string;
  /** Sophon の会社（つないでいなければ空） */
  companies: LinkCompany[];
}

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/**
 * マイページのログイン情報。ログイン画面を開いているときに出して、保存・入力する。
 * パスワードはこの PC の拡張機能の storage にだけ置く。
 */
export function MypageCard({ tabId, tabUrl, companies }: Props) {
  const [list, setList] = useState<Mypage[] | null>(null);
  const [found, setFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', loginId: '', password: '' });
  const [reveal, setReveal] = useState(false);
  const [message, setMessage] = useState('');
  /** ログイン画面に今入っている ID・パスワード（保存したものと違えば「更新」を出す） */
  const [page, setPage] = useState({ loginId: '', password: '' });
  /** ボタンを押したあとの表示（説明文を出さず、ボタンの文字で伝える） */
  const [done, setDone] = useState<'' | 'filled' | 'updated' | 'failed'>('');
  /** 保存したサイトで、一覧から開いたときに自動入力してよいか（Chrome の許可） */
  const [granted, setGranted] = useState<boolean | null>(null);

  const saved = list ? findMypage(list, tabUrl) : undefined;

  useEffect(() => {
    (async () => {
      const ms = await mypagesItem.getValue();
      setList(ms);
      let login = { found: false, loginId: '', password: '' };
      if (tabId != null) {
        try {
          const res = await runInTab(tabId, 'readLogin');
          login = res.map((f) => f.result.login).find((l) => l?.found) ?? login;
        } catch {
          // 入力できないページ
        }
      }
      setFound(login.found);
      setPage({ loginId: login.loginId, password: login.password });
      const m = findMypage(ms, tabUrl);
      setForm({
        name: m?.companyName ?? matchCompany(tabUrl, companies)?.name ?? '',
        url: m?.url ?? cleanUrl(tabUrl),
        loginId: login.loginId || m?.loginId || '',
        password: login.password || m?.password || '',
      });
      // まだ保存していないログイン画面なら、最初から保存の形で出す
      setEditing(!m && login.found);
      const pattern = m && originPattern(m.url);
      if (pattern) setGranted(await browser.permissions.contains({ origins: [pattern] }).catch(() => false));
    })();
  }, [tabId, tabUrl, companies]);

  if (!list || (!saved && !found)) return null;

  const fillHere = async () => {
    if (tabId == null || !saved) return;
    try {
      const res = await runInTab(tabId, 'fillLogin', { loginId: saved.loginId, password: saved.password, company: saved.companyName });
      setDone(res.some((f) => f.result.login?.found) ? 'filled' : 'failed');
    } catch {
      setDone('failed');
    }
  };

  /** 許可ダイアログはボタンを押した直後にしか出せないので、await より前に request を呼ぶ */
  const save = () => {
    const name = form.name.trim();
    const url = form.url.trim();
    if (!name || !url) return setMessage('会社名と URL を入れてください');
    const sophon = companies.find((c) => c.name === name);
    const sameName = list.find((m) => m.companyName === name);
    const companyId = sophon?.id ?? saved?.companyId ?? sameName?.companyId ?? crypto.randomUUID();
    const item: Mypage = {
      id: saved?.id ?? sameName?.id ?? crypto.randomUUID(),
      companyId,
      companyName: name,
      url,
      loginId: form.loginId.trim(),
      password: form.password,
      updatedAt: new Date().toISOString(),
    };
    const next = [...list.filter((m) => m.id !== item.id && m.companyId !== companyId), item];
    setList(next);
    void mypagesItem.setValue(next);
    const pattern = originPattern(url);
    if (pattern) browser.permissions.request({ origins: [pattern] }).then(setGranted, () => setGranted(false));
    setEditing(false);
    setMessage('');
    setPage({ loginId: item.loginId, password: item.password });
  };

  /** 保存したときに許可しなかった人が、あとから許可する（ボタンを押した直後に request を呼ぶ） */
  const allow = () => {
    const pattern = saved && originPattern(saved.url);
    if (pattern) browser.permissions.request({ origins: [pattern] }).then(setGranted, () => setGranted(false));
  };

  /** ページで打ち直した ID・パスワードで、保存した内容を上書きする */
  const update = () => {
    if (!saved) return;
    const item = { ...saved, loginId: page.loginId || saved.loginId, password: page.password, updatedAt: new Date().toISOString() };
    const next = list.map((m) => (m.id === saved.id ? item : m));
    setList(next);
    void mypagesItem.setValue(next);
    setDone('updated');
  };

  const changed =
    !!saved && found && !!page.password && (page.password !== saved.password || (!!page.loginId && page.loginId !== saved.loginId));

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  if (!editing && saved) {
    return (
      <section className="mypage">
        <div className="mypage-saved">
          <div className="mypage-head">
            <span className="company-logo">{[...saved.companyName][0]}</span>
            <span className="company-body">
              <b>{saved.companyName}</b>
              <span>{saved.loginId || host(saved.url)}</span>
            </span>
          </div>
          {done === 'updated' || done === 'filled' ? (
            <button className="mypage-save is-done" disabled>
              <Check size={15} />
              {done === 'updated' ? '更新しました' : '入力しました'}
            </button>
          ) : changed ? (
            <button className="mypage-save" onClick={update}>
              <RefreshCw size={15} />
              保存内容を更新
            </button>
          ) : (
            found && (
              <button className="mypage-save" onClick={fillHere} disabled={done === 'failed'}>
                <KeyRound size={15} />
                {done === 'failed' ? '入力できませんでした' : 'ログイン情報を入力'}
              </button>
            )
          )}
          {granted === false && (
            <button className="link mypage-allow" onClick={allow}>
              一覧から開いたときの自動入力を許可
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mypage">
      <div className="mypage-title">
        <KeyRound size={14} />
        <span>このマイページを保存</span>
      </div>
      <div className="mypage-group">
        <label className="mypage-row">
          <span>会社名</span>
          <input value={form.name} onChange={set('name')} list="mypage-companies" placeholder="入力または選択" />
          <datalist id="mypage-companies">
            {companies.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </label>
        <label className="mypage-row">
          <span>ID</span>
          <input value={form.loginId} onChange={set('loginId')} autoComplete="off" />
        </label>
        <label className="mypage-row">
          <span>パスワード</span>
          <input type={reveal ? 'text' : 'password'} value={form.password} onChange={set('password')} autoComplete="off" />
          <button className="mypage-eye" aria-label={reveal ? '隠す' : '表示'} onClick={(e) => (e.preventDefault(), setReveal(!reveal))}>
            {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </label>
        <label className="mypage-row">
          <span>URL</span>
          <input value={form.url} onChange={set('url')} title={form.url} />
        </label>
      </div>
      <div className="mypage-actions">
        <button className="mypage-save" onClick={save}>
          保存
        </button>
      </div>
      {message && <p className="block-note">{message}</p>}
    </section>
  );
}
