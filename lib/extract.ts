import { COMBO_SELECTOR, isCombo } from './combo';
import { jqDecoy } from './jqtransform';

export type FieldKind =
  | 'text' | 'email' | 'tel' | 'url' | 'number' | 'date' | 'month' | 'select' | 'radio' | 'textarea' | 'file' | 'checkbox';

/** 扱うチェックボックスは「現住所と同じ」系だけ（同意チェックなどには触らない） */
export function isSameAsCurrent(text: string): boolean {
  const t = text.replace(/\s+/g, '');
  if (/同意|メール|マガジン|配信|海外|国外/.test(t)) return false;
  // 「帰省先住所がある場合は入力して下さい。ない場合はチェックして下さい。」（snar.jp）。現住所と同じなら別の帰省先はない
  if (/(帰省|休暇).{0,40}ない場合.{0,10}チェック/.test(t)) return true;
  // 「現住所と同じ」「現在の連絡先と同じ」「上記と同一」「同上」など。
  // 住所・連絡先の話であることを必須にし、同意・メール配信・海外在住などのチェックボックスは含まない
  return /同じ|同一|同上/.test(t) && /住所|連絡先|帰省|休暇/.test(t);
}

/** AI・ルール判定に使う欄の特徴。ユーザーが入力済みの値は含めない */
export interface FieldDescriptor {
  id: string;
  kind: FieldKind;
  /** <label>・aria-label など、その欄専用のラベル */
  label: string;
  /** 欄の直前・直後にある短いテキスト（「姓」「年」など） */
  prefix: string;
  suffix: string;
  /**
   * 同じセル（td・dd）の中で、欄より前にある最後の見出しらしい文字（「年」「月」などの単位は飛ばす）。
   * 「入学年月 [年▼]年[月▼]月 / 卒業年月 [年▼]年[月▼]月」の月の欄が、どちらの年月かを見分けるのに使う
   */
  lead: string;
  /** 行見出し・dt・周辺のテキスト */
  context: string;
  /** 欄が属する区切りの見出し（「帰省先」「緊急連絡先」など） */
  section: string;
  placeholder: string;
  /**
   * 画面の見出しには出ない書式の指定：pattern・class・data-*・title・inputmode と、
   * aria-describedby・欄の下の注意書き・表の右の列の注意書き（「半角カナ」「ハイフンなし」など）
   */
  rules: string;
  name: string;
  htmlId: string;
  autocomplete: string;
  maxLength: number | null;
  /** file 欄の accept 属性 */
  accept: string;
  /** select の選択肢・ラジオボタンのラベル */
  options: string[];
  groupIndex: number;
  groupSize: number;
  /** グループの中で、同じ行（横並び）にある欄の数と、その中での位置 */
  lineIndex: number;
  lineSize: number;
}

export interface ScannedField {
  desc: FieldDescriptor;
  /** 独自デザインのプルダウン（クリックで開いて選ぶ） */
  combo?: boolean;
  /** ラジオボタンはグループ内の全要素、それ以外は1要素 */
  elements: HTMLElement[];
}

const TEXT_TYPES = new Set(['', 'text', 'email', 'tel', 'url', 'number', 'date', 'month']);
const SKIP_TEXT_PARENTS = new Set(['SELECT', 'OPTION', 'TEXTAREA', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'BUTTON']);
/** 入力欄（独自デザインのプルダウンを含む） */
const CONTROLS = `input, select, textarea, ${COMBO_SELECTOR}`;
/** 見出しやラベルを探すときに「欄がある」とみなすもの。type=hidden はサイトの裏のデータで、見出しのセルに入っていることがある（snar.jp など）ので数えない */
const VISIBLE_CONTROLS = `input:not([type="hidden"]), select, textarea, ${COMBO_SELECTOR}`;

