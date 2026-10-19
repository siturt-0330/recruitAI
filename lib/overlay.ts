export interface Mark {
  el: HTMLElement;
  status: 'ok' | 'warn';
  ai: boolean;
}

/* 入力した欄には朱色の「済」の判子、要確認は山吹色の角判を押す */
const CSS = `
:host { all: initial; }
.box { position: absolute; box-sizing: border-box; border-radius: 6px; pointer-events: none; transition: opacity .2s; }
.box.ok { box-shadow: 0 0 0 2px rgba(194, 65, 45, .22); }
.box.warn { box-shadow: 0 0 0 2px rgba(184, 134, 43, .45); }
.stamp { position: absolute; top: -11px; right: -9px; width: 22px; height: 22px; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center; background: #fbf8f2;
  font: 600 11px/1 "Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", serif;
  border: 1.5px solid #c2412d; color: #c2412d; border-radius: 50%; transform: rotate(-12deg);
  animation: press .28s cubic-bezier(.2, 1.6, .4, 1) both; }
.warn .stamp { width: auto; padding: 0 4px; border-radius: 3px; border-color: #b8862b; color: #9a6c17; font-size: 10px; }
@keyframes press { from { transform: rotate(-12deg) scale(1.8); opacity: 0; } }
.bar { position: fixed; right: 20px; bottom: 20px; display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 18px;
  border-radius: 999px; background: #0f1419; color: #fff; pointer-events: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,.25), 0 2px 6px rgba(0,0,0,.15);
  font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif; animation: rise .25s ease-out; }
.bar { padding-left: 6px; }
.bar b { font-weight: 700; }
.orb { position: relative; width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 50%, #34386a 0%, #23264a 28%, #121322 52%, #0a0a0f 72%); }
.orb::after { content: ''; width: 42%; height: 42%; border-radius: 50%; background: #0a0a0f;
  box-shadow: 0 0 0 1.3px #b9bde8, 0 0 4px 1.3px rgba(185, 189, 232, .55); }
.bar .warn { color: #ffc53d; }
.bar button { all: unset; cursor: pointer; font-size: 13px; font-weight: 700; padding: 7px 14px; border-radius: 999px; background: #fff; color: #0f1419; }
.bar button:hover { background: #e7e9ea; }
.bar button.primary { background: #0f1419; color: #fff; }
.bar button.primary:hover { background: #272c30; }
.bar button.done { background: transparent; color: #9fe1cb; cursor: default; }
.bar .company { font-weight: 700; }
.bar button.icon { padding: 7px 10px; background: transparent; color: #8b98a5; font-weight: 400; }
.bar button.icon:hover { background: rgba(255,255,255,.1); color: #fff; }
@keyframes rise { from { transform: translateY(8px); opacity: 0; } }
`;

/** ページ上に入力結果の枠・バッジ・フローティングバーを描く。ページの CSS と干渉しないよう Shadow DOM に閉じ込める */
/** Sophon とつながっていて、応募先の企業が分かったときにバーへ出す内容 */
export interface BarLink {
  company: string;
  recorded: boolean;
  onRecord(): void;
}

export class Overlay {
  private host: HTMLDivElement | null = null;
  private layer: HTMLDivElement | null = null;
  private boxes: { mark: Mark; box: HTMLDivElement }[] = [];
  private raf = 0;

  constructor(
    private doc: Document,
    private handlers: { onUndo(): void; onClose(): void },
  ) {}

  private link: BarLink | null = null;

  setLink(link: BarLink | null) {
    this.link = link;
  }

  /** text を渡すと、バーには件数の代わりにその文を出す（ログイン情報の入力など） */
  render(marks: Mark[], summary: { filled: number; warn: number }, text?: string) {
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
      const stamp = this.doc.createElement('span');
      stamp.className = 'stamp';
      stamp.textContent = mark.status === 'warn' ? '確認' : '済';
      if (mark.ai) stamp.title = 'AI が判定しました';
      box.append(stamp);
      this.layer!.append(box);
      this.boxes.push({ mark, box });
    }

    if (summary.filled > 0) root.append(this.makeBar(summary, text));

    this.doc.documentElement.append(host);
    this.host = host;
    this.position();
    addEventListener('scroll', this.schedule, true);
    addEventListener('resize', this.schedule);
  }

  /** 入力できなかった理由など、短いお知らせを右下のバーに出す */
  notice(message: string) {
    this.clear();
    const host = this.doc.createElement('div');
    host.setAttribute('data-recruitai', '');
    host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${CSS}</style>`;
    const bar = this.doc.createElement('div');
    bar.className = 'bar';
    const orb = this.doc.createElement('span');
    orb.className = 'orb';
    const text = this.doc.createElement('span');
    text.textContent = message;
    const close = this.doc.createElement('button');
    close.className = 'icon';
    close.textContent = '✕';
    close.setAttribute('aria-label', '閉じる');
    close.onclick = () => this.clear();
    bar.append(orb, text, close);
    root.append(bar);
    this.doc.documentElement.append(host);
    this.host = host;
    setTimeout(() => {
      if (this.host === host) this.clear();
    }, 6000);
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

  private makeBar({ filled, warn }: { filled: number; warn: number }, message?: string) {
    const bar = this.doc.createElement('div');
    bar.className = 'bar';
    const text = this.doc.createElement('span');
    const count = (n: number, label: string, cls = '') => {
      const s = this.doc.createElement('span');
      if (cls) s.className = cls;
      const b = this.doc.createElement('b');
      b.textContent = String(n);
      s.append(b, label);
      return s;
    };
    if (message) {
      text.textContent = message;
    } else if (this.link) {
      const name = this.doc.createElement('span');
      name.className = 'company';
      name.textContent = this.link.company;
      text.append(name, ' · ');
    }
    if (!message) {
      text.append(count(filled, ' 件入力'));
      if (warn) text.append(' · ', count(warn, ' 件要確認', 'warn'));
    }
    const undo = this.doc.createElement('button');
    undo.textContent = '元に戻す';
    undo.onclick = () => this.handlers.onUndo();
    const close = this.doc.createElement('button');
    close.className = 'icon';
    close.textContent = '✕';
    close.setAttribute('aria-label', '閉じる');
    close.onclick = () => this.handlers.onClose();
    const orb = this.doc.createElement('span');
    orb.className = 'orb';
    orb.title = 'Sophon';
    bar.append(orb, text);
    if (this.link && !message) bar.append(this.recordButton(this.link));
    bar.append(undo, close);
    return bar;
  }

  private recordButton(link: BarLink) {
    const b = this.doc.createElement('button');
    const done = () => {
      b.className = 'done';
      b.textContent = '✓ 記録しました';
      b.onclick = null;
    };
    if (link.recorded) {
      done();
    } else {
      b.className = 'primary';
      b.textContent = 'ボードに記録';
      b.onclick = () => {
        link.onRecord();
        link.recorded = true;
        done();
      };
    }
    return b;
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
