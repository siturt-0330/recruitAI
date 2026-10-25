import type { Profile } from './types';

/**
 * 拡張機能と Sophon（Web アプリ）のあいだでやり取りするデータ。
 * 拡張機能側・Web 側の両方からこのファイルを読み込むので、ブラウザ API には依存させない。
 */

/**
 * Web 版（マイページ管理）のページ。拡張機能の中継スクリプトはここでだけ動く。
 * 公開用のビルドでは localhost を外す（wxt.config.ts）。開く URL は lib/app-config.ts の WEB_URL
 */
export const SOPHON_MATCHES = ['https://app.rakuraku-entry.com/*', 'http://localhost:3100/*'];

export interface LinkCompany {
  id: string;
  name: string;
  url: string;
  mypageUrl: string;
  /** マイページのログイン ID（パスワードは渡さない） */
  loginId?: string;
  /** Sophon で最後に直した日時（ログイン情報とどちらが新しいかを比べる） */
  updatedAt?: string;
  stageLabel: string;
  deadline: string;
  deadlineLabel: string;
  nextAt: string;
  nextLabel: string;
}

export interface LinkEsAnswer {
  id: string;
  category: string;
  title: string;
  text: string;
  charLimit: number;
  companyIds: string[];
}

/** Sophon から拡張機能に渡す企業と ES */
export interface LinkData {
  companies: LinkCompany[];
  esAnswers: LinkEsAnswer[];
  syncedAt: string;
}

/** 応募フォームで「ボードに記録」を押したとき、拡張機能から Sophon に渡す記録 */
export interface LinkRecord {
  id: string;
  companyId: string;
  /** ISO 日時 */
  at: string;
  url: string;
  esAnswerIds: string[];
}

/**
 * 拡張機能に保存したマイページのログイン情報の「見出し」。パスワードそのものは含めない。
 * 拡張機能 → Sophon に渡し、Sophon の一覧に会社・マイページ・ID・保存済みの印を出す
 */
export interface LinkMypage {
  companyId: string;
  companyName: string;
  url: string;
  loginId: string;
  hasPassword: boolean;
  updatedAt: string;
}

/** ページ（Sophon）→ 拡張機能 */
export type AppMessage =
  | { source: 'sophon-app'; type: 'ping' }
  | { source: 'sophon-app'; type: 'sync'; data: LinkData; profile: Profile | null }
  | { source: 'sophon-app'; type: 'ack'; ids: string[] }
  /** その会社のマイページを開いて、ID とパスワードを入れる */
  | { source: 'sophon-app'; type: 'openMypage'; companyId: string }
  /** 会社を消したので、保存したログイン情報も消す */
  | { source: 'sophon-app'; type: 'forgetMypage'; companyId: string }
  /** Web 版で打ったパスワードを、拡張機能にだけ保存してもらう（Web 版には残さない） */
  | { source: 'sophon-app'; type: 'setPassword'; companyId: string; companyName: string; url: string; loginId: string; password: string };

/** 拡張機能 → ページ（Sophon） */
export type ExtMessage =
  | { source: 'sophon-ext'; type: 'hello'; version: string }
  | { source: 'sophon-ext'; type: 'profile'; profile: Profile }
  | { source: 'sophon-ext'; type: 'records'; records: LinkRecord[] }
  | { source: 'sophon-ext'; type: 'mypages'; mypages: LinkMypage[] };

/** 新しく保存したほうを残す（更新日時がないものは古い扱い） */
export const isNewer = (a: { updatedAt?: string } | null | undefined, b: { updatedAt?: string } | null | undefined) =>
  (a?.updatedAt ?? '') > (b?.updatedAt ?? '');

// ---- 応募ページの企業を見分ける ----