export function textOf(node: Node | null, limit = 120): string {
  if (!node) return '';
  const doc = node.ownerDocument ?? document;
  const walker = doc.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let out = '';
  // limit を超えたら打ち切る（呼び出し側は長さで「広すぎる範囲」を判断する）
  while (walker.nextNode() && out.length <= limit) {
    const t = walker.currentNode;
    if (t.parentElement && SKIP_TEXT_PARENTS.has(t.parentElement.tagName)) continue;
    // 独自プルダウンに表示中の値・「選択してください」・jqTransform の飾りの選択肢は見出しではない
    if (t.parentElement?.closest(`${COMBO_SELECTOR}, [class*="placeholder" i], .jqTransformSelectWrapper`)) continue;
    const v = (t.nodeValue ?? '').replace(/\s+/g, ' ').trim();
    if (v) out += (out ? ' ' : '') + v;
  }
  return out;
}

function isControl(n: Node): boolean {
  return n instanceof HTMLElement && (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(n.tagName) || isCombo(n));
}

function isVisible(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden';
}

/**
 * ボット対策のダミー欄（ハニーポット）。人には見えない位置・大きさにして、入力されたらボットと判定する。
 * ここに入れると応募がはじかれるおそれがあるので触らない。
 */
function isHoneypot(el: HTMLElement): boolean {
  if (el.closest('[aria-hidden="true"]')) return true;
  if (el instanceof HTMLInputElement && /^(radio|checkbox|file)$/.test(el.type)) return false;
  // 独自デザインのプルダウンは、透明な <select> を飾りの上に重ねていることが多い
  if (el instanceof HTMLSelectElement) return false;
  if (el.tabIndex < 0) return true;
  const r = el.getBoundingClientRect();
  if (r.width <= 2 || r.height <= 2) return true;
  if (r.right + scrollX < 0 || r.bottom + scrollY < 0) return true;
  const style = getComputedStyle(el);
  return Number(style.opacity) === 0;
}

/**
 * Select2 は本物の <select> を隠し、すぐ後ろに見た目用の要素を置く。
 * Select2 は select の change を受けて表示を更新するので、隠れていても入力してよい
 */
function isSelect2Source(el: HTMLSelectElement): boolean {
  if (el.disabled || el.multiple) return false;
  const next = el.nextElementSibling;
  return el.classList.contains('select2-hidden-accessible') && next instanceof HTMLElement && next.classList.contains('select2') && isVisible(next);
}

function isCandidate(el: Element): el is HTMLElement {
  if (el instanceof HTMLSelectElement && isSelect2Source(el)) return true;
  // jqTransform で隠された欄は、飾りが見えていれば入力してよい（入れたあとに飾りも書きかえる）
  const decoy = jqDecoy(el);
  if (decoy && (el instanceof HTMLSelectElement || el instanceof HTMLInputElement)) return !el.disabled && isVisible(decoy);
  if (isCombo(el)) return !el.closest('[aria-hidden="true"]') && isVisible(el as HTMLElement) && !(el instanceof HTMLInputElement && el.disabled);
  if (el instanceof HTMLElement && isHoneypot(el)) return false;
  if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    return !el.disabled && !(el instanceof HTMLTextAreaElement && el.readOnly) && isVisible(el);
  }
  if (!(el instanceof HTMLInputElement) || el.disabled || el.readOnly) return false;
  // type 属性が大文字・未対応の値でも、el.type はブラウザが解釈した種類を返す
  const type = el.type;
  // 「現住所と同じ」チェックボックスは、本体もラベルも隠して飾りの要素で見せていることがある。
  // 扱うのは文言で絞り込んだものだけなので、見えるかどうかは問わない
  if (type === 'checkbox') return true;
  if (type === 'radio' || type === 'file') {
    // カスタムデザインのラジオやファイル欄は、本体が非表示でラベルだけ見えていることが多い
    return isVisible(el) || Array.from(el.labels ?? []).some(isVisible);
  }
  return TEXT_TYPES.has(type) && isVisible(el);
}

