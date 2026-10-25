import type { ScannedField } from './extract';
import { comboRoot, comboText } from './combo';
import { norm } from './japanese';

export type Snapshot =
  | { kind: 'value'; value: string }
  | { kind: 'index'; index: number }
  | { kind: 'checked'; checked: boolean[] }
  | { kind: 'files'; files: File[] };

export function takeSnapshot(field: ScannedField): Snapshot {
  const el = field.elements[0]!;
  if (field.desc.kind === 'radio' || field.desc.kind === 'checkbox') {
    return { kind: 'checked', checked: field.elements.map((r) => (r as HTMLInputElement).checked) };
  }
  if (field.desc.kind === 'file') return { kind: 'files', files: Array.from((el as HTMLInputElement).files ?? []) };
  if (el instanceof HTMLSelectElement) return { kind: 'index', index: el.selectedIndex };
  return { kind: 'value', value: (el as HTMLInputElement).value };
}

export function restoreSnapshot(field: ScannedField, snap: Snapshot) {
  const el = field.elements[0]!;
  if (snap.kind === 'checked') {
    // React などページ側で状態を持つ欄は、checked を書き換えても描き直しで元に戻されるので、まず click() で戻す。
    // ラジオは click() で外せないので、選び直すときだけ
    const boxes = field.elements as HTMLInputElement[];
    boxes.forEach((b, i) => {
      const want = snap.checked[i] ?? false;
      if (b.checked !== want && (want || b.type === 'checkbox')) b.click();
    });
    // click() で戻らなかった欄（何も選ばれていなかったラジオなど）は、これまでどおり直接書き換える
    const rest = boxes.filter((b, i) => b.checked !== (snap.checked[i] ?? false));
    if (rest.length) {
      boxes.forEach((b, i) => (b.checked = snap.checked[i] ?? false));
      rest.forEach(dispatch);
    }
    return;
  }
  if (snap.kind === 'files') (el as HTMLInputElement).files = toFileList(snap.files);
  else if (snap.kind === 'index') (el as HTMLSelectElement).selectedIndex = snap.index;
  else (el as HTMLInputElement).value = snap.value;
  dispatch(el);
}

function toFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  return dt.files;
}

function dataUrlToFile(dataUrl: string, name: string): File | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/.exec(dataUrl);
  if (!m) return null;
  const bytes = m[2] ? Uint8Array.from(atob(m[3]!), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(m[3]!));
  return new File([bytes], name, { type: m[1] });
}

/** 既にユーザーが値を入れている欄かどうか。select は初期値から変わっているときだけ入力済みとみなす */
export function hasUserValue(field: ScannedField): boolean {
  const el = field.elements[0]!;
  if (field.combo) return comboText(el) !== '';
  if (el instanceof HTMLSelectElement) {
    const opts = Array.from(el.options);
    const initial = Math.max(0, opts.findIndex((o) => o.defaultSelected));
    return el.selectedIndex >= 0 && el.selectedIndex !== initial && el.value !== '';
  }
  if (el instanceof HTMLInputElement && el.type === 'file') return (el.files?.length ?? 0) > 0;
  if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) return false;
  if (el instanceof HTMLInputElement) return el.value.trim() !== '';
  if (el instanceof HTMLTextAreaElement) return el.value.trim() !== '';
  return false;
}

/**
 * コンテンツスクリプトは isolated world で動くので、`el.value = x` は
 * ページ側（React など）の値トラッカーを更新しない。そのため input イベントで変更として扱われる。
 */
function dispatch(el: HTMLElement) {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  // キーを離したときに入力チェックや郵便番号検索をするサイトのため
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('blur'));
}

export const normOption = (s: string) => {
  // 「平成01年」と「平成1」を同じにするため、文字の中の数字の先頭の 0 も除く
  const t = norm(s).replace(/\s/g, '').replace(/[年月日]$/, '').replace(/(^|\D)0+(\d)/g, '$1$2');
  return /^\d+$/.test(t) ? String(parseInt(t, 10)) : t;
};

/** 選択肢の中から候補に合うものを探す。完全一致を優先し、なければ部分一致 */
export function pickOption(options: string[], variants: string[], exactOnly = false): number {
  const normalized = options.map(normOption);
  for (const v of variants.map(normOption)) {
    const i = normalized.indexOf(v);
    if (i >= 0) return i;
  }
  if (exactOnly) return -1;
  for (const v of variants.map(normOption)) {
    // 「1」が「10」「11」に部分一致しないよう、短い数字は部分一致させない
    if (/^\d{1,3}$/.test(v) || v.length < 2) continue;
    const i = normalized.findIndex((o) => o.includes(v));
    if (i >= 0) return i;
  }
  return -1;
}

