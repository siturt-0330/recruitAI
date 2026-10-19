/**
 * ログイン画面の ID 欄・パスワード欄を見つけて、読んだり入れたりする。
 */

const visible = (el: HTMLElement) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[aria-hidden="true"]');

const USER_TYPES = new Set(['', 'text', 'email', 'tel']);

export interface LoginFields {
  user: HTMLInputElement | null;
  pass: HTMLInputElement;
}

/** 見えているパスワード欄と、その直前にある ID 欄（メール・会員番号など） */
export function findLoginFields(doc: Document): LoginFields | null {
  const inputs = Array.from(doc.querySelectorAll('input')).filter((el) => !el.disabled && visible(el));
  const pass = inputs.find((el) => el.type === 'password');
  if (!pass) return null;
  const scope = inputs.filter((el) => !pass.form || el.form === pass.form);
  const before = scope.slice(0, scope.indexOf(pass)).filter((el) => USER_TYPES.has(el.type));
  const user =
    before.find((el) => el.autocomplete === 'username' || /user|login|mail|id/i.test(`${el.name} ${el.id}`)) ?? before[before.length - 1] ?? null;
  return { user, pass };
}

/**
 * React などの画面でも値が反映されるように、ネイティブの setter で入れてイベントを送る。
 */
export function setNativeValue(el: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