function collectControls(root: Document | ShadowRoot, out: Element[]) {
  root.querySelectorAll(CONTROLS).forEach((el) => out.push(el));
  root.querySelectorAll('*').forEach((el) => {
    if (el.shadowRoot) collectControls(el.shadowRoot, out);
  });
}

function labelText(el: HTMLElement): string {
  const parts: string[] = [];
  const labels = (el as HTMLInputElement).labels;
  if (labels) for (const l of Array.from(labels)) parts.push(textOf(l, 40));
  const by = el.getAttribute('aria-labelledby');
  if (by) {
    for (const id of by.split(/\s+/)) parts.push(textOf(el.ownerDocument.getElementById(id), 40));
  }
  parts.push(el.getAttribute('aria-label') ?? '', el.getAttribute('title') ?? '');
  return parts.filter(Boolean).join(' ').slice(0, 80);
}

/**
 * 直前（dir=-1）・直後（dir=1）の短いテキスト。
 * `<span>姓：</span><span><input></span>` のように欄が包まれているときは、包んでいる要素の外側も見る
 */
function siblingText(el: HTMLElement, dir: 1 | -1, max: number): string {
  let target: HTMLElement = el;
  for (let i = 0; i < 3; i++) {
    const t = adjacentText(target, dir, max);
    if (t) return t;
    const parent = target.parentElement;
    if (!parent || /^(TD|TH|DD|DT|TR|LI|FORM|BODY|FIELDSET)$/.test(parent.tagName)) break;
    if (parent.querySelectorAll(VISIBLE_CONTROLS).length > 1) break;
    target = parent;
  }
  return '';
}

function adjacentText(el: HTMLElement, dir: 1 | -1, max: number): string {
  let out = '';
  let n: Node | null = dir === 1 ? el.nextSibling : el.previousSibling;
  while (n && out.length < max) {
    if (isControl(n) || (n instanceof HTMLElement && n.querySelector(VISIBLE_CONTROLS))) break;
    const t = n.nodeType === Node.TEXT_NODE ? (n.nodeValue ?? '') : textOf(n, max);
    out = dir === 1 ? `${out} ${t}` : `${t} ${out}`;
    n = dir === 1 ? n.nextSibling : n.previousSibling;
  }
  out = out.replace(/\s+/g, ' ').trim();
  return dir === 1 ? out.slice(0, max) : out.slice(-max);
}

/** 表の列見出し（ヘッダー行の同じ位置のセル） */
function columnHeader(cell: HTMLTableCellElement): string {
  const table = cell.closest('table');
  const row = cell.parentElement as HTMLTableRowElement | null;
  if (!table || !row) return '';
  const headerRow =
    table.tHead?.rows[0] ??
    Array.from(table.rows).find((r) => r !== row && r.querySelector('th') && !r.querySelector(VISIBLE_CONTROLS));
  if (!headerRow || headerRow === row) return '';
  return textOf(headerRow.cells[cell.cellIndex] ?? null, 40);
}

