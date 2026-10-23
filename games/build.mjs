// 単語タイピングゲームのページを作る。games/<slug>/game.json と words.json から、
//   site/game/<slug>/index.html と words.json、ゲーム一覧（site/game/index.html）、サイトマップを書き出す。
// 言葉のデータに間違いがあれば、何も書き出さずに止まる。
//
//   node games/build.mjs
//
// 新しいゲームの作り方は games/README.md
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gamesDir = path.join(root, 'games');
const siteGame = path.join(root, 'site', 'game');
const SITE = 'https://rakuraku-entry.com';

// 判定にはゲームと同じローマ字のエンジンを使う（打てない言い回しを公開しないため）
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(siteGame, 'engine', 'romaji.js'), 'utf8'), sandbox);
const Romaji = sandbox.window.Romaji;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const KANA = /^[ぁ-ゖー]+$/;
const forms = (w) => {
  const f = [w];
  if (w.length === 2 && w[0] === w[1]) f.push(w[0] + '々');
  if (w.length === 4 && w.slice(0, 2) === w.slice(2)) f.push(w.slice(0, 2) + '々々');
  return f;
};
const template = (file) => fs.readFileSync(path.join(gamesDir, file), 'utf8').replace(/^<!--[^\n]*-->\r?\n/, '');

/** 1 つのゲームを読み込んで確かめる。間違いは errors に入れる */
function load(slug, errors) {
  const dir = path.join(gamesDir, slug);
  const err = (m) => errors.push(`[${slug}] ${m}`);
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8'));
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'words.json'), 'utf8'));
  if (!/^[a-z0-9-]+$/.test(slug)) err('フォルダ名は半角の小文字・数字・ハイフンだけにしてください');
  for (const k of ['title', 'seoTitle', 'description', 'summary', 'kicker', 'heading1', 'heading2', 'card', 'hashtags', 'courses']) {
    if (cfg[k] === undefined) err(`game.json に ${k} がありません`);
  }
  const levels = new Set();
  (cfg.courses || []).forEach((c, i) => {
    for (const k of ['id', 'tag', 'name', 'sec', 'levels', 'cross', 'ex']) if (c[k] === undefined) err(`courses[${i}] に ${k} がありません`);
    (c.levels || []).forEach((l) => levels.add(l));
  });

  const seen = new Set();
  const words = raw.map((w, i) => {
    const at = `${i + 1} 番目（${w.w ?? '?'}）`;
    for (const k of ['w', 'y', 'm', 'e', 'p', 'lv']) if (w[k] === undefined || w[k] === '') err(`${at}: ${k} がありません`);
    if (seen.has(w.w)) err(`${at}: 同じ言葉が 2 回あります`);
    seen.add(w.w);
    if (!levels.has(w.lv)) err(`${at}: lv ${w.lv} を使うコースがありません`);
    const f = forms(w.w).find((x) => String(w.p).includes(x));
    if (!f) err(`${at}: 言い回し「${w.p}」に言葉が入っていません`);
    if (!String(w.e).includes(w.p)) err(`${at}: 例文「${w.e}」に言い回し「${w.p}」が入っていません`);
    // 言い回しの読みは pr（全体）か、pre と post（言葉の前後）で書く
    let pre = w.pre ?? '', post = w.post ?? '';
    if (w.pr !== undefined) {
      const k = String(w.pr).indexOf(w.y);
      if (k < 0) err(`${at}: 言い回しの読み「${w.pr}」に言葉の読み「${w.y}」が入っていません`);
      pre = String(w.pr).slice(0, k);
      post = String(w.pr).slice(k + String(w.y).length);
    }
    const readings = [w.y, ...(w.alt || [])];
    for (const r of readings) if (!KANA.test(r)) err(`${at}: 読み「${r}」はひらがなだけで書いてください`);
    if ((pre && !KANA.test(pre)) || (post && !KANA.test(post))) err(`${at}: 言い回しの読みはひらがなだけで書いてください`);
    // ガイドどおりに打って最後まで打てるか
    for (const r of readings) {
      const full = pre + r + post;
      const guide = Romaji.units(full).map((u) => u.opts[0]).join('');
      const word = new Romaji.Word([full]);
      if (![...guide].every((ch) => word.input(ch)) || !word.done()) err(`${at}: 「${full}」がローマ字で打てません`);
    }
    const out = { w: w.w, y: w.y, m: w.m, e: w.e, p: w.p, pre, post, lv: w.lv };
    if (w.alt && w.alt.length) out.alt = w.alt;
    return out;
  });
  for (const c of cfg.courses || []) {
    const n = words.filter((w) => c.levels.includes(w.lv)).length;
    if (n < 10) err(`コース「${c.name}」の言葉が ${n} 語しかありません（10 語以上にしてください）`);
  }
  return { slug, cfg, words };
}