/** 候補を順に試して欄に入力する。入力した値を返し、入力できなければ null */
export function applyValue(field: ScannedField, variants: string[]): string | null {
  if (!variants.length) return null;
  const el = field.elements[0]!;

  if (field.desc.kind === 'checkbox') {
    const box = el as HTMLInputElement;
    const want = variants[0] === 'checked';
    if (box.checked !== want) box.click();
    if (box.checked !== want) {
      box.checked = want;
      dispatch(box);
    }
    return want ? 'チェックあり' : 'チェックなし';
  }

  if (field.desc.kind === 'radio') {
    const i = pickOption(field.desc.options, variants);
    if (i < 0) return null;
    const radio = field.elements[i] as HTMLInputElement;
    if (!radio.checked) radio.click();
    if (!radio.checked) {
      radio.checked = true;
      dispatch(radio);
    }
    return field.desc.options[i] ?? null;
  }

  if (field.desc.kind === 'file') {
    const ext = /^data:image\/(\w+)/.exec(variants[0] ?? '')?.[1] ?? 'jpg';
    const file = dataUrlToFile(variants[0] ?? '', `photo.${ext === 'jpeg' ? 'jpg' : ext}`);
    if (!file) return null;
    (el as HTMLInputElement).files = toFileList([file]);
    dispatch(el);
    return '顔写真';
  }

  if (el instanceof HTMLSelectElement) {
    const opts = Array.from(el.options);
    const texts = opts.map((o) => o.text);
    // 見えている文字の完全一致を value より優先する。value は「0 始まりの月」「並び順の番号」のことがあり、
    // 和暦の年「11」などの候補が別の選択肢の value に当たってしまう
    let i = pickOption(texts, variants, true);
    if (i < 0) i = opts.findIndex((o) => o.value !== '' && variants.some((v) => normOption(o.value) === normOption(v)));
    if (i < 0) i = pickOption(texts, variants);
    const opt = opts[i];
    if (!opt || opt.disabled) return null;
    el.selectedIndex = i;
    dispatch(el);
    return opt.text.trim();
  }

  const input = el as HTMLInputElement | HTMLTextAreaElement;
  const value = pickTextValue(input, variants);
  if (value == null) return null;
  input.value = value;
  // type="number" などは不正な値を代入すると黙って空になるので、入ったか確かめる
  if (input.value !== value) return null;
  dispatch(input);
  return value;
}

/** maxlength・type="number"・pattern 属性に合う候補を選ぶ */
function pickTextValue(input: HTMLInputElement | HTMLTextAreaElement, variants: string[]): string | null {
  const max = input.maxLength > 0 ? input.maxLength : Infinity;
  let candidates = variants.filter((v) => v.length <= max);
  if (input instanceof HTMLInputElement && input.type === 'number') {
    candidates = candidates.map((v) => v.normalize('NFKC').replace(/[^\d.]/g, '')).filter((v) => /^\d+(\.\d+)?$/.test(v));
  }
  const pattern = input instanceof HTMLInputElement ? input.pattern : '';
  if (pattern) {
    try {
      const re = new RegExp(`^(?:${pattern})$`, 'v');
      const matched = candidates.find((v) => re.test(v));
      if (matched) return matched;
    } catch {
      // ページ側の pattern が壊れていても入力は続ける
    }
  }
  return candidates[0] ?? null;
}

/** オーバーレイの枠を付ける要素。非表示のラジオはラベルに付ける */
export function markTarget(field: ScannedField): HTMLElement {
  // 独自プルダウンの input は小さいことが多いので、見た目の枠に付ける
  if (field.combo) return comboRoot(field.elements[0]!);
  if (field.desc.kind === 'file') {
    const input = field.elements[0] as HTMLInputElement;
    if (input.getClientRects().length) return input;
    return Array.from(input.labels ?? []).find((l) => l.getClientRects().length) ?? input;
  }
  if (field.desc.kind !== 'radio' && field.desc.kind !== 'checkbox') return field.elements[0]!;
  const radios = field.elements as HTMLInputElement[];
  const chosen = radios.find((r) => r.checked) ?? radios[0]!;
  if (chosen.getClientRects().length) return chosen;
  return Array.from(chosen.labels ?? []).find((l) => l.getClientRects().length) ?? chosen;
}
