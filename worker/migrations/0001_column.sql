-- コラム（/column）の表。時刻はすべて UNIX ミリ秒。
-- 「非表示（hidden）」は運営が問題のある投稿を隠すためのもの。書き手が決める公開・下書きとは別にする。

-- 書き手と読み手（Google でログインした人）
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,                       -- 運営からの連絡と運営の判定にだけ使う。ページには出さない
  handle TEXT UNIQUE,                        -- URL に使う名前（/column/u/<handle>）。最初の設定までは NULL
  pen_name TEXT,                             -- ペンネーム。最初の設定までは NULL
  status_line TEXT NOT NULL DEFAULT '',      -- 立場（例：27卒・文系）
  bio TEXT NOT NULL DEFAULT '',
  icon_color TEXT NOT NULL DEFAULT '#c4a68d',
  icon_key TEXT,                             -- アイコンの画像（R2 の key）。なければ icon_color の丸
  role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'writer')),
  hidden INTEGER NOT NULL DEFAULT 0,
  terms_at INTEGER,                          -- 書き手になるときに利用規約に同意した時刻
  created_at INTEGER NOT NULL
);

-- ログインのセッション。Cookie に入れるトークンそのものは保存せず、SHA-256 だけを持つ
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

-- 招待コード（書き手になるためのもの）。1 つのコードは 1 人だけ使える
CREATE TABLE invites (
  code TEXT PRIMARY KEY,
  note TEXT NOT NULL DEFAULT '',             -- だれに渡したかのメモ（運営だけが見る）
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  used_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  used_at INTEGER,
  expires_at INTEGER
);

-- 記事。本文は JSON のブロックの配列（表示するときに HTML にする。利用者の HTML はそのまま出さない）
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '[]',
  excerpt TEXT NOT NULL DEFAULT '',          -- 一覧と OG に使う冒頭の文
  cover_key TEXT,
  template TEXT NOT NULL DEFAULT 'free',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  hidden INTEGER NOT NULL DEFAULT 0,
  chars INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);
CREATE INDEX articles_feed ON articles (status, hidden, visibility, published_at DESC);
CREATE INDEX articles_user ON articles (user_id, updated_at DESC);

CREATE TABLE article_tags (
  article_id TEXT NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (article_id, tag)
);
CREATE INDEX article_tags_tag ON article_tags (tag);

CREATE TABLE likes (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  article_id TEXT NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, article_id)
);
CREATE INDEX likes_article ON likes (article_id);

CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  followee_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX follows_followee ON follows (followee_id);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX comments_article ON comments (article_id, created_at);
CREATE INDEX comments_user ON comments (user_id, created_at);

-- 通報。運営の画面で見て、非表示にするか決める
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('article', 'comment', 'user')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX reports_open ON reports (resolved_at, created_at);

-- アップロードした画像（R2 の key と持ち主）。退会したら R2 からも消す
CREATE TABLE images (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX images_user ON images (user_id, created_at);
