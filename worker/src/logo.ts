/**
 * 企業のサイトからロゴ（アイコン）を取得する。
 * 外部のロゴ検索サービスは使わず、企業のサイトに直接アクセスする（どの企業を見ているかを第三者に送らないため）。
 * 会社名しかないときは、公開データベースの Wikidata で公式サイトを調べる（送るのは会社名だけ）。
 */

const MAX_BYTES = 400_000;
const MAX_HTML = 300_000;
const TIMEOUT_MS = 6000;
/** 1 ページから試すアイコンの数（ページに大量の <link rel=icon> を並べて、ほかのサイトへ大量にアクセスさせられないように） */
const MAX_CANDIDATES = 6;

function isPublicHttpUrl(u: URL): boolean {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname;
  // 手元やネットワーク内部のアドレスには取りに行かない
  return (
    !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.0\.[02]\.|198\.1[89]\.|22[4-9]\.|2[3-5]\d\.|0\.|\[?::1\]?$)/.test(host) &&
    host.includes('.')
  );
}

/**
 * 独自の User-Agent だとボットとして断る企業サイトが多いので、ふつうのブラウザと同じにする。
 * Wikidata はブラウザの User-Agent だと制限されるので、規約どおり名乗る
 */
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const BOT_UA = 'SophonLogoFetcher/1.0 (https://rakuraku-entry.com; contact@geek-app.com)';

/**
 * 本文を上限まで読む。truncate なら上限で切り、そうでなければ上限を超えたら null（巨大なファイルでメモリを使い切らないように）
 */
async function readCapped(res: Response, max: number, truncate: boolean): Promise<Uint8Array | null> {
  if (!truncate && Number(res.headers.get('content-length') ?? 0) > max) {
    await res.body?.cancel();
    return null;
  }
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      if (!truncate) return null;
      break;
    }
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return all.subarray(0, Math.min(size, max));
}

interface Fetched {
  res: Response;
  /** 本文（上限を超えたら null） */
  body: Uint8Array | null;
}

/**
 * リダイレクトは自分でたどり、行き先が手元やネットワーク内部のアドレスでないかを毎回確かめる
 * （公開サイトから内部のアドレスへ転送させて、中を読まれないように）。
 * 本文もタイムアウトの中で読む（少しずつしか返さないサイトで、いつまでも待たないように）
 */
async function fetchWithTimeout(url: string, max = MAX_BYTES, truncate = false): Promise<Fetched> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(current, {
        signal: ctrl.signal,
        redirect: 'manual',
        headers: { 'User-Agent': current.startsWith('https://www.wikidata.org/') ? BOT_UA : BROWSER_UA, 'Accept-Language': 'ja,en;q=0.8' },
      });
      const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!location) return { res, body: await readCapped(res, max, truncate) };
      const next = new URL(location, current);
      if (!isPublicHttpUrl(next)) throw new Error('blocked redirect');
      current = next.toString();
    }
    throw new Error('too many redirects');
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

/** Wikidata の説明文が会社を表しているか */
const COMPANY_WORDS =
  /会社|企業|商社|コングロマリット|持株|ホールディングス|多国籍|電機|製薬|ゼネコン|デベロッパー|メーカー|銀行|証券|保険|グループ|株式|事業者|製造|小売|インテグレーター|コンサル|出版社|放送局|新聞社|鉄道|航空|監査法人|法律事務所|company|corporation|manufacturer|bank|retailer|conglomerate|firm/i;

const text = (body: Uint8Array | null) => (body ? new TextDecoder().decode(body) : '');

async function fetchJson(url: string): Promise<unknown> {
  return JSON.parse(text((await fetchWithTimeout(url)).body));
}

/** 会社名から公式サイトの URL を調べる（Wikidata の「公式ウェブサイト」） */
async function officialSite(name: string): Promise<string | null> {
  const q = bareName(name);
  if (!q) return null;
  const api = 'https://www.wikidata.org/w/api.php';
  try {
    const search = await fetchJson(`${api}?action=wbsearchentities&search=${encodeURIComponent(q)}&language=ja&uselang=ja&type=item&limit=5&format=json`);
    // 「楽天」で野球チーム、「東京」で東京都が出ないよう、説明が会社のものだけを使う
    const ids =
      (search as { search?: { id: string; description?: string }[] }).search
        ?.filter((x) => COMPANY_WORDS.test(x.description ?? ''))
        .map((x) => x.id) ?? [];
    if (!ids.length) return null;
    const got = await fetchJson(`${api}?action=wbgetentities&ids=${ids.join('|')}&props=claims&format=json`);
    type Claim = { mainsnak?: { datavalue?: { value?: unknown } } };
    const entities = (got as { entities?: Record<string, { claims?: Record<string, Claim[]> }> }).entities ?? {};
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

export type LogoResult = { logo: string; source: string } | { error: string; status: number };

const NOT_FOUND = { error: 'ロゴが見つかりませんでした', status: 404 };

/** 画像を data URL にする（Workers には Buffer がないので、少しずつ文字にしてから base64 にする） */
function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** 会社名か URL からロゴを探す */
export async function findLogo(name: string, url: string): Promise<LogoResult> {
  let raw = url;
  if (!raw && name) raw = (await officialSite(name)) ?? '';
  if (!raw) return NOT_FOUND;
  let site: URL;
  try {
    site = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { error: 'URL が正しくありません', status: 400 };
  }
  if (!isPublicHttpUrl(site)) return { error: 'このアドレスからは取得できません', status: 400 };

  let html = '';
  try {
    const page = await fetchWithTimeout(site.toString(), MAX_HTML, true);
    if (page.res.ok) html = text(page.body);
    // トップページが <meta http-equiv="refresh"> で /ja/ などへ飛ばすだけのときは、飛び先を読む
    const refresh = /<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"'\s>]+)/i.exec(html)?.[1];
    if (refresh) {
      const next = new URL(refresh, site);
      if (isPublicHttpUrl(next)) {
        const moved = await fetchWithTimeout(next.toString(), MAX_HTML, true);
        if (moved.res.ok) {
          html = text(moved.body);
          site = next;
        }
      }
    }
  } catch {
    // ページが取れなくても /favicon.ico は試す
  }

  for (const candidate of iconCandidates(html, site).slice(0, MAX_CANDIDATES)) {
    try {
      const u = new URL(candidate);
      if (!isPublicHttpUrl(u)) continue;
      const { res, body: buf } = await fetchWithTimeout(candidate);
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !/^image\//.test(type) || !buf?.length) continue;
      return { logo: `data:${type.split(';')[0]};base64,${toBase64(buf)}`, source: candidate };
    } catch {
      // 次の候補へ
    }
  }
  // 企業サイトがボット対策でアクセスを断るとき（sony.com など）は、Google のファビコンの配信から取る。
  // 送るのは会社のサイトのドメインだけ。知らないドメインには 404 が返るので、そのときは頭文字のまま
  try {
    const { res, body: buf } = await fetchWithTimeout(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(site.hostname)}&sz=128`);
    const type = res.headers.get('content-type') ?? '';
    if (res.ok && /^image\//.test(type)) {
      if (buf?.length) return { logo: `data:${type.split(';')[0]};base64,${toBase64(buf)}`, source: 'google-favicon' };
    }
  } catch {
    // 取れなければ頭文字のまま
  }
  return NOT_FOUND;
}
