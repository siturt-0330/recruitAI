// コラムの共通の小さな道具（エスケープ・ID・Cookie・レスポンス）

export const now = () => Date.now();

/** HTML に入れる文字をエスケープする。利用者が書いた文字は必ずこれを通す */
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** 推測できないランダムな ID（URL や Cookie に使える文字だけ） */
export function randomId(bytes = 12): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** 読み間違えにくい文字だけの短いコード（招待コード） */
export function readableCode(length = 8): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(r, (b) => chars[b % chars.length]).join('');
}

export async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

export async function sha256Hex(text: string): Promise<string> {
  return Array.from(await sha256(text), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Base64Url(text: string): Promise<string> {
  return toBase64Url(await sha256(text));
}

export function base64UrlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

export function parseCookies(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** ログインまわりの Cookie。__Host- を付けるので、Secure・Path=/・ドメインなしでしか置けない（ほかのサブドメインから上書きされない） */
export function hostCookie(name: string, value: string, maxAgeSec: number): string {
  return `__Host-${name}=${encodeURIComponent(value)}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

/** 書き込みのリクエストが、このサイトのページから来たか（ほかのサイトに勝手に送らせる攻撃を防ぐ） */
export function sameOrigin(request: Request, url: URL): boolean {
  return request.headers.get('Origin') === url.origin;
}

/** ページの HTML。スクリプトはこのサイトと Cloudflare Web Analytics のものだけ動くようにする */
export function htmlResponse(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' https://static.cloudflareinsights.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        'font-src https://fonts.gstatic.com',
        "img-src 'self' data: blob:",
        "connect-src 'self' https://cloudflareinsights.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': 'private, no-store',
      ...headers,
    },
  });
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  });
}

export function redirect(location: string, headers: Record<string, string | string[]> = {}): Response {
  const h = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const [k, v] of Object.entries(headers)) for (const x of Array.isArray(v) ? v : [v]) h.append(k, x);
  return new Response(null, { status: 303, headers: h });
}

/** ログインのあとに戻る先。コラムの中の URL だけ許す（ほかのサイトに飛ばされないように） */
export function safeNext(next: string | null | undefined): string {
  return next && /^\/column(\/[^\s\\]*)?(\?[^\s\\]*)?$/.test(next) && !next.startsWith('//') ? next : '/column';
}

/** フォームの本文を読む（大きすぎるものは読まない） */
export async function readForm(request: Request, maxBytes = 32 * 1024): Promise<URLSearchParams | null> {
  if (Number(request.headers.get('Content-Length') ?? '0') > maxBytes) return null;
  const text = await request.text();
  if (text.length > maxBytes) return null;
  return new URLSearchParams(text);
}

/** 日本語の日付（2026年10月20日） */
export function jaDate(ms: number): string {
  const d = new Date(ms + 9 * 3600_000);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}