/** 表の行見出し（th）・dt・legend など、構造上の見出し */
function structuralHeader(el: HTMLElement): string {
  let node = el.parentElement;
  for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
    if (node.tagName === 'TD' || node.tagName === 'TH') {
      const cell = node as HTMLTableCellElement;
      const row = cell.parentElement as HTMLTableRowElement | null;
      // 同じ行の、入力欄のないセル（ふつうは th）が行見出し。
      // 「姓｜［ ］｜名｜［ ］」のように th と欄が交互に並ぶ行もあるので、欄より手前でいちばん近い th を優先する。
      // td は「［ ］｜年｜［ ］｜月」の単位のこともあるので、これまでどおり行の最初のものを使う
      const cells = Array.from(row?.children ?? []);
      const isHeader = (c: Element) => c !== cell && !c.contains(el) && !c.querySelector(VISIBLE_CONTROLS);
      const header =
        cells.slice(0, Math.max(0, cells.indexOf(cell))).reverse().find((c) => c.tagName === 'TH' && isHeader(c)) ??
        cells.find(isHeader);
      const t = textOf(header ?? null, 60);
      if (t && !/^[\s\-‐‑‒–—―−ー－ｰ~〜～()（）]*$/.test(t)) return t;
      // 行見出しがない表（「年｜月｜学歴・職歴」のような表）は、列の見出しを使う
      const column = columnHeader(cell);
      if (column) return column;
    }
    if (node.tagName === 'DD') {
      let prev = node.previousElementSibling;
      while (prev && prev.tagName !== 'DT') prev = prev.previousElementSibling;
      const t = textOf(prev, 60);
      if (t) return t;
    }
    if (node.tagName === 'FIELDSET') {
      const t = textOf(node.querySelector('legend'), 60);
      if (t) return t;
    }
    // <div role="group" aria-labelledby="…"> の見出し（axol の「入学年月」など。年・月の欄には「年」「月」のラベルしかない）
    const labelledby = /^(group|radiogroup)$/.test(node.getAttribute('role') ?? '') ? node.getAttribute('aria-labelledby') : null;
    if (labelledby) {
      const doc = node.ownerDocument;
      const t = labelledby
        .split(/\s+/)
        .map((id) => textOf(doc.getElementById(id), 60))
        .join(' ')
        .trim();
      if (t) return t;
    }
  }
  return '';
}

/** 「例（111-0000）」「-」のような入力例・区切り記号は見出しにしない */
/**
 * 入力例と、区切りの記号だけの文字。ダッシュは見た目が同じで文字が違うものが多い（マイナビの電話番号は「–」）ので、
 * 区切りの記号を書くときは、この並び（\-‐‑‒–—―−ー－ｰ）をそろえて使う
 */
const NOT_A_HEADING = /^(例|e\.?g\.?|ex\.?)\s*[:：(（]|^[\s\-‐‑‒–—―−ー－ｰ~〜～/／:：()（）]*$/i;

/**
 * node の中に、el 以外の入力欄に紐づいた <label> があるか。
 * 同じラジオグループの選択肢のラベル（「男性」「女性」）は el の仲間なので数えない。
 */
function hasOtherFieldLabel(node: Element, el: HTMLElement): boolean {
  const radioName = el instanceof HTMLInputElement && el.type === 'radio' ? el.name : null;
  for (const label of Array.from(node.querySelectorAll('label'))) {
    const control = label.control;
    if (!control || control === el || label.contains(el)) continue;
    if (radioName && control instanceof HTMLInputElement && control.type === 'radio' && control.name === radioName) continue;
    return true;
  }
  return false;
}

/** 「設問 8」「Q3」のような、番号だけで中身のわからない行見出し */
const NUMBER_ONLY_HEADER = /^(設問|質問|問|q|question)\s*[\d０-９]+[.．:：]?$/i;

/**
 * アンケートで、欄より前に書かれた設問の文（「TOEICのスコアについて」「スコアはお持ちですか？」）。
 * 欄を含むセルの中で、欄より前にあって入力欄を含まない要素の文字を順につなげる
 */
function questionText(el: HTMLElement): string {
  const parts: string[] = [];
  let node: HTMLElement | null = el;
  for (let depth = 0; node && depth < 6; depth++) {
    for (let n = node.previousSibling; n; n = n.previousSibling) {
      // 前の設問の欄まで来たら、それより前の文字は前の設問のもの
      if (isControl(n) || (n instanceof HTMLElement && n.querySelector(VISIBLE_CONTROLS))) return finish(parts);
      const t = n.nodeType === Node.TEXT_NODE ? (n.nodeValue ?? '') : textOf(n, 80);
      if (t.trim()) parts.unshift(t.trim());
    }
    const parent: HTMLElement | null = node.parentElement;
    if (!parent || /^(TD|TH|DD|LI|FORM|BODY|FIELDSET)$/.test(parent.tagName)) break;
    node = parent;
  }
  return finish(parts);
}

const finish = (parts: string[]) => parts.join(' ').replace(/\s+/g, ' ').slice(0, 100);

function contextText(el: HTMLElement): string {
  // 表や dl の行見出しがあれば、近くにある入力例より優先する
  const header = structuralHeader(el);
  if (header && NUMBER_ONLY_HEADER.test(header.normalize('NFKC').trim())) return questionText(el) || header;
  if (header) return header;

  let node = el.parentElement;
  for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
    // 欄自身の <label>（ラジオの「男性」など）は見出しではない
    if (node.tagName === 'LABEL') continue;
    // ほかの欄のラベルを含むところまで広がったら、その文字は別の欄の見出しなので使わない
    if (hasOtherFieldLabel(node, el)) break;
    // 表全体の文字は複数の行の見出しが混ざるので使わない
    if (/^(TABLE|TBODY|THEAD|TR)$/.test(node.tagName)) break;
    const t = textOf(node, 60);
    if (t.length > 60) break;
    if (t && !NOT_A_HEADING.test(t)) return t;
  }
  return '';
}

