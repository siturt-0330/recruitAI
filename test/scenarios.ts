// 「入力 → 画面が変わる → もう一度入力」のような、1回の入力では確かめられない流れのテスト
import { FormFiller } from '../lib/engine';
import { DEFAULT_SETTINGS } from '../lib/types';
import { testProfile } from './fixtures/profile';

interface Scenario {
  name: string;
  run(stage: HTMLElement): Promise<string[]>;
}

const val = (root: HTMLElement, sel: string) => (root.querySelector(sel) as HTMLInputElement).value;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SCENARIOS: Scenario[] = [
  {
    name: '手順型フォーム：2ページ目で入力しても、隠れた1ページ目の値は消えない',
    async run(stage) {
      stage.innerHTML = `<form>
        <section id="s1"><label>氏名 <input name="a1"></label><label>メールアドレス <input name="a2" type="email"></label></section>
        <section id="s2" hidden><label>大学名 <input name="b1"></label><label>学部 <input name="b2"></label></section></form>`;
      const f = new FormFiller(document);
      await f.fill(testProfile(), DEFAULT_SETTINGS);
      (stage.querySelector('#s1') as HTMLElement).hidden = true;
      (stage.querySelector('#s2') as HTMLElement).hidden = false;
      await f.fill(testProfile(), DEFAULT_SETTINGS);
      const errs: string[] = [];
      if (val(stage, '[name=a1]') !== '山田　太郎') errs.push(`1ページ目の氏名: ${val(stage, '[name=a1]')}`);
      if (val(stage, '[name=a2]') !== 'taro@example.com') errs.push(`1ページ目のメール: ${val(stage, '[name=a2]')}`);
      if (val(stage, '[name=b1]') !== 'サンプル大学') errs.push(`2ページ目の大学名: ${val(stage, '[name=b1]')}`);
      f.undo();
      return errs;
    },
  },
  {
    name: '同じページでもう一度入力しても値が変わらない（2回押し）',
    async run(stage) {
      stage.innerHTML = `<form><label>氏名 <input name="a1"></label><label>都道府県 <select name="a2"><option value="">--</option><option>東京都</option></select></label></form>`;
      const f = new FormFiller(document);
      await f.fill(testProfile(), DEFAULT_SETTINGS);
      await f.fill(testProfile(), DEFAULT_SETTINGS);
      const errs: string[] = [];
      if (val(stage, '[name=a1]') !== '山田　太郎') errs.push(`氏名: ${val(stage, '[name=a1]')}`);
      if (val(stage, '[name=a2]') !== '東京都') errs.push(`都道府県: ${val(stage, '[name=a2]')}`);
      f.undo();
      return errs;
    },
  },
  {
    name: 'SPA：入力後に1ページ目の要素を消して2ページ目を描いても、2回目の入力が動く',
    async run(stage) {
      stage.innerHTML = `<form id="w"><label>氏名 <input name="a1"></label></form>`;
      const f = new FormFiller(document);
      await f.fill(testProfile(), DEFAULT_SETTINGS);
      stage.innerHTML = `<form><label>大学名 <input name="b1"></label></form>`;
      const r = await f.fill(testProfile(), DEFAULT_SETTINGS);
      const errs: string[] = [];
      if (val(stage, '[name=b1]') !== 'サンプル大学') errs.push(`大学名: ${val(stage, '[name=b1]')}`);
      if (r.filled !== 1) errs.push(`入力件数: ${r.filled}`);
      f.undo();
      return errs;
    },
  },
  {
    name: '開閉式（details）の中の欄：開いてからもう一度入力すると入る',
    async run(stage) {
      stage.innerHTML = `<form><label>氏名 <input name="a1"></label><details id="d"><summary>帰省先</summary><label>帰省先 郵便番号 <input name="k1"></label></details></form>`;
      const f = new FormFiller(document);
      await f.fill(testProfile({ kiseiSame: false, kiseiPostalCode: '100-0001' }), DEFAULT_SETTINGS);
      (stage.querySelector('#d') as HTMLDetailsElement).open = true;
      await sleep(50);
      await f.fill(testProfile({ kiseiSame: false, kiseiPostalCode: '100-0001' }), DEFAULT_SETTINGS);
      const errs: string[] = [];
      if (val(stage, '[name=a1]') !== '山田　太郎') errs.push(`氏名: ${val(stage, '[name=a1]')}`);
      if (val(stage, '[name=k1]') !== '100-0001') errs.push(`帰省先郵便番号: ${val(stage, '[name=k1]')}`);
      f.undo();
      return errs;
    },
  },
];

async function main() {
  const stage = document.getElementById('stage')!;
  const results: { name: string; errors: string[] }[] = [];
  for (const s of SCENARIOS) {
    let errors: string[];
    try {
      errors = await s.run(stage);
    } catch (e) {
      errors = [String(e instanceof Error ? e.stack : e)];
    }
    results.push({ name: s.name, errors });
    stage.innerHTML = '';
  }
  const ok = results.filter((r) => !r.errors.length).length;
  document.getElementById('results')!.innerHTML = `<h2>${ok} / ${results.length} 件 成功</h2><ol>${results
    .map((r) => `<li>${r.errors.length ? '✗' : '✓'} ${r.name}${r.errors.map((e) => `<div>${e}</div>`).join('')}</li>`)
    .join('')}</ol>`;
  (window as unknown as { suiteResults: unknown }).suiteResults = results.map((r) => ({ name: r.name, failures: r.errors, undoFailures: [] }));
}

main();
