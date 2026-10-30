// 単語タイピングゲームのページを作る。games/<slug>/game.json と words.json から、
//   site/game/<slug>/index.html と words.json、単語一覧（site/game/<slug>/words/index.html）、ゲーム一覧（site/game/index.html）、サイトマップを書き出す。
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
    // 工程（steps の id、ranges・others の名前）
    if (w.st !== undefined) {
      const known = new Set([...(cfg.steps || []).map((s) => s.id), ...Object.keys(cfg.ranges || {}), ...Object.keys(cfg.others || {})]);
      if (!known.has(w.st)) err(`${at}: st「${w.st}」は game.json の steps・ranges・others にありません`);
      out.st = w.st;
    }
    if (w.alt && w.alt.length) out.alt = w.alt;
    if (w.syn !== undefined && !Array.isArray(w.syn)) err(`${at}: syn は言葉の配列で書いてください`);
    else if (w.syn && w.syn.length) out.syn = w.syn;
    return out;
  });
  // 似た意味の言葉（syn）は、このゲームにある言葉を指していること
  for (const w of words) {
    for (const s of w.syn || []) {
      if (s === w.w) err(`${w.w}: syn に自分自身が入っています`);
      else if (!seen.has(s)) err(`${w.w}: syn の「${s}」は words.json にない言葉です`);
    }
  }
  for (const c of cfg.courses || []) {
    const n = words.filter((w) => c.levels.includes(w.lv)).length;
    if (n < 10) err(`コース「${c.name}」の言葉が ${n} 語しかありません（10 語以上にしてください）`);
  }
  return { slug, cfg, words };
}

const slugs = fs.readdirSync(gamesDir).filter((d) => fs.existsSync(path.join(gamesDir, d, 'game.json')));
const errors = [];
const games = slugs.map((s) => load(s, errors));

// 広告（Google AdSense）。games/ads.json の client が空なら、広告のタグも ads.txt も出さない
const ads = JSON.parse(fs.readFileSync(path.join(gamesDir, 'ads.json'), 'utf8'));
const adClient = ads.client || '';
if (adClient && !/^ca-pub-\d+$/.test(adClient)) errors.push(`[ads.json] client は「ca-pub-」で始まる AdSense のサイト運営者 ID にしてください（いまは「${adClient}」）`);
for (const [name, id] of Object.entries(ads.slots || {})) {
  if (id && !/^\d+$/.test(id)) errors.push(`[ads.json] slots.${name} は広告ユニットの ID（数字だけ）にしてください（いまは「${id}」）`);
}
const adHead = adClient
  ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}" crossorigin="anonymous"></script>`
  : '';
/**
 * 広告の枠。見えるようになってから読み込むので、class は adsbygoogle ではなく ad-unit にしておく（ゲームのページでは game.js、一覧では now で埋め込むスクリプトが読み込む）。
 * size をつけると大きさの決まった枠になる（大きさは game.css の .ad-small・.ad-side で決める）。small はプレイ中の小さい横長、side は結果画面のスコアの下の縦長
 */
const adSlot = (name, { now = false, size = '' } = {}) => {
  const id = adClient && ads.slots?.[name];
  if (!id) return '';
  const load = now ? '<script>(window.adsbygoogle = window.adsbygoogle || []).push({});</script>' : '';
  const cls = now ? 'adsbygoogle' : 'ad-unit';
  const attrs = size ? 'style="display:inline-block"' : 'style="display:block" data-ad-format="auto" data-full-width-responsive="true"';
  return `<aside class="ad${size ? ' ad-' + size : ''}"><span class="ad-label">広告</span><ins class="${cls}" ${attrs} data-ad-client="${adClient}" data-ad-slot="${id}"></ins>${load}</aside>`;
};

if (errors.length) {
  console.error('言葉のデータに直すところがあります。何も書き出していません。\n');
  errors.forEach((e) => console.error('  ' + e));
  process.exit(1);
}

// 共通の部品とデータが変わったら、ブラウザのキャッシュを使わず読み直してもらう
const engineHash = createHash('sha1');
for (const f of ['romaji.js', 'game.js', 'game.css']) engineHash.update(fs.readFileSync(path.join(siteGame, 'engine', f)));

// シェア画像（games/og.mjs で作る）。画像が変わったら URL も変わるように ?v= を付ける。なければサイト共通の画像を使う
const ogMissing = [];
const ogImage = (file) => {
  const p = path.join(siteGame, file);
  if (!fs.existsSync(p)) { ogMissing.push(file); return `${SITE}/images/og.png`; }
  return `${SITE}/game/${file}?v=${createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 8)}`;
};
// 称号（[1 分あたりの点数, 称号] の高い順）。game.json になければこれを使う。game.js の称号と、称号ごとのシェアのページで使う
const RANKS = [[6000, 'マスター'], [3500, 'エキスパート'], [1500, 'ルーキー'], [0, '見習い']];
const share = template('share.html');