const HEADING_TAGS = /^(H[1-6]|LEGEND|CAPTION)$/;

function isHeadingLike(el: Element): boolean {
  if (/^(SCRIPT|STYLE|TEMPLATE)$/.test(el.tagName)) return false;
  if (el.querySelector('input, select, textarea, button')) return false;
  if (HEADING_TAGS.test(el.tagName)) return true;
  // 入力欄のない1セルの行（<tr><th colspan="2">帰省先</th></tr>）
  if (el.tagName === 'TR') return el.children.length === 1;
  if (/title|ttl|heading|head|caption|section|midashi/i.test(el.className?.toString() ?? '')) return true;
  // クラス名のない <div>休暇中の連絡先</div> のような短い見出し
  return /^(DIV|P|SPAN|STRONG|B|DT)$/.test(el.tagName) && textOf(el, 30).length <= 20;
}

/** 前方にある見出し（h3「帰省先」など）。帰省先・緊急連絡先のような区切りの判定に使う */
function sectionText(el: HTMLElement): string {
  // 欄の入った dd の手前の dt は、その欄の見出し（「郵便番号」）で、区切りの見出しではない
  const ownDd = el.closest('dd');
  let node: Element | null = el;
  for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
    let sib = node.previousElementSibling;
    for (let i = 0; sib && i < 15; i++, sib = sib.previousElementSibling) {
      if (node === ownDd && sib.tagName === 'DT') continue;
      if (!isHeadingLike(sib)) continue;
      // 先頭の「*」は必須の印（「*出身高校名を入力してください。」）なので外して見る
      const t = textOf(sib, 40).replace(/^[*＊]\s*/, '');
      // 「例（111-0000）」や「※〜」の注意書きは見出しではない
      if (!t || t.length > 40 || NOT_A_HEADING.test(t) || /^※/.test(t)) continue;
      return t;
    }
  }
  return '';
}

/** 単位や区切りの記号だけの文字（見出しとしては使わない） */
const UNIT_ONLY = /^[\s年月日時分\-‐–—―−ー－~〜～/／:：()（）]*$/;

/** 同じセルの中で、欄より前にある最後の見出しらしい文字（FieldDescriptor.lead） */
function leadText(el: HTMLElement): string {
  const cell = el.closest('td, th, dd, li');
  if (!cell) return '';
  const walker = (el.ownerDocument ?? document).createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  let last = '';
  while (walker.nextNode()) {
    const t = walker.currentNode;
    // 欄より後ろの文字は見ない
    if (el.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) break;
    const parent = t.parentElement;
    if (!parent || SKIP_TEXT_PARENTS.has(parent.tagName) || parent.closest(`${COMBO_SELECTOR}, .jqTransformSelectWrapper`)) continue;
    const v = (t.nodeValue ?? '').replace(/\s+/g, ' ').trim();
    if (v && !UNIT_ONLY.test(v)) last = v;
  }
  return last.slice(-20);
}

