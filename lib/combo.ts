import { normOption, pickOption } from './fill';

/**
 * 独自デザインのプルダウン（MUI・react-select・Radix・Headless UI・Ant Design など）。
 * 本物の <select> がないので、クリックで開いて表示された選択肢（role="option"）を選ぶ。
 */
export const COMBO_SELECTOR = '[role="combobox"], [aria-haspopup="listbox"]';

/** 欄として扱う独自プルダウンか（<select>・ふつうの入力欄・無効なものは除く） */
export function isCombo(el: Element): boolean {
  if (!(el instanceof HTMLElement) || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) return false;
  if (!el.matches(COMBO_SELECTOR)) return false;
  if (el.getAttribute('aria-disabled') === 'true' || (el as HTMLButtonElement).disabled) return false;
  if (el instanceof HTMLInputElement && !/^(text|search|)$/.test((el.getAttribute('type') ?? '').toLowerCase())) return false;
  // react-select などは、表示用の要素の中にもう1つ combobox を持つことがある。内側だけを欄にする
  return !el.querySelector(COMBO_SELECTOR);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 本物のマウス操作と同じ順にイベントを送る。Radix は pointer、MUI・react-select は mouse、Headless UI は click を見る */
function press(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const base = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: r.left + r.width / 2,
    clientY: r.top + r.height / 2,
    button: 0,
    view: el.ownerDocument.defaultView,
  };
  const ptr = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
  el.dispatchEvent(new PointerEvent('pointerover', ptr));
  el.dispatchEvent(new PointerEvent('pointermove', ptr));
  el.dispatchEvent(new MouseEvent('mousemove', base));
  el.dispatchEvent(new PointerEvent('pointerdown', { ...ptr, buttons: 1 }));
  el.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
  if (el.isConnected) el.focus({ preventScroll: true });
  el.dispatchEvent(new PointerEvent('pointerup', ptr));
  el.dispatchEvent(new MouseEvent('mouseup', base));
  el.dispatchEvent(new MouseEvent('click', base));
}

function key(el: HTMLElement, k: string) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, composed: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true, composed: true }));
}

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
};

/** 選択肢らしいクラス名（react-select__option・ant-select-item-option・css-xxx-option など） */
const optionLike = (el: Element) => Array.from(el.classList).some((c) => /(^|[-_])option$/i.test(c));

/** 開いている一覧。aria-controls で示されていればそれ、なければ表示中の listbox */
function listboxOf(el: HTMLElement): HTMLElement | null {
  const doc = el.ownerDocument;
  for (const attr of ['aria-controls', 'aria-owns']) {
    for (const id of (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean)) {
      const box = doc.getElementById(id);
      if (box && visible(box)) return box;
    }
  }
  const boxes = Array.from(doc.querySelectorAll<HTMLElement>('[role="listbox"]')).filter(visible);
  return boxes.at(-1) ?? null;
}

/** ページに元からある選択肢らしい要素。開いたあとに増えたものだけを、このプルダウンの選択肢とみなす */
function optionLikeNow(doc: Document): Set<Element> {
  return new Set(Array.from(doc.querySelectorAll('[role="option"], [class*="option" i]')).filter((o) => visible(o)));
}

/**
 * 表示中の選択肢。react-select は選択肢に role を付けず、Ant Design の仮想リストは role="option" を見えない要素に付けるので、
 * クラス名でも探す（開く前からページにあったものは除く）
 */
function visibleOptions(el: HTMLElement, before: Set<Element>): HTMLElement[] {
  const box = listboxOf(el);
  const scope: ParentNode = box ?? el.ownerDocument;
  let opts = Array.from(scope.querySelectorAll<HTMLElement>('[role="option"]')).filter((o) => visible(o) && (box || !before.has(o)));
  if (!opts.length) {
    opts = Array.from(el.ownerDocument.querySelectorAll<HTMLElement>('[class*="option" i]')).filter(
      (o) => optionLike(o) && visible(o) && !before.has(o) && !Array.from(o.querySelectorAll('*')).some(optionLike),
    );
  }
  return opts.filter((o) => o.getAttribute('aria-disabled') !== 'true' && !o.hasAttribute('data-disabled'));
}

