import { DurableObject } from 'cloudflare:workers';
import { classifyWithOpenAI } from '../../lib/openai';
import { findLogo } from './logo';
import type { RemoteQuestion } from '../../lib/types';

/**
 * 拡張機能の「Sophon 判定」の中継 API。
 * OpenAI の API キーはここ（Wrangler secret）にだけ置き、拡張機能には渡さない。
 * 判定の選択肢（プロフィールの項目）はサーバー側で決めるので、汎用の AI としては使えない。
 */

const MAX_BODY = 64 * 1024;
const MAX_FORM_CHARS = 12_000;
const MAX_QUESTIONS = 80;
const MAX_INSTRUCTIONS = 400;

interface ClassifyBody {
  installId: string;
  formText: string;
  questions: RemoteQuestion[];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

/** 日本時間の日付（上限は日本時間の0時にリセット） */
const dayJst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

function parseBody(raw: unknown): ClassifyBody | string {
  if (!raw || typeof raw !== 'object') return 'invalid body';
  const b = raw as Record<string, unknown>;
  if (typeof b.installId !== 'string' || !/^[0-9a-f-]{36}$/.test(b.installId)) return 'invalid installId';
  if (typeof b.formText !== 'string' || b.formText.length > MAX_FORM_CHARS) return 'invalid formText';
  if (!Array.isArray(b.questions) || b.questions.length === 0 || b.questions.length > MAX_QUESTIONS) return 'invalid questions';
  const questions: RemoteQuestion[] = [];
  for (const q of b.questions as unknown[]) {
    const x = q as Record<string, unknown>;
    if (typeof x?.name !== 'string' || x.name.length > 80 || typeof x.instructions !== 'string') return 'invalid question';
    questions.push({ name: x.name, instructions: x.instructions.slice(0, MAX_INSTRUCTIONS) });
  }
  return { installId: b.installId, formText: b.formText, questions };
}

/** 管理用トークンを、比較時間から推測されないように比べる */
async function isAdmin(request: Request, env: Env): Promise<boolean> {
  const given = (request.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  if (!env.ADMIN_TOKEN || !given) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(given)), crypto.subtle.digest('SHA-256', enc.encode(env.ADMIN_TOKEN))]);
  return crypto.subtle.timingSafeEqual(a, b);
}

/** 本文を上限付きで読む（巨大なリクエストでメモリを使い切らないように） */
async function readLimited(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/**
 * Web 版（app.rakuraku-entry.com）の会社のロゴ。会社名か URL を受け取り、企業サイトのアイコンを data URL で返す。
 * 結果はキャッシュし、取りに行く回数には上限を付ける（このサーバーを踏み台に、ほかのサイトへ大量にアクセスさせないため）
 */
async function logo(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.APP_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return json({ error: 'forbidden' }, 403);
  const cors = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const name = (url.searchParams.get('name') ?? '').trim().slice(0, 80);
  const target = (url.searchParams.get('url') ?? '').trim().slice(0, 300);
  if (!name && !target) return json({ error: 'name or url' }, 400);

  // 同じ会社は何度も取りに行かない（どの Origin から来ても同じ結果なので、キャッシュの鍵には Origin を入れない）
  const key = new Request(`${url.origin}/__logo-cache?name=${encodeURIComponent(name)}&url=${encodeURIComponent(target)}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return new Response(hit.body, { status: hit.status, headers: { ...Object.fromEntries(hit.headers), ...cors } });

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const verdict = await env.QUOTA.getByName('global').takeLogo(dayJst(), ip, Number(env.LOGO_LIMIT_PER_IP), Number(env.LOGO_LIMIT_GLOBAL));
  if (!verdict.ok) return new Response(JSON.stringify({ error: 'quota' }), { status: 429, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors } });

  const result = await findLogo(name, target);
  const status = 'error' in result ? result.status : 200;
  const body = 'error' in result ? { error: result.error } : result;
  // 見つかったものは1週間、見つからなかったものは1日おいてから探し直す
  const res = new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${status === 200 ? 7 * 86400 : 86400}` },
  });
  if (status === 200 || status === 404) ctx.waitUntil(cache.put(key, res.clone()));
  return new Response(res.body, { status, headers: { ...Object.fromEntries(res.headers), ...cors } });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true });
    // Google Search Console の所有確認。.html のままリダイレクトせずに返す必要がある
    if (url.pathname === '/googleb3c282b9a4c4b17b.html') {
      return new Response('google-site-verification: googleb3c282b9a4c4b17b.html', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/v1/sponsor') {
      // ポップアップのスポンサー枠。vars の SPONSOR（JSON）を変えて deploy すれば、拡張機能を出し直さずに差し替えられる
      let sponsor: unknown = null;
      try {
        sponsor = env.SPONSOR ? JSON.parse(env.SPONSOR) : null;
      } catch {
        console.error(JSON.stringify({ message: 'invalid SPONSOR json' }));
      }
      return new Response(JSON.stringify({ sponsor }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' },
      });
    }
    if (url.pathname === '/v1/stats') {
      // 運用者だけが見られる今日の利用状況（Authorization: Bearer <ADMIN_TOKEN>）
      if (!(await isAdmin(request, env))) return json({ error: 'unauthorized' }, 401);
      return json({ day: dayJst(), ...(await env.QUOTA.getByName('global').today(dayJst())) });
    }
    if (url.pathname === '/v1/logo') return logo(request, env, ctx, url);
    if (url.pathname !== '/v1/classify') return json({ error: 'not found' }, 404);
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    // 公開後は拡張機能の ID（chrome-extension://...）だけを許可する。空なら開発用にすべて許可
    const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') ?? '';
    if (allowed.length && !allowed.includes(origin)) return json({ error: 'forbidden' }, 403);

    const text = await readLimited(request);
    if (text === null) return json({ error: 'too large' }, 413);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: 'invalid json' }, 400);
    }
    const body = parseBody(parsed);
    if (typeof body === 'string') return json({ error: body }, 400);

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const quota = env.QUOTA.getByName('global');
    const verdict = await quota.take(dayJst(), body.installId, ip, {
      perInstall: Number(env.LIMIT_PER_INSTALL),
      perIp: Number(env.LIMIT_PER_IP),
      global: Number(env.LIMIT_GLOBAL),
    });
    if (!verdict.ok) {
      console.log(JSON.stringify({ message: 'quota exceeded', reason: verdict.reason }));
      return json({ error: 'quota', reason: verdict.reason }, 429);
    }

    try {
      const answers =
        env.MOCK_AI === '1'
          ? body.questions.map((q) => ({ name: q.name, choice: 'none', confidence: 0.5 }))
          : await classifyWithOpenAI(env.OPENAI_API_KEY, body.formText, body.questions);
      console.log(JSON.stringify({ message: 'classified', questions: body.questions.length, formChars: body.formText.length }));
      return json({ answers });
    } catch (e) {
      console.error(JSON.stringify({ message: 'openai failed', error: e instanceof Error ? e.message : String(e) }));
      return json({ error: 'upstream' }, 502);
    }
  },
} satisfies ExportedHandler<Env>;

