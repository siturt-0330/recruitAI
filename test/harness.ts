// 拡張機能を読み込まずに入力エンジンを試すためのページ。`npm run harness` で起動する
import { FormFiller, type ClassifyRemote } from '../lib/engine';
import { describeForm, scanFields } from '../lib/extract';
import { PREFECTURES } from '../lib/prefectures';
import { classify } from '../lib/rules';
import { DEFAULT_SETTINGS, type Profile } from '../lib/types';

const profile: Profile = {
  id: 'test',
  label: '新卒用',
  lastName: '山田',
  firstName: '太郎',
  lastNameKana: 'ヤマダ',
  firstNameKana: 'タロウ',
  lastNameRoman: 'Yamada',
  firstNameRoman: 'Taro',
  birthDate: '1999-04-01',
  gender: 'male',
  email: 'taro@example.com',
  phone: '090-1234-5678',
  postalCode: '150-0041',
  prefecture: '東京都',
  city: '渋谷区',
  addressLine: '神南1-2-3',
  building: 'サンプルマンション101',
  school: 'サンプル大学',
  faculty: '経済学部',
  department: '経済学科',
  graduation: '2026-03',
};

const fillOptions = (name: string, items: string[]) => {
  const sel = document.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
  for (const t of items) sel.add(new Option(t, t));
};
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

fillOptions('birth_y', range(1980, 2010).map(String));
fillOptions('birth_m', range(1, 12).map(String));
fillOptions('birth_d', range(1, 31).map(String));
fillOptions('pref', PREFECTURES);
fillOptions('c_era_y', [...range(55, 63).map((n) => `昭和${n}年`), '平成元年', ...range(2, 20).map((n) => `平成${n}年`)]);
fillOptions('c_m', range(1, 12).map((n) => `${n}月`));
fillOptions('c_d', range(1, 31).map((n) => `${n}日`));
fillOptions('c_gy', range(2024, 2030).map(String));
fillOptions('c_gm', range(1, 12).map((n) => String(n).padStart(2, '0')));

// 「ラベルが弱い欄」だけを当てる AI のモック
const mockAi: ClassifyRemote = async (formText, questions) => {
  console.log(formText);
  const guess: Record<string, string> = { field_17: 'lastName', field_18: 'firstName', q3: 'email' };
  return questions.map((q) => {
    const line = formText.split('\n').find((l) => l.startsWith(`[${q.name}]`)) ?? '';
    const hit = Object.entries(guess).find(([n]) => line.includes(`name:"${n}"`));
    return { name: q.name, choice: hit?.[1] ?? 'none', confidence: hit ? 0.86 : 0.9 };
  });
};

const filler = new FormFiller(document);
const log = document.getElementById('log')!;

document.getElementById('fill')!.onclick = async () => {
  const useAi = (document.getElementById('mockAi') as HTMLInputElement).checked;
  const status = await filler.fill(profile, DEFAULT_SETTINGS, useAi ? mockAi : undefined);
  const rows = scanFields(document).map(({ desc, elements }) => {
    const c = classify(desc);
    const el = elements[0] as HTMLInputElement;
    const value = desc.kind === 'radio' ? elements.map((r) => ((r as HTMLInputElement).checked ? '●' : '○')).join('') : el.value;
    return `${(desc.name || desc.htmlId).padEnd(12)} rule=${String(c.key).padEnd(14)} ${c.confidence.toFixed(2)}  → ${JSON.stringify(value)}`;
  });
  log.textContent = `${JSON.stringify(status, null, 1)}\n\n${rows.join('\n')}`;
  (window as unknown as { describe: () => string }).describe = () => describeForm(scanFields(document));
};
document.getElementById('undo')!.onclick = () => {
  filler.undo();
  log.textContent = '';
};
