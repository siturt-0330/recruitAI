// 読むページ（一覧・記事・書き手のページ）と、サイトマップ・画像
import { canComment } from './api';
import { hasProfile, isAdmin, type User } from './auth';
import { parseBody, readMinutes, renderBlocks, richText } from './blocks';
import {
  commentsOf,
  followCounts,
  getArticle,
  isFollowing,
  isLiked,
  listArticles,
  popularTags,
  tagsOf,
  userByHandle,
  type ArticleRow,
} from './data';
import { avatar, page } from './layout';
import { esc, htmlResponse, jaDate } from './util';

const SITE = 'https://rakuraku-entry.com';

/** 「2時間前」「昨日」「10月18日」のような日時（日本時間） */
export function ago(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'たった今';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分前`;
  const day = (t: number) => Math.floor((t + 9 * 3600_000) / 86400_000);
  const d = day(Date.now()) - day(ms);
  if (d === 0) return `${Math.floor(diff / 3600_000)}時間前`;
  if (d === 1) return '昨日';
  const a = new Date(ms + 9 * 3600_000);
  const b = new Date(Date.now() + 9 * 3600_000);
  return a.getUTCFullYear() === b.getUTCFullYear() ? `${a.getUTCMonth() + 1}月${a.getUTCDate()}日` : jaDate(ms);
}

/** 検索に載せる記事（公開・一覧に出す・非表示でない・書き手も非表示でない）。a = articles、u = users */
const LISTED = "a.status = 'published' AND a.visibility = 'public' AND a.hidden = 0 AND u.hidden = 0";
const PUBLISHER = { '@type': 'Organization', name: 'らくらくエントリー', url: `${SITE}/`, logo: { '@type': 'ImageObject', url: `${SITE}/images/icon-128.png` } };
const crumbs = (items: [string, string][]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
});

const imgUrl = (key: string) => `/column/img/${encodeURIComponent(key)}`;
const heart = (on: boolean) =>
  `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;

/** 一覧の 1 行（タイトル・書き手・日時・スキ・見出し画像の小さな絵） */
function row(a: ArticleRow): string {
  return `<a class="post" href="/column/p/${esc(a.id)}">
<span class="post-main"><span class="post-title">${esc(a.title || '無題')}</span>
<span class="post-meta">${avatar(a, 18)}${esc(a.pen_name)}<span aria-hidden="true">·</span>${ago(a.published_at ?? a.updated_at)}${a.like_count ? `<span aria-hidden="true">·</span>スキ ${a.like_count}` : ''}</span></span>
${a.cover_key ? `<img class="post-cover" src="${imgUrl(a.cover_key)}" alt="" loading="lazy" decoding="async" width="88" height="88">` : ''}
</a>`;
}

function list(rows: ArticleRow[], more: boolean, base: string, emptyText: string): string {
  if (!rows.length) return `<p class="empty">${emptyText}</p>`;
  const last = rows[rows.length - 1]!;
  const sep = base.includes('?') ? '&' : '?';
  return `<div class="posts">${rows.map(row).join('')}</div>${more ? `<p class="more"><a class="btn btn-plain" href="${esc(`${base}${sep}before=${last.published_at}`)}">もっと見る</a></p>` : ''}`;
}

/** コラムのトップ（おすすめ＝新着・フォロー中・タグ・検索） */
export async function home(env: Env, url: URL, user: User | null): Promise<Response> {
  const tab = url.searchParams.get('tab') === 'following' ? 'following' : '';
  const tag = (url.searchParams.get('tag') ?? '').slice(0, 20);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
  const before = Number(url.searchParams.get('before')) || undefined;
  const tags = await popularTags(env.COLUMN_DB);
  if (tag && !tags.includes(tag)) tags.push(tag);

  let rows: ArticleRow[] = [];
  let more = false;
  let empty = 'まだ記事がありません';
  if (tab === 'following' && !user) {
    empty = `<a href="/column/auth/google?next=${encodeURIComponent('/column?tab=following')}">ログイン</a>すると表示されます`;
  } else {
    ({ rows, more } = await listArticles(env.COLUMN_DB, { followerId: tab === 'following' ? user!.id : undefined, tag: tag || undefined, q: q || undefined, before }));
    if (tab === 'following') empty = 'まだありません';
    if (q) empty = `「${esc(q)}」の記事は見つかりませんでした`;
  }

  const tabLink = (label: string, href: string, on: boolean) => `<a class="chip" href="${esc(href)}"${on ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
  const chips = [
    tabLink('おすすめ', '/column', !tab && !tag && !q),
    tabLink('フォロー中', '/column?tab=following', tab === 'following'),
    ...tags.map((t) => tabLink(`#${t}`, `/column?tag=${encodeURIComponent(t)}`, tag === t)),
  ].join('');
  const base = tab ? '/column?tab=following' : tag ? `/column?tag=${encodeURIComponent(tag)}` : q ? `/column?q=${encodeURIComponent(q)}` : '/column';
  const body = `<h1 class="title">${tag ? `#${esc(tag)}` : 'コラム'}</h1>
<form class="search" role="search" action="/column"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input type="search" name="q" value="${esc(q)}" placeholder="検索" aria-label="記事を検索" enterkeyhint="search"></form>
<nav class="chips" aria-label="テーマ">${chips}</nav>
${list(rows, more, base, empty)}`;
  const filtered = !!(tab || tag || q || before);
  return htmlResponse(
    page(
      {
        title: tag ? `#${tag}の記事` : 'コラム',
        description: tag
          ? `「${tag}」の就活コラム。就活生が、エントリーシート・面接・マイページ管理などの体験やコツを書き合っています。`
          : '就活生が、エントリーシート・面接・マイページ管理などの体験やコツを書き合うコラム。',
        canonical: tab || q || before ? undefined : tag ? `/column?tag=${encodeURIComponent(tag)}` : '/column',
        noindex: !!(tab || q || before) || (!!tag && !rows.length),
        jsonLd: filtered
          ? undefined
          : {
              '@context': 'https://schema.org',
              '@type': 'Blog',
              name: 'らくらくエントリー コラム',
              url: `${SITE}/column`,
              description: '就活生が、エントリーシート・面接・マイページ管理などの体験やコツを書き合うコラム。',
              inLanguage: 'ja',
              publisher: PUBLISHER,
              blogPost: rows
                .slice(0, 10)
                .map((r) => ({ '@type': 'BlogPosting', headline: r.title || '無題', url: `${SITE}/column/p/${r.id}`, author: { '@type': 'Person', name: r.pen_name } })),
            },
      },
      body,
      user,
      env,
      url.pathname,
    ),
  );
}

