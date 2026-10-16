// 使い方の動画（site/howto.js）を 1 コマずつ撮って、MP4（H.264, 1920×1080, 30fps）に書き出す。
// 使い方: node store/marketing/record-howto.mjs <mp4-muxer の build/mp4-muxer.js へのパス> [出力先.mp4]
// （mp4-muxer は `npm install mp4-muxer@5` で入る。ffmpeg は不要。Chrome の WebCodecs で圧縮する）
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const muxerPath = process.argv[2];
const out = resolve(process.argv[3] ?? 'store/marketing/howto.mp4');
if (!muxerPath) throw new Error('mp4-muxer.js のパスを指定してください');

const FPS = 30;
const DURATION = 28;
const HOLD = 1.5; // 最後の画面を少し長めに見せる
// 4 つ目の引数で秒数を短くできる（試し撮り用）
const LIMIT = process.argv[4] ? Number(process.argv[4]) : Infinity;
const SCALE = 2; // 960×540 を 2 倍 → 1920×1080
const page = pathToFileURL(resolve('store/marketing/howto-capture.html')).href;

const port = 9333;
const profile = mkdtempSync(join(tmpdir(), 'howto-rec-'));
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

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: SCALE, mobile: false });
await send('Page.navigate', { url: page });
await sleep(2500); // フォントの読み込みを待つ
await evaluate(`new Promise((ok, ng) => { const s = document.createElement('script'); s.src = ${JSON.stringify(pathToFileURL(resolve(muxerPath)).href)}; s.onload = ok; s.onerror = ng; document.head.appendChild(s); })`);

const W = 960 * SCALE;
const H = 540 * SCALE;
const support = await evaluate(`VideoEncoder.isConfigSupported({ codec: 'avc1.640028', width: ${W}, height: ${H}, bitrate: 8e6, framerate: ${FPS} }).then(r => r.supported)`);
if (!support) throw new Error('この Chrome では H.264 で書き出せません');

await evaluate(`(() => {
  window.__muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: ${W}, height: ${H} }, fastStart: 'in-memory' });
  window.__enc = new VideoEncoder({ output: (c, m) => __muxer.addVideoChunk(c, m), error: (e) => { window.__encError = String(e); } });
  __enc.configure({ codec: 'avc1.640028', width: ${W}, height: ${H}, bitrate: 8e6, framerate: ${FPS} });
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

const total = Math.round(Math.min(DURATION + HOLD, LIMIT) * FPS);
for (let i = 0; i < total; i++) {
  const t = Math.min(i / FPS, DURATION);
  await evaluate(`__howtoRender(${t})`);
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
console.log(`\n書き出しました: ${out}`);
ws.close();
chrome.kill();
