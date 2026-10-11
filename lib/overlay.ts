export interface Mark {
  el: HTMLElement;
  status: 'ok' | 'warn';
  ai: boolean;
}

const CSS = `
:host { all: initial; }
.box { position: absolute; box-sizing: border-box; border: 2px solid; border-radius: 8px; pointer-events: none; transition: opacity .2s; }
.box.ok { border-color: #1d9e75; }
.box.warn { border-color: #d48a1c; }
.badge { position: absolute; top: -9px; right: -6px; font: 500 10px/1 system-ui, "Hiragino Sans", "Yu Gothic UI", sans-serif; padding: 3px 6px; border-radius: 999px; white-space: nowrap; display: flex; align-items: center; gap: 2px; }
.ok .badge { background: #e1f5ee; color: #0f6e56; }
.warn .badge { background: #faeeda; color: #854f0b; }
.bar { position: fixed; right: 20px; bottom: 20px; display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 14px; border-radius: 999px;
  background: #fff; color: #1f1e1c; border: 1px solid rgba(31,30,28,.14); box-shadow: 0 8px 24px rgba(0,0,0,.12), 0 2px 6px rgba(0,0,0,.08);
  font: 13px/1.4 system-ui, "Hiragino Sans", "Yu Gothic UI", sans-serif; pointer-events: auto; animation: rise .25s ease-out; }
.bar .dot { width: 8px; height: 8px; border-radius: 50%; background: #1d9e75; }
.bar .dot.warn { background: #d48a1c; }
.bar button { all: unset; cursor: pointer; font-size: 12px; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(31,30,28,.18); }
.bar button:hover { background: #f1efe8; }
.bar button.icon { padding: 6px 9px; border-color: transparent; color: #5f5e5a; }
@keyframes rise { from { transform: translateY(8px); opacity: 0; } }
@media (prefers-color-scheme: dark) {
  .bar { background: #2c2c2a; color: #f1efe8; border-color: rgba(255,255,255,.14); }
  .bar button { border-color: rgba(255,255,255,.2); }
  .bar button:hover { background: #444441; }
  .bar button.icon { color: #b4b2a9; }
}
`;

/** ページ上に入力結果の枠・バッジ・フローティングバーを描く。ページの CSS と干渉しないよう Shadow DOM に閉じ込める */
export class Overlay {
  private host: HTMLDivElement | null = null;
  private layer: HTMLDivElement | null = null;
  private boxes: { mark: Mark; box: HTMLDivElement }[] = [];
  private raf = 0;

  constructor(
    private doc: Document,
    private handlers: { onUndo(): void; onClose(): void },
  ) {}

  render(marks: Mark[], summary: { filled: number; warn: number }) {
    this.clear();
    const host = this.doc.createElement('div');
    host.setAttribute('data-recruitai', '');
    host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${CSS}</style><div class="layer"></div>`;
    this.layer = root.querySelector('.layer');

    for (const mark of marks) {
      const box = this.doc.createElement('div');
      box.className = `box ${mark.status}`;
      const badge = this.doc.createElement('span');
      badge.className = 'badge';
      badge.textContent = mark.status === 'warn' ? '要確認' : mark.ai ? '✓ AI' : '✓';
      box.append(badge);
      this.layer!.append(box);
      this.boxes.push({ mark, box });
    }

    if (summary.filled > 0) root.append(this.makeBar(summary));

    this.doc.documentElement.append(host);
    this.host = host;
    this.position();
    addEventListener('scroll', this.schedule, true);
    addEventListener('resize', this.schedule);
  }

  clear() {
    removeEventListener('scroll', this.schedule, true);
    removeEventListener('resize', this.schedule);
    cancelAnimationFrame(this.raf);
    this.host?.remove();
    this.host = null;
    this.layer = null;
    this.boxes = [];
  }

  private makeBar({ filled, warn }: { filled: number; warn: number }) {
    const bar = this.doc.createElement('div');
    bar.className = 'bar';
    const dot = this.doc.createElement('span');
    dot.className = warn ? 'dot warn' : 'dot';
    const text = this.doc.createElement('span');
    text.textContent = `${filled}件入力しました` + (warn ? ` ・ ${warn}件は確認してください` : '');
    const undo = this.doc.createElement('button');
    undo.textContent = '元に戻す';
    undo.onclick = () => this.handlers.onUndo();
    const close = this.doc.createElement('button');
    close.className = 'icon';
    close.textContent = '✕';
    close.setAttribute('aria-label', '閉じる');
    close.onclick = () => this.handlers.onClose();
    bar.append(dot, text, undo, close);
    return bar;
  }

  private schedule = () => {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.position);
  };

  private position = () => {
    const sx = scrollX;
    const sy = scrollY;
    for (const { mark, box } of this.boxes) {
      const r = mark.el.getBoundingClientRect();
      const hidden = r.width === 0 && r.height === 0;
      box.style.opacity = hidden ? '0' : '1';
      box.style.left = `${r.left + sx - 3}px`;
      box.style.top = `${r.top + sy - 3}px`;
      box.style.width = `${r.width + 6}px`;
      box.style.height = `${r.height + 6}px`;
    }
  };
}