/** チェックボックスの文言。<label> がなくても、隣や親の要素の短いテキストを使う */
function checkboxText(el: HTMLInputElement): string {
  const parts = [labelText(el), siblingText(el, 1, 60), siblingText(el, -1, 30)];
  let node = el.parentElement;
  for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
    if (node.querySelectorAll(VISIBLE_CONTROLS).length > 1) break;
    const t = textOf(node, 100);
    if (t && t.length <= 100) parts.push(t);
  }
  return parts.filter(Boolean).join(' ').slice(0, 160);
}

let seq = 0;

export function scanFields(doc: Document): ScannedField[] {
  const controls: Element[] = [];
  collectControls(doc, controls);

  const fields: ScannedField[] = [];
  const radioGroups = new Map<string | Element, ScannedField>();

  for (const el of controls) {
    if (!isCandidate(el)) continue;

    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      const text = checkboxText(el);
      // 「上記と同じ」だけの文言でも、見出しが「休暇中の連絡先」なら対象にする
      if (!isSameAsCurrent(`${text} ${sectionText(el)} ${contextText(el)}`) || !isSameAsCurrent(`${text} 住所`)) continue;
      const field = makeField(el, 'checkbox');
      field.desc.label = text.trim();
      fields.push(field);
      continue;
    }

    if (el instanceof HTMLInputElement && el.type === 'radio') {
      const optionLabel = labelText(el) || siblingText(el, 1, 20) || el.value;
      const group = radioGroupKey(el);
      const existing = group ? radioGroups.get(group) : undefined;
      if (existing) {
        existing.elements.push(el);
        existing.desc.options.push(optionLabel);
        continue;
      }
      const field = makeField(el, 'radio');
      field.desc.label = '';
      field.desc.options = [optionLabel];
      if (group) radioGroups.set(group, field);
      fields.push(field);
      continue;
    }

    if (isCombo(el)) {
      // 選択肢は開くまで分からないので、見出しだけで判定する
      const field = makeField(el, 'select');
      field.combo = true;
      fields.push(field);
      continue;
    }
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) continue;

    const kind: FieldKind =
      el instanceof HTMLSelectElement
        ? 'select'
        : el instanceof HTMLTextAreaElement
          ? 'textarea'
          : el.type === 'file'
            ? 'file'
            : ((el.type || 'text') as FieldKind);
    const field = makeField(el, kind);
    if (el instanceof HTMLSelectElement) {
      field.desc.options = Array.from(el.options)
        .map((o) => o.text.trim())
        .slice(0, 150);
    }
    fields.push(field);
  }

  // フォームごとに1回だけ調べる
  const login = new Map<HTMLFormElement, boolean>();
  const result = fields.filter((f) => !inLoginForm(f, login));
  assignGroups(result);
  return result;
}

/**
 * ラジオボタンのグループ。ふつうは name でまとめるが、Vue の v-model などは name を付けないので、
 * 同じ行（表の行・fieldset・radiogroup など）に並ぶ name なしのラジオを1つのグループにする
 */
function radioGroupKey(el: HTMLInputElement): string | Element | null {
  if (el.name) return el.name;
  return el.closest('[role="radiogroup"], fieldset, tr, dd, li') ?? el.closest('label')?.parentElement ?? el.parentElement;
}

/** ページ上部などにあるログインフォーム（ID とパスワードだけ）には入れない */
function inLoginForm(f: ScannedField, cache: Map<HTMLFormElement, boolean>): boolean {
  const form = (f.elements[0] as HTMLInputElement).form;
  if (!form) return false;
  let v = cache.get(form);
  if (v === undefined) cache.set(form, (v = isLoginForm(form)));
  return v;
}

