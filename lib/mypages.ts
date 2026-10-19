import { isSharedHost, siteOf, type LinkMypage } from './sophon-link';

/**
 * 就活のマイページのログイン情報。拡張機能の storage（この PC の中）にだけ保存し、
 * Sophon のページやサーバーにはパスワードを渡さない（渡すのは LinkMypage の見出しだけ）。
 */
export interface Mypage {
  id: string;
  /** Sophon の会社の ID（Sophon につないでいなければ、ここで作った ID） */
  companyId: string;
  companyName: string;
  /** ログイン画面の URL（クエリは外す） */
  url: string;
  loginId: string;
  password: string;
  updatedAt: string;
}

export function summarize(m: Mypage): LinkMypage {
  return { companyId: m.companyId, companyName: m.companyName, url: m.url, loginId: m.loginId, hasPassword: !!m.password, updatedAt: m.updatedAt };
}

const segments = (u: URL) => u.pathname.split('/').filter(Boolean).map((s) => s.toLowerCase());

/**
 * 開いているページに合うマイページ。別の会社のパスワードを入れないよう、応募フォームの企業判定より厳しく見る：
 * 同じ会社のサイトなら URL のパスが長く一致するもの、共有の採用サイト（axol など）なら保存した URL のフォルダの中だけ。
 */
export function findMypage(list: Mypage[], href: string): Mypage | undefined {
  let page: URL;
  try {
    page = new URL(href);
  } catch {
    return undefined;
  }
  const pageSeg = segments(page);
  let best: { m: Mypage; score: number } | undefined;
  for (const m of list) {
    let u: URL;
    try {
      u = new URL(m.url);
    } catch {
      continue;
    }
    const seg = segments(u);
    let common = 0;
    while (common < seg.length && seg[common] === pageSeg[common]) common++;
    let score: number;
    if (isSharedHost(u.hostname)) {
      const dir = Math.max(seg.length - 1, 1);
      if (u.hostname !== page.hostname || common < dir) continue;
      score = 100 + common;
    } else if (u.hostname === page.hostname) score = 100 + common;
    else if (siteOf(u.hostname) === siteOf(page.hostname)) score = common;
    else continue;
    if (!best || score > best.score) best = { m, score };
  }
  return best?.m;
}

/** 保存する URL：クエリやハッシュ（セッション ID など）は外す */
export function cleanUrl(href: string): string {
  try {
    const u = new URL(href);
    return `${u.origin}${u.pathname}`;
  } catch {
    return href;
  }
}

export function originPattern(href: string): string | null {
  try {
    const u = new URL(href);
    return /^https?:$/.test(u.protocol) ? `${u.origin}/*` : null;
  } catch {
    return null;
  }
}
