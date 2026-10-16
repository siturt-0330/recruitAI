// HTML のアニメーションを、静止画（PNG）か動画（MP4・H.264・30fps）に書き出す。ffmpeg は不要（Chrome の WebCodecs で圧縮する）。
// ページには window.__capture = { width, height, scale, duration } と、時刻 t の画面を描く window.__render(t) を用意しておく。
// 使い方:
//   node store/marketing/capture.mjs store/marketing/reel.html store/marketing/reel.mp4 --muxer=<mp4-muxer の build/mp4-muxer.js>
//   node store/marketing/capture.mjs store/marketing/reel.html store/marketing/reel-cover.png --t=2.3
//   node store/marketing/capture.mjs "store/marketing/reel.html?soon" store/marketing/reel-soon.mp4 --muxer=...
// （mp4-muxer は `npm install mp4-muxer@5` で入る。--limit=秒 で試し撮りできる）
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FPS = 30;

const args = process.argv.slice(2);
const opts = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=');
    return [k, v ?? true];
  }),
);
const [pageArg, outArg] = args.filter((a) => !a.startsWith('--'));
if (!pageArg || !outArg) throw new Error('使い方: node capture.mjs <ページ.html[?クエリ]> <出力.mp4|.png> [--t=秒] [--muxer=パス]');
const [pagePath, query] = pageArg.split('?');
const url = `${pathToFileURL(resolve(pagePath)).href}?capture${query ? `&${query}` : ''}`;
const out = resolve(outArg);
const video = out.endsWith('.mp4');
if (video && !opts.muxer) throw new Error('動画にするときは --muxer=<mp4-muxer.js のパス> を指定してください');

// 同時にいくつ動かしてもぶつからないよう、ポートは毎回変える
const port = 9300 + Math.floor(Math.random() * 600);
const profile = mkdtempSync(join(tmpdir(), 'promo-cap-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--allow-file-access-from-files', '--remote-allow-origins=*', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    target = list.find((t) => t.type === 'page');
  } catch {
    await sleep(200);
  }
}
if (!target) throw new Error('Chrome に接続できませんでした');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ok, ng) => {
  ws.addEventListener('open', ok, { once: true });
  ws.addEventListener('error', () => ng(new Error('Chrome との接続に失敗しました')), { once: true });
});
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

try {
  await send('Page.enable');
  await send('Page.navigate', { url });
  let info;
  for (let i = 0; i < 100 && !info; i++) {
    await sleep(100);
    info = await evaluate(`document.readyState === 'complete' && typeof window.__render === 'function' ? window.__capture : null`).catch(() => null);
  }
  if (!info) throw new Error('ページに window.__render がありません');
  await send('Emulation.setDeviceMetricsOverride', { width: info.width, height: info.height, deviceScaleFactor: info.scale, mobile: false });

  // 途中で出てくる文字のぶんまでフォントを読み込んでおく（日本語のフォントは文字ごとに分けて配信されるため）
  const failed = await evaluate(`(async () => {
    await document.fonts.ready;
    for (let t = 0; t <= (__capture.duration || 0); t += 0.25) {
      __render(t);
      document.body.getBoundingClientRect();
      await document.fonts.ready;
    }
    await new Promise((r) => setTimeout(r, 500));
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === 'error').length;
  })()`);
  if (failed) console.warn(`読み込めなかったフォントがあります（${failed} 件）`);

  if (!video) {
    // --t=1,2.5 のように複数書くと、ファイル名の後ろに秒数を付けて 1 枚ずつ書き出す
    const times = String(opts.t ?? 0).split(',');
    for (const t of times) {
      await evaluate(`Promise.resolve(__render(${Number(t)})).then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))`);
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const file = times.length > 1 ? out.replace(/\.png$/, `-${t}.png`) : out;
      writeFileSync(file, Buffer.from(data, 'base64'));
      console.log(`書き出しました: ${file}`);
    }
  } else {
    await evaluate(`new Promise((ok, ng) => { const s = document.createElement('script'); s.src = ${JSON.stringify(pathToFileURL(resolve(opts.muxer)).href)}; s.onload = ok; s.onerror = ng; document.head.appendChild(s); })`);
    const W = info.width * info.scale;
    const H = info.height * info.scale;
    // 縦 1920 は H.264 のレベル 4.0 にぎりぎり収まる。だめなら上のレベルを試す
    const codec = await evaluate(`(async () => {
      for (const codec of ['avc1.640028', 'avc1.64002a', 'avc1.640032']) {
        const r = await VideoEncoder.isConfigSupported({ codec, width: ${W}, height: ${H}, bitrate: 8e6, framerate: ${FPS} });
        if (r.supported) return codec;
      }
      return null;
    })()`);
    if (!codec) throw new Error('この Chrome では H.264 で書き出せません');

    await evaluate(`(() => {
      window.__muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: ${W}, height: ${H} }, fastStart: 'in-memory' });
      window.__enc = new VideoEncoder({ output: (c, m) => __muxer.addVideoChunk(c, m), error: (e) => { window.__encError = String(e); } });
      __enc.configure({ codec: '${codec}', width: ${W}, height: ${H}, bitrate: 8e6, framerate: ${FPS} });
      window.__addFrame = async (b64, i) => {
        const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
        const frame = new VideoFrame(bmp, { timestamp: Math.round((i * 1e6) / ${FPS}), duration: Math.round(1e6 / ${FPS}) });
        __enc.encode(frame, { keyFrame: i % ${FPS * 2} === 0 });
        frame.close();
        bmp.close();
        while (__enc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 5));
      };
    })()`);

    const total = Math.round(Math.min(info.duration, Number(opts.limit ?? Infinity)) * FPS);
    for (let i = 0; i < total; i++) {
      await evaluate(`__render(${i / FPS})`);
      const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 95, captureBeyondViewport: false });
      await evaluate(`__addFrame(${JSON.stringify(data)}, ${i})`);
      if (i % 60 === 0) process.stdout.write(`\r${i}/${total}`);
    }
    process.stdout.write('\n圧縮を仕上げています…');
    const size = await evaluate(`(async () => {
      await __enc.flush();
      if (window.__encError) throw new Error(__encError);
      __muxer.finalize();
      window.__mp4 = new Uint8Array(__muxer.target.buffer);
      return __mp4.length;
    })()`);
    // 大きな文字列を一度に受け取ると止まることがあるので、少しずつ受け取る
    const CHUNK = 512 * 1024;
    const parts = [];
    for (let at = 0; at < size; at += CHUNK) {
      const b64 = await evaluate(`(() => {
        const b = __mp4.subarray(${at}, ${at + CHUNK});
        let s = '';
        for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
        return btoa(s);
      })()`);
      parts.push(Buffer.from(b64, 'base64'));
    }
    writeFileSync(out, Buffer.concat(parts));
    console.log(`\n書き出しました: ${out}（${codec}, ${W}×${H}, ${(size / 1e6).toFixed(1)} MB）`);
  }
} finally {
  ws.close();
  chrome.kill();
}
