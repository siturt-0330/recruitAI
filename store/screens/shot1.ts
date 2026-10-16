// ストア用スクリーンショット：入力後の応募フォーム（済の印とフローティングバー）
import { FormFiller } from '../../lib/engine';
import { DEFAULT_SETTINGS } from '../../lib/types';
import { testProfile } from '../../test/fixtures/profile';

const fillSelect = (name: string, values: string[]) => {
  const s = document.querySelector<HTMLSelectElement>(`select[name=${name}]`)!;
  for (const v of values) s.add(new Option(v, v));
};
fillSelect('birth_y', Array.from({ length: 12 }, (_, i) => String(2008 - i)));
fillSelect('birth_m', Array.from({ length: 12 }, (_, i) => String(i + 1)));
fillSelect('birth_d', Array.from({ length: 31 }, (_, i) => String(i + 1)));

const profile = testProfile({ lastName: '山田', firstName: '花子', lastNameKana: 'ヤマダ', firstNameKana: 'ハナコ', birthDate: '2004-05-12', school: 'サンプル大学' });
await new FormFiller(document).fill(profile, { ...DEFAULT_SETTINGS, engine: 'rules' });
document.body.dataset.ready = '1';
