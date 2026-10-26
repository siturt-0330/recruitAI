import { PREFECTURES } from '../../../lib/prefectures';
import type { Case } from '../cases';

/**
 * 見た目は同じでも、フレームワークの状態・イベントの受け方・タイミングが違うフォーム。
 * 実サイトでは「画面には値が出ているのに、送信される値（フレームワークの状態）が空」になるのがいちばん困るので、
 * 状態を <input type="hidden" id="…-s"> に写して確かめる（hidden は「元に戻す」の確認にも入る）。
 * 実際のフレームワークは使わず、それぞれのイベントの受け方だけをまねる。
 */

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const opts = (items: (string | [string, string])[], empty = '選択してください') =>
  [`<option value="">${empty}</option>`, ...items.map((o) => (Array.isArray(o) ? `<option value="${o[0]}">${o[1]}</option>` : `<option>${o}</option>`))].join('');
/** フレームワークの状態の写し */
const mirrors = (...ids: string[]) => ids.map((id) => `<input type="hidden" id="${id}">`).join('');
const $ = <T extends Element = HTMLInputElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
const toKatakana = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
const toFull = (s: string) => s.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
const later = (ms: number, fn: () => void) => window.setTimeout(fn, ms);

type TextEl = HTMLInputElement | HTMLTextAreaElement;

/**
 * React の inputValueTracking と同じ仕組み：要素自身に value のアクセサを置き、JS から代入された値を覚えておく。
 * input / change イベントで、覚えた値と今の値が違うときだけ onChange が呼ばれる。
 * （拡張機能の isolated world からは、この要素自身のアクセサは見えない）
 */
function track(el: TextEl) {
  const d = Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!;
  const read = () => d.get!.call(el) as string;
  let tracked = read();
  Object.defineProperty(el, 'value', {
    configurable: true,
    get() {
      return d.get!.call(this);
    },
    set(v: string) {
      tracked = String(v);
      d.set!.call(this, v);
    },
  });
  return {
    read,
    /** 値が変わっていれば true（React の updateValueIfChanged） */
    changed() {
      const cur = read();
      if (cur === tracked) return false;
      tracked = cur;
      return true;
    },
  };
}

interface ReactField {
  sel: string;
  mirror: string;
  onChange?(v: string): string;
  onBlur?(v: string): string;
}

/** React の制御コンポーネント（uncontrolled なら react-hook-form の register 風：DOM はそのまま、状態だけ持つ） */
function reactForm(root: HTMLElement, fields: ReactField[], uncontrolled = false) {
  const state = new Map<ReactField, string>();
  const els = fields.map((f) => $<TextEl>(root, f.sel));
  // 状態が変わるたびに、コンポーネント全体を描き直す（制御コンポーネントは DOM を状態に合わせる）
  const render = () =>
    fields.forEach((f, i) => {
      const v = state.get(f) ?? '';
      $(root, `#${f.mirror}`).value = v;
      if (!uncontrolled && els[i]!.value !== v) els[i]!.value = v;
    });
  fields.forEach((f, i) => {
    const el = els[i]!;
    const t = track(el);
    const on = () => {
      if (!t.changed()) return;
      state.set(f, f.onChange ? f.onChange(t.read()) : t.read());
      render();
    };
    el.addEventListener('input', on);
    el.addEventListener('change', on);
    // React の onBlur は focusout で動く
    if (f.onBlur) el.addEventListener('focusout', () => (state.set(f, f.onBlur!(state.get(f) ?? '')), render()));
  });
}

/** Vue 3 の v-model（vModelText）。lazy は change、composition 中の input は無視、描き直しはマイクロタスク */
function vModel(el: HTMLInputElement, mirror: HTMLInputElement, mod: { lazy?: boolean; trim?: boolean; number?: boolean } = {}) {
  const x = el as HTMLInputElement & { composing?: boolean };
  let state: string | number = '';
  const update = () => {
    if (x.composing) return;
    const v = String(state);
    if (el.value !== v) el.value = v;
  };
  el.addEventListener('compositionstart', () => (x.composing = true));
  el.addEventListener('compositionend', () => {
    x.composing = false;
    el.dispatchEvent(new Event('input'));
  });
  el.addEventListener(mod.lazy ? 'change' : 'input', () => {
    if (x.composing) return;
    let v: string | number = el.value;
    if (mod.trim) v = v.trim();
    if (mod.number) {
      const n = parseFloat(v);
      v = Number.isNaN(n) ? v : n;
    }
    state = v;
    mirror.value = String(state);
    queueMicrotask(update);
  });
  if (mod.trim) el.addEventListener('change', () => (el.value = el.value.trim()));
}

/**
 * 欄を描き直すとき、要素ごと作り直すフォーム（React の key が変わる・条件で別の要素を出す）。
 * 回帰テストは「元に戻す」で stage の中の欄を入力前と比べるが、作り直した欄は入力前には無いので、
 * フォーム本体は stage のすぐ外に置き、状態の写し（hidden）だけを stage に置く。stage が空になったら片付ける。
 */
function outside(root: HTMLElement, html: string): HTMLElement {
  const marker = root.firstElementChild;
  const box = document.createElement('div');
  box.innerHTML = html;
  root.after(box);
  const mo = new MutationObserver(() => {
    if (marker && root.contains(marker)) return;
    box.remove();
    mo.disconnect();
  });
  mo.observe(root, { childList: true });
  return box;
}

/** 入力したら状態を持つだけの欄（Vue の v-model 相当）。作り直す欄で使う */
function bindState(el: HTMLInputElement, mirror: HTMLInputElement, state: Record<string, string>, key: string) {
  el.value = state[key] ?? '';
  el.addEventListener('input', () => {
    // 外された古い要素のイベントは、フレームワークに届かない（React のルートのリスナーまで上がらない）
    if (!el.isConnected) return;
    state[key] = el.value;
    mirror.value = el.value;
  });
}