function isLoginForm(form: HTMLFormElement): boolean {
  // 会員登録はパスワードと確認用の2つがあることが多いので、パスワード欄が1つのときだけ
  if (form.querySelectorAll('input[type="password"]').length !== 1) return false;
  const textInputs = Array.from(form.querySelectorAll('input')).filter((el) =>
    /^(text|email|tel|)$/.test((el.getAttribute('type') ?? '').toLowerCase()),
  );
  if (textInputs.length > 2) return false;
  // ID とパスワードだけなら、文言がなくてもログインフォーム
  if (textInputs.length <= 1) return true;
  const words = `${textOf(form, 200)} ${Array.from(form.querySelectorAll('button, input[type=submit]'))
    .map((b) => (b as HTMLInputElement).value || b.textContent)
    .join(' ')}`;
  return /ログイン|サインイン|login|log in|sign ?in/i.test(words);
}

/** 注意書きらしい要素（欄の下の small・help など） */
const NOTE = /^(SMALL|P|SPAN|DIV)$/;
const NOTE_CLASS = /note|help|hint|caution|example|annotation|desc|attention|guide|form-text|chui|ex\b/i;

function rulesText(el: HTMLElement): string {
  const parts: string[] = [];
  for (const a of ['pattern', 'class', 'title', 'inputmode', 'data-validation', 'data-rule', 'data-vv-rules', 'data-parsley-pattern', 'data-parsley-type']) {
    const v = el.getAttribute(a);
    if (v) parts.push(v);
  }
  for (const a of Array.from(el.attributes)) if (/^data-(rule|parsley|validate|valid)/.test(a.name)) parts.push(a.name, a.value);
  const doc = el.ownerDocument;
  for (const id of (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)) parts.push(textOf(doc.getElementById(id), 80));
  // 欄（またはそれを包む label）のすぐ後ろの注意書き
  const host = el.closest('label') ?? el;
  for (let n = host.nextElementSibling, i = 0; n && i < 2; n = n.nextElementSibling, i++) {
    if (n.matches(CONTROLS) || n.querySelector(CONTROLS)) break;
    if (NOTE.test(n.tagName) && (n.tagName === 'SMALL' || NOTE_CLASS.test(n.className))) parts.push(textOf(n, 80));
  }
  // 3 列の表：見出し・欄・注意書き。欄のセルの右の、欄のないセル
  const cell = el.closest('td, dd');
  const next = cell?.nextElementSibling;
  if (next && /^(TD|DD)$/.test(next.tagName) && !next.querySelector(CONTROLS)) parts.push(textOf(next, 80));
  return parts.join(' ');
}

function makeField(el: HTMLElement, kind: FieldKind): ScannedField {
  const maxLength = 'maxLength' in el && typeof el.maxLength === 'number' && el.maxLength > 0 ? el.maxLength : null;
  return {
    elements: [el],
    desc: {
      id: `f${++seq}`,
      kind,
      label: labelText(el),
      prefix: siblingText(el, -1, 20),
      suffix: siblingText(el, 1, 10),
      lead: leadText(el),
      context: contextText(el),
      section: sectionText(el),
      placeholder: el.getAttribute('placeholder') ?? '',
      rules: rulesText(el),
      name: el.getAttribute('name') ?? '',
      htmlId: el.id,
      autocomplete: el.getAttribute('autocomplete') ?? '',
      maxLength,
      accept: el.getAttribute('accept') ?? '',
      options: [],
      groupIndex: 0,
      groupSize: 1,
      lineIndex: 0,
      lineSize: 1,
    },
  };
}