/** 記事のページ */
export async function article(env: Env, url: URL, user: User | null, id: string): Promise<Response | null> {
  const a = await getArticle(env.COLUMN_DB, id);
  if (!a) return null;
  const mine = user?.id === a.user_id;
  const admin = isAdmin(user, env);
  // 下書きは本人だけ、非表示にしたものは本人と運営だけが見られる
  if (a.status !== 'published' && !mine) return null;
  if ((a.hidden || a.user_hidden) && !mine && !admin) return null;

  const blocks = parseBody(a.body);
  const [tags, liked, following, comments, others] = await Promise.all([
    tagsOf(env.COLUMN_DB, a.id),
    user ? isLiked(env.COLUMN_DB, user.id, a.id) : false,
    user && !mine ? isFollowing(env.COLUMN_DB, user.id, a.user_id) : false,
    commentsOf(env.COLUMN_DB, a.id),
    listArticles(env.COLUMN_DB, { authorId: a.user_id }),
  ]);
  const listed = a.status === 'published' && a.visibility === 'public' && !a.hidden && !a.user_hidden;
  const when = a.published_at ?? a.updated_at;
  const next = others.rows.filter((o) => o.id !== a.id).slice(0, 3);
  const loginNext = `/column/auth/google?next=${encodeURIComponent(url.pathname)}`;
  const commentable = canComment(user);

  const notice =
    a.status === 'draft'
      ? `<p class="notice">下書きです。あなただけが見られます。<a href="/column/write/${esc(a.id)}">続きを書く</a></p>`
      : a.hidden || a.user_hidden
        ? '<p class="notice">運営が非表示にしています。ほかの人には見えません。</p>'
        : a.visibility === 'unlisted'
          ? '<p class="notice">リンクを知っている人だけが見られる記事です。</p>'
          : '';

  const commentList = comments
    .map((c) => {
      const canDelete = user && (user.id === c.user_id || mine || admin);
      return `<li class="comment" id="c-${esc(c.id)}">
<a href="/column/u/${esc(c.handle)}">${avatar(c, 32)}</a>
<div class="comment-main"><p class="comment-head"><a href="/column/u/${esc(c.handle)}">${esc(c.pen_name)}</a><span>${ago(c.created_at)}</span></p>
<p class="comment-body">${richText(c.body)}</p>
<p class="comment-tools">${canDelete ? `<button type="button" data-delete-comment="${esc(c.id)}">削除</button>` : ''}${user && user.id !== c.user_id ? `<button type="button" data-report="comment" data-id="${esc(c.id)}">通報</button>` : ''}</p></div></li>`;
    })
    .join('');
  const commentForm = !user
    ? `<p class="comment-login"><a href="${esc(loginNext)}">ログインしてコメント</a></p>`
    : commentable
      ? `<form class="comment-form" data-comment-form data-article="${esc(a.id)}"><textarea name="body" rows="3" maxlength="1000" placeholder="コメントを書く" aria-label="コメント" required></textarea><button class="btn btn-sm" type="submit">送信</button></form>`
      : user && !hasProfile(user)
        ? `<p class="comment-login"><a href="/column/welcome?next=${encodeURIComponent(url.pathname)}">登録してコメント</a></p>`
        : '<p class="comment-login">コメントできません</p>';

  const articleUrl = `${SITE}/column/p/${a.id}`;
  const coverUrl = a.cover_key ? `${SITE}${imgUrl(a.cover_key)}` : undefined;
  const jsonLd = listed
    ? {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'BlogPosting',
            '@id': `${articleUrl}#article`,
            headline: (a.title || '無題').slice(0, 110),
            description: a.excerpt || undefined,
            datePublished: new Date(when).toISOString(),
            dateModified: new Date(a.updated_at).toISOString(),
            author: { '@type': 'Person', name: a.pen_name, url: `${SITE}/column/u/${a.handle}` },
            publisher: PUBLISHER,
            image: coverUrl ?? `${SITE}/images/og.png`,
            mainEntityOfPage: articleUrl,
            url: articleUrl,
            inLanguage: 'ja',
            keywords: tags.length ? tags.join(',') : undefined,
            wordCount: a.chars,
            commentCount: a.comment_count,
            isPartOf: { '@type': 'Blog', name: 'らくらくエントリー コラム', url: `${SITE}/column` },
          },
          crumbs([
            ['らくらくエントリー', `${SITE}/`],
            ['コラム', `${SITE}/column`],
            ...(tags[0] ? [[`#${tags[0]}`, `${SITE}/column?tag=${encodeURIComponent(tags[0])}`] as [string, string]] : []),
            [a.title || '無題', articleUrl],
          ]),
        ],
      }
    : undefined;

  const body = `<article class="article" data-article-id="${esc(a.id)}">
${notice}
${tags[0] ? `<p class="kicker"><a href="/column?tag=${encodeURIComponent(tags[0])}">${esc(tags[0])}</a></p>` : ''}
<h1 class="article-title">${esc(a.title || '無題')}</h1>
<div class="byline">
<a href="/column/u/${esc(a.handle)}">${avatar(a, 36)}</a>
<span class="byline-main"><a class="byline-name" href="/column/u/${esc(a.handle)}">${esc(a.pen_name)}</a><span class="byline-meta"><time datetime="${new Date(when).toISOString()}">${jaDate(when)}</time> · ${readMinutes(a.chars)}分</span></span>
${mine ? `<a class="btn btn-sm btn-plain" href="/column/write/${esc(a.id)}">編集</a>` : `<button type="button" class="follow" data-follow="${esc(a.user_id)}" data-login="${esc(loginNext)}" aria-pressed="${following}">${following ? 'フォロー中' : 'フォロー'}</button>`}
</div>
${a.cover_key ? `<img class="cover" src="${imgUrl(a.cover_key)}" alt="${esc(a.title || '')}" decoding="async">` : ''}
<div class="prose" data-prose>${renderBlocks(blocks)}</div>
${tags.length ? `<p class="tags">${tags.map((t) => `<a href="/column?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`).join('')}</p>` : ''}
<div class="actions">
<button type="button" class="like" data-like="${esc(a.id)}" data-login="${esc(loginNext)}" aria-pressed="${liked}" aria-label="スキ">${heart(liked)}<span data-like-count>${a.like_count}</span></button>
<a class="action" href="#comments" aria-label="コメント"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>${a.comment_count}</a>
<span class="grow"></span>
<button type="button" class="icon-btn" data-share data-title="${esc(a.title)}" aria-label="共有"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 9l5-5 5 5M5 14v5h14v-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
${user && !mine ? `<button type="button" class="icon-btn" data-report="article" data-id="${esc(a.id)}" aria-label="通報"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4h11l-2 4 2 4H6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg></button>` : ''}
</div>
<a class="author" href="/column/u/${esc(a.handle)}">${avatar(a, 48)}<span class="author-main"><span class="author-name">${esc(a.pen_name)}</span></span><svg width="9" height="15" viewBox="0 0 9 15" aria-hidden="true"><path d="M1.5 1.5l6 6-6 6" fill="none" stroke="#c7c7cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
<section id="comments" class="comments" aria-label="コメント"><h2>コメント ${a.comment_count || ''}</h2><ul class="comment-list" data-comment-list>${commentList}</ul>${commentForm}</section>
${next.length ? `<section class="next" aria-label="この人の記事"><h2>${esc(a.pen_name)}の記事</h2><div class="posts">${next.map(row).join('')}</div></section>` : ''}
</article>`;

  return htmlResponse(
    page(
      {
        title: a.title || '無題',
        description: a.excerpt || `${a.pen_name}のコラム`,
        canonical: listed ? `/column/p/${a.id}` : undefined,
        noindex: !listed,
        ogImage: coverUrl,
        scripts: ['column.js'],
        reading: true,
        article: listed ? { published: when, modified: a.updated_at, author: a.pen_name, tags } : undefined,
        jsonLd,
      },
      body,
      user,
      env,
      url.pathname,
    ),
  );
}