export const CASES: Case[] = [
  // ---- React（値トラッカー・制御コンポーネント） ----
  {
    name: 'F-R1 React の制御コンポーネント（姓・名・メール）で状態にも値が入る',
    html: `<form><table>
      <tr><th>姓</th><td><input name="fr1a"></td></tr>
      <tr><th>名</th><td><input name="fr1b"></td></tr>
      <tr><th>メールアドレス</th><td><input name="fr1c" type="email"></td></tr>
    </table></form>${mirrors('fr1a-s', 'fr1b-s', 'fr1c-s')}`,
    setup(root) {
      reactForm(root, [
        { sel: '[name=fr1a]', mirror: 'fr1a-s' },
        { sel: '[name=fr1b]', mirror: 'fr1b-s' },
        { sel: '[name=fr1c]', mirror: 'fr1c-s' },
      ]);
    },
    expect: {
      '[name=fr1a]': '山田',
      '[name=fr1b]': '太郎',
      '[name=fr1c]': 'taro@example.com',
      '#fr1a-s': '山田',
      '#fr1b-s': '太郎',
      '#fr1c-s': 'taro@example.com',
    },
  },
  {
    name: 'F-R2 React の onChange で数字以外を消す電話番号',
    html: `<form><label>電話番号 <input name="fr2" type="tel"></label></form>${mirrors('fr2-s')}`,
    setup(root) {
      reactForm(root, [{ sel: '[name=fr2]', mirror: 'fr2-s', onChange: (v) => v.replace(/\D/g, '') }]);
    },
    expect: { '[name=fr2]': '09012345678', '#fr2-s': '09012345678' },
  },
  {
    name: 'F-R3 React の onBlur で形式を確かめ、正しくないメールアドレスは空にする',
    html: `<form><label>メールアドレス <input name="fr3"></label></form>${mirrors('fr3-s')}`,
    setup(root) {
      reactForm(root, [{ sel: '[name=fr3]', mirror: 'fr3-s', onBlur: (v) => (/^[^@\s]+@[^@\s]+\.\w+$/.test(v.trim()) ? v.trim() : '') }]);
    },
    expect: { '[name=fr3]': 'taro@example.com', '#fr3-s': 'taro@example.com' },
  },
  {
    name: 'F-R4 react-hook-form 風の非制御の欄（DOM は残るが、送信される状態は onChange だけで作られる）',
    html: `<form><table>
      <tr><th>氏名</th><td><input name="fr4a"></td></tr>
      <tr><th>フリガナ</th><td><input name="fr4b"></td></tr>
    </table></form>${mirrors('fr4a-s', 'fr4b-s')}`,
    setup(root) {
      reactForm(
        root,
        [
          { sel: '[name=fr4a]', mirror: 'fr4a-s' },
          { sel: '[name=fr4b]', mirror: 'fr4b-s' },
        ],
        true,
      );
    },
    expect: { '[name=fr4a]': '山田　太郎', '[name=fr4b]': 'ヤマダ　タロウ', '#fr4a-s': '山田　太郎', '#fr4b-s': 'ヤマダ　タロウ' },
  },
  {
    name: 'F-R5 React の onKeyDown で数字以外のキーを止める郵便番号（keydown は来ない）',
    html: `<form><label>郵便番号（半角数字のみ） <input name="fr5" inputmode="numeric"></label></form>${mirrors('fr5-s')}`,
    setup(root) {
      const el = $(root, '[name=fr5]');
      el.addEventListener('keydown', (e) => {
        if (e.key.length === 1 && !/\d/.test(e.key)) e.preventDefault();
      });
      reactForm(root, [{ sel: '[name=fr5]', mirror: 'fr5-s' }]);
    },
    expect: { '[name=fr5]': '1500041', '#fr5-s': '1500041' },
  },
  {
    name: 'F-R6 React のラジオ（click で状態・change で描き直し）と select（change）',
    html: `<form><table>
      <tr><th>性別</th><td><label><input type="radio" name="fr6g" value="男性">男性</label><label><input type="radio" name="fr6g" value="女性">女性</label></td></tr>
      <tr><th>都道府県</th><td><select name="fr6p">${opts(PREFECTURES)}</select></td></tr>
    </table></form>${mirrors('fr6g-s', 'fr6p-s')}`,
    setup(root) {
      const radios = Array.from(root.querySelectorAll<HTMLInputElement>('[name=fr6g]'));
      const sel = $<HTMLSelectElement>(root, '[name=fr6p]');
      const s = { g: '', p: '' };
      const render = () => {
        radios.forEach((r) => (r.checked = r.value === s.g));
        if (sel.value !== s.p) sel.value = s.p;
        $(root, '#fr6g-s').value = s.g;
        $(root, '#fr6p-s').value = s.p;
      };
      radios.forEach((r) => {
        r.addEventListener('click', () => (s.g = r.value));
        r.addEventListener('change', () => queueMicrotask(render));
      });
      sel.addEventListener('change', () => {
        s.p = sel.value;
        render();
      });
    },
    expect: { 'radio:fr6g': '男性', '[name=fr6p]': '東京都', '#fr6g-s': '男性', '#fr6p-s': '東京都' },
  },
  {
    name: 'F-R7 React の type="date" の生年月日',
    html: `<form><label>生年月日 <input name="fr7" type="date"></label></form>${mirrors('fr7-s')}`,
    setup(root) {
      reactForm(root, [{ sel: '[name=fr7]', mirror: 'fr7-s' }]);
    },
    expect: { '[name=fr7]': '1999-04-01', '#fr7-s': '1999-04-01' },
  },
  {
    name: 'F-P1 Preact 風：描き直しがマイクロタスクで、イベントのたびに前回の描画時の状態から作り直す',
    html: `<form><table>
      <tr><th>姓</th><td><input name="fp1a"></td></tr>
      <tr><th>名</th><td><input name="fp1b"></td></tr>
      <tr><th>メールアドレス</th><td><input name="fp1c"></td></tr>
    </table></form>${mirrors('fp1a-s', 'fp1b-s', 'fp1c-s')}`,
    setup(root) {
      // const [form, setForm] = useState({}); onInput={e => setForm({ ...form, [name]: e.target.value })}
      const names = ['fp1a', 'fp1b', 'fp1c'];
      let state: Record<string, string> = {};
      let rendered = state;
      let queued = false;
      const render = () => {
        queued = false;
        rendered = state;
        for (const n of names) {
          const el = $(root, `[name=${n}]`);
          const m = $(root, `#${n}-s`);
          if (!el || !m) return;
          const v = state[n] ?? '';
          if (el.value !== v) el.value = v;
          m.value = v;
        }
      };
      for (const n of names) {
        const el = $(root, `[name=${n}]`);
        el.addEventListener('input', () => {
          state = { ...rendered, [n]: el.value };
          if (!queued) {
            queued = true;
            queueMicrotask(render);
          }
        });
      }
    },
    expect: {
      '[name=fp1a]': '山田',
      '[name=fp1b]': '太郎',
      '[name=fp1c]': 'taro@example.com',
      '#fp1a-s': '山田',
      '#fp1b-s': '太郎',
      '#fp1c-s': 'taro@example.com',
    },
  },

  // ---- Vue ----
  {
    name: 'F-V1 Vue の v-model（input）で姓・名・セイ・メイ',
    html: `<form><table>
      <tr><th>氏名</th><td>姓 <input name="fv1a"> 名 <input name="fv1b"></td></tr>
      <tr><th>フリガナ</th><td>セイ <input name="fv1c"> メイ <input name="fv1d"></td></tr>
    </table></form>${mirrors('fv1a-s', 'fv1b-s', 'fv1c-s', 'fv1d-s')}`,
    setup(root) {
      for (const n of ['fv1a', 'fv1b', 'fv1c', 'fv1d']) vModel($(root, `[name=${n}]`), $(root, `#${n}-s`));
    },
    expect: { '#fv1a-s': '山田', '#fv1b-s': '太郎', '#fv1c-s': 'ヤマダ', '#fv1d-s': 'タロウ' },
  },
  {
    name: 'F-V2 Vue の v-model.lazy（change のときだけ状態が変わる）',
    html: `<form><table>
      <tr><th>大学名</th><td><input name="fv2a"></td></tr>
      <tr><th>学部</th><td><input name="fv2b"></td></tr>
    </table></form>${mirrors('fv2a-s', 'fv2b-s')}`,
    setup(root) {
      for (const n of ['fv2a', 'fv2b']) vModel($(root, `[name=${n}]`), $(root, `#${n}-s`), { lazy: true });
    },
    expect: { '[name=fv2a]': 'サンプル大学', '[name=fv2b]': '経済学部', '#fv2a-s': 'サンプル大学', '#fv2b-s': '経済学部' },
  },
  {
    name: 'F-V3 Vue の v-model.number（生年月日の年・月・日）と v-model.trim（メール）',
    html: `<form><table>
      <tr><th>生年月日</th><td><input name="fv3y" size="4">年<input name="fv3m" size="2">月<input name="fv3d" size="2">日</td></tr>
      <tr><th>メールアドレス</th><td><input name="fv3e"></td></tr>
    </table></form>${mirrors('fv3y-s', 'fv3m-s', 'fv3d-s', 'fv3e-s')}`,
    setup(root) {
      for (const n of ['fv3y', 'fv3m', 'fv3d']) vModel($(root, `[name=${n}]`), $(root, `#${n}-s`), { number: true });
      vModel($(root, '[name=fv3e]'), $(root, '#fv3e-s'), { trim: true });
    },
    expect: { '#fv3y-s': '1999', '#fv3m-s': '4', '#fv3d-s': '1', '#fv3e-s': 'taro@example.com' },
  },
  {
    name: 'F-V4 Vue の IME 対応（composition 中の input は無視）の氏名・フリガナ',
    html: `<form>
      <p><label>氏名 <input name="fv4a"></label></p>
      <p><label>フリガナ <input name="fv4b"></label></p>
    </form>${mirrors('fv4a-s', 'fv4b-s')}`,
    setup(root) {
      for (const n of ['fv4a', 'fv4b']) vModel($(root, `[name=${n}]`), $(root, `#${n}-s`));
    },
    expect: { '#fv4a-s': '山田　太郎', '#fv4b-s': 'ヤマダ　タロウ' },
  },
  {
    name: 'F-V5 Vue の v-model の select・ラジオ（change）',
    html: `<form><table>
      <tr><th>学校区分</th><td><select name="fv5a">${opts(['大学院', '大学', '短期大学', '専門学校'])}</select></td></tr>
      <tr><th>文理区分</th><td><label><input type="radio" name="fv5b" value="1">文系</label><label><input type="radio" name="fv5b" value="2">理系</label></td></tr>
    </table></form>${mirrors('fv5a-s', 'fv5b-s')}`,
    setup(root) {
      const sel = $<HTMLSelectElement>(root, '[name=fv5a]');
      sel.addEventListener('change', () => ($(root, '#fv5a-s').value = sel.value));
      // vModelRadio：change が来たら、その選択肢の値を状態に入れ、描き直しで checked を状態に合わせる
      const radios = Array.from(root.querySelectorAll<HTMLInputElement>('[name=fv5b]'));
      radios.forEach((r) =>
        r.addEventListener('change', () => {
          $(root, '#fv5b-s').value = r.value;
          queueMicrotask(() => radios.forEach((x) => (x.checked = x.value === $(root, '#fv5b-s')?.value)));
        }),
      );
    },
    expect: { '[name=fv5a]': '大学', 'radio:fv5b': '文系', '#fv5a-s': '大学', '#fv5b-s': '1' },
  },

  // ---- Angular・Knockout ----
  {
    name: 'F-A1 Angular のリアクティブフォーム（input で値、blur で touched）',
    html: `<form><table>
      <tr><th>氏名</th><td><input name="fa1a"></td></tr>
      <tr><th>メールアドレス</th><td><input name="fa1b"></td></tr>
    </table><output id="fa1-t"></output></form>${mirrors('fa1a-s', 'fa1b-s')}`,
    setup(root) {
      const touched = new Set<string>();
      for (const n of ['fa1a', 'fa1b']) {
        const el = $(root, `[name=${n}]`);
        let composing = false;
        el.addEventListener('compositionstart', () => (composing = true));
        el.addEventListener('compositionend', () => (composing = false));
        el.addEventListener('input', () => !composing && ($(root, `#${n}-s`).value = el.value));
        el.addEventListener('blur', () => {
          touched.add(n);
          $(root, '#fa1-t').textContent = String(touched.size);
        });
      }
    },
    expect: { '#fa1a-s': '山田　太郎', '#fa1b-s': 'taro@example.com', 'text:#fa1-t': '2' },
  },
  {
    name: "F-A2 Angular の updateOn: 'blur'（blur まで値がモデルに入らない）",
    html: `<form><table>
      <tr><th>電話番号</th><td><input name="fa2a" type="tel"></td></tr>
      <tr><th>郵便番号</th><td><input name="fa2b"></td></tr>
    </table></form>${mirrors('fa2a-s', 'fa2b-s')}`,
    setup(root) {
      for (const n of ['fa2a', 'fa2b']) {
        const el = $(root, `[name=${n}]`);
        let pending = '';
        el.addEventListener('input', () => (pending = el.value));
        el.addEventListener('blur', () => ($(root, `#${n}-s`).value = pending));
      }
    },
    expect: { '#fa2a-s': '090-1234-5678', '#fa2b-s': '150-0041' },
  },
  {
    name: 'F-A3 Angular の独自ディレクティブ（keyup で全角を半角にしてモデルに入れる）',
    html: `<form><label>携帯電話番号 <input name="fa3" type="tel"></label></form>${mirrors('fa3-s')}`,
    setup(root) {
      const el = $(root, '[name=fa3]');
      el.addEventListener('keyup', () => {
        el.value = el.value.normalize('NFKC');
        $(root, '#fa3-s').value = el.value;
      });
    },
    expect: { '[name=fa3]': '090-1234-5678', '#fa3-s': '090-1234-5678' },
  },
  {
    name: "F-KO1 Knockout の valueUpdate: 'afterkeydown'（keydown のあとの setTimeout と change）",
    html: `<form><table>
      <tr><th>大学名</th><td><input name="fk1a"></td></tr>
      <tr><th>学科</th><td><input name="fk1b"></td></tr>
    </table></form>${mirrors('fk1a-s', 'fk1b-s')}`,
    setup(root) {
      for (const n of ['fk1a', 'fk1b']) {
        const el = $(root, `[name=${n}]`);
        const write = () => ($(root, `#${n}-s`).value = el.value);
        el.addEventListener('keydown', () => setTimeout(write, 0));
        el.addEventListener('change', write);
      }
    },
    expect: { '#fk1a-s': 'サンプル大学', '#fk1b-s': '経済学科' },
  },

  // ---- jQuery のイベントで整形・確認する欄 ----
  {
    name: 'F-J1 jQuery の blur で全角に変換する番地',
    html: `<form><table>
      <tr><th>番地</th><td><input name="fj1" class="zenkaku"></td></tr>
    </table></form>`,
    setup(root) {
      const el = $(root, '[name=fj1]');
      el.addEventListener('blur', () => (el.value = toFull(el.value)));
    },
    expect: { '[name=fj1]': '神南１－２－３' },
  },
  {
    name: 'F-J2 jQuery の keyup でハイフンを消す電話番号',
    html: `<form><label>電話番号 <input name="fj2" type="tel"></label></form>`,
    setup(root) {
      const el = $(root, '[name=fj2]');
      el.addEventListener('keyup', () => (el.value = el.value.replace(/-/g, '')));
    },
    expect: { '[name=fj2]': '09012345678' },
  },
  {
    name: 'F-J3 jQuery の blur で確認用メールアドレスが一致しなければ空にしてエラーを出す',
    html: `<form><table>
      <tr><th>メールアドレス</th><td><input name="fj3a"></td></tr>
      <tr><th>メールアドレス（確認）</th><td><input name="fj3b"><span id="fj3-err"></span></td></tr>
    </table></form>`,
    setup(root) {
      const a = $(root, '[name=fj3a]');
      const b = $(root, '[name=fj3b]');
      b.addEventListener('blur', () => {
        const ng = b.value !== '' && b.value !== a.value;
        $(root, '#fj3-err').textContent = ng ? 'メールアドレスが一致しません' : '';
        if (ng) b.value = '';
      });
    },
    expect: { '[name=fj3a]': 'taro@example.com', '[name=fj3b]': 'taro@example.com', 'text:#fj3-err': '' },
  },

  // ---- 入力マスク ----
  {
    name: 'F-M1 jquery.mask 風（keyup で 000-0000 に整形、focusout で形が合わなければ空）',
    html: `<form><label>郵便番号 <input name="fm1"></label></form>`,
    setup(root) {
      const el = $(root, '[name=fm1]');
      el.addEventListener('keyup', (e) => {
        if ([9, 16, 17, 18, 36, 37, 38, 39, 40, 91].includes(e.keyCode)) return;
        const d = el.value.replace(/\D/g, '').slice(0, 7);
        el.value = d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
      });
      el.addEventListener('focusout', () => {
        if (!/^\d{3}-\d{4}$/.test(el.value)) el.value = '';
      });
    },
    expect: { '[name=fm1]': '150-0041' },
  },
  {
    name: 'F-M2 マスクを常に表示する郵便番号（imask の lazy: false 風、最初から「___-____」）',
    html: `<form><label>郵便番号 <input name="fm2"></label></form>${mirrors('fm2-s')}`,
    setup(root) {
      const el = $(root, '[name=fm2]');
      const mask = '___-____';
      const apply = () => {
        const d = el.value.replace(/\D/g, '').slice(0, 7).split('');
        el.value = mask.replace(/_/g, () => d.shift() ?? '_');
        $(root, '#fm2-s').value = el.value.replace(/\D/g, '');
      };
      el.value = mask;
      el.addEventListener('input', apply);
    },
    expect: { '[name=fm2]': '150-0041', '#fm2-s': '1500041' },
  },
  {
    name: 'F-M3 マスクを常に表示する電話番号（react-input-mask の alwaysShowMask 風「(___) ____-____」）',
    html: `<form><label>携帯電話番号 <input name="fm3" type="tel"></label></form>`,
    setup(root) {
      const el = $(root, '[name=fm3]');
      const mask = '___-____-____';
      el.value = mask;
      el.addEventListener('input', () => {
        const d = el.value.replace(/\D/g, '').slice(0, 11).split('');
        el.value = mask.replace(/_/g, () => d.shift() ?? '_');
      });
    },
    expect: { '[name=fm3]': '090-1234-5678' },
  },
  {
    name: 'F-M4 Cleave.js 風（input で「090 1234 5678」に区切る）',
    html: `<form><label>携帯電話番号 <input name="fm4" type="tel"></label></form>`,
    setup(root) {
      const el = $(root, '[name=fm4]');
      el.addEventListener('input', () => {
        const d = el.value.replace(/\D/g, '').slice(0, 11);
        el.value = [d.slice(0, 3), d.slice(3, 7), d.slice(7)].filter(Boolean).join(' ');
      });
    },
    expect: { '[name=fm4]': '090 1234 5678' },
  },
  {
    name: 'F-M5 数字以外が入ると直前の値に戻す電話番号（キー入力を止める型のマスク）',
    html: `<form><label>携帯電話番号 <input name="fm5" type="tel"></label></form>`,
    setup(root) {
      const el = $(root, '[name=fm5]');
      let last = '';
      el.addEventListener('input', () => {
        if (/^\d*$/.test(el.value)) last = el.value;
        else el.value = last;
      });
    },
    expect: { '[name=fm5]': '09012345678' },
  },
  {
    name: 'F-M6 JS で 11 文字に切り詰める電話番号（maxlength 属性なし）',
    html: `<form><label>携帯電話番号 <input name="fm6" type="tel"></label></form>`,
    setup(root) {
      const el = $(root, '[name=fm6]');
      el.addEventListener('input', () => el.value.length > 11 && (el.value = el.value.slice(0, 11)));
    },
    expect: { '[name=fm6]': '09012345678' },
  },

  // ---- 入力チェックで値を消す ----
  {
    name: 'F-B1 blur で「7桁の数字」でなければ空にしてエラーを出す郵便番号',
    html: `<form><label>郵便番号 <input name="fb1"></label><span id="fb1-err"></span></form>`,
    setup(root) {
      const el = $(root, '[name=fb1]');
      el.addEventListener('blur', () => {
        const ng = el.value !== '' && !/^\d{7}$/.test(el.value);
        $(root, '#fb1-err').textContent = ng ? 'ハイフンなしの7桁で入力してください' : '';
        if (ng) el.value = '';
      });
    },
    expect: { '[name=fb1]': '1500041' },
  },
  {
    name: 'F-B2 300ms のデバウンスで形式違いを空にする郵便番号',
    html: `<form><label>郵便番号 <input name="fb2"></label></form>`,
    setup(root) {
      const el = $(root, '[name=fb2]');
      let t = 0;
      el.addEventListener('input', () => {
        clearTimeout(t);
        t = later(300, () => el.value !== '' && !/^\d{7}$/.test(el.value) && (el.value = ''));
      });
    },
    expect: { '[name=fb2]': '1500041' },
  },
  {
    name: 'F-B3 300ms のデバウンスでハイフンを付け直す電話番号',
    html: `<form><label>電話番号（ハイフンなし） <input name="fb3" type="tel"></label></form>`,
    setup(root) {
      const el = $(root, '[name=fb3]');
      let t = 0;
      el.addEventListener('input', () => {
        clearTimeout(t);
        t = later(300, () => {
          const d = el.value.replace(/\D/g, '');
          if (d.length === 11) el.value = `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
        });
      });
    },
    expect: { '[name=fb3]': '090-1234-5678' },
  },
  {
    name: 'F-B4 300ms のデバウンスでメールアドレスの形式を確かめる（正しければ残す）',
    html: `<form><label>メールアドレス <input name="fb4"></label></form>`,
    setup(root) {
      const el = $(root, '[name=fb4]');
      let t = 0;
      el.addEventListener('input', () => {
        clearTimeout(t);
        t = later(300, () => !/^[^@]+@[^@]+$/.test(el.value) && (el.value = ''));
      });
    },
    expect: { '[name=fb4]': 'taro@example.com' },
  },

  // ---- フリガナの自動入力（jquery.autoKana 風） ----
  {
    name: 'F-AK1 autoKana 風：氏名の入力でフリガナを作る・氏名を消すとフリガナも消す（氏名が先）',
    html: `<form><table>
      <tr><th>氏名</th><td><input name="fak1a"></td></tr>
      <tr><th>フリガナ</th><td><input name="fak1b"></td></tr>
    </table></form>`,
    setup(root) {
      const name = $(root, '[name=fak1a]');
      const kana = $(root, '[name=fak1b]');
      name.addEventListener('input', () => {
        if (name.value === '') kana.value = '';
        const k = toKatakana(name.value.replace(/[^ぁ-ゖー]/g, ''));
        if (k) kana.value = k;
      });
    },
    expect: { '[name=fak1a]': '山田　太郎', '[name=fak1b]': 'ヤマダ　タロウ' },
  },
  {
    name: 'F-AK2 フリガナが氏名より上にあり、氏名の input でフリガナを作り直す（漢字だけなので空になる）',
    html: `<form><table>
      <tr><th>フリガナ</th><td><input name="fak2a"></td></tr>
      <tr><th>氏名</th><td><input name="fak2b"></td></tr>
    </table></form>`,
    setup(root) {
      const kana = $(root, '[name=fak2a]');
      const name = $(root, '[name=fak2b]');
      name.addEventListener('input', () => (kana.value = toKatakana(name.value.replace(/[^ぁ-ゖー\s　]/g, '')).trim()));
    },
    expect: { '[name=fak2a]': 'ヤマダ　タロウ', '[name=fak2b]': '山田　太郎' },
  },
  {
    name: 'F-AK3 姓・名ごとの autoKana（compositionupdate でセイ・メイを作り、姓・名を消すと消す）',
    html: `<form><table>
      <tr><th>氏名</th><td>姓 <input name="fak3a"> 名 <input name="fak3b"></td></tr>
      <tr><th>フリガナ</th><td>セイ <input name="fak3c"> メイ <input name="fak3d"></td></tr>
    </table></form>`,
    setup(root) {
      const pairs: [string, string][] = [
        ['fak3a', 'fak3c'],
        ['fak3b', 'fak3d'],
      ];
      for (const [n, k] of pairs) {
        const name = $(root, `[name=${n}]`);
        const kana = $(root, `[name=${k}]`);
        name.addEventListener('compositionupdate', (e) => (kana.value = toKatakana((e as CompositionEvent).data)));
        name.addEventListener('input', () => name.value === '' && (kana.value = ''));
      }
    },
    expect: { '[name=fak3a]': '山田', '[name=fak3b]': '太郎', '[name=fak3c]': 'ヤマダ', '[name=fak3d]': 'タロウ' },
  },
  {
    name: 'F-AK4 よみがな API：氏名の change の 300ms 後に、フリガナが空だったらひらがなで入れる',
    html: `<form><table>
      <tr><th>氏名</th><td><input name="fak4a"></td></tr>
      <tr><th>フリガナ</th><td><input name="fak4b"></td></tr>
    </table></form>`,
    setup(root) {
      const name = $(root, '[name=fak4a]');
      const kana = $(root, '[name=fak4b]');
      name.addEventListener('change', () => {
        const wasEmpty = kana.value === '';
        if (name.value && wasEmpty) later(300, () => (kana.value = 'やまだ たろう'));
      });
    },
    expect: { '[name=fak4a]': '山田　太郎', '[name=fak4b]': 'ヤマダ　タロウ' },
  },

  // ---- 郵便番号から住所（ajaxzip3 風）の別の形 ----
  {
    name: 'F-Z1 ajaxzip3 風：郵便番号の blur の 300ms 後に住所を上書き（都道府県は select）',
    html: `<form><table>
      <tr><th>郵便番号</th><td><input name="fz1a"></td></tr>
      <tr><th>都道府県</th><td><select name="fz1b">${opts(PREFECTURES)}</select></td></tr>
      <tr><th>市区町村</th><td><input name="fz1c"></td></tr>
      <tr><th>番地</th><td><input name="fz1d"></td></tr>
    </table></form>`,
    setup(root) {
      const zip = $(root, '[name=fz1a]');
      zip.addEventListener('blur', () =>
        later(300, () => {
          if (!root.contains(zip)) return;
          $<HTMLSelectElement>(root, '[name=fz1b]').value = '東京都';
          $(root, '[name=fz1c]').value = '渋谷区';
          $(root, '[name=fz1d]').value = '神南';
        }),
      );
    },
    expect: { '[name=fz1a]': '150-0041', '[name=fz1b]': '東京都', '[name=fz1c]': '渋谷区', '[name=fz1d]': '神南1-2-3' },
  },
  {
    name: 'F-Z2 ajaxzip3 風：change で市区町村に「渋谷区神南」を入れ、番地・建物名を空にする',
    html: `<form><table>
      <tr><th>郵便番号</th><td><input name="fz2a"></td></tr>
      <tr><th>都道府県</th><td><select name="fz2b">${opts(PREFECTURES)}</select></td></tr>
      <tr><th>市区町村</th><td><input name="fz2c"></td></tr>
      <tr><th>番地</th><td><input name="fz2d"></td></tr>
      <tr><th>建物名</th><td><input name="fz2e"></td></tr>
    </table></form>`,
    setup(root) {
      const zip = $(root, '[name=fz2a]');
      zip.addEventListener('change', () =>
        later(300, () => {
          if (!root.contains(zip)) return;
          $<HTMLSelectElement>(root, '[name=fz2b]').value = '東京都';
          $(root, '[name=fz2c]').value = '渋谷区神南';
          $(root, '[name=fz2d]').value = '';
          $(root, '[name=fz2e]').value = '';
        }),
      );
    },
    expect: {
      '[name=fz2b]': '東京都',
      '[name=fz2c]': '渋谷区',
      '[name=fz2d]': '神南1-2-3',
      '[name=fz2e]': 'サンプルマンション101',
    },
  },
  {
    name: 'F-Z3 ajaxzip3 風：2分割の郵便番号の後ろの欄の keyup（7桁そろったら）で 200ms 後に上書き',
    html: `<form><table>
      <tr><th>郵便番号</th><td>〒<input name="fz3a" size="3" maxlength="3">-<input name="fz3b" size="4" maxlength="4"></td></tr>
      <tr><th>都道府県</th><td><select name="fz3c">${opts(PREFECTURES)}</select></td></tr>
      <tr><th>住所</th><td><input name="fz3d" size="40"></td></tr>
    </table></form>`,
    setup(root) {
      const a = $(root, '[name=fz3a]');
      const b = $(root, '[name=fz3b]');
      b.addEventListener('keyup', () => {
        if ((a.value + b.value).length !== 7) return;
        later(200, () => {
          if (!root.contains(b)) return;
          $<HTMLSelectElement>(root, '[name=fz3c]').value = '東京都';
          $(root, '[name=fz3d]').value = '渋谷区神南';
        });
      });
    },
    expect: { '[name=fz3a]': '150', '[name=fz3b]': '0041', '[name=fz3c]': '東京都', '[name=fz3d]': '渋谷区神南1-2-3　サンプルマンション101' },
  },
  {
    name: 'F-Z4 郵便番号の住所検索 API が遅い（800ms）・都道府県が文字の欄',
    html: `<form><table>
      <tr><th>郵便番号</th><td><input name="fz4a"></td></tr>
      <tr><th>都道府県</th><td><input name="fz4b"></td></tr>
      <tr><th>市区町村</th><td><input name="fz4c"></td></tr>
      <tr><th>番地</th><td><input name="fz4d"></td></tr>
    </table></form>`,
    setup(root) {
      const zip = $(root, '[name=fz4a]');
      zip.addEventListener('keyup', () =>
        later(800, () => {
          if (!root.contains(zip)) return;
          $(root, '[name=fz4b]').value = '東京都';
          $(root, '[name=fz4c]').value = '渋谷区';
          $(root, '[name=fz4d]').value = '神南';
        }),
      );
    },
    expect: { '[name=fz4b]': '東京都', '[name=fz4c]': '渋谷区', '[name=fz4d]': '神南1-2-3' },
  },

  // ---- 選んだあとで出てくる欄 ----
  {
    name: 'F-C1 学校区分のラジオで「大学」を選ぶと学部・学科の欄が出る（すぐ）',
    html: `<form><table>
      <tr><th>学校区分</th><td>${['大学院', '大学', '短期大学'].map((t) => `<label><input type="radio" name="fc1a" value="${t}">${t}</label>`).join('')}</td></tr>
      <tr class="fc1-dep" style="display:none"><th>学部</th><td><input name="fc1b"></td></tr>
      <tr class="fc1-dep" style="display:none"><th>学科</th><td><input name="fc1c"></td></tr>
    </table></form>`,
    setup(root) {
      root.querySelectorAll<HTMLInputElement>('[name=fc1a]').forEach((r) =>
        r.addEventListener('change', () => root.querySelectorAll<HTMLElement>('.fc1-dep').forEach((tr) => (tr.style.display = r.value === '大学' ? '' : 'none'))),
      );
    },
    expect: { 'radio:fc1a': '大学', '[name=fc1b]': '経済学部', '[name=fc1c]': '経済学科' },
  },
  {
    name: 'F-C2 学校区分のラジオで「大学」を選ぶと、300ms 後に学部・学科の欄が出る',
    html: `<form><table>
      <tr><th>学校区分</th><td>${['大学院', '大学', '短期大学'].map((t) => `<label><input type="radio" name="fc2a" value="${t}">${t}</label>`).join('')}</td></tr>
      <tr class="fc2-dep" style="display:none"><th>学部</th><td><input name="fc2b"></td></tr>
      <tr class="fc2-dep" style="display:none"><th>学科</th><td><input name="fc2c"></td></tr>
    </table></form>`,
    setup(root) {
      root.querySelectorAll<HTMLInputElement>('[name=fc2a]').forEach((r) =>
        r.addEventListener('change', () =>
          later(300, () => root.querySelectorAll<HTMLElement>('.fc2-dep').forEach((tr) => (tr.style.display = r.value === '大学' ? '' : 'none'))),
        ),
      );
    },
    expect: { 'radio:fc2a': '大学', '[name=fc2b]': '経済学部', '[name=fc2c]': '経済学科' },
  },
  {
    name: 'F-C3 学校区分のプルダウンで「大学」を選ぶと、300ms 後に学部・学科の欄が出る（F-C2 と同じ見た目）',
    html: `<form><table>
      <tr><th>学校区分</th><td><select name="fc3a">${opts(['大学院', '大学', '短期大学'])}</select></td></tr>
      <tr class="fc3-dep" style="display:none"><th>学部</th><td><input name="fc3b"></td></tr>
      <tr class="fc3-dep" style="display:none"><th>学科</th><td><input name="fc3c"></td></tr>
    </table></form>`,
    setup(root) {
      const sel = $<HTMLSelectElement>(root, '[name=fc3a]');
      sel.addEventListener('change', () =>
        later(300, () => root.querySelectorAll<HTMLElement>('.fc3-dep').forEach((tr) => (tr.style.display = sel.value === '大学' ? '' : 'none'))),
      );
    },
    expect: { '[name=fc3a]': '大学', '[name=fc3b]': '経済学部', '[name=fc3c]': '経済学科' },
  },
  {
    name: 'F-C4 帰省先「現住所と異なる」を選ぶと帰省先の欄が出る',
    profile: { kiseiSame: false, kiseiPostalCode: '960-8001', kiseiPrefecture: '福島県', kiseiCity: '福島市', kiseiAddressLine: '天神町1-1' },
    html: `<form>
      <h3>帰省先</h3>
      <table>
        <tr><th>帰省先</th><td><label><input type="radio" name="fc4a" value="same">現住所と同じ</label><label><input type="radio" name="fc4a" value="diff">現住所と異なる</label></td></tr>
      </table>
      <table id="fc4-sec" style="display:none">
        <tr><th>帰省先郵便番号</th><td><input name="fc4b"></td></tr>
        <tr><th>帰省先都道府県</th><td><select name="fc4c">${opts(PREFECTURES)}</select></td></tr>
        <tr><th>帰省先市区町村</th><td><input name="fc4d"></td></tr>
        <tr><th>帰省先番地</th><td><input name="fc4e"></td></tr>
      </table>
    </form>`,
    setup(root) {
      root.querySelectorAll<HTMLInputElement>('[name=fc4a]').forEach((r) =>
        r.addEventListener('change', () => ($<HTMLElement>(root, '#fc4-sec').style.display = r.value === 'diff' ? '' : 'none')),
      );
    },
    expect: { 'radio:fc4a': '現住所と異なる', '[name=fc4b]': '960-8001', '[name=fc4c]': '福島県', '[name=fc4d]': '福島市', '[name=fc4e]': '天神町1-1' },
  },
  {
    name: 'F-C4b 「帰省先は現住所と同じですか」で「いいえ」を選ぶと帰省先の欄が出る',
    profile: { kiseiSame: false, kiseiPostalCode: '960-8001', kiseiPrefecture: '福島県', kiseiCity: '福島市', kiseiAddressLine: '天神町1-1' },
    html: `<form>
      <table>
        <tr><th>帰省先は現住所と同じですか</th><td><label><input type="radio" name="fc4ba" value="1">はい</label><label><input type="radio" name="fc4ba" value="0">いいえ</label></td></tr>
      </table>
      <div id="fc4b-sec" style="display:none"><h3>帰省先</h3><table>
        <tr><th>郵便番号</th><td><input name="fc4bb"></td></tr>
        <tr><th>都道府県</th><td><select name="fc4bc">${opts(PREFECTURES)}</select></td></tr>
        <tr><th>市区町村</th><td><input name="fc4bd"></td></tr>
        <tr><th>番地</th><td><input name="fc4be"></td></tr>
      </table></div>
    </form>`,
    setup(root) {
      root.querySelectorAll<HTMLInputElement>('[name=fc4ba]').forEach((r) =>
        r.addEventListener('change', () => ($<HTMLElement>(root, '#fc4b-sec').style.display = r.value === '0' ? '' : 'none')),
      );
    },
    expect: { 'radio:fc4ba': 'いいえ', '[name=fc4bb]': '960-8001', '[name=fc4bc]': '福島県', '[name=fc4bd]': '福島市', '[name=fc4be]': '天神町1-1' },
  },
  {
    name: 'F-C5 学校区分を変えるとウォッチャーが学校名・学部・文理区分を空にする（マイクロタスク）',
    html: `<form><table>
      <tr><th>学校区分</th><td><select name="fc5a">${opts(['大学院', '大学', '短期大学'])}</select></td></tr>
      <tr><th>学校名</th><td><input name="fc5b"></td></tr>
      <tr><th>学部</th><td><select name="fc5c">${opts(['法学部', '経済学部', '文学部'])}</select></td></tr>
      <tr><th>文理区分</th><td><label><input type="radio" name="fc5d" value="1">文系</label><label><input type="radio" name="fc5d" value="2">理系</label></td></tr>
    </table></form>`,
    setup(root) {
      // watch(() => form.schoolType, () => { form.school = ''; form.faculty = ''; form.bunri = '' })
      $(root, '[name=fc5a]').addEventListener('change', () =>
        queueMicrotask(() => {
          if (!root.querySelector('[name=fc5b]')) return;
          $(root, '[name=fc5b]').value = '';
          $<HTMLSelectElement>(root, '[name=fc5c]').selectedIndex = 0;
          root.querySelectorAll<HTMLInputElement>('[name=fc5d]').forEach((r) => (r.checked = false));
        }),
      );
    },
    expect: { '[name=fc5a]': '大学', '[name=fc5b]': 'サンプル大学', '[name=fc5c]': '経済学部', 'radio:fc5d': '文系' },
  },

  // ---- 前の欄を入れると使えるようになる欄 ----
  {
    name: 'F-D1 姓を入れると名が入力できるようになる（input で disabled を外す）',
    html: `<form><table>
      <tr><th>姓</th><td><input name="fd1a"></td></tr>
      <tr><th>名</th><td><input name="fd1b" disabled></td></tr>
    </table></form>`,
    setup(root) {
      const a = $(root, '[name=fd1a]');
      a.addEventListener('input', () => ($(root, '[name=fd1b]').disabled = a.value === ''));
    },
    expect: { '[name=fd1a]': '山田', '[name=fd1b]': '太郎' },
  },
  {
    name: 'F-D2 順番に入力できるようになる4つの欄（姓→名→セイ→メイ）',
    html: `<form><table>
      <tr><th>姓</th><td><input name="fd2a"></td></tr>
      <tr><th>名</th><td><input name="fd2b" disabled></td></tr>
      <tr><th>セイ</th><td><input name="fd2c" disabled></td></tr>
      <tr><th>メイ</th><td><input name="fd2d" disabled></td></tr>
    </table></form>`,
    setup(root) {
      const names = ['fd2a', 'fd2b', 'fd2c', 'fd2d'];
      names.slice(0, -1).forEach((n, i) => {
        const el = $(root, `[name=${n}]`);
        el.addEventListener('input', () => ($(root, `[name=${names[i + 1]}]`).disabled = el.value === ''));
      });
    },
    expect: { '[name=fd2a]': '山田', '[name=fd2b]': '太郎', '[name=fd2c]': 'ヤマダ', '[name=fd2d]': 'タロウ' },
  },
  {
    name: 'F-D3 メールアドレスの確認（blur の 250ms 後）が通ると、確認用の欄が使えるようになる',
    html: `<form><table>
      <tr><th>メールアドレス</th><td><input name="fd3a"></td></tr>
      <tr><th>メールアドレス（確認用）</th><td><input name="fd3b" disabled></td></tr>
    </table></form>`,
    setup(root) {
      const a = $(root, '[name=fd3a]');
      a.addEventListener('blur', () => later(250, () => root.contains(a) && ($(root, '[name=fd3b]').disabled = !/@/.test(a.value))));
    },
    expect: { '[name=fd3a]': 'taro@example.com', '[name=fd3b]': 'taro@example.com' },
  },

  // ---- 選択肢があとから作られる select ----
  {
    name: 'F-S1 都道府県の選択肢を focus で読み込む select',
    html: `<form><label>都道府県 <select name="fs1"><option value="">選択してください</option></select></label></form>`,
    setup(root) {
      const sel = $<HTMLSelectElement>(root, '[name=fs1]');
      sel.addEventListener('focus', () => sel.length === 1 && PREFECTURES.forEach((p) => sel.add(new Option(p))));
    },
    expect: { '[name=fs1]': '東京都' },
  },
  {
    name: 'F-S2 学校区分の選択肢を mousedown で読み込む select',
    html: `<form><label>学校区分 <select name="fs2"><option value="">選択してください</option></select></label></form>`,
    setup(root) {
      const sel = $<HTMLSelectElement>(root, '[name=fs2]');
      sel.addEventListener('mousedown', () => sel.length === 1 && ['大学院', '大学', '短期大学', '専門学校'].forEach((p) => sel.add(new Option(p))));
    },
    expect: { '[name=fs2]': '大学' },
  },
  {
    name: 'F-S3 都道府県を選ぶと市区町村の選択肢を読み込む API が遅い（1200ms）',
    html: `<form><table>
      <tr><th>都道府県</th><td><select name="fs3a">${opts(PREFECTURES)}</select></td></tr>
      <tr><th>市区町村</th><td><select name="fs3b"><option value="">選択してください</option></select></td></tr>
    </table></form>`,
    setup(root) {
      const p = $<HTMLSelectElement>(root, '[name=fs3a]');
      p.addEventListener('change', () =>
        later(1200, () => {
          const c = root.querySelector<HTMLSelectElement>('[name=fs3b]');
          if (c) c.innerHTML = opts(p.value === '東京都' ? ['千代田区', '新宿区', '渋谷区'] : ['その他']);
        }),
      );
    },
    expect: { '[name=fs3a]': '東京都', '[name=fs3b]': '渋谷区' },
  },

  // ---- focus でイベントを付けるサイト ----
  {
    name: 'F-F1 focus で初めて入力のイベントを付ける欄（モデルの更新が focus のあと）',
    html: `<form><table>
      <tr><th>氏名</th><td><input name="ff1a"></td></tr>
      <tr><th>電話番号</th><td><input name="ff1b" type="tel"></td></tr>
    </table></form>${mirrors('ff1a-s', 'ff1b-s')}`,
    setup(root) {
      // $(document).on('focus', '.inp', function () { $(this).off('.v').on('input.v blur.v', update) })
      for (const n of ['ff1a', 'ff1b']) {
        const el = $(root, `[name=${n}]`);
        const update = () => ($(root, `#${n}-s`).value = el.value);
        el.addEventListener(
          'focus',
          () => {
            el.addEventListener('input', update);
            el.addEventListener('blur', update);
          },
          { once: true },
        );
      }
    },
    expect: { '[name=ff1a]': '山田　太郎', '#ff1a-s': '山田　太郎', '#ff1b-s': '090-1234-5678' },
  },

  // ---- 欄が作り直される（入力エンジンが持っている要素が古くなる） ----
  {
    name: 'F-K1 学校区分を選ぶと学校名・学部の欄が作り直される（React の key が変わる・状態も空になる）',
    html: `<p>学歴</p>${mirrors('fk1s-school', 'fk1s-fac')}`,
    setup(root) {
      const box = outside(
        root,
        `<form><table>
          <tr><th>学校区分</th><td><select name="fx1a">${opts(['大学院', '大学', '短期大学'])}</select></td></tr>
          <tr><th>学校名</th><td class="fx1-school"></td></tr>
          <tr><th>学部</th><td class="fx1-fac"></td></tr>
        </table></form>`,
      );
      const mount = () => {
        const state: Record<string, string> = {};
        box.querySelector('.fx1-school')!.innerHTML = '<input name="fx1b">';
        box.querySelector('.fx1-fac')!.innerHTML = '<input name="fx1c">';
        bindState($(box, '[name=fx1b]'), $(root, '#fk1s-school'), state, 'school');
        bindState($(box, '[name=fx1c]'), $(root, '#fk1s-fac'), state, 'fac');
        $(root, '#fk1s-school').value = '';
        $(root, '#fk1s-fac').value = '';
      };
      mount();
      $(box, '[name=fx1a]').addEventListener('change', mount);
    },
    expect: { '#fk1s-school': 'サンプル大学', '#fk1s-fac': '経済学部' },
  },
  {
    name: 'F-K2 blur のあとで欄を作り直す（エラー表示の切り替え）と、「元に戻す」で消えない',
    html: `<p>連絡先</p>${mirrors('fk2s-mail')}`,
    setup(root) {
      const box = outside(root, `<form><table><tr><th>メールアドレス</th><td class="fx2"></td></tr></table></form>`);
      const state: Record<string, string> = {};
      const mount = (cls: string) => {
        box.querySelector('.fx2')!.innerHTML = `<div class="${cls}"><input name="fx2"></div>`;
        const el = $(box, '[name=fx2]');
        bindState(el, $(root, '#fk2s-mail'), state, 'mail');
        // 入力が終わったら、正しいかどうかで別の要素として描き直す
        el.addEventListener('focusout', () => queueMicrotask(() => mount(/@/.test(state.mail ?? '') ? 'ok' : 'ng')));
      };
      mount('');
    },
    expect: { '#fk2s-mail': 'taro@example.com' },
  },
  {
    name: 'F-K3 都道府県を選ぶと、300ms 後に市区町村の select ごと作り直される',
    html: `<p>住所</p>${mirrors('fk3s-pref', 'fk3s-city')}`,
    setup(root) {
      const box = outside(
        root,
        `<form><table>
          <tr><th>都道府県</th><td><select name="fx3a">${opts(PREFECTURES)}</select></td></tr>
          <tr><th>市区町村</th><td class="fx3"><select name="fx3b"><option value="">先に都道府県を選択</option></select></td></tr>
        </table></form>`,
      );
      const pref = $<HTMLSelectElement>(box, '[name=fx3a]');
      pref.addEventListener('change', () => {
        $(root, '#fk3s-pref').value = pref.value;
        later(300, () => {
          if (!box.isConnected) return;
          box.querySelector('.fx3')!.innerHTML = `<select name="fx3b">${opts(pref.value === '東京都' ? ['千代田区', '新宿区', '渋谷区'] : ['その他'])}</select>`;
          const city = $<HTMLSelectElement>(box, '[name=fx3b]');
          $(root, '#fk3s-city').value = '';
          city.addEventListener('change', () => ($(root, '#fk3s-city').value = city.value));
        });
      });
    },
    expect: { '#fk3s-pref': '東京都', '#fk3s-city': '渋谷区' },
  },

  // ---- モーダル ----
  {
    name: 'F-DL1 モーダル（dialog.showModal）の中のフォーム',
    html: `<dialog id="fdl1"><form method="dialog"><table>
      <tr><th>氏名</th><td><input name="fdl1a"></td></tr>
      <tr><th>メールアドレス</th><td><input name="fdl1b"></td></tr>
    </table></form></dialog>`,
    setup(root) {
      $<HTMLDialogElement>(root, '#fdl1').showModal();
    },
    expect: { '[name=fdl1a]': '山田　太郎', '[name=fdl1b]': 'taro@example.com' },
  },
];