const page = template('template.html');
const listPage = template('words.html');
/** <script type="application/ld+json"> に埋め込む（</script> で切れないように < を逃がす） */
const ld = (data) => JSON.stringify(data).replace(/</g, '\\u003c');
const PUBLISHER = { '@type': 'Organization', name: 'らくらくエントリー', url: `${SITE}/`, logo: `${SITE}/images/icon-128.png` };
/** テーマ（site/game/themes/<theme>.css）。ゲームごとの色・背景・カードのイラスト */
const themeCss = (g) => {
  if (!g.cfg.theme) return '';
  const file = path.join(siteGame, 'themes', `${g.cfg.theme}.css`);
  if (!fs.existsSync(file)) throw new Error(`テーマの CSS がありません：site/game/themes/${g.cfg.theme}.css`);
  const v = createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
  return `<link rel="stylesheet" href="/game/themes/${g.cfg.theme}.css?v=${v}" />`;
};
const themeClass = (g) => (g.cfg.theme ? ` class="theme-${g.cfg.theme}"` : '');
const HUB_LINK = '<a class="link" href="/game">SPI 用語集</a>';
/** パンくずの「SPI 用語集」。standalone のゲームは SPI 用語集の下に置かない */
const hubCrumb = (g) => (g.cfg.standalone ? [] : [['SPI 用語集', `${SITE}/game`]]);
const crumbs = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
});
/** 例文の中の言葉に印をつける（々で書いた形も） */
const markWord = (w) => {
  const f = forms(w.w).find((x) => w.e.includes(x));
  return f ? w.e.split(f).map(esc).join(`<mark>${esc(f)}</mark>`) : esc(w.e);
};
/** 中身が同じなら書きかえない。書きかえたら true（サイトマップの更新日に使う） */
const changed = new Set();
const write = (file, text, url) => {
  const same = fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text;
  if (!same) {
    fs.writeFileSync(file, text);
    if (url) changed.add(url);
  }
};