/** 書き手のページ */
export async function profile(env: Env, url: URL, user: User | null, handle: string): Promise<Response | null> {
  const p = await userByHandle(env.COLUMN_DB, handle);
  if (!p || (p.hidden && !isAdmin(user, env) && user?.id !== p.id)) return null;
  const before = Number(url.searchParams.get('before')) || undefined;
  const [counts, { rows, more }, following] = await Promise.all([
    followCounts(env.COLUMN_DB, p.id),
    listArticles(env.COLUMN_DB, { authorId: p.id, before }),
    user && user.id !== p.id ? isFollowing(env.COLUMN_DB, user.id, p.id) : false,
  ]);
  const me = user?.id === p.id;
  // 自分のページには、下書きと、一覧に出ない自分の記事（リンクのみ・非表示）も出す
  const mine = me
    ? (
        await env.COLUMN_DB.prepare(
          `SELECT id, title, status, visibility, hidden, updated_at FROM articles
           WHERE user_id = ? AND (status = 'draft' OR visibility = 'unlisted' OR hidden = 1) ORDER BY updated_at DESC LIMIT 50`,
        )
          .bind(p.id)
          .all<{ id: string; title: string; status: string; visibility: string; hidden: number; updated_at: number }>()
      ).results
    : [];
  const drafts = mine.length
    ? `<section class="drafts" aria-label="下書き"><h2>下書きなど</h2>${mine
        .map(
          (d) =>
            `<a class="post" href="/column/write/${esc(d.id)}"><span class="post-main"><span class="post-title">${esc(d.title || '無題')}</span><span class="post-meta">${d.hidden ? '非表示' : d.status === 'draft' ? '下書き' : 'リンクのみ'}<span aria-hidden="true">·</span>${ago(d.updated_at)}</span></span></a>`,
        )
        .join('')}</section>`
    : '';
  const loginNext = `/column/auth/google?next=${encodeURIComponent(url.pathname)}`;
  const body = `<header class="profile">
${avatar(p, 72)}
<h1 class="profile-name">${esc(p.pen_name)}</h1>
${p.bio ? `<p class="profile-bio">${richText(p.bio)}</p>` : ''}
<p class="profile-counts"><span><b>${counts.articles}</b> 記事</span><span><b data-followers>${counts.followers}</b> フォロワー</span><span><b>${counts.following}</b> フォロー</span></p>
${me ? '<a class="btn btn-sm btn-plain" href="/column/settings">プロフィールを編集</a>' : `<button type="button" class="follow" data-follow="${esc(p.id)}" data-login="${esc(loginNext)}" aria-pressed="${following}">${following ? 'フォロー中' : 'フォロー'}</button>`}
${user && !me ? `<button type="button" class="link-btn small" data-report="user" data-id="${esc(p.id)}">通報</button>` : ''}
</header>
${drafts}
${list(rows, more, `/column/u/${p.handle}`, me ? '<a href="/column/write">書いてみる</a>' : 'まだ記事がありません')}`;
  return htmlResponse(
    page(
      {
        title: p.pen_name,
        description: p.bio || `${p.pen_name}のコラム`,
        canonical: before || p.hidden ? undefined : `/column/u/${p.handle}`,
        noindex: !!before || !!p.hidden || counts.articles === 0,
        scripts: ['column.js'],
        jsonLd:
          before || p.hidden
            ? undefined
            : {
                '@context': 'https://schema.org',
                '@type': 'ProfilePage',
                url: `${SITE}/column/u/${p.handle}`,
                mainEntity: { '@type': 'Person', name: p.pen_name, description: p.bio || undefined, url: `${SITE}/column/u/${p.handle}` },
              },
      },
      body,
      user,
      env,
      url.pathname,
    ),
  );
}

