import { DurableObject } from 'cloudflare:workers';
import { classifyWithOpenAI } from '../../lib/openai';
import type { RemoteQuestion } from '../../lib/types';
import privacyHtml from '../../store/privacy.html';

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

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true });
    // Chrome ウェブストアに載せるプライバシーポリシー
    if (url.pathname === '/privacy') return new Response(privacyHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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

  /** 今日の利用状況（運用の確認用） */
  async today(day: string): Promise<{ global: number; installs: number }> {
    const sql = this.ctx.storage.sql;
    const global = sql.exec<{ n: number }>("SELECT n FROM usage WHERE day = ? AND key = 'global'", day).toArray()[0]?.n ?? 0;
    const installs = sql.exec<{ c: number }>("SELECT COUNT(*) AS c FROM usage WHERE day = ? AND key LIKE 'install:%'", day).toArray()[0]?.c ?? 0;
    return { global, installs };
  }
}
