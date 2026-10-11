// 拡張機能を読み込まずに入力エンジンを試すためのページ。`npm run harness` で起動する
import { FormFiller, type ClassifyRemote } from '../lib/engine';
import { describeForm, scanFields } from '../lib/extract';
import { PREFECTURES } from '../lib/prefectures';
import { classify } from '../lib/rules';
import { normalizeProfile } from '../lib/profile';
import { DEFAULT_SETTINGS } from '../lib/types';

const profile = normalizeProfile({
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
  admission: '2022-04',
  graduationStatus: 'expected',
  schoolType: '大学',
  bunri: '文系',
  cityKana: 'シブヤク',
  addressLineKana: 'ジンナン1-2-3',
  nearestLine: 'JR山手線',
  nearestStation: '渋谷',
  kiseiSame: new URLSearchParams(location.search).has('same'),
  kiseiPostalCode: '530-0001',
  kiseiPrefecture: '福島県',
  kiseiCity: '大阪市北区',
  kiseiAddressLine: '梅田1-2-3',
  kiseiPhone: '06-1234-5678',
  highSchool: '県立サンプル高等学校',
  highSchoolAdmission: '2019-04',
  highSchoolGraduation: '2022-03',
  highSchoolPrefecture: '福島県',
  schoolKana: 'サンプルダイガク',
  schoolPrefecture: '東京都',
  studyAbroad: 'なし',
  lab: '山本ゼミ',
  driverLicense: 'regularAT',
  driverLicenseDate: '2023-03',
  toeic: '780',
  toeicDate: '2024-12',
  qualifications: [{ name: '日商簿記検定2級 合格', date: '2024-06' }],
  club: 'テニスサークル',
  clubRole: '副部長',
  hobbies: '写真',
  specialSkills: 'ピアノ',
  desiredLocations: ['東京都', '大阪府', ''],
  personalRequest: '貴社の規定に従います。',
});

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
fillOptions('e_pref', PREFECTURES);
fillOptions('k_pref', PREFECTURES);
fillOptions('school_type', ['大学院', '大学', '短大', '高専', '専門学校']);
fillOptions('adm_y', range(2015, 2026).map(String));
for (const n of ['j_hs_gy', 'j_ug_gy']) fillOptions(n, range(2015, 2026).map(String));
for (const n of ['j_hs_gm', 'j_ug_gm']) fillOptions(n, range(1, 12).map(String));
fillOptions('j_hs_pref', PREFECTURES);
fillOptions('g_by', range(1995, 2008).map(String));
fillOptions('g_ey', range(1, 31).map(String));
fillOptions('g_em', range(1, 12).map(String));
fillOptions('g_ed', range(1, 31).map(String));

// 年を選んだあとに月・日の選択肢を作るフォーム（少し遅れて作る）
const by = document.querySelector<HTMLSelectElement>('select[name="g_by"]')!;
by.addEventListener('change', () =>
  setTimeout(() => {
    const m = document.querySelector<HTMLSelectElement>('select[name="g_bm"]')!;
    m.length = 1;
    range(1, 12).forEach((n) => m.add(new Option(String(n).padStart(2, '0'), String(n))));
    m.onchange = () =>
      setTimeout(() => {
        const d = document.querySelector<HTMLSelectElement>('select[name="g_bd"]')!;
        d.length = 1;
        range(1, 31).forEach((n) => d.add(new Option(String(n), String(n))));
      }, 80);
  }, 80),
);

const radios = (containerId: string, name: string, labels: string[]) => {
  const box = document.getElementById(containerId)!;
  for (const t of labels) {
    const label = document.createElement('label');
    label.innerHTML = `<input type="radio" name="${name}" />${t}`;
    label.style.marginRight = '6px';
    box.append(label);
  }
};
radios('h_initials', 'h_initial', Array.from('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'));
radios('h_prefs', 'h_pref', PREFECTURES);
fillOptions('adm_m', range(1, 12).map(String));

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
  (window as unknown as { diag: () => string }).diag = () => filler.diagnose();
};
document.getElementById('undo')!.onclick = () => {
  filler.undo();
  log.textContent = '';
};