for (const g of games) {
  const url = `${SITE}/game/${g.slug}`;
  const gamePath = `/game/${g.slug}`;
  const listPath = `${gamePath}/words`;
  const version = createHash('sha1').update(engineHash.copy().digest('hex')).update(JSON.stringify(g)).digest('hex').slice(0, 8);
  const ranks = g.cfg.ranks || RANKS;
  const config = { ...g.cfg, slug: g.slug, url, version, ranks };
  const gameOg = ogImage(`${g.slug}/og/game.png`);
  const names = g.cfg.levelNames || {};
  const levelName = (lv) => names[lv] || `レベル ${lv}`;
  const gameLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: g.cfg.title,
        url,
        description: g.cfg.description,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Web',
        inLanguage: 'ja',
        isAccessibleForFree: true,
        image: gameOg,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
        publisher: PUBLISHER,
      },
      crumbs([
        ['らくらくエントリー', `${SITE}/`],
        ...hubCrumb(g),
        [g.cfg.title, url],
      ]),
    ],
  };
  const html = page
    .replaceAll('{{seoTitle}}', () => esc(g.cfg.seoTitle))
    .replaceAll('{{hubLink}}', () => (g.cfg.standalone ? '' : HUB_LINK))
    .replaceAll('{{themeCss}}', () => themeCss(g))
    .replaceAll('{{themeClass}}', () => themeClass(g))
    .replaceAll('{{description}}', () => esc(g.cfg.description))
    .replaceAll('{{url}}', () => url)
    .replaceAll('{{ogImage}}', () => gameOg)
    .replaceAll('{{kicker}}', () => esc(g.cfg.kicker))
    .replaceAll('{{heading1}}', () => esc(g.cfg.heading1))
    .replaceAll('{{heading2}}', () => esc(g.cfg.heading2))
    .replaceAll('{{aboutHeading}}', () => esc(g.cfg.aboutHeading || `${g.cfg.title}とは`))
    .replaceAll('{{aboutText}}', () => esc(g.cfg.aboutText || g.cfg.description))
    .replaceAll('{{listPath}}', () => listPath)
    .replaceAll('{{version}}', () => version)
    .replaceAll('{{adHead}}', () => adHead)
    .replaceAll('{{wordCount}}', () => String(g.words.length))
    .replaceAll('{{adStart}}', () => adSlot('start'))
    .replaceAll('{{adPlay}}', () => adSlot('play', { size: 'small' }))
    .replaceAll('{{adSide}}', () => adSlot('side', { size: 'side' }))
    .replaceAll('{{adResult}}', () => adSlot('result'))
    .replaceAll('{{jsonLd}}', () => ld(gameLd))
    .replaceAll('{{config}}', () => JSON.stringify(config).replace(/</g, '\\u003c'));
  const out = path.join(siteGame, g.slug);
  fs.mkdirSync(out, { recursive: true });
  write(path.join(out, 'index.html'), html, gamePath);
  write(path.join(out, 'words.json'), JSON.stringify(g.words), gamePath);
  // 結果をシェアするときのページ（/game/<slug>/r/<称号の番号>）。X には称号ごとの画像が出る
  fs.rmSync(path.join(out, 'r'), { recursive: true, force: true });
  ranks.forEach(([, name], n) => {
    const dir = path.join(out, 'r', String(n));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      share
        .replaceAll('{{title}}', esc(`「${name}」の称号をとった！｜${g.cfg.title}`))
        .replaceAll('{{description}}', esc(g.cfg.description))
        .replaceAll('{{shareUrl}}', `${url}/r/${n}`)
        .replaceAll('{{ogImage}}', ogImage(`${g.slug}/og/rank-${n}.png`))
        .replaceAll('{{gamePath}}', `/game/${g.slug}`)
        .replaceAll('{{gameTitle}}', esc(g.cfg.title)),
    );
  });
  console.log(`/game/${g.slug}  ${g.cfg.title}（${g.words.length} 語）`);

  // 単語一覧（言葉をすべて HTML に書き出す。検索から言葉を探して来た人が読める）
  const levels = [...new Set(g.words.map((w) => w.lv))].sort((a, b) => a - b);
  const byYomi = (a, b) => a.y.localeCompare(b.y, 'ja');
  const sections = levels
    .map((lv) => {
      const list = g.words.filter((w) => w.lv === lv).sort(byYomi);
      const items = list
        .map(
          (w) =>
            `              <div class="it" id="${esc(w.w)}"><dt><b>${esc(w.w)}</b><span class="y">${esc([w.y, ...(w.alt || [])].join('・'))}</span></dt><dd>${esc(w.m)}<span class="ex">例：${markWord(w)}</span></dd></div>`,
        )
        .join('\n');
      return `        <section class="wbg" id="lv${lv}">\n          <div class="wbgh"><h2>${esc(levelName(lv))}<small>${list.length} 語</small></h2></div>\n          <dl>\n${items}\n          </dl>\n        </section>`;
    })
    .join('\n');
  const toc = levels.map((lv) => `          <li><a href="#lv${lv}">${esc(levelName(lv))}（${g.words.filter((w) => w.lv === lv).length} 語）</a></li>`).join('\n');
  const listUrl = SITE + listPath;
  const listTitle = g.cfg.listTitle || `${g.cfg.title}の単語一覧（${g.words.length} 語）`;
  const listDescription = g.cfg.listDescription || `${g.cfg.title}に出る ${g.words.length} 語を、読み・意味・例文つきで一覧にしました。`;
  const listLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'DefinedTermSet',
        '@id': `${listUrl}#terms`,
        name: listTitle,
        url: listUrl,
        description: listDescription,
        inLanguage: 'ja',
        publisher: PUBLISHER,
        hasDefinedTerm: g.words.map((w) => ({
          '@type': 'DefinedTerm',
          name: w.w,
          alternateName: [w.y, ...(w.alt || [])],
          description: w.m,
          url: `${listUrl}#${w.w}`,
        })),
      },
      crumbs([
        ['らくらくエントリー', `${SITE}/`],
        ...hubCrumb(g),
        [g.cfg.title, url],
        ['単語一覧', listUrl],
      ]),
    ],
  };
  const listHtml = listPage
    .replaceAll('{{listTitle}}', () => esc(listTitle))
    .replaceAll('{{listDescription}}', () => esc(listDescription))
    .replaceAll('{{listHeading}}', () => esc(g.cfg.listHeading || listTitle))
    .replaceAll('{{listLead}}', () => esc(g.cfg.listLead || listDescription))
    .replaceAll('{{listUrl}}', () => listUrl)
    .replaceAll('{{gamePath}}', () => gamePath)
    .replaceAll('{{title}}', () => esc(g.cfg.title))
    .replaceAll('{{hubLink}}', () => (g.cfg.standalone ? '' : HUB_LINK))
    .replaceAll('{{themeCss}}', () => themeCss(g))
    .replaceAll('{{themeClass}}', () => themeClass(g))
    .replaceAll('{{hubCrumb}}', () => (g.cfg.standalone ? '' : '<li><a href="/game">SPI 用語集</a></li>'))
    .replaceAll('{{hubFoot}}', () => (g.cfg.standalone ? '' : '<a href="/game">SPI 用語集</a> ・ '))
    .replaceAll('{{ogImage}}', () => gameOg)
    .replaceAll('{{version}}', () => version)
    .replaceAll('{{toc}}', () => toc)
    .replaceAll('{{sections}}', () => sections)
    .replaceAll('{{jsonLd}}', () => ld(listLd));
  fs.mkdirSync(path.join(out, 'words'), { recursive: true });
  write(path.join(out, 'words', 'index.html'), listHtml, listPath);
  console.log(`${listPath}  単語一覧`);
}