/** 記事のサイトマップ（robots.txt から案内する） */
export async function sitemap(env: Env): Promise<Response> {
  const db = env.COLUMN_DB;
  const [articles, authors, tags] = await Promise.all([
    db.prepare(`SELECT a.id, a.updated_at FROM articles a JOIN users u ON u.id = a.user_id WHERE ${LISTED} ORDER BY a.published_at DESC LIMIT 5000`).all<{ id: string; updated_at: number }>(),
    db
      .prepare(`SELECT u.handle, MAX(a.updated_at) AS updated_at FROM articles a JOIN users u ON u.id = a.user_id WHERE ${LISTED} GROUP BY u.id LIMIT 5000`)
      .all<{ handle: string; updated_at: number }>(),
    // 記事が 2 本以上あるタグだけ（1 本だけのタグのページは、記事のページとほぼ同じになるため）
    db
      .prepare(
        `SELECT t.tag, MAX(a.updated_at) AS updated_at FROM article_tags t JOIN articles a ON a.id = t.article_id JOIN users u ON u.id = a.user_id
         WHERE ${LISTED} GROUP BY t.tag HAVING COUNT(*) >= 2 LIMIT 1000`,
      )
      .all<{ tag: string; updated_at: number }>(),
  ]);
  const day = (ms: number) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);
  const url = (path: string, ms?: number) => `  <url><loc>${esc(SITE + path)}</loc>${ms ? `<lastmod>${day(ms)}</lastmod>` : ''}</url>`;
  const urls = [
    url('/column', articles.results[0]?.updated_at),
    ...articles.results.map((a) => url(`/column/p/${a.id}`, a.updated_at)),
    ...authors.results.map((u) => url(`/column/u/${u.handle}`, u.updated_at)),
    ...tags.results.map((t) => url(`/column?tag=${encodeURIComponent(t.tag)}`, t.updated_at)),
  ];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

