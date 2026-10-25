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
  /** 記事のページ（ヘッダーに文字の大きさの切りかえを出す） */
  reading?: boolean;
  /** 記事のページのメタ情報（og:type を article にし、公開日・書き手・タグを書く） */
  article?: { published: number; modified: number; author: string; tags: string[] };
  /** 構造化データ（schema.org）。<script type="application/ld+json"> にして head に入れる */
  jsonLd?: object;
}

/** 丸いアイコン（画像がなければ色の丸） */
export function avatar(user: Pick<User, 'icon_key' | 'icon_color'>, size: number): string {
  const style = `width:${size}px;height:${size}px`;
  return user.icon_key
    ? `<img class="av" src="/column/img/${esc(user.icon_key)}" alt="" width="${size}" height="${size}" style="${style}">`
    : `<span class="av" aria-hidden="true" style="${style};background:${esc(user.icon_color)}"></span>`;
}

/** 文字の大きさ（小・中・大）。選んだ大きさは column.js がブラウザに覚える */
const SIZE_SWITCH = `<div class="sizes" role="group" aria-label="文字の大きさ">${['小', '中', '大']
  .map((l, i) => `<button type="button" data-size="${i}" aria-label="文字の大きさ ${l}" aria-pressed="${i === 1}">あ</button>`)
  .join('')}</div>`;

function header(user: User | null, env: Env, path: string, reading = false): string {
  // 書くボタンはだれにでも出す（ログインしていなければ、ログインしてから書く画面へ）
  const write = !user || canWrite(user) ? '<a class="btn btn-sm" href="/column/write">書く</a>' : '';
  const right = (reading ? SIZE_SWITCH : '') + (!user
    ? `<a class="nav-link nav-login" href="/column/auth/google?next=${encodeURIComponent(path)}">ログイン</a>${write}`
    : `${write}<a class="nav-me" href="/column/settings" aria-label="プロフィール">${avatar(user, 28)}</a>`);
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
  const a = opts.article;
  const iso = (ms: number) => new Date(ms).toISOString();
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}｜らくらくエントリー コラム</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${opts.noindex ? 'noindex' : 'max-image-preview:large'}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="らくらくエントリー コラム" href="${SITE}/column/feed.xml">
<meta property="og:site_name" content="らくらくエントリー コラム">
<meta property="og:type" content="${a ? 'article' : 'website'}">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(desc)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
<meta property="og:image" content="${esc(og)}">
<meta property="og:locale" content="ja_JP">
${
  a
    ? [
        `<meta property="article:published_time" content="${iso(a.published)}">`,
        `<meta property="article:modified_time" content="${iso(a.modified)}">`,
        `<meta property="article:author" content="${esc(a.author)}">`,
        ...a.tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`),
      ].join('\n')
    : ''
}
<meta name="twitter:card" content="summary_large_image">
${opts.jsonLd ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/column-assets/column.css">
</head>
<body${opts.grouped ? ' class="grouped"' : ''}>
${header(user, env, path, opts.reading)}
<main class="${opts.width === 'narrow' ? 'narrow' : 'main'}">
${body}
</main>
${(opts.scripts ?? []).map((s) => `<script type="module" src="/column-assets/${esc(s)}"></script>`).join('\n')}
${ANALYTICS}
</body>
</html>`;
}
