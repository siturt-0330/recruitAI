import type { ScannedField } from './extract';
import { norm } from './japanese';

export type Snapshot = { kind: 'value'; value: string } | { kind: 'index'; index: number } | { kind: 'checked'; checked: boolean[] };

export function takeSnapshot(field: ScannedField): Snapshot {
  const el = field.elements[0]!;
  if (field.desc.kind === 'radio') {
    return { kind: 'checked', checked: field.elements.map((r) => (r as HTMLInputElement).checked) };
  }
  if (el instanceof HTMLSelectElement) return { kind: 'index', index: el.selectedIndex };
  return { kind: 'value', value: (el as HTMLInputElement).value };
}

export function restoreSnapshot(field: ScannedField, snap: Snapshot) {
  const el = field.elements[0]!;
  if (snap.kind === 'checked') {
    field.elements.forEach((r, i) => ((r as HTMLInputElement).checked = snap.checked[i] ?? false));
    field.elements.forEach(dispatch);
    return;
  }
  if (snap.kind === 'index') (el as HTMLSelectElement).selectedIndex = snap.index;
  else (el as HTMLInputElement).value = snap.value;
  dispatch(el);
}

/** 既にユーザーが値を入れている欄かどうか（テキスト系のみ。select は初期値が入っていることが多いので見ない） */
export function hasUserValue(field: ScannedField): boolean {
  const el = field.elements[0]!;
  if (el instanceof HTMLInputElement && el.type !== 'radio') return el.value.trim() !== '';
  if (el instanceof HTMLTextAreaElement) return el.value.trim() !== '';
  return false;
}

/**
 * コンテンツスクリプトは isolated world で動くので、`el.value = x` は
 * ページ側（React など）の値トラッカーを更新しない。そのため input イベントで変更として扱われる。
 */
function dispatch(el: HTMLElement) {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('blur'));
}

const normOption = (s: string) => {
  const t = norm(s).replace(/\s/g, '').replace(/[年月日]$/, '');
  return /^\d+$/.test(t) ? String(parseInt(t, 10)) : t;
};

/** 選択肢の中から候補に合うものを探す。完全一致を優先し、なければ部分一致 */
function pickOption(options: string[], variants: string[]): number {
  const normalized = options.map(normOption);
  for (const v of variants.map(normOption)) {
    const i = normalized.indexOf(v);
    if (i >= 0) return i;
  }
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

  if (el instanceof HTMLSelectElement) {
    const opts = Array.from(el.options);
    const byValue = opts.findIndex((o) => variants.some((v) => normOption(o.value) === normOption(v)));
    const i = byValue >= 0 ? byValue : pickOption(opts.map((o) => o.text), variants);
    const opt = opts[i];
    if (!opt || opt.disabled) return null;
    el.selectedIndex = i;
    dispatch(el);
    return opt.text.trim();
  }

  const input = el as HTMLInputElement | HTMLTextAreaElement;
  const max = input.maxLength > 0 ? input.maxLength : Infinity;
  const value = variants.find((v) => v.length <= max);
  if (value == null) return null;
  input.value = value;
  dispatch(input);
  return value;
}

/** オーバーレイの枠を付ける要素。非表示のラジオはラベルに付ける */
export function markTarget(field: ScannedField): HTMLElement {
  if (field.desc.kind !== 'radio') return field.elements[0]!;
  const radios = field.elements as HTMLInputElement[];
  const chosen = radios.find((r) => r.checked) ?? radios[0]!;
  if (chosen.getClientRects().length) return chosen;
  return Array.from(chosen.labels ?? []).find((l) => l.getClientRects().length) ?? chosen;
}
