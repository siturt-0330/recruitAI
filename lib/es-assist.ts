import { scanFields } from './extract';
import { classify } from './rules';
import { charCount, limitOf, rankEsAnswers, type LinkEsAnswer } from './sophon-link';

const CSS = `
:host { all: initial; }
.panel { position: absolute; z-index: 2147483647; width: 320px; box-sizing: border-box; padding: 10px; border-radius: 14px;
  background: #f7f9f9; border: 1px solid #eff3f4; box-shadow: 0 10px 30px rgba(15,20,25,.16);
  font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif; color: #0f1419; }
.head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #0f1419; font-weight: 700; }
.head span { flex: 1; }
.orb { width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 50%, #34386a 0%, #23264a 28%, #121322 52%, #0a0a0f 72%); }
.orb::after { content: ''; width: 42%; height: 42%; border-radius: 50%; background: #0a0a0f; box-shadow: 0 0 0 1px #b9bde8; }
.x { all: unset; cursor: pointer; color: #536471; padding: 0 4px; }
.item { all: unset; box-sizing: border-box; display: block; width: 100%; cursor: pointer; margin-top: 4px; padding: 7px 9px;
  border-radius: 10px; background: #fff; border: 1px solid #eff3f4; }
.item:hover { border-color: #0f1419; }
.row { display: flex; gap: 8px; align-items: baseline; }
.title { flex: 1; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.count { font-size: 11px; color: #0f6e56; white-space: nowrap; }
.count.over { color: #c41320; }
.text { margin-top: 2px; font-size: 12px; color: #536471; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

type Box = HTMLTextAreaElement | HTMLInputElement;

/**
 * 志望動機などの記述欄にフォーカスしたとき、Sophon に書きためた ES を候補として出す。
 * 選ぶと欄に入れて、使った ES を覚えておく（「ボードに記録」で一緒に送る）。
 */
export class EsAssist {
  readonly used = new Set<string>();
  private host: HTMLDivElement | null = null;
  private target: Box | null = null;
  private labels = new Map<Element, { label: string; limit: number }>();
  private dismissed = new Set<Element>();

  constructor(
    private doc: Document,
    private answers: LinkEsAnswer[],
    private companyId: string | undefined,
  ) {}

  start() {
    if (!this.answers.some((a) => a.text.trim())) return;
    // プロフィールの項目（趣味・本人希望欄など）ではない、長文の欄だけを対象にする
    for (const f of scanFields(this.doc)) {
      const el = f.elements[0];
      const long = f.desc.kind === 'textarea' || (el instanceof HTMLInputElement && (f.desc.maxLength ?? 0) >= 100);
      if (!long || classify(f.desc).key) continue;
      const label = [f.desc.label, f.desc.context, f.desc.placeholder].filter(Boolean).join(' ');
      this.labels.set(el!, { label, limit: limitOf(label, f.desc.maxLength) });
    }
    this.doc.addEventListener('focusin', this.onFocus, true);
    this.doc.addEventListener('mousedown', this.onOutside, true);
    this.doc.addEventListener('keydown', this.onKey, true);
  }

  stop() {
    this.close();
    this.doc.removeEventListener('focusin', this.onFocus, true);
    this.doc.removeEventListener('mousedown', this.onOutside, true);
    this.doc.removeEventListener('keydown', this.onKey, true);
  }

  private onFocus = (e: FocusEvent) => {
    const el = e.target as Element;
    if (el === this.target) return;
    const info = this.labels.get(el);
    if (!info || this.dismissed.has(el) || (el as Box).value.trim()) return this.close();
    this.open(el as Box, info);
  };

  private onOutside = (e: MouseEvent) => {
    if (!this.host || e.composedPath().includes(this.host) || e.target === this.target) return;
    this.close();
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };

  private open(el: Box, { label, limit }: { label: string; limit: number }) {
    this.close();
    const ranked = rankEsAnswers(this.answers, { companyId: this.companyId, label, limit }).slice(0, 4);
    if (!ranked.length) return;
    this.target = el;

    const host = this.doc.createElement('div');
    host.setAttribute('data-recruitai', '');
    host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${CSS}</style>`;
    const panel = this.doc.createElement('div');
    panel.className = 'panel';

    const head = this.doc.createElement('div');
    head.className = 'head';
    const orb = this.doc.createElement('i');
    orb.className = 'orb';
    const title = this.doc.createElement('span');
    title.textContent = 'ESから入れる';
    const x = this.doc.createElement('button');
    x.className = 'x';
    x.textContent = '✕';
    x.setAttribute('aria-label', '閉じる');
    x.onclick = () => {
      this.dismissed.add(el);
      this.close();
    };
    head.append(orb, title, x);
    panel.append(head);

    for (const a of ranked) {
      const n = charCount(a.text);
      const item = this.doc.createElement('button');
      item.className = 'item';
      const row = this.doc.createElement('div');
      row.className = 'row';
      const t = this.doc.createElement('span');
      t.className = 'title';
      t.textContent = a.title || a.category;
      const c = this.doc.createElement('span');
      const over = !!limit && n > limit;
      c.className = over ? 'count over' : 'count';
      c.textContent = limit ? `${n} / ${limit}字` : `${n}字`;
      row.append(t, c);
      const body = this.doc.createElement('div');
      body.className = 'text';
      body.textContent = a.text;
      item.append(row, body);
      // フォーカスが外れて欄が閉じる前に入れる
      item.onmousedown = (e) => e.preventDefault();
      item.onclick = () => this.insert(el, a);
      panel.append(item);
    }
    root.append(panel);
    this.doc.documentElement.append(host);
    this.host = host;

    const r = el.getBoundingClientRect();
    panel.style.left = `${Math.max(8, r.left + scrollX)}px`;
    panel.style.top = `${r.bottom + scrollY + 6}px`;
  }

  private insert(el: Box, a: LinkEsAnswer) {
    // React などのフォームでも反映されるよう、ネイティブの setter で入れてイベントを送る
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, a.text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    this.used.add(a.id);
    this.close();
    el.focus();
  }

  private close() {
    this.host?.remove();
    this.host = null;
    this.target = null;
  }
}
