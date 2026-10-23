// 書く画面が使う API（worker/src/column/write.ts）と、記事の形（worker/src/column/blocks.ts と同じ）

export type BlockType = 'text' | 'heading' | 'bullet' | 'quote' | 'image' | 'divider';

export interface Block {
  id: string;
  type: BlockType;
  text?: string;
  key?: string;
  caption?: string;
  /** アップロード中の画像の、手元だけの URL（保存しない） */
  preview?: string;
}

export interface Article {
  id: string;
  title: string;
  body: Block[];
  coverKey: string | null;
  template: string;
  visibility: 'public' | 'unlisted';
  status: 'draft' | 'published';
  hidden: boolean;
  tags: string[];
  updatedAt: number;
}

export interface ArticleSummary {
  id: string;
  title: string;
  status: 'draft' | 'published';
  visibility: 'public' | 'unlisted';
  hidden: number;
  updated_at: number;
  published_at: number | null;
}

export interface Me {
  penName: string;
  handle: string;
  iconColor: string;
  iconKey: string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(0, 'network', 'つながりませんでした');
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 401) {
    location.href = `/column/auth/google?next=${encodeURIComponent(location.pathname)}`;
    throw new ApiError(401, 'login', 'ログインしてください');
  }
  if (!res.ok) {
    const code = String(data.error ?? 'error');
    const message =
      typeof data.message === 'string' ? data.message : code === 'quota' ? '今日はこれ以上できません。また明日どうぞ' : code === 'too large' ? '画像が大きすぎます（5MB まで）' : 'うまくいきませんでした';
    throw new ApiError(res.status, code, message);
  }
  return data as T;
}

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** 保存するときは、手元だけの preview を外す */
const forSave = (blocks: Block[]) => blocks.filter((b) => b.type !== 'image' || b.key).map(({ preview: _, ...b }) => b);

export const api = {
  mine: () => call<{ articles: ArticleSummary[] }>('/column/api/articles'),
  get: (id: string) => call<{ article: Article }>(`/column/api/articles/${id}`),
  create: (template: string, body: Block[]) => call<{ id: string }>('/column/api/articles', json({ template, body })),
  save: (a: Pick<Article, 'id' | 'title' | 'body' | 'coverKey' | 'tags' | 'visibility'>) =>
    call<{ savedAt: number }>(`/column/api/articles/${a.id}/save`, json({ ...a, body: forSave(a.body) })),
  publish: (a: Pick<Article, 'id' | 'title' | 'body' | 'coverKey' | 'tags' | 'visibility'>, confirmed = false) =>
    call<{ url: string }>(`/column/api/articles/${a.id}/publish`, json({ ...a, body: forSave(a.body), confirmed })),
  unpublish: (id: string) => call<{ ok: true }>(`/column/api/articles/${id}/unpublish`, json({})),
  remove: (id: string) => call<{ ok: true }>(`/column/api/articles/${id}/delete`, json({})),
  upload: (blob: Blob) => call<{ key: string }>('/column/api/images', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob }),
};

export const imageUrl = (key: string) => `/column/img/${encodeURIComponent(key)}`;
export const uid = () => Math.random().toString(36).slice(2, 10);

/** 文字数（空白を数えない。サーバーと同じ数え方） */
export const countChars = (blocks: Block[]) => blocks.reduce((n, b) => n + (b.text ?? '').replace(/\s/g, '').length, 0);
