// 入力エンジンの回帰テスト。`npm run harness` で起動し、/test/suite.html を開く
import { FormFiller } from '../lib/engine';
import { DEFAULT_SETTINGS } from '../lib/types';
import { CASES, type Case } from './fixtures/cases';
import { removeComboPopups } from './fixtures/combos';
import { testProfile } from './fixtures/profile';

interface Failure {
  selector: string;
  expected: string | boolean;
  actual: string | boolean;
}

interface CaseResult {
  name: string;
  failures: Failure[];
  undoFailures: string[];
  error?: string;
}

function resolve(root: HTMLElement, selector: string): Element | null {
  if (selector.startsWith('shadow:')) {
    const [host, inner] = selector.slice(7).split('|') as [string, string];
    return root.querySelector(host)?.shadowRoot?.querySelector(inner) ?? null;
  }
  return root.querySelector(selector);
}

function actualValue(root: HTMLElement, selector: string, expected: string | boolean): string | boolean {
  if (selector.startsWith('radio:')) {
    const checked = root.querySelector<HTMLInputElement>(`input[type=radio][name="${selector.slice(6)}"]:checked`);
    return checked ? (checked.closest('label, span')?.textContent ?? checked.value).trim() : '';
  }
  if (selector.startsWith('text:')) return (root.querySelector(selector.slice(5))?.textContent ?? '（要素なし）').replace(/\u200b/g, '').trim();
  const el = resolve(root, selector);
  if (!el) return '（要素なし）';
  if (el instanceof HTMLInputElement && el.type === 'checkbox') return el.checked;
  if (el instanceof HTMLSelectElement) {
    const opt = el.options[el.selectedIndex];
    // 期待値が value かテキストのどちらかに一致すればよい
    if (!opt || opt.value === '') return '';
    return opt.value === expected || opt.text.trim() === expected ? (expected as string) : `${opt.value}「${opt.text.trim()}」`;
  }
  return (el as HTMLInputElement).value;
}

/** 元に戻したときに比べるため、すべての欄の状態を記録する */
function snapshotAll(root: HTMLElement): Map<Element, string> {
  const map = new Map<Element, string>();
  const visit = (r: ParentNode) => {
    r.querySelectorAll('input, select, textarea').forEach((el) => {
      const v = el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') ? String(el.checked) : (el as HTMLInputElement).value;
      map.set(el, v);
    });
    r.querySelectorAll('*').forEach((el) => el.shadowRoot && visit(el.shadowRoot));
  };
  visit(root);
  return map;
}

async function runCase(c: Case, stage: HTMLElement): Promise<CaseResult> {
  stage.innerHTML = c.html;
  c.setup?.(stage);
  const before = snapshotAll(stage);
  const filler = new FormFiller(document);
  const result: CaseResult = { name: c.name, failures: [], undoFailures: [] };
  try {
    await filler.fill(testProfile(c.profile), DEFAULT_SETTINGS);
    for (const [selector, expected] of Object.entries(c.expect)) {
      const actual = actualValue(stage, selector, expected);
      if (actual !== expected) result.failures.push({ selector, expected, actual });
    }
    const edited = c.afterFill?.(stage) ?? {};
    filler.undo();
    await filler.whenRestored();
    for (const [sel, v] of Object.entries(edited)) {
      const now = (stage.querySelector(sel) as HTMLInputElement).value;
      if (now !== v) result.undoFailures.push(`書き直した ${sel} が消えた: ${v} → ${now}`);
    }
    for (const [el, v] of snapshotAll(stage)) {
      if (Object.keys(edited).some((sel) => stage.querySelector(sel) === el)) continue;
      if (before.get(el) !== v) result.undoFailures.push(`${(el as HTMLInputElement).name || el.id}: ${before.get(el)} → ${v}`);
    }
  } catch (e) {
    result.error = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  }
  filler.undo();
  await filler.whenRestored();
  removeComboPopups(document);
  stage.innerHTML = '';
  return result;
}

async function main() {
  const stage = document.getElementById('stage')!;
  const out = document.getElementById('results')!;
  const results: CaseResult[] = [];
  for (const c of CASES) results.push(await runCase(c, stage));

  const failed = results.filter((r) => r.failures.length || r.undoFailures.length || r.error);
  const esc = (s: unknown) => String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]!);
  out.innerHTML = `
    <h2 class="${failed.length ? 'ng' : 'ok'}">${results.length - failed.length} / ${results.length} 件 成功</h2>
    <ol>${results
      .map(
        (r) => `<li class="${r.failures.length || r.undoFailures.length || r.error ? 'ng' : 'ok'}">${esc(r.name)}
        ${r.failures.map((f) => `<div class="d">${esc(f.selector)}：期待 <b>${esc(JSON.stringify(f.expected))}</b> / 実際 <b>${esc(JSON.stringify(f.actual))}</b></div>`).join('')}
        ${r.undoFailures.map((u) => `<div class="d">元に戻らない：${esc(u)}</div>`).join('')}
        ${r.error ? `<pre class="d">${esc(r.error)}</pre>` : ''}</li>`,
      )
      .join('')}</ol>`;
  (window as unknown as { suiteResults: CaseResult[] }).suiteResults = results;
}

main();
