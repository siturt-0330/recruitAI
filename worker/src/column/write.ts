// 書く画面（React のアプリ）の入れ物と、記事・画像の API
import { canWrite, hasProfile, type User } from './auth';
import { countChars, excerptOf, imageKeys, LIMITS, sanitizeBlocks, type Block } from './blocks';
import { countToday, tagsOf } from './data';
import { esc, htmlResponse, jsonResponse, now, randomId, readBytes, readJson, redirect, sameOrigin } from './util';
import { WRITE_VERSION } from './write-version';

const DAILY = { articles: 20, images: 40 } as const;
const MAX_IMAGE = 5 * 1024 * 1024;
const TEMPLATES = ['fail', 'exp', 'es', 'tips', 'free'];

/** /column/write と /column/write/<id>。中身は site/column-assets/write/ の React のアプリが作る */
export function writeShell(url: URL, user: User | null, env: Env): Response {
  if (!user) return redirect(`/column/auth/google?next=${encodeURIComponent(url.pathname)}`);
  if (!hasProfile(user)) return redirect(`/column/welcome?next=${encodeURIComponent(url.pathname)}`);
  if (!canWrite(user)) return redirect('/column');
  const me = { penName: user.pen_name, handle: user.handle, iconColor: user.icon_color, iconKey: user.icon_key };
  return htmlResponse(`<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>書く｜らくらくエントリー コラム</title>
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/column-assets/column.css">
<link rel="stylesheet" href="/column-assets/write/write.css?v=${WRITE_VERSION}">
</head>
<body>
<div id="app" data-me="${esc(JSON.stringify(me))}"></div>
<noscript><p class="narrow">書く画面には JavaScript が必要です。</p></noscript>
<script type="module" src="/column-assets/write/write.js?v=${WRITE_VERSION}"></script>
</body>
</html>`);
}

interface OwnArticle {
  id: string;
  user_id: string;
  title: string;
  body: string;
  cover_key: string | null;
  template: string;
  visibility: 'public' | 'unlisted';
  status: 'draft' | 'published';
  hidden: number;
  updated_at: number;
  published_at: number | null;
}

async function ownArticle(db: D1Database, user: User, id: string): Promise<OwnArticle | null> {
  return db.prepare('SELECT * FROM articles WHERE id = ? AND user_id = ?').bind(id, user.id).first<OwnArticle>();
}

/** タグを整える（# を外し、空白をなくし、5 個まで・20 文字まで・重なりなし） */
function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const t of raw) {
    const s = String(t ?? '').replace(/^[#＃]+/, '').replace(/\s+/g, '').slice(0, LIMITS.tag);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= LIMITS.tags) break;
  }
  return out;
}

/** 画像の key が、その人がアップロードしたものか */
async function ownsImages(db: D1Database, user: User, keys: string[]): Promise<boolean> {
  const uniq = [...new Set(keys)];
  if (!uniq.length) return true;
  const r = await db
    .prepare(`SELECT COUNT(*) AS n FROM images WHERE user_id = ? AND key IN (${uniq.map(() => '?').join(',')})`)
    .bind(user.id, ...uniq)
    .first<{ n: number }>();
  return (r?.n ?? 0) === uniq.length;
}

/** 本文に電話番号やメールアドレスらしい文字があるか（公開の前に知らせる） */
function personalInfoHint(title: string, blocks: Block[]): string {
  const text = [title, ...blocks.map((b) => `${b.text ?? ''} ${b.caption ?? ''}`)].join('\n');
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(text)) return 'メールアドレスのような文字があります';
  if (/0\d{1,4}[-ー－ ]?\d{1,4}[-ー－ ]?\d{3,4}/.test(text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)))) return '電話番号のような文字があります';
  return '';
}

/** 記事の保存の本文の上限（本文 4 万字と、ブロックの形の分） */
const MAX_ARTICLE_JSON = 256 * 1024;