const optionText = (o: HTMLElement) => (o.getAttribute('title') || o.textContent || '').replace(/[​\s]+/g, ' ').trim();

async function waitFor<T>(fn: () => T | null | undefined | false, timeout: number): Promise<T | null> {
  const end = Date.now() + timeout;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(40);
  }
}

/** 一覧のスクロールできる要素（仮想リストは、スクロールしないと先の選択肢が作られない） */
function scroller(opts: HTMLElement[]): HTMLElement | null {
  let node: HTMLElement | null = opts[0]?.parentElement ?? null;
  for (let i = 0; node && i < 6; i++, node = node.parentElement) {
    // Ant Design の仮想リストは overflow: hidden で、独自のスクロールバーとホイールで動かす
    const oy = getComputedStyle(node).overflowY;
    if (node.scrollHeight > node.clientHeight + 4 && oy !== 'visible') return node;
  }
  return null;
}

async function findOption(el: HTMLElement, variants: string[], before: Set<Element>, timeout = 800): Promise<HTMLElement | null> {
  const opts = await waitFor(() => {
    const o = visibleOptions(el, before);
    return o.length ? o : null;
  }, timeout);
  if (!opts) return null;
  let current = opts;
  const box = scroller(current);
  for (let round = 0; round < 40; round++) {
    const i = pickOption(current.map(optionText), variants);
    if (i >= 0) return current[i]!;
    if (!box || box.scrollTop + box.clientHeight >= box.scrollHeight - 2) return null;
    const step = Math.max(40, box.clientHeight * 0.8);
    const shown = current.map(optionText).join('\n');
    box.scrollTop += step;
    box.dispatchEvent(new Event('scroll'));
    await sleep(60);
    current = visibleOptions(el, before);
    if (current.map(optionText).join('\n') === shown) {
      // scrollTop では描き直さない仮想リストは、ホイールで送る
      box.dispatchEvent(new WheelEvent('wheel', { deltaY: step, bubbles: true, cancelable: true }));
      await sleep(80);
      current = visibleOptions(el, before);
    }
  }
  return null;
}

/** 文字を入れて選択肢を絞り込む（検索できるプルダウン・入力候補つきの欄） */
function typeInto(input: HTMLInputElement, text: string) {
  input.focus({ preventScroll: true });
  input.value = text;
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function close(el: HTMLElement) {
  if (!listboxOf(el)) return;
  key(el, 'Escape');
}

/** 欄の見た目の範囲（react-select の input なら、選んだ値が表示される外側の要素まで） */
export function comboRoot(el: HTMLElement): HTMLElement {
  if (!(el instanceof HTMLInputElement)) return el;
  let root: HTMLElement = el;
  const labelledBy = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)
    .map((id) => el.ownerDocument.getElementById(id))
    .filter((l): l is HTMLElement => !!l && !l.contains(el));
  for (let i = 0; i < 5 && root.parentElement; i++) {
    const parent = root.parentElement;
    if (parent.querySelectorAll('input:not([type="hidden"]), select, textarea, button:not([aria-label*="clear" i])').length > 1) break;
    if ((parent.textContent ?? '').length > 80) break;
    // 見出しのラベルまで広がったら、そこは欄の外
    if (parent.querySelector('label') || labelledBy.some((l) => parent.contains(l))) break;
    root = parent;
  }
  return root;
}

/** 欄に表示されている値。プレースホルダー（「選択してください」）は除く */
export function comboText(el: HTMLElement): string {
  const root = comboRoot(el);
  const clone = root.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll('[data-placeholder], [class*="placeholder" i], [aria-hidden="true"], input, svg, [aria-label*="clear" i], [title*="clear" i], [class*="clear" i], [class*="indicator" i]')
    .forEach((n) => n.remove());
  const shown = (clone.hasAttribute('data-placeholder') ? '' : clone.textContent ?? '').replace(/[​\s]+/g, ' ').trim();
  const typed = el instanceof HTMLInputElement ? el.value.trim() : '';
  const text = typed || shown;
  if (/^[\s×✕xX▼▾▿⌄∨\-–—]*$/.test(text)) return '';
  return /^(選択してください|選択|未選択|select\.*|choose\.*|please select\.*)$/i.test(text) ? '' : text;
}

