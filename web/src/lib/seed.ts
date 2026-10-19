import { addDays, nowIso, today } from './dates';
import type { AppData, Company } from './types';

export const uid = () => crypto.randomUUID();

export function emptyCompany(name: string): Company {
  const now = nowIso();
  return {
    id: uid(),
    name,
    url: '',
    logo: '',
    industry: '',
    stage: 'entry',
    deadline: '',
    deadlineLabel: '',
    nextAt: '',
    nextLabel: '',
    mypageUrl: '',
    loginId: '',
    hasPassword: false,
    memo: '',
    blocks: [],
    props: [],
    submittedAt: '',
    createdAt: now,
    updatedAt: now,
  };
}

/** はじめて開いたときに入れる架空のサンプル。日付は今日を基準に作る */
export function sampleData(): AppData {
  const t = today();
  const c = (patch: Partial<Company> & { name: string }): Company => ({ ...emptyCompany(patch.name), ...patch });
  const companies: Company[] = [
    c({ name: 'A自動車', industry: '自動車', stage: 'entry', deadline: addDays(t, 1), deadlineLabel: 'ES', url: 'https://recruit.example-auto.jp/' }),
    c({ name: 'E食品', industry: '食品', stage: 'entry', deadline: addDays(t, 3), deadlineLabel: 'ES' }),
    c({ name: 'Cコンサル', industry: 'コンサル', stage: 'final', nextAt: `${addDays(t, 1)}T14:00`, nextLabel: '最終面接（Web）' }),
    c({
      name: 'B商事',
      industry: '商社',
      stage: 'interview2',
      memo: '総合商社。若手の海外駐在が多い。',
      blocks: [{ id: uid(), type: 'text', text: '総合商社。若手の海外駐在が多い。' }],
    }),
    c({ name: 'D電機', industry: '電機', stage: 'offer', deadline: addDays(t, 16), deadlineLabel: '内定承諾の回答' }),
    c({ name: 'F銀行', industry: '金融', stage: 'entry', nextAt: `${addDays(t, 5)}T13:00`, nextLabel: '説明会' }),
    c({ name: 'Gソフト', industry: 'IT・通信', stage: 'esSubmitted', nextLabel: '結果待ち' }),
  ];
  return { companies, industries: [], profile: null, doneTasks: {}, sample: true, removedIds: [] };
}