// ゲームの一覧（standalone のゲームは SPI 用語集とは別のものとして、一覧に載せない）
const hubGames = games.filter((g) => !g.cfg.standalone);
hubGames.sort((a, b) => (a.cfg.order ?? 99) - (b.cfg.order ?? 99) || a.cfg.title.localeCompare(b.cfg.title));
const cards = hubGames
  .map(
    (g) =>
      `          <a class="gcard" href="/game/${g.slug}"><span class="k">${esc(g.cfg.kicker)}</span><b>${esc(g.cfg.title)}</b><p>${esc(g.cfg.summary)}</p><div class="n">${g.words.length} 語 ・ ${g.cfg.courses.length} コース</div></a>`,
  )
  .join('\n');
const lists = hubGames.map((g) => `          <li><a href="/game/${g.slug}/words">${esc(g.cfg.title)}の単語一覧（${g.words.length} 語）</a></li>`).join('\n');
const hubLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      name: 'SPI 用語集',
      url: `${SITE}/game`,
      inLanguage: 'ja',
      publisher: PUBLISHER,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: hubGames.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.cfg.title, url: `${SITE}/game/${g.slug}` })),
      },
    },
    crumbs([
      ['らくらくエントリー', `${SITE}/`],
      ['SPI 用語集', `${SITE}/game`],
    ]),
  ],
};
const hubVersion = engineHash.digest('hex').slice(0, 8);
write(
  path.join(siteGame, 'index.html'),
  template('hub.html')
    .replaceAll('{{version}}', () => hubVersion)
    .replace('{{ogImage}}', () => ogImage('og.png'))
    .replace('{{adHead}}', () => adHead)
    .replace('{{adHub}}', () => adSlot('hub', { now: true }))
    .replace('{{jsonLd}}', () => ld(hubLd))
    .replace('{{games}}', () => cards)
    .replace('{{lists}}', () => lists),
  '/game',
);
console.log('/game  ゲーム一覧');

// ads.txt（AdSense が「このサイトの広告枠を売ってよい会社」を確かめるファイル。サイトの確認にも使える）
const adsTxt = path.join(root, 'site', 'ads.txt');
if (adClient) {
  fs.writeFileSync(adsTxt, `google.com, ${adClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
  console.log(`広告：${adClient}（枠：${Object.keys(ads.slots || {}).filter((k) => ads.slots[k]).join('・') || 'なし'}）・ads.txt を書き出しました`);
} else if (fs.existsSync(adsTxt)) {
  fs.rmSync(adsTxt);
  console.log('広告：なし（ads.txt を消しました）');
}

// サイトマップ（<!-- games --> と <!-- /games --> のあいだを書きかえる）。
// 更新日は中身が変わったページだけ今日にする（毎回今日にすると、検索エンジンが更新日を信用しなくなる）
const sitemapPath = path.join(root, 'site', 'sitemap.xml');
let sitemap = fs.readFileSync(sitemapPath, 'utf8');
// 日本時間の日付（toISOString は世界標準時なので、朝 9 時まで前の日になる）
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
const lastmod = (p) => {
  const m = sitemap.match(new RegExp(`<loc>${SITE}${p}</loc><lastmod>([\\d-]+)</lastmod>`));
  return changed.has(p) || !m ? today : m[1];
};
const entries = ['/game', ...games.flatMap((g) => [`/game/${g.slug}`, `/game/${g.slug}/words`])]
  .map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${lastmod(p)}</lastmod></url>`)
  .join('\n');
const block = `  <!-- games -->\n${entries}\n  <!-- /games -->`;
sitemap = /<!-- games -->[\s\S]*<!-- \/games -->/.test(sitemap)
  ? sitemap.replace(/  <!-- games -->[\s\S]*<!-- \/games -->/, () => block)
  : sitemap.replace('</urlset>', () => block + '\n</urlset>');
write(sitemapPath, sitemap);
console.log('サイトマップを更新しました');
if (ogMissing.length) console.warn(`シェア画像がありません（サイト共通の画像を使いました）：${ogMissing.join('・')}
  node games/og.mjs で作ってから、もう一度書き出してください`);
