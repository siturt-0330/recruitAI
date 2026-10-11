export type FieldKind = 'text' | 'email' | 'tel' | 'number' | 'date' | 'month' | 'select' | 'radio' | 'textarea';

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
  placeholder: string;
  name: string;
  htmlId: string;
  autocomplete: string;
  maxLength: number | null;
  /** select の選択肢・ラジオボタンのラベル */
  options: string[];
  groupIndex: number;
  groupSize: number;
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

function isCandidate(el: Element): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    return !el.disabled && !(el instanceof HTMLTextAreaElement && el.readOnly) && isVisible(el);
  }
  if (!(el instanceof HTMLInputElement) || el.disabled || el.readOnly) return false;
  const type = (el.getAttribute('type') ?? '').toLowerCase();
  if (type === 'radio') {
    // カスタムデザインのラジオは本体が非表示でラベルだけ見えていることが多い
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

/** 直前（dir=-1）・直後（dir=1）の兄弟ノードにある短いテキスト */
function siblingText(el: HTMLElement, dir: 1 | -1, max: number): string {
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

function contextText(el: HTMLElement): string {
  let node = el.parentElement;
  for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
    // 欄自身の <label>（ラジオの「男性」など）は見出しではない
    if (node.tagName === 'LABEL') continue;
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
    const t = textOf(node, 60);
    if (t.length > 60) break;
    if (t) return t;
  }
  return '';
}

let seq = 0;

export function scanFields(doc: Document): ScannedField[] {
  const controls: Element[] = [];
  collectControls(doc, controls);

  const fields: ScannedField[] = [];
  const radioGroups = new Map<string, ScannedField>();

  for (const el of controls) {
    if (!isCandidate(el)) continue;

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
          : ((el.type || 'text') as FieldKind);
    const field = makeField(el, kind);
    if (el instanceof HTMLSelectElement) {
      field.desc.options = Array.from(el.options)
        .map((o) => o.text.trim())
        .slice(0, 150);
    }
    fields.push(field);
  }

  assignGroups(fields);
  return fields;
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
      placeholder: el.getAttribute('placeholder') ?? '',
      name: el.getAttribute('name') ?? '',
      htmlId: el.id,
      autocomplete: el.getAttribute('autocomplete') ?? '',
      maxLength,
      options: [],
      groupIndex: 0,
      groupSize: 1,
    },
  };
}

/** 同じ見出しの下に並ぶ欄（姓・名、年・月・日など）をグループにまとめる */
function assignGroups(fields: ScannedField[]) {
  let start = 0;
  for (let i = 1; i <= fields.length; i++) {
    const prev = fields[i - 1]!.desc;
    const cur = fields[i]?.desc;
    const same = cur && cur.context && cur.context === prev.context && sameFamily(cur.kind, prev.kind);
    if (same) continue;
    const size = i - start;
    for (let j = start; j < i; j++) {
      fields[j]!.desc.groupIndex = j - start;
      fields[j]!.desc.groupSize = size;
    }
    start = i;
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