/** 記事と画像の API（/column/api/articles…、/column/api/images）。null ならここの API ではない */
export async function handleWriteApi(request: Request, env: Env, url: URL, user: User | null): Promise<Response | null> {
  const p = url.pathname;
  if (!p.startsWith('/column/api/articles') && p !== '/column/api/images') return null;
  if (!user || !hasProfile(user)) return jsonResponse({ error: 'login' }, 401);
  if (!canWrite(user)) return jsonResponse({ error: 'forbidden' }, 403);
  const db = env.COLUMN_DB;

  // 読むだけの API（自分の記事）
  if (request.method === 'GET') {
    if (p === '/column/api/articles') {
      const r = await db
        .prepare('SELECT id, title, status, visibility, hidden, updated_at, published_at FROM articles WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100')
        .bind(user.id)
        .all();
      return jsonResponse({ articles: r.results });
    }
    const m = p.match(/^\/column\/api\/articles\/([A-Za-z0-9_-]{1,40})$/);
    if (!m) return jsonResponse({ error: 'not found' }, 404);
    const a = await ownArticle(db, user, m[1]!);
    if (!a) return jsonResponse({ error: 'not found' }, 404);
    return jsonResponse({
      article: {
        id: a.id,
        title: a.title,
        body: JSON.parse(a.body),
        coverKey: a.cover_key,
        template: a.template,
        visibility: a.visibility,
        status: a.status,
        hidden: !!a.hidden,
        tags: await tagsOf(db, a.id),
        updatedAt: a.updated_at,
      },
    });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'method' }, 405);
  if (!sameOrigin(request, url)) return jsonResponse({ error: 'forbidden' }, 403);
  if (p === '/column/api/images') return uploadImage(request, env, user);

  // 新しい下書き
  if (p === '/column/api/articles') {
    const b = (await readJson(request, MAX_ARTICLE_JSON)) ?? {};
    if ((await countToday(db, 'articles', user.id)) >= DAILY.articles) return jsonResponse({ error: 'quota' }, 429);
    const id = randomId(9);
    const template = TEMPLATES.includes(String(b.template)) ? String(b.template) : 'free';
    const body = sanitizeBlocks(b.body);
    const t = now();
    await db
      .prepare('INSERT INTO articles (id, user_id, template, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, user.id, template, JSON.stringify(typeof body === 'string' ? [] : body), t, t)
      .run();
    return jsonResponse({ id });
  }

  const m = p.match(/^\/column\/api\/articles\/([A-Za-z0-9_-]{1,40})\/(save|publish|unpublish|delete)$/);
  if (!m) return jsonResponse({ error: 'not found' }, 404);
  const a = await ownArticle(db, user, m[1]!);
  if (!a) return jsonResponse({ error: 'not found' }, 404);
  const action = m[2]!;

  if (action === 'delete') {
    await db.prepare('DELETE FROM articles WHERE id = ?').bind(a.id).run();
    return jsonResponse({ ok: true });
  }
  if (action === 'unpublish') {
    await db.prepare("UPDATE articles SET status = 'draft', updated_at = ? WHERE id = ?").bind(now(), a.id).run();
    return jsonResponse({ ok: true });
  }

  // 保存・公開
  const b = await readJson(request, MAX_ARTICLE_JSON);
  if (!b) return jsonResponse({ error: 'bad request' }, 400);
  const title = String(b.title ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.title);
  const blocks = sanitizeBlocks(b.body);
  if (typeof blocks === 'string') return jsonResponse({ error: 'invalid', message: blocks }, 400);
  const cover = typeof b.coverKey === 'string' && b.coverKey ? b.coverKey : null;
  const keys = [...imageKeys(blocks), ...(cover ? [cover] : [])];
  if (!(await ownsImages(db, user, keys))) return jsonResponse({ error: 'invalid', message: '画像をもう一度アップロードしてください' }, 400);
  const tags = cleanTags(b.tags);
  const visibility = b.visibility === 'unlisted' ? 'unlisted' : 'public';
  const chars = countChars(blocks);
  const t = now();

  if (action === 'publish') {
    if (!title) return jsonResponse({ error: 'invalid', message: 'タイトルを入れてください' }, 400);
    if (!chars) return jsonResponse({ error: 'invalid', message: '本文を書いてください' }, 400);
    const hint = personalInfoHint(title, blocks);
    if (hint && b.confirmed !== true) return jsonResponse({ error: 'confirm', message: `${hint}。個人の情報でないか確かめてください` }, 409);
  }

  const stmts = [
    db
      .prepare(
        `UPDATE articles SET title = ?, body = ?, excerpt = ?, cover_key = ?, visibility = ?, chars = ?, updated_at = ?
         ${action === 'publish' ? ", status = 'published', published_at = COALESCE(published_at, ?)" : ''} WHERE id = ?`,
      )
      .bind(...[title, JSON.stringify(blocks), excerptOf(blocks), cover, visibility, chars, t, ...(action === 'publish' ? [t] : []), a.id]),
    db.prepare('DELETE FROM article_tags WHERE article_id = ?').bind(a.id),
    ...tags.map((tag) => db.prepare('INSERT INTO article_tags (article_id, tag) VALUES (?, ?)').bind(a.id, tag)),
  ];
  await db.batch(stmts);
  return jsonResponse({ ok: true, savedAt: t, url: `/column/p/${a.id}` });
}

/** 画像のアップロード。ブラウザで縮めてから送られてくる。中身の先頭のバイトで種類を確かめる（アイコンの写真にも使う） */
export async function uploadImage(request: Request, env: Env, user: User): Promise<Response> {
  const db = env.COLUMN_DB;
  if (Number(request.headers.get('Content-Length') ?? '0') > MAX_IMAGE) return jsonResponse({ error: 'too large' }, 413);
  if ((await countToday(db, 'images', user.id)) >= DAILY.images) return jsonResponse({ error: 'quota' }, 429);
  const buf = await readBytes(request, MAX_IMAGE);
  if (!buf) return jsonResponse({ error: 'too large' }, 413);
  if (buf.byteLength < 16) return jsonResponse({ error: 'invalid' }, 400);
  const ascii = (from: number, to: number) => String.fromCharCode(...buf.slice(from, to));
  const kind =
    ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
      ? { ext: 'webp', type: 'image/webp' }
      : buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
        ? { ext: 'jpg', type: 'image/jpeg' }
        : buf[0] === 0x89 && ascii(1, 4) === 'PNG'
          ? { ext: 'png', type: 'image/png' }
          : null;
  if (!kind) return jsonResponse({ error: 'invalid', message: 'JPEG・PNG・WebP の画像にしてください' }, 400);
  const key = `${randomId(18)}.${kind.ext}`;
  await env.COLUMN_IMAGES.put(key, buf, { httpMetadata: { contentType: kind.type } });
  await db
    .prepare('INSERT INTO images (key, user_id, content_type, bytes, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(key, user.id, kind.type, buf.byteLength, now())
    .run();
  return jsonResponse({ key });
}