const slugs = fs.readdirSync(gamesDir).filter((d) => fs.existsSync(path.join(gamesDir, d, 'game.json')));
const errors = [];
const games = slugs.map((s) => load(s, errors));
if (errors.length) {
  console.error('言葉のデータに直すところがあります。何も書き出していません。\n');
  errors.forEach((e) => console.error('  ' + e));
  process.exit(1);
}

// 共通の部品とデータが変わったら、ブラウザのキャッシュを使わず読み直してもらう
const engineHash = createHash('sha1');
for (const f of ['romaji.js', 'game.js', 'game.css']) engineHash.update(fs.readFileSync(path.join(siteGame, 'engine', f)));

const page = template('template.html');
for (const g of games) {
  const url = `${SITE}/game/${g.slug}`;
  const version = createHash('sha1').update(engineHash.copy().digest('hex')).update(JSON.stringify(g)).digest('hex').slice(0, 8);
  const config = { ...g.cfg, slug: g.slug, url, version };
  const html = page
    .replaceAll('{{seoTitle}}', esc(g.cfg.seoTitle))
    .replaceAll('{{description}}', esc(g.cfg.description))
    .replaceAll('{{url}}', url)
    .replaceAll('{{kicker}}', esc(g.cfg.kicker))
    .replaceAll('{{heading1}}', esc(g.cfg.heading1))
    .replaceAll('{{heading2}}', esc(g.cfg.heading2))
    .replaceAll('{{version}}', version)
    .replaceAll('{{config}}', JSON.stringify(config).replace(/</g, '\\u003c'));
  const out = path.join(siteGame, g.slug);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'index.html'), html);
  fs.writeFileSync(path.join(out, 'words.json'), JSON.stringify(g.words));
  console.log(`/game/${g.slug}  ${g.cfg.title}（${g.words.length} 語）`);
}

// ゲームの一覧
const cards = games
  .sort((a, b) => (a.cfg.order ?? 99) - (b.cfg.order ?? 99) || a.cfg.title.localeCompare(b.cfg.title))
  .map(
    (g) =>
      `          <a class="gcard" href="/game/${g.slug}"><span class="k">${esc(g.cfg.kicker)}</span><b>${esc(g.cfg.title)}</b><p>${esc(g.cfg.summary)}</p><div class="n">${g.words.length} 語 ・ ${g.cfg.courses.length} コース</div></a>`,
  )
  .join('\n');
const hubVersion = engineHash.digest('hex').slice(0, 8);
fs.writeFileSync(path.join(siteGame, 'index.html'), template('hub.html').replaceAll('{{version}}', hubVersion).replace('{{games}}', cards));
console.log('/game  ゲーム一覧');

// サイトマップ（<!-- games --> と <!-- /games --> のあいだを書きかえる）
const sitemapPath = path.join(root, 'site', 'sitemap.xml');
let sitemap = fs.readFileSync(sitemapPath, 'utf8');
const today = new Date().toISOString().slice(0, 10);
const entries = ['/game', ...games.map((g) => `/game/${g.slug}`)].map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n');
const block = `  <!-- games -->\n${entries}\n  <!-- /games -->`;
sitemap = /<!-- games -->[\s\S]*<!-- \/games -->/.test(sitemap)
  ? sitemap.replace(/  <!-- games -->[\s\S]*<!-- \/games -->/, block)
  : sitemap.replace('</urlset>', block + '\n</urlset>');
fs.writeFileSync(sitemapPath, sitemap);
console.log('サイトマップを更新しました');
