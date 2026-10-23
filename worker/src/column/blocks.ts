// 記事の本文の形（書く画面と表示で同じものを使う）と、HTML への変換。
// 本文は 1 行ずつのブロックの配列。利用者の HTML はそのまま出さず、文字はすべてエスケープする。URL だけ自動でリンクにする。
import { esc } from './util';

export type BlockType = 'text' | 'heading' | 'bullet' | 'quote' | 'image' | 'divider';

export interface Block {
  id: string;
  type: BlockType;
  /** 文字（image と divider 以外）。改行を含んでよい */
  text?: string;
  /** image のときの R2 の key と説明 */
  key?: string;
  caption?: string;
}

export const LIMITS = { blocks: 600, blockChars: 5000, totalChars: 40000, title: 80, tags: 5, tag: 20 } as const;
const TYPES: BlockType[] = ['text', 'heading', 'bullet', 'quote', 'image', 'divider'];
export const IMAGE_KEY = /^[A-Za-z0-9_-]{16,64}\.(webp|jpg|png)$/;

/** 保存する前に本文を整える（知らない形は捨て、長さを切る）。だめなら理由の文 */
export function sanitizeBlocks(raw: unknown): Block[] | string {
  if (!Array.isArray(raw)) return '本文の形がおかしいです';
  if (raw.length > LIMITS.blocks) return `本文のブロックは ${LIMITS.blocks} 個までです`;
  const out: Block[] = [];
  let total = 0;
  for (const r of raw) {
    const b = r as Partial<Block>;
    if (!b || typeof b !== 'object' || !TYPES.includes(b.type as BlockType)) continue;
    const id = typeof b.id === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(b.id) ? b.id : Math.random().toString(36).slice(2, 10);
    if (b.type === 'divider') {
      out.push({ id, type: 'divider' });
    } else if (b.type === 'image') {
      if (typeof b.key !== 'string' || !IMAGE_KEY.test(b.key)) continue;
      out.push({ id, type: 'image', key: b.key, caption: String(b.caption ?? '').slice(0, 200) });
    } else {
      const text = String(b.text ?? '').replace(/\r\n?/g, '\n').slice(0, LIMITS.blockChars);
      total += text.length;
      out.push({ id, type: b.type as BlockType, text });
    }
  }
  if (total > LIMITS.totalChars) return `本文は ${LIMITS.totalChars.toLocaleString()} 文字までです`;
  return out;
}

export function parseBody(json: string): Block[] {
  try {
    const v = sanitizeBlocks(JSON.parse(json));
    return typeof v === 'string' ? [] : v;
  } catch {
    return [];
  }
}

/** 文字数（空白を数えない） */
export const countChars = (blocks: Block[]) => blocks.reduce((n, b) => n + (b.text ?? '').replace(/\s/g, '').length, 0);

/** 一覧と OG に使う冒頭の文 */
export function excerptOf(blocks: Block[], max = 120): string {
  const text = blocks
    .filter((b) => b.type === 'text' || b.type === 'bullet' || b.type === 'quote')
    .map((b) => (b.text ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** 読む時間の目安（1 分あたり 500 文字） */
export const readMinutes = (chars: number) => Math.max(1, Math.round(chars / 500));

/** 本文の画像の key（持ち主の確認と、退会のときの後片付けに使う） */
export const imageKeys = (blocks: Block[]) => blocks.filter((b) => b.type === 'image' && b.key).map((b) => b.key!);

/** 利用者の文字を HTML にする。エスケープしてから、URL をリンクにし、改行を <br> にする */
export function richText(text: string): string {
  return esc(text)
    .replace(/https?:\/\/[^\s<>"'）」]+/g, (u) => {
      // エスケープした引用符などの手前で切り、文末の句読点はリンクに含めない
      const href = u.replace(/(&quot;|&#39;|&lt;|&gt;).*$/, '').replace(/[.,!?。、]+$/, '');
      const rest = u.slice(href.length);
      return `<a href="${href}" rel="nofollow ugc noopener" target="_blank">${href}</a>${rest}`;
    })
    .replace(/\n/g, '<br>');
}

const hasContent = (b: Block) => b.type === 'image' || b.type === 'divider' || !!(b.text ?? '').trim();

/** 中身のない見出し（型で入ったまま書かなかったもの）を外す。次の見出しまでに何も書いていなければ出さない */
function dropEmptySections(blocks: Block[]): Block[] {
  return blocks.filter((b, i) => {
    if (b.type !== 'heading') return true;
    for (const next of blocks.slice(i + 1)) {
      if (next.type === 'heading') return false;
      if (hasContent(next)) return true;
    }
    return false;
  });
}

/** 本文の HTML。続いた箇条書きは 1 つの <ul> にまとめる */
export function renderBlocks(all: Block[]): string {
  const blocks = dropEmptySections(all);
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.join('')}</ul>`);
    list = [];
  };
  for (const b of blocks) {
    if (b.type === 'bullet') {
      if ((b.text ?? '').trim()) list.push(`<li>${richText(b.text ?? '')}</li>`);
      continue;
    }
    flush();
    if (b.type === 'divider') out.push('<hr>');
    else if (b.type === 'image')
      out.push(`<figure><img src="/column/img/${esc(b.key)}" alt="${esc(b.caption)}" loading="lazy" decoding="async">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`);
    else if (!(b.text ?? '').trim()) continue;
    else if (b.type === 'heading') out.push(`<h2>${esc(b.text)}</h2>`);
    else if (b.type === 'quote') out.push(`<blockquote>${richText(b.text ?? '')}</blockquote>`);
    else out.push(`<p>${richText(b.text ?? '')}</p>`);
  }
  flush();
  return out.join('\n');
}
