/**
 * jqTransform（古い jQuery のプラグイン。i-webs の応募フォームなど）は、本物の欄を class="jqTransformHidden" で隠し、
 * すぐ外側の wrapper に見た目用のプルダウン・ラジオ・チェックボックスを描く。
 * 本物の欄に入れても飾りは書きかわらないので、入れたあとに飾りの表示も合わせる
 */
const WRAPPER = '.jqTransformSelectWrapper, .jqTransformRadioWrapper, .jqTransformCheckboxWrapper';

/** jqTransform で隠された欄なら、見た目用の飾り（wrapper）を返す */
export function jqDecoy(el: Element): HTMLElement | null {
  if (!el.classList.contains('jqTransformHidden')) return null;
  return el.closest<HTMLElement>(WRAPPER);
}

/** 本物の欄の状態を、飾りの表示に写す */
export function syncJqTransform(el: HTMLElement) {
  const wrap = jqDecoy(el);
  if (!wrap) return;
  if (el instanceof HTMLSelectElement) {
    const shown = wrap.querySelector(':scope > div > span');
    if (shown) shown.textContent = el.options[el.selectedIndex]?.text ?? '';
    wrap.querySelectorAll('ul a[index]').forEach((a) => a.classList.toggle('selected', a.getAttribute('index') === String(el.selectedIndex)));
    return;
  }
  if (!(el instanceof HTMLInputElement)) return;
  // ラジオは同じ name のほかの選択肢の印も外す
  const group =
    el.type === 'radio' && el.name ? Array.from((el.form ?? el.ownerDocument).querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(el.name)}"]`)) : [el];
  for (const box of group) {
    jqDecoy(box)?.querySelector('a.jqTransformRadio, a.jqTransformCheckbox')?.classList.toggle('jqTransformChecked', box.checked);
  }
}
