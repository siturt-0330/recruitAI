// コラムの D1 の読み書き（読むページとスキ・フォロー・コメントで使うもの）

/** 一覧に出す記事（書き手の表示に要るものも一緒に引く） */
export interface ArticleRow {
  id: string;
  user_id: string;
  title: string;
  excerpt: string;
  body: string;
  cover_key: string | null;
  template: string;
  visibility: 'public' | 'unlisted';
  status: 'draft' | 'published';
  hidden: number;
  chars: number;
  like_count: number;
  comment_count: number;
  created_at: number;
  updated_at: number;
  published_at: number | null;
  handle: string;
  pen_name: string;
  status_line: string;
  bio: string;
  icon_color: string;
  icon_key: string | null;
  user_hidden: number;
}

const ARTICLE_COLS = `a.id, a.user_id, a.title, a.excerpt, a.body, a.cover_key, a.template, a.visibility, a.status, a.hidden, a.chars,
  a.like_count, a.comment_count, a.created_at, a.updated_at, a.published_at,
  u.handle, u.pen_name, u.status_line, u.bio, u.icon_color, u.icon_key, u.hidden AS user_hidden`;
/** みんなに見せてよい記事（公開・一覧に出す・非表示でない・書き手も非表示でない） */
export const LISTED = `a.status = 'published' AND a.visibility = 'public' AND a.hidden = 0 AND u.hidden = 0`;
export const PAGE_SIZE = 20;

export interface ListQuery {
  /** フォロー中の書き手だけ（この人がフォローしている人） */
  followerId?: string;
  tag?: string;
  q?: string;
  authorId?: string;
  /** これより前に公開された記事（「もっと見る」） */
  before?: number;
}

/** 一覧（新しい順）。PAGE_SIZE + 1 件引いて、次があるかを見る */
export async function listArticles(db: D1Database, q: ListQuery): Promise<{ rows: ArticleRow[]; more: boolean }> {
  const where = [LISTED];
  const args: unknown[] = [];
  if (q.followerId) {
    where.push('a.user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?)');
    args.push(q.followerId);
  }
  if (q.tag) {
    where.push('a.id IN (SELECT article_id FROM article_tags WHERE tag = ?)');
    args.push(q.tag);
  }
  if (q.q) {
    // 小さいうちは LIKE で足りる。記事が増えたら全文検索（FTS5）にする
    where.push("(a.title LIKE ? ESCAPE '\\' OR a.excerpt LIKE ? ESCAPE '\\')");
    const like = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    args.push(like, like);
  }
  if (q.authorId) {
    where.push('a.user_id = ?');
    args.push(q.authorId);
  }
  if (q.before) {
    where.push('a.published_at < ?');
    args.push(q.before);
  }
  const res = await db
    .prepare(`SELECT ${ARTICLE_COLS} FROM articles a JOIN users u ON u.id = a.user_id WHERE ${where.join(' AND ')} ORDER BY a.published_at DESC LIMIT ?`)
    .bind(...args, PAGE_SIZE + 1)
    .all<ArticleRow>();
  return { rows: res.results.slice(0, PAGE_SIZE), more: res.results.length > PAGE_SIZE };
}

export async function getArticle(db: D1Database, id: string): Promise<ArticleRow | null> {
  return db.prepare(`SELECT ${ARTICLE_COLS} FROM articles a JOIN users u ON u.id = a.user_id WHERE a.id = ?`).bind(id).first<ArticleRow>();
}

export async function tagsOf(db: D1Database, articleId: string): Promise<string[]> {
  const r = await db.prepare('SELECT tag FROM article_tags WHERE article_id = ? ORDER BY rowid').bind(articleId).all<{ tag: string }>();
  return r.results.map((x) => x.tag);
}

/** よく使われているタグ（一覧のタブに出す） */
export async function popularTags(db: D1Database, limit = 6): Promise<string[]> {
  const r = await db
    .prepare(
      `SELECT t.tag, COUNT(*) AS n FROM article_tags t JOIN articles a ON a.id = t.article_id JOIN users u ON u.id = a.user_id
       WHERE ${LISTED} GROUP BY t.tag ORDER BY n DESC, t.tag LIMIT ?`,
    )
    .bind(limit)
    .all<{ tag: string }>();
  return r.results.map((x) => x.tag);
}

export interface Author {
  id: string;
  handle: string;
  pen_name: string;
  status_line: string;
  bio: string;
  icon_color: string;
  icon_key: string | null;
  hidden: number;
}

export async function userByHandle(db: D1Database, handle: string): Promise<Author | null> {
  return db
    .prepare('SELECT id, handle, pen_name, status_line, bio, icon_color, icon_key, hidden FROM users WHERE handle = ? AND pen_name IS NOT NULL')
    .bind(handle)
    .first<Author>();
}

export async function followCounts(db: D1Database, userId: string): Promise<{ following: number; followers: number; articles: number }> {
  const r = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM follows WHERE follower_id = ?1) AS following,
              (SELECT COUNT(*) FROM follows WHERE followee_id = ?1) AS followers,
              (SELECT COUNT(*) FROM articles a JOIN users u ON u.id = a.user_id WHERE a.user_id = ?1 AND ${LISTED}) AS articles`,
    )
    .bind(userId)
    .first<{ following: number; followers: number; articles: number }>();
  return r ?? { following: 0, followers: 0, articles: 0 };
}

export async function isLiked(db: D1Database, userId: string, articleId: string): Promise<boolean> {
  return !!(await db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND article_id = ?').bind(userId, articleId).first());
}

export async function isFollowing(db: D1Database, followerId: string, followeeId: string): Promise<boolean> {
  return !!(await db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?').bind(followerId, followeeId).first());
}

export interface CommentRow {
  id: string;
  article_id: string;
  user_id: string;
  body: string;
  created_at: number;
  handle: string;
  pen_name: string;
  icon_color: string;
  icon_key: string | null;
}

export async function commentsOf(db: D1Database, articleId: string): Promise<CommentRow[]> {
  const r = await db
    .prepare(
      `SELECT c.id, c.article_id, c.user_id, c.body, c.created_at, u.handle, u.pen_name, u.icon_color, u.icon_key
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.article_id = ? AND c.hidden = 0 AND u.hidden = 0 ORDER BY c.created_at LIMIT 500`,
    )
    .bind(articleId)
    .all<CommentRow>();
  return r.results;
}

/** 1 日（日本時間）のうちに、その人が表に足した数（1 日の上限に使う） */
export async function countToday(db: D1Database, table: 'comments' | 'reports' | 'articles' | 'images' | 'likes' | 'follows', userId: string): Promise<number> {
  const col = { comments: 'user_id', reports: 'reporter_id', articles: 'user_id', images: 'user_id', likes: 'user_id', follows: 'follower_id' }[table];
  const dayStart = Math.floor((Date.now() + 9 * 3600_000) / 86400_000) * 86400_000 - 9 * 3600_000;
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ? AND created_at >= ?`).bind(userId, dayStart).first<{ n: number }>();
  return r?.n ?? 0;
}
