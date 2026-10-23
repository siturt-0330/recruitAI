// シェア画像（X などに出る 1200×630 の PNG）を作る。Chrome をヘッドレスで開いて games/og.html を撮る。
//   site/game/og.png                  … ゲーム一覧（/game）
//   site/game/<slug>/og/game.png      … 各ゲーム
//   site/game/<slug>/og/rank-<n>.png  … 結果をシェアしたときの称号ごと（n は game.json の ranks の順番。0 がいちばん上）
//
//   node games/og.mjs
//
// 題名や称号を変えたら作り直して、node games/build.mjs で書き出す（画像が変わると URL の ?v= も変わる）。
// Chrome の場所がちがうときは、環境変数 CHROME に入れる。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gamesDir = path.join(root, 'games');
const siteGame = path.join(root, 'site', 'game');
const RANKS = [[6000, 'マスター'], [3500, 'エキスパート'], [1500, 'ルーキー'], [0, '見習い']];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const template = fs.readFileSync(path.join(gamesDir, 'og.html'), 'utf8').replace(/^<!--[^\n]*-->\r?\n/, '');
const icon = fs.readFileSync(path.join(root, 'site', 'images', 'icon.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');

/** 1 枚ぶんの HTML。left は左の文、card は右のカードに出す言葉 */
function page(left, card, stamp) {
  return template
    .replace('{{icon}}', icon)
    .replace('{{left}}', left)
    .replace('{{word}}', esc(card.w))
    .replace('{{yomi}}', esc(card.y))
    .replace('{{meaning}}', esc(card.m))
    .replace('{{wordBack}}', esc(card.back))
    .replace('{{no}}', '12')
    .replace('{{noBack}}', '13')
    .replace('{{stamp}}', stamp ? '<div class="stamp">済</div>' : '');
}

// ---- 作る画像を並べる ----
const shots = [];
const slugs = fs.readdirSync(gamesDir).filter((d) => fs.existsSync(path.join(gamesDir, d, 'game.json')));
let hubCard;
for (const slug of slugs) {
  const cfg = JSON.parse(fs.readFileSync(path.join(gamesDir, slug, 'game.json'), 'utf8'));
  const words = JSON.parse(fs.readFileSync(path.join(gamesDir, slug, 'words.json'), 'utf8'));
  // カードに出す言葉は game.json の ogWord（なければ最初の言葉）。後ろのカードはその次の言葉
  const i = Math.max(0, words.findIndex((w) => w.w === cfg.ogWord));
  const card = { ...words[i], back: words[(i + 1) % words.length].w };
  hubCard = hubCard || card;
  const out = path.join(siteGame, slug, 'og');
  shots.push({
    file: path.join(out, 'game.png'),
    html: page(
      `<div class="kick">${esc(cfg.kicker)}</div><h1><span class="ln">${esc(cfg.heading1)}</span><span class="ln"><em>${esc(cfg.heading2)}</em></span></h1>` +
        `<div class="pill">無料・登録なしで遊べる</div>`,
      card,
      false,
    ),
  });
  const ranks = cfg.ranks || RANKS;
  ranks.forEach(([, name], n) => {
    const lv = ranks.map((_, k) => `<i${k < ranks.length - n ? ' class="on"' : ''}></i>`).join('');
    shots.push({
      file: path.join(out, `rank-${n}.png`),
      html: page(
        `<div class="lead">${esc(cfg.title)}で</div><h1><span class="ln"><em>「${esc(name)}」</em></span></h1><div class="after">の称号をとった！</div>` +
          `<div class="lv">${lv}</div><div class="pill">あなたは何点とれる？</div>`,
        card,
        true,
      ),
    });
  });
}
shots.push({
  file: path.join(siteGame, 'og.png'),
  html: page(
    `<div class="kick">SPI WORDS</div><h1><span class="ln">打って覚える、</span><span class="ln"><em>SPI 用語集。</em></span></h1>` +
      `<div class="pill">無料・登録なしで遊べる</div><span class="url">rakuraku-entry.com/game</span>`,
    hubCard,
    false,
  ),
});

// ---- Chrome で撮る ----
const chromePath = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p));
if (!chromePath) {
  console.error('Chrome が見つかりません。環境変数 CHROME に場所を入れてください');
  process.exit(1);
}
const PORT = 9400 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'og-chrome-'));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'og-html-'));
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let targets;
  for (let i = 0; i < 50 && !targets?.some((t) => t.type === 'page'); i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { await sleep(200); }
  }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  for (const [n, s] of shots.entries()) {
    // 画像ごとに別のファイルにする（前の画像のページを撮ってしまわないように）
    const html = path.join(work, `og-${n}.html`);
    fs.writeFileSync(html, s.html);
    await send('Page.navigate', { url: pathToFileURL(html).href });
    await sleep(300);
    // 字の大きさの調整（og.html のスクリプト）が終わるまで待つ
    for (let i = 0; i < 100; i++) {
      const r = await send('Runtime.evaluate', { expression: 'document.body && document.body.dataset.ready', returnByValue: true });
      if (r.result?.result?.value === '1') break;
      await sleep(100);
    }
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(s.file), { recursive: true });
    fs.writeFileSync(s.file, Buffer.from(r.result.data, 'base64'));
    console.log(path.relative(root, s.file).replaceAll('\\', '/'));
  }
  ws.close();
} finally {
  chrome.kill();
}