/** 候補に合う選択肢を選ぶ。選んだ選択肢の文字を返し、選べなければ null */
export async function applyCombo(el: HTMLElement, variants: string[], allowFreeText: boolean): Promise<string | null> {
  if (!variants.length || !el.isConnected) return null;
  const before = optionLikeNow(el.ownerDocument);
  const target = el instanceof HTMLInputElement ? comboRoot(el) : el;
  const isOpen = () => !!listboxOf(el) || el.getAttribute('aria-expanded') === 'true' || visibleOptions(el, before).length > 0;
  press(target);
  // 外側ではなく欄そのもののクリックで開くもの（もう一度押すと閉じるものもあるので、開いていないときだけ）
  if (target !== el && !(await waitFor(isOpen, 150))) press(el);
  if (!(await waitFor(isOpen, 400)) && !(el instanceof HTMLInputElement)) {
    // 開き方がクリックでないものは、キーボード（↓）で開く
    key(el, 'ArrowDown');
  }

  let option = await findOption(el, variants, before);
  if (!option && el instanceof HTMLInputElement && !el.readOnly) {
    // 検索できるプルダウンは、文字を入れると選択肢が絞り込まれる
    for (const v of variants.slice(0, 3)) {
      typeInto(el, v);
      option = await findOption(el, [v, ...variants], before, 500);
      if (option) break;
    }
    if (!option && allowFreeText && variants[0]) {
      // 候補にない学校名なども、自由入力できる欄なら文字のまま残す。
      // react-select などは欄を離れると文字を消すので、離れたあとも残っているときだけ入力できたとする
      typeInto(el, variants[0]);
      close(el);
      el.dispatchEvent(new FocusEvent('blur'));
      el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      el.blur();
      await sleep(150);
      return el.value === variants[0] ? variants[0] : null;
    }
    if (!option) typeInto(el, '');
  }
  if (!option) {
    close(el);
    return null;
  }

  const text = optionText(option);
  option.scrollIntoView?.({ block: 'nearest' });
  press(option);
  // 選ぶと一覧が閉じるか、欄の表示が変わる
  const ok = await waitFor(() => !option!.isConnected || !visible(option!) || sameText(comboText(el), text) || option!.getAttribute('aria-selected') === 'true', 600);
  close(el);
  if (!ok) return null;
  return text;
}

const sameText = (a: string, b: string) => !!a && normOption(a) === normOption(b);

/** 「元に戻す」：入力前に選ばれていた値に戻す。何も選ばれていなかったなら、クリアボタンを押す */
export async function restoreCombo(el: HTMLElement, before: string): Promise<void> {
  if (sameText(comboText(el), before)) return;
  if (before) {
    await applyCombo(el, [before], el instanceof HTMLInputElement);
    return;
  }
  const root = comboRoot(el).parentElement ?? comboRoot(el);
  const clear = root.querySelector<HTMLElement>(
    '[aria-label*="clear" i], [title*="clear" i], [aria-label*="クリア"], [class*="clear" i]:not([class*="clearfix" i])',
  );
  if (clear) press(clear);
  else if (el instanceof HTMLInputElement) {
    typeInto(el, '');
    // react-select などは、空の入力欄で Backspace を押すと選択が消える
    el.focus({ preventScroll: true });
    key(el, 'Backspace');
  }
  await sleep(50);
  close(el);
}

/** 欄が「選ばれた値の候補」に一致しているか（ユーザーが選び直していないか） */
export function comboStill(el: HTMLElement, value: string): boolean {
  return sameText(comboText(el), value);
}
