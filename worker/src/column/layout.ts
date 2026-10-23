// コラムのページの共通の枠（ヘッダー・メタタグ・アクセス解析）
import { canWrite, type User } from './auth';
import { esc } from './util';

const SITE = 'https://rakuraku-entry.com';
// 公式サイトと同じ Cloudflare Web Analytics（Cookie は使わない）
const ANALYTICS =
  `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "bfa5d22bd9ef4d3e8c71de69bad08fa1"}'></script>`;

export interface PageOptions {
  title: string;
  description?: string;
  /** /column から始まるパス。検索に載せるページだけ付ける */
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
  /** ページだけで使う JS（/column-assets/ のファイル名） */
  scripts?: string[];
  /** 本文の幅。narrow は設定などの画面 */
  width?: 'normal' | 'narrow';
  /** 背景を灰色にする（設定の画面など、白いまとまりを並べる画面） */
  grouped?: boolean;
}

/** 丸いアイコン（画像がなければ色の丸） */
export function avatar(user: Pick<User, 'icon_key' | 'icon_color'>, size: number): string {
  const style = `width:${size}px;height:${size}px`;
  return user.icon_key
    ? `<img class="av" src="/column/img/${esc(user.icon_key)}" alt="" width="${size}" height="${size}" style="${style}">`
    : `<span class="av" aria-hidden="true" style="${style};background:${esc(user.icon_color)}"></span>`;
}

function header(user: User | null, env: Env, path: string): string {
  const right = !user
    ? `<a class="nav-link" href="/column/auth/google?next=${encodeURIComponent(path)}">ログイン</a>`
    : `${canWrite(user, env) ? '<a class="btn btn-sm" href="/column/write">書く</a>' : ''}<a class="nav-me" href="/column/settings" aria-label="設定">${avatar(user, 28)}</a>`;
  return `<header class="bar"><nav class="bar-in" aria-label="メインメニュー">
<a class="brand" href="/"><img src="/images/icon.svg" alt="" width="22" height="22">らくらくエントリー</a>
<a class="nav-link" href="https://app.rakuraku-entry.com/companies">マイページ管理</a>
<a class="nav-link" href="/game">SPI 用語集</a>
<a class="nav-link" href="/column" aria-current="${path.startsWith('/column') ? 'page' : 'false'}">コラム</a>
<span class="grow"></span>${right}
</nav></header>`;
}

export function page(opts: PageOptions, body: string, user: User | null, env: Env, path: string): string {
  const desc = opts.description ?? '就活生が、就活の体験やコツを書き合うコラム。';
  const canonical = opts.canonical ? `${SITE}${opts.canonical}` : '';
  const og = opts.ogImage ?? `${SITE}/images/og.png`;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}｜らくらくエントリー コラム</title>
<meta name="description" content="${esc(desc)}">
${opts.noindex ? '<meta name="robots" content="noindex">' : ''}
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<link rel="icon" href="/favicon.png" type="image/png">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(desc)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
<meta property="og:image" content="${esc(og)}">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/column-assets/column.css">
</head>
<body${opts.grouped ? ' class="grouped"' : ''}>
${header(user, env, path)}
<main class="${opts.width === 'narrow' ? 'narrow' : 'main'}">
${body}
</main>
${(opts.scripts ?? []).map((s) => `<script type="module" src="/column-assets/${esc(s)}"></script>`).join('\n')}
${ANALYTICS}
</body>
</html>`;
}