/** 同じ見出しの下に並ぶ欄（姓・名、年・月・日など）をグループにまとめる */
function assignGroups(fields: ScannedField[]) {
  let start = 0;
  for (let i = 1; i <= fields.length; i++) {
    const prev = fields[i - 1]!.desc;
    const cur = fields[i]?.desc;
    // 見出しが同じでも、別の行（別の表の「郵便番号」など）にある欄は同じグループにしない
    const same =
      cur &&
      cur.context &&
      cur.context === prev.context &&
      sameFamily(cur.kind, prev.kind) &&
      // 「内線」の欄は電話番号の3分割に含めない
      !/内線|\bext\b/i.test(`${cur.prefix} ${cur.label}`) &&
      rowOf(fields[i]!.elements[0]!) === rowOf(fields[i - 1]!.elements[0]!);
    if (same) continue;
    const size = i - start;
    const group = fields.slice(start, i);
    group.forEach((f, j) => {
      f.desc.groupIndex = j;
      f.desc.groupSize = size;
    });
    assignLines(group);
    start = i;
  }
}

/** 欄が属する「行」（表の行・dd・リスト項目・行らしい div など） */
function rowOf(el: HTMLElement): Element | null {
  // 表やリストの構造を優先する（入力欄ごとの小さな包み要素を「行」と取り違えないように）
  return (
    el.closest('tr, dd, li, fieldset') ??
    el.closest('p, [class*="row" i], [class*="group" i]') ??
    el.parentElement?.parentElement ??
    null
  );
}

/**
 * グループ内の欄を見た目の行ごとに分ける。
 * ［taro］@［example.com］のような横並びと、「入力」「確認用」の縦並びを区別するため。
 */
function assignLines(group: ScannedField[]) {
  const tops = group.map((f) => {
    const r = f.elements[0]!.getBoundingClientRect();
    return r.top + r.height / 2;
  });
  let lineStart = 0;
  for (let j = 1; j <= group.length; j++) {
    if (j < group.length && Math.abs(tops[j]! - tops[j - 1]!) < 10) continue;
    for (let k = lineStart; k < j; k++) {
      group[k]!.desc.lineIndex = k - lineStart;
      group[k]!.desc.lineSize = j - lineStart;
    }
    lineStart = j;
  }
}

function sameFamily(a: FieldKind, b: FieldKind) {
  const fam = (k: FieldKind) => (k === 'select' || k === 'radio' ? 'choice' : 'text');
  return fam(a) === fam(b);
}

/** AI に渡すフォームの説明文。値は含めない */
export function describeForm(fields: ScannedField[]): string {
  const q = (s: string) => JSON.stringify(s);
  const lines = fields.map(({ desc: d }) => {
    const parts = [`[${d.id}] 種類:${d.kind}`];
    if (d.label) parts.push(`ラベル:${q(d.label)}`);
    if (d.context) parts.push(`見出し:${q(d.context)}`);
    if (d.section && d.section !== d.context) parts.push(`区切り:${q(d.section)}`);
    if (d.prefix) parts.push(`直前:${q(d.prefix)}`);
    if (d.suffix) parts.push(`直後:${q(d.suffix)}`);
    if (d.placeholder) parts.push(`placeholder:${q(d.placeholder)}`);
    if (d.name) parts.push(`name:${q(d.name)}`);
    if (d.htmlId) parts.push(`id:${q(d.htmlId)}`);
    if (d.autocomplete) parts.push(`autocomplete:${q(d.autocomplete)}`);
    if (d.maxLength) parts.push(`maxlength:${d.maxLength}`);
    if (d.groupSize > 1) parts.push(`グループ内 ${d.groupIndex + 1}/${d.groupSize}番目`);
    if (d.options.length) {
      const opts = d.options.length > 12 ? [...d.options.slice(0, 6), '…', ...d.options.slice(-3)] : d.options;
      parts.push(`選択肢(${d.options.length}件):${q(opts.join(' / '))}`);
    }
    return parts.join(' ');
  });
  return `日本語の応募フォームの入力欄一覧です。上から画面の表示順に並んでいます。\n${lines.join('\n')}`;
}