/** 新着記事の RSS（フィードリーダーや検索エンジンが新しい記事を見つけやすくなる） */
export async function feed(env: Env): Promise<Response> {
  const r = await env.COLUMN_DB.prepare(
    `SELECT a.id, a.title, a.excerpt, a.published_at, u.pen_name FROM articles a JOIN users u ON u.id = a.user_id
     WHERE ${LISTED} ORDER BY a.published_at DESC LIMIT 20`,
  ).all<{ id: string; title: string; excerpt: string; published_at: number; pen_name: string }>();
  const items = r.results
    .map((a) => {
      const link = `${SITE}/column/p/${a.id}`;
      return `<item><title>${esc(a.title || '無題')}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><pubDate>${new Date(a.published_at).toUTCString()}</pubDate><dc:creator>${esc(a.pen_name)}</dc:creator><description>${esc(a.excerpt)}</description></item>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>らくらくエントリー コラム</title>
<link>${SITE}/column</link>
<atom:link href="${SITE}/column/feed.xml" rel="self" type="application/rss+xml"/>
<description>就活生が、エントリーシート・面接・マイページ管理などの体験やコツを書き合うコラム。</description>
<language>ja</language>
${items}
</channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=1800' } });
}

/** 画像（R2）。key はランダムで中身が変わらないので、長くキャッシュしてよい */
export async function image(env: Env, key: string): Promise<Response | null> {
  if (!/^[A-Za-z0-9_-]{16,64}\.(webp|jpg|png)$/.test(key)) return null;
  const obj = await env.COLUMN_IMAGES.get(key);
  if (!obj) return null;
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      ETag: obj.httpEtag,
    },
  });
}
