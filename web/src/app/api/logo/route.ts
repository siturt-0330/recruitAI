import type { NextRequest } from 'next/server';

/**
 * 企業のサイトからロゴ（アイコン）を取得する。
 * 外部のロゴ検索サービスは使わず、企業のサイトに直接アクセスする（どの企業を見ているかを第三者に送らないため）。
 * 会社名しかないときは、公開データベースの Wikidata で公式サイトを調べる（送るのは会社名だけ）。
 */

const MAX_BYTES = 400_000;
const TIMEOUT_MS = 6000;

function isPublicHttpUrl(u: URL): boolean {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname;
  // 手元やネットワーク内部のアドレスには取りに行かない
  return !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/.test(host) && host.includes('.');
}

/**
 * 独自の User-Agent だとボットとして断る企業サイトが多いので、ふつうのブラウザと同じにする。
 * Wikidata はブラウザの User-Agent だと制限されるので、規約どおり名乗る
 */
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const BOT_UA = 'SophonLogoFetcher/1.0 (https://rakuraku-entry.com; contact@geek-app.com)';

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': url.startsWith('https://www.wikidata.org/') ? BOT_UA : BROWSER_UA, 'Accept-Language': 'ja,en;q=0.8' },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** HTML の <link rel="...icon..."> から候補を集める。大きいアイコンを優先 */
function iconCandidates(html: string, base: URL): string[] {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const scored: { href: string; score: number }[] = [];
  for (const tag of links) {
    const rel = /rel=["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase() ?? '';
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href || !/icon/.test(rel) || /mask-icon/.test(rel)) continue;
    const size = Number(/sizes=["'](\d+)x\d+["']/i.exec(tag)?.[1] ?? 0);
    const score = (rel.includes('apple-touch-icon') ? 1000 : 0) + size + (/\.svg($|\?)/.test(href) ? 500 : 0);
    try {
      scored.push({ href: new URL(href, base).toString(), score });
    } catch {
      // 壊れた URL は飛ばす
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return [...scored.map((s) => s.href), new URL('/apple-touch-icon.png', base).toString(), new URL('/favicon.ico', base).toString()];
}

/** 「株式会社〇〇」→「〇〇」 */
const bareName = (name: string) => name.replace(/株式会社|有限会社|合同会社|[（(]株[）)]|㈱/g, '').replace(/\s+/g, '').trim();

/** 会社名から公式サイトの URL を調べる（Wikidata の「公式ウェブサイト」） */
async function officialSite(name: string): Promise<string | null> {
  const q = bareName(name);
  if (!q) return null;
  const api = 'https://www.wikidata.org/w/api.php';
  try {
    const search = await fetchWithTimeout(`${api}?action=wbsearchentities&search=${encodeURIComponent(q)}&language=ja&uselang=ja&type=item&limit=5&format=json`);
    const ids = ((await search.json()) as { search?: { id: string }[] }).search?.map((x) => x.id) ?? [];
    if (!ids.length) return null;
    const got = await fetchWithTimeout(`${api}?action=wbgetentities&ids=${ids.join('|')}&props=claims&format=json`);
    type Claim = { mainsnak?: { datavalue?: { value?: unknown } } };
    const entities = ((await got.json()) as { entities?: Record<string, { claims?: Record<string, Claim[]> }> }).entities ?? {};
    // 検索で上に出たものから順に、公式サイトがあるものを使う
    for (const id of ids) {
      const v = entities[id]?.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
      if (typeof v === 'string') return v;
    }
  } catch {
    // 調べられなければ頭文字のまま
  }
  return null;
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name') ?? '';
  let raw = request.nextUrl.searchParams.get('url') ?? '';
  if (!raw && name) raw = (await officialSite(name)) ?? '';
  if (!raw) return Response.json({ error: 'ロゴが見つかりませんでした' }, { status: 404 });
  let site: URL;
  try {
    site = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
  } catch {
    return Response.json({ error: 'URL が正しくありません' }, { status: 400 });
  }
  if (!isPublicHttpUrl(site)) return Response.json({ error: 'このアドレスからは取得できません' }, { status: 400 });

  let html = '';
  try {
    const page = await fetchWithTimeout(site.toString());
    if (page.ok) html = (await page.text()).slice(0, 300_000);
  } catch {
    // ページが取れなくても /favicon.ico は試す
  }

  for (const candidate of iconCandidates(html, site)) {
    try {
      const u = new URL(candidate);
      if (!isPublicHttpUrl(u)) continue;
      const res = await fetchWithTimeout(candidate);
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !/^image\//.test(type)) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length || buf.length > MAX_BYTES) continue;
      return Response.json({ logo: `data:${type.split(';')[0]};base64,${buf.toString('base64')}`, source: candidate });
    } catch {
      // 次の候補へ
    }
  }
  return Response.json({ error: 'ロゴが見つかりませんでした' }, { status: 404 });
}