interface Limits {
  perInstall: number;
  perIp: number;
  global: number;
}

/**
 * 1日あたりの利用回数を数える。全リクエストを1つのインスタンスで数えるので、上限を確実に守れる。
 * 「インストールごと」「IP ごと」「全体」の3つの上限がある（全体の上限が API 使用料の上限になる）。
 */
export class Quota extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS usage (day TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, key))');
  }

  async take(day: string, installId: string, ip: string, limits: Limits): Promise<{ ok: true } | { ok: false; reason: string }> {
    const sql = this.ctx.storage.sql;
    const count = (key: string) => sql.exec<{ n: number }>('SELECT n FROM usage WHERE day = ? AND key = ?', day, key).toArray()[0]?.n ?? 0;
    const checks: [string, number][] = [
      ['global', limits.global],
      [`install:${installId}`, limits.perInstall],
      [`ip:${ip}`, limits.perIp],
    ];
    for (const [key, limit] of checks) {
      if (count(key) >= limit) return { ok: false, reason: key.split(':')[0]! };
    }
    for (const [key] of checks) {
      sql.exec('INSERT INTO usage (day, key, n) VALUES (?, ?, 1) ON CONFLICT (day, key) DO UPDATE SET n = n + 1', day, key);
    }
    // 古い日の記録は消す
    sql.exec('DELETE FROM usage WHERE day < ?', day);
    return { ok: true };
  }

  /** ロゴ取得の回数を数える（AI 判定とは別の上限） */
  async takeLogo(day: string, ip: string, perIp: number, global: number): Promise<{ ok: boolean }> {
    const sql = this.ctx.storage.sql;
    const checks: [string, number][] = [
      ['logo', global],
      [`logo-ip:${ip}`, perIp],
    ];
    for (const [key, limit] of checks) {
      const n = sql.exec<{ n: number }>('SELECT n FROM usage WHERE day = ? AND key = ?', day, key).toArray()[0]?.n ?? 0;
      if (n >= limit) return { ok: false };
    }
    for (const [key] of checks) {
      sql.exec('INSERT INTO usage (day, key, n) VALUES (?, ?, 1) ON CONFLICT (day, key) DO UPDATE SET n = n + 1', day, key);
    }
    return { ok: true };
  }

  /** 今日の利用状況（運用の確認用） */
  async today(day: string): Promise<{ global: number; installs: number }> {
    const sql = this.ctx.storage.sql;
    const global = sql.exec<{ n: number }>("SELECT n FROM usage WHERE day = ? AND key = 'global'", day).toArray()[0]?.n ?? 0;
    const installs = sql.exec<{ c: number }>("SELECT COUNT(*) AS c FROM usage WHERE day = ? AND key LIKE 'install:%'", day).toArray()[0]?.c ?? 0;
    return { global, installs };
  }
}