/** 複数の企業が同じドメインを使う採用管理サービス。パスの1段目まで一致したときだけ同じ企業とみなす */
const SHARED_HOSTS = [/(^|\.)i-web\.jpn\.com$/, /(^|\.)i-webs\.jp$/, /(^|\.)axol\.jp$/, /(^|\.)e2r\.jp$/, /(^|\.)snar\.jp$/, /(^|\.)mynavi\.jp$/, /(^|\.)rikunabi\.com$/, /(^|\.)hrmos\.co$/, /(^|\.)herp\.cloud$/, /(^|\.)talentio\.com$/, /(^|\.)n-ext\.jp$/];

export const isSharedHost = (host: string) => SHARED_HOSTS.some((re) => re.test(host));

function parse(url: string): URL | null {
  if (!url.trim()) return null;
  try {
    return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`);
  } catch {
    return null;
  }
}

/** 「recruit.example.co.jp」→「example.co.jp」 */
export function siteOf(host: string): string {
  const parts = host.replace(/^www\./, '').split('.');
  const second = /^(co|ne|or|ac|go|ed|lg|gr)$/.test(parts[parts.length - 2] ?? '');
  return parts.slice(second ? -3 : -2).join('.');
}

const firstSegment = (u: URL) => u.pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? '';

/** ページの URL に一番合う企業。マイページの URL が前方一致するものを優先する */
export function matchCompany<T extends Pick<LinkCompany, 'url' | 'mypageUrl'>>(href: string, companies: T[]): T | undefined {
  const page = parse(href);
  if (!page) return undefined;
  let best: { c: T; score: number } | undefined;
  for (const c of companies) {
    let score = 0;
    for (const [raw, weight] of [
      [c.mypageUrl, 3],
      [c.url, 2],
    ] as const) {
      const u = parse(raw);
      if (!u) continue;
      const shared = SHARED_HOSTS.some((re) => re.test(u.hostname));
      if (shared) {
        if (u.hostname === page.hostname && firstSegment(u) && firstSegment(u) === firstSegment(page)) score = Math.max(score, weight + 1);
      } else if (u.hostname === page.hostname) {
        score = Math.max(score, weight + 1);
      } else if (siteOf(u.hostname) === siteOf(page.hostname)) {
        score = Math.max(score, weight);
      }
    }
    if (score && (!best || score > best.score)) best = { c, score };
  }
  return best?.c;
}

// ---- 記述欄に合う ES を探す ----

const CATEGORY_WORDS: [string, RegExp][] = [
  ['志望動機', /志望(動機|理由)|なぜ当社|弊社を志望|入社して/],
  ['自己PR', /自己PR|自己ＰＲ|アピール|強み|長所/],
  ['ガクチカ', /力を入れ|学生時代|ガクチカ|頑張った/],
  ['長所・短所', /短所|弱み/],
];

export function categoryOf(label: string): string {
  const t = label.normalize('NFKC');
  return CATEGORY_WORDS.find(([, re]) => re.test(t))?.[0] ?? '';
}

/** 見出しや maxlength から字数制限を読む（「400字以内」「400文字」など） */
export function limitOf(label: string, maxLength: number | null): number {
  if (maxLength && maxLength > 0 && maxLength < 100000) return maxLength;
  const m = label.normalize('NFKC').match(/(\d{2,4})\s*(字|文字)/);
  return m ? Number(m[1]) : 0;
}

export const charCount = (text: string) => [...text.replace(/\r\n/g, '\n')].length;

/** 記述欄に出す ES の候補。この企業用 → 同じ種類 → 字数が収まる、の順 */
export function rankEsAnswers(answers: LinkEsAnswer[], opts: { companyId?: string; label: string; limit: number }): LinkEsAnswer[] {
  const cat = categoryOf(opts.label);
  const score = (a: LinkEsAnswer) => {
    let s = 0;
    if (opts.companyId && a.companyIds.includes(opts.companyId)) s += 4;
    if (cat && a.category === cat) s += 2;
    if (opts.limit && charCount(a.text) <= opts.limit) s += 1;
    return s;
  };
  return answers
    .filter((a) => a.text.trim())
    .map((a) => ({ a, s: score(a) }))
    .sort((x, y) => y.s - x.s)
    .map((x) => x.a);
}
