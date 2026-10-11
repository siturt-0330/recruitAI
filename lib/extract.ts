export type FieldKind =
  | 'text' | 'email' | 'tel' | 'number' | 'date' | 'month' | 'select' | 'radio' | 'textarea' | 'file' | 'checkbox';

/** 扱うチェックボックスは「現住所と同じ」系だけ（同意チェックなどには触らない） */
export const SAME_AS_CURRENT = /(現住所|上記|本人|自宅)(と|に)?同(じ|一)|同上/;

/** AI・ルール判定に使う欄の特徴。ユーザーが入力済みの値は含めない */
export interface FieldDescriptor {
  id: string;
  kind: FieldKind;
  /** <label>・aria-label など、その欄専用のラベル */
  label: string;
  /** 欄の直前・直後にある短いテキスト（「姓」「年」など） */
  prefix: string;
  suffix: string;
  /** 行見出し・dt・周辺のテキスト */
  context: string;
  /** 欄が属する区切りの見出し（「帰省先」「緊急連絡先」など） */
  section: string;
  placeholder: string;
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
  /** ラジオボタンはグループ内の全要素、それ以外は1要素 */
  elements: HTMLElement[];
}

const TEXT_TYPES = new Set(['', 'text', 'email', 'tel', 'number', 'date', 'month']);
const SKIP_TEXT_PARENTS = new Set(['SELECT', 'OPTION', 'TEXTAREA', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'BUTTON']);

export function textOf(node: Node | null, limit = 120): string {
  if (!node) return '';
  const doc = node.ownerDocument ?? document;
  const walker = doc.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let out = '';
  // limit を超えたら打ち切る（呼び出し側は長さで「広すぎる範囲」を判断する）
  while (walker.nextNode() && out.length <= limit) {
    const t = walker.currentNode;
    if (t.parentElement && SKIP_TEXT_PARENTS.has(t.parentElement.tagName)) continue;
    const v = (t.nodeValue ?? '').replace(/\s+/g, ' ').trim();
    if (v) out += (out ? ' ' : '') + v;
  }
  return out;
}

function isControl(n: Node): boolean {
  return n instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(n.tagName);
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

function isCandidate(el: Element): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  if (el instanceof HTMLElement && isHoneypot(el)) return false;
  if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    return !el.disabled && !(el instanceof HTMLTextAreaElement && el.readOnly) && isVisible(el);
  }
  if (!(el instanceof HTMLInputElement) || el.disabled || el.readOnly) return false;
  const type = (el.getAttribute('type') ?? '').toLowerCase();
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
  root.querySelectorAll('input, select, textarea').forEach((el) => out.push(el));
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
    if (parent.querySelectorAll('input, select, textarea').length > 1) break;
    target = parent;
  }
  return '';
}

function adjacentText(el: HTMLElement, dir: 1 | -1, max: number): string {
  let out = '';
  let n: Node | null = dir === 1 ? el.nextSibling : el.previousSibling;
  while (n && out.length < max) {
    if (isControl(n) || (n instanceof HTMLElement && n.querySelector('input, select, textarea'))) break;
    const t = n.nodeType === Node.TEXT_NODE ? (n.nodeValue ?? '') : textOf(n, max);
    out = dir === 1 ? `${out} ${t}` : `${t} ${out}`;
    n = dir === 1 ? n.nextSibling : n.previousSibling;
  }
  out = out.replace(/\s+/g, ' ').trim();
  return dir === 1 ? out.slice(0, max) : out.slice(-max);
}

/** 表の行見出し（th）・dt・legend など、構造上の見出し */
function structuralHeader(el: HTMLElement): string {
  let node = el.parentElement;
  for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
    if (node.tagName === 'TD' || node.tagName === 'TH') {
      const row = node.parentElement;
      const header = Array.from(row?.children ?? []).find((c) => c !== node && !c.contains(el));
      const t = textOf(header ?? null, 60);
      if (t) return t;
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
  }
  return '';
}

/** 「例（111-0000）」「-」のような入力例・区切り記号は見出しにしない */
const NOT_A_HEADING = /^(例|e\.?g\.?|ex\.?)\s*[:：(（]|^[\s\-‐ー－~〜～/／:：()（）]*$/i;

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

function contextText(el: HTMLElement): string {
  // 表や dl の行見出しがあれば、近くにある入力例より優先する
  const header = structuralHeader(el);
  if (header) return header;

  let node = el.parentElement;
  for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
    // 欄自身の <label>（ラジオの「男性」など）は見出しではない
    if (node.tagName === 'LABEL') continue;
    // ほかの欄のラベルを含むところまで広がったら、その文字は別の欄の見出しなので使わない
    if (hasOtherFieldLabel(node, el)) break;
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
  let node: Element | null = el;
  for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
    let sib = node.previousElementSibling;
    for (let i = 0; sib && i < 15; i++, sib = sib.previousElementSibling) {
      if (!isHeadingLike(sib)) continue;
      const t = textOf(sib, 40);
      // 「例（111-0000）」や「※〜」の注意書きは見出しではない
      if (!t || t.length > 40 || NOT_A_HEADING.test(t) || /^[※*＊]/.test(t)) continue;
      return t;
    }
  }
  return '';
}

/** チェックボックスの文言。<label> がなくても、隣や親の要素の短いテキストを使う */
function checkboxText(el: HTMLInputElement): string {
  const parts = [labelText(el), siblingText(el, 1, 60), siblingText(el, -1, 30)];
  let node = el.parentElement;
  for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
    if (node.querySelectorAll('input, select, textarea').length > 1) break;
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
  const radioGroups = new Map<string, ScannedField>();

  for (const el of controls) {
    if (!isCandidate(el)) continue;

    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      const text = checkboxText(el);
      if (!SAME_AS_CURRENT.test(text)) continue;
      const field = makeField(el, 'checkbox');
      field.desc.label = text.trim();
      fields.push(field);
      continue;
    }

    if (el instanceof HTMLInputElement && el.type === 'radio') {
      const optionLabel = labelText(el) || siblingText(el, 1, 20) || el.value;
      const existing = el.name ? radioGroups.get(el.name) : undefined;
      if (existing) {
        existing.elements.push(el);
        existing.desc.options.push(optionLabel);
        continue;
      }
      const field = makeField(el, 'radio');
      field.desc.label = '';
      field.desc.options = [optionLabel];
      if (el.name) radioGroups.set(el.name, field);
      fields.push(field);
      continue;
    }

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

  const result = fields.filter((f) => !inLoginForm(f));
  assignGroups(result);
  return result;
}

/** ページ上部などにあるログインフォーム（ID とパスワードだけ）には入れない */
function inLoginForm(f: ScannedField): boolean {
  const form = (f.elements[0] as HTMLInputElement).form;
  if (!form) return false;
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

function makeField(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, kind: FieldKind): ScannedField {
  const maxLength = 'maxLength' in el && el.maxLength > 0 ? el.maxLength : null;
  return {
    elements: [el],
    desc: {
      id: `f${++seq}`,
      kind,
      label: labelText(el),
      prefix: siblingText(el, -1, 20),
      suffix: siblingText(el, 1, 10),
      context: contextText(el),
      section: sectionText(el),
      placeholder: el.getAttribute('placeholder') ?? '',
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
