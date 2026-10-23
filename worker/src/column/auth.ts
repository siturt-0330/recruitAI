// コラムのログイン。Google のログイン（OpenID Connect）で本人を確かめ、セッションを D1 に置いて Cookie で持つ。
import {
  base64UrlDecode,
  hostCookie,
  now,
  parseCookies,
  randomId,
  redirect,
  safeNext,
  sameOrigin,
  sha256Base64Url,
  sha256Hex,
  htmlResponse,
} from './util';

export interface User {
  id: string;
  email: string;
  handle: string | null;
  pen_name: string | null;
  status_line: string;
  bio: string;
  icon_color: string;
  icon_key: string | null;
  role: 'reader' | 'writer';
  hidden: number;
  terms_at: number | null;
  created_at: number;
}

const SESSION_DAYS = 30;
const SID = 'col_sid';
const OAUTH = 'col_oauth';

/** 運営か（wrangler.jsonc の COLUMN_ADMIN_EMAILS に入っている Google アカウント） */
export function isAdmin(user: User | null, env: Env): boolean {
  if (!user) return false;
  const list = (env.COLUMN_ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(user.email.toLowerCase());
}

/** 記事を書けるか（招待コードで書き手になった人と運営） */
export function canWrite(user: User | null, env: Env): boolean {
  return !!user && !user.hidden && (user.role === 'writer' || isAdmin(user, env));
}

/** プロフィール（ペンネームと URL の名前）を設定し終えたか */
export const hasProfile = (user: User | null) => !!user?.pen_name && !!user.handle;

/** Cookie のセッションから、ログインしている人を引く（いなければ null） */
export async function currentUser(request: Request, env: Env): Promise<User | null> {
  const token = parseCookies(request)[`__Host-${SID}`];
  if (!token) return null;
  const row = await env.COLUMN_DB.prepare(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?',
  )
    .bind(await sha256Hex(token), now())
    .first<User>();
  return row ?? null;
}

/** ログインしたことにする（セッションを作って Cookie を渡す） */
async function signIn(env: Env, userId: string, next: string): Promise<Response> {
  const token = randomId(32);
  const t = now();
  await env.COLUMN_DB.batch([
    env.COLUMN_DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256Hex(token), userId, t + SESSION_DAYS * 86400_000),
    // 古いセッションはついでに消す
    env.COLUMN_DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t),
  ]);
  const user = await env.COLUMN_DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<User>();
  // 初めての人は、先にペンネームなどを決めてもらう
  const to = hasProfile(user) ? next : `/column/settings?first=1&next=${encodeURIComponent(next)}`;
  return redirect(to, { 'Set-Cookie': [hostCookie(SID, token, SESSION_DAYS * 86400), hostCookie(OAUTH, '', 0)] });
}

/** Google の sub（変わらない ID）で探し、いなければ読み手として作る */
async function upsertUser(env: Env, sub: string, email: string): Promise<string> {
  const found = await env.COLUMN_DB.prepare('SELECT id FROM users WHERE google_sub = ?').bind(sub).first<{ id: string }>();
  if (found) {
    await env.COLUMN_DB.prepare('UPDATE users SET email = ? WHERE id = ?').bind(email, found.id).run();
    return found.id;
  }
  const id = randomId(9);
  await env.COLUMN_DB.prepare('INSERT INTO users (id, google_sub, email, created_at) VALUES (?, ?, ?, ?)').bind(id, sub, email, now()).run();
  return id;
}

/** Google のログイン画面へ。state・nonce・PKCE をつけ、短い時間だけ Cookie に覚えておく */
export async function startGoogle(env: Env, url: URL): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID) return htmlResponse('Google ログインの設定がまだです（GOOGLE_CLIENT_ID）', 503);
  const state = randomId(16);
  const nonce = randomId(16);
  const verifier = randomId(32);
  const next = safeNext(url.searchParams.get('next'));
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${url.origin}/column/auth/callback`,
    response_type: 'code',
    scope: 'openid email',
    state,
    nonce,
    code_challenge: await sha256Base64Url(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, {
    'Set-Cookie': hostCookie(OAUTH, JSON.stringify({ state, nonce, verifier, next }), 600),
  });
}

/** Google から戻ってきたところ。コードを ID トークンに替えて、本人を確かめる */
export async function googleCallback(request: Request, env: Env, url: URL): Promise<Response> {
  const fail = (why: string) => {
    console.warn(JSON.stringify({ message: 'column login failed', why }));
    return htmlResponse(page('ログインできませんでした', 'もう一度ためしてください。'), 400, { 'Set-Cookie': hostCookie(OAUTH, '', 0) });
  };
  let saved: { state: string; nonce: string; verifier: string; next: string };
  try {
    saved = JSON.parse(parseCookies(request)[`__Host-${OAUTH}`] ?? '');
  } catch {
    return fail('no oauth cookie');
  }
  const code = url.searchParams.get('code');
  if (!code || url.searchParams.get('state') !== saved.state) return fail('state mismatch');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/column/auth/callback`,
      grant_type: 'authorization_code',
      code_verifier: saved.verifier,
    }),
  });
  if (!res.ok) return fail(`token ${res.status}`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return fail('no id_token');

  // ID トークンは Google のトークンの窓口から TLS で直接受け取ったので、署名の検証は省ける（OpenID Connect の仕様 3.1.3.7）。
  // 中身の発行元・宛先・期限・nonce は確かめる
  let claims: { iss?: string; aud?: string; exp?: number; nonce?: string; sub?: string; email?: string; email_verified?: boolean };
  try {
    claims = JSON.parse(base64UrlDecode(id_token.split('.')[1] ?? ''));
  } catch {
    return fail('bad id_token');
  }
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss ?? '')) return fail('iss');
  if (claims.aud !== env.GOOGLE_CLIENT_ID) return fail('aud');
  if (!claims.exp || claims.exp * 1000 < now()) return fail('exp');
  if (claims.nonce !== saved.nonce) return fail('nonce');
  if (!claims.sub || !claims.email || claims.email_verified !== true) return fail('email');

  return signIn(env, await upsertUser(env, claims.sub, claims.email), saved.next);
}

/** 手元の確認用の仮ログイン。COLUMN_DEV_LOGIN=1 で、しかも http の localhost のときだけ使える（本番では COLUMN_DEV_LOGIN を入れない） */
export async function devLogin(env: Env, url: URL): Promise<Response | null> {
  const local = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (env.COLUMN_DEV_LOGIN !== '1' || !local) return null;
  const email = (url.searchParams.get('email') ?? 'dev@example.com').slice(0, 100);
  return signIn(env, await upsertUser(env, `dev:${email}`, email), safeNext(url.searchParams.get('next')));
}

export async function logout(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== 'POST' || !sameOrigin(request, url)) return htmlResponse('', 405);
  const token = parseCookies(request)[`__Host-${SID}`];
  if (token) await env.COLUMN_DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return redirect('/column', { 'Set-Cookie': hostCookie(SID, '', 0) });
}

/** ログインの失敗だけに使う、ごく簡単なページ（ヘッダーなどの共通の部品を使わない） */
function page(title: string, text: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}｜らくらくエントリー</title><link rel="stylesheet" href="/column-assets/column.css"></head><body><main class="narrow"><h1 class="title">${title}</h1><p class="sub">${text}</p><p><a class="btn" href="/column/auth/google">Google でログイン</a></p></main></body></html>`;
}
