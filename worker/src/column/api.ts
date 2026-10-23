// 読むページの小さな JS が使う API（スキ・フォロー・コメント・通報）。書き込みはすべて POST で、このサイトのページからだけ受ける
import { canWrite, hasProfile, isAdmin, type User } from './auth';
import { countToday } from './data';
import { jsonResponse, now, randomId, sameOrigin } from './util';

/** 1 日（日本時間）の上限。連打や荒らしで表が膨らまないように */
export const DAILY = { likes: 300, follows: 200, comments: 50, reports: 20 } as const;

/** コメントを書けるか。招待のあいだ（COLUMN_COMMENTS=members）は書き手どうしだけ */
export function canComment(user: User | null, env: Env): boolean {
  if (!user || user.hidden || !hasProfile(user)) return false;
  return (env.COLUMN_COMMENTS as string) === 'everyone' || canWrite(user, env);
}

async function readJson(request: Request, max = 16 * 1024): Promise<Record<string, unknown> | null> {
  if (Number(request.headers.get('Content-Length') ?? '0') > max) return null;
  const text = await request.text();
  if (text.length > max) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function handleApi(request: Request, env: Env, url: URL, user: User | null): Promise<Response | null> {
  const name = url.pathname.slice('/column/api/'.length);
  const handlers: Record<string, (b: Record<string, unknown>, u: User) => Promise<Response>> = {
    like: (b, u) => like(env, u, str(b.article, 40)),
    follow: (b, u) => follow(env, u, str(b.user, 40)),
    comment: (b, u) => addComment(env, u, str(b.article, 40), str(b.body, 1000)),
    'comment-delete': (b, u) => deleteComment(env, u, str(b.id, 40)),
    report: (b, u) => report(env, u, str(b.type, 10), str(b.id, 40), str(b.reason, 300)),
  };
  const fn = handlers[name];
  if (!fn) return null;
  if (request.method !== 'POST') return jsonResponse({ error: 'method' }, 405);
  if (!sameOrigin(request, url)) return jsonResponse({ error: 'forbidden' }, 403);
  if (!user || !hasProfile(user)) return jsonResponse({ error: 'login' }, 401);
  if (user.hidden) return jsonResponse({ error: 'forbidden' }, 403);
  const body = await readJson(request);
  if (!body) return jsonResponse({ error: 'bad request' }, 400);
  return fn(body, user);
}

/** スキを付ける・外す（数は記録から数え直す。ずれないように） */
async function like(env: Env, user: User, articleId: string): Promise<Response> {
  const db = env.COLUMN_DB;
  const a = await db.prepare("SELECT id FROM articles WHERE id = ? AND status = 'published' AND hidden = 0").bind(articleId).first();
  if (!a) return jsonResponse({ error: 'not found' }, 404);
  const had = await db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND article_id = ?').bind(user.id, articleId).first();
  if (!had && (await countToday(db, 'likes', user.id)) >= DAILY.likes) return jsonResponse({ error: 'quota' }, 429);
  const recount = db.prepare('UPDATE articles SET like_count = (SELECT COUNT(*) FROM likes WHERE article_id = ?1) WHERE id = ?1').bind(articleId);
  await db.batch([
    had
      ? db.prepare('DELETE FROM likes WHERE user_id = ? AND article_id = ?').bind(user.id, articleId)
      : db.prepare('INSERT OR IGNORE INTO likes (user_id, article_id, created_at) VALUES (?, ?, ?)').bind(user.id, articleId, now()),
    recount,
  ]);
  const r = await db.prepare('SELECT like_count FROM articles WHERE id = ?').bind(articleId).first<{ like_count: number }>();
  return jsonResponse({ liked: !had, count: r?.like_count ?? 0 });
}

async function follow(env: Env, user: User, targetId: string): Promise<Response> {
  const db = env.COLUMN_DB;
  if (targetId === user.id) return jsonResponse({ error: 'self' }, 400);
  const t = await db.prepare('SELECT id FROM users WHERE id = ? AND hidden = 0 AND pen_name IS NOT NULL').bind(targetId).first();
  if (!t) return jsonResponse({ error: 'not found' }, 404);
  const had = await db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?').bind(user.id, targetId).first();
  if (!had && (await countToday(db, 'follows', user.id)) >= DAILY.follows) return jsonResponse({ error: 'quota' }, 429);
  await (had
    ? db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').bind(user.id, targetId)
    : db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)').bind(user.id, targetId, now())
  ).run();
  const r = await db.prepare('SELECT COUNT(*) AS n FROM follows WHERE followee_id = ?').bind(targetId).first<{ n: number }>();
  return jsonResponse({ following: !had, followers: r?.n ?? 0 });
}

async function addComment(env: Env, user: User, articleId: string, body: string): Promise<Response> {
  const db = env.COLUMN_DB;
  if (!canComment(user, env)) return jsonResponse({ error: 'forbidden' }, 403);
  if (!body) return jsonResponse({ error: 'empty' }, 400);
  const a = await db.prepare("SELECT id FROM articles WHERE id = ? AND status = 'published' AND hidden = 0").bind(articleId).first();
  if (!a) return jsonResponse({ error: 'not found' }, 404);
  if ((await countToday(db, 'comments', user.id)) >= DAILY.comments) return jsonResponse({ error: 'quota' }, 429);
  const id = randomId(9);
  const t = now();
  await db.batch([
    db.prepare('INSERT INTO comments (id, article_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, articleId, user.id, body, t),
    db.prepare('UPDATE articles SET comment_count = (SELECT COUNT(*) FROM comments WHERE article_id = ?1 AND hidden = 0) WHERE id = ?1').bind(articleId),
  ]);
  return jsonResponse({
    comment: { id, body, created_at: t, pen_name: user.pen_name, handle: user.handle, icon_color: user.icon_color, icon_key: user.icon_key },
  });
}

/** コメントを消す（書いた本人・記事の書き手・運営） */
async function deleteComment(env: Env, user: User, id: string): Promise<Response> {
  const db = env.COLUMN_DB;
  const c = await db
    .prepare('SELECT c.id, c.user_id, c.article_id, a.user_id AS author_id FROM comments c JOIN articles a ON a.id = c.article_id WHERE c.id = ?')
    .bind(id)
    .first<{ id: string; user_id: string; article_id: string; author_id: string }>();
  if (!c) return jsonResponse({ error: 'not found' }, 404);
  if (c.user_id !== user.id && c.author_id !== user.id && !isAdmin(user, env)) return jsonResponse({ error: 'forbidden' }, 403);
  await db.batch([
    db.prepare('DELETE FROM comments WHERE id = ?').bind(id),
    db.prepare('UPDATE articles SET comment_count = (SELECT COUNT(*) FROM comments WHERE article_id = ?1 AND hidden = 0) WHERE id = ?1').bind(c.article_id),
  ]);
  return jsonResponse({ ok: true });
}

async function report(env: Env, user: User, type: string, id: string, reason: string): Promise<Response> {
  const db = env.COLUMN_DB;
  if (!['article', 'comment', 'user'].includes(type) || !id) return jsonResponse({ error: 'bad request' }, 400);
  if ((await countToday(db, 'reports', user.id)) >= DAILY.reports) return jsonResponse({ error: 'quota' }, 429);
  await db
    .prepare('INSERT INTO reports (id, reporter_id, target_type, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(randomId(9), user.id, type, id, reason, now())
    .run();
  console.log(JSON.stringify({ message: 'column report', type }));
  return jsonResponse({ ok: true });
}
