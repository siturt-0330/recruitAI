import { addDays, nowIso, today } from './dates';
import type { AppData, Company, EsAnswer, Episode, Interview } from './types';

export const uid = () => crypto.randomUUID();

export const EMPTY_SHEETS: AppData['sheets'] = { history: {}, strengths: {}, values: {}, gakuchika: {} };

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
    memo: '',
    submittedAt: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function emptyInterview(companyId: string, round = '一次面接'): Interview {
  const now = nowIso();
  return {
    id: uid(),
    companyId,
    round,
    at: `${today()}T10:00`,
    format: '対面',
    interviewers: '',
    rating: 0,
    questions: [],
    reverseQuestions: '',
    improvements: '',
    rawNotes: '',
    review: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function emptyEpisode(title = '新しいエピソード'): Episode {
  const now = nowIso();
  return { id: uid(), title, period: '', situation: '', task: '', action: '', result: '', strengths: [], chat: [], createdAt: now, updatedAt: now };
}

export function emptyEsAnswer(category: EsAnswer['category'] = '志望動機'): EsAnswer {
  const now = nowIso();
  return { id: uid(), category, title: '', text: '', charLimit: 400, companyIds: [], episodeIds: [], createdAt: now, updatedAt: now };
}

/** はじめて開いたときに入れる架空のサンプル。日付は今日を基準に作る */
export function sampleData(): AppData {
  const t = today();
  const c = (patch: Partial<Company> & { name: string }): Company => ({ ...emptyCompany(patch.name), ...patch });
  const companies: Company[] = [
    c({ name: 'A自動車', industry: '自動車', stage: 'entry', deadline: addDays(t, 1), deadlineLabel: 'ES', url: 'https://recruit.example-auto.jp/' }),
    c({ name: 'E食品', industry: '食品', stage: 'entry', deadline: addDays(t, 3), deadlineLabel: 'ES' }),
    c({ name: 'Cコンサル', industry: 'コンサル', stage: 'final', nextAt: `${addDays(t, 1)}T14:00`, nextLabel: '最終面接（Web）' }),
    c({ name: 'B商事', industry: '商社', stage: 'interview2', memo: '総合商社。若手の海外駐在が多い。' }),
    c({ name: 'D電機', industry: '電機', stage: 'offer', deadline: addDays(t, 16), deadlineLabel: '内定承諾の回答' }),
    c({ name: 'F銀行', industry: '金融', stage: 'entry', nextAt: `${addDays(t, 5)}T13:00`, nextLabel: '説明会' }),
    c({ name: 'Gソフト', industry: 'IT・通信', stage: 'esSubmitted', nextLabel: '結果待ち' }),
  ];
  const id = (name: string) => companies.find((x) => x.name === name)!.id;

  const episodes: Episode[] = [
    {
      ...emptyEpisode('サークルの新歓改革'),
      period: '大学1年',
      situation: '新入生の参加が年々減っていた',
      task: 'ビラ配りに頼った勧誘で、サークルの雰囲気が伝わらない',
      action: '体験会を毎週開き、反対する先輩を説得して役割を分担した',
      result: '新入生が前年の1.5倍に増えた',
      strengths: ['巻き込む力', '仕組みを作る'],
      chat: [
        { role: 'sophon', text: '新入生が1.5倍に増えたとき、最初に変えたことは何でしたか？' },
        { role: 'me', text: '勧誘のビラをやめて、体験会を毎週開くようにした' },
        { role: 'sophon', text: '反対した先輩はいましたか？ どう説得しましたか？' },
      ],
    },
    {
      ...emptyEpisode('カナダ留学'),
      period: '大学2年',
      situation: '語学学校で半年間の留学',
      task: '授業の議論についていけず、孤立しかけた',
      action: '毎日1人に話しかけると決めて続けた',
      result: '現地の友人と共同発表を成功させた',
      strengths: ['挑戦'],
    },
    {
      ...emptyEpisode('ゼミの共同研究'),
      period: '大学3年',
      situation: '4人で地域経済の共同研究',
      task: '分析方針で意見が割れた',
      action: '論点を表に整理し、全員の案を比べた',
      result: '学内発表で優秀賞',
      strengths: ['調整力'],
    },
  ];

  const interviews: Interview[] = [
    {
      ...emptyInterview(id('B商事'), '二次面接'),
      at: `${addDays(t, -1)}T15:00`,
      interviewers: '2名（人事・営業部長）',
      rating: 4,
      questions: [
        { id: uid(), question: '学生時代に力を入れたことは？', answer: 'サークルの新歓を作り直した話。人数を前年の1.5倍に。', stuck: false, episodeId: episodes[0]!.id },
        { id: uid(), question: 'チームで意見が割れたとき、どうしましたか？', answer: '答えに詰まった。具体例が出てこなかった。', stuck: true, episodeId: '' },
        { id: uid(), question: 'なぜ商社なのですか？', answer: '現場で人をつなぐ仕事がしたい、と回答。', stuck: false, episodeId: '' },
      ],
      reverseQuestions: '若手のうちに海外駐在の機会はありますか？',
    },
    {
      ...emptyInterview(id('B商事'), '一次面接'),
      at: `${addDays(t, -9)}T11:00`,
      format: 'Web',
      rating: 3,
      questions: [
        { id: uid(), question: 'なぜ商社なのですか？', answer: '海外で働きたいから、と回答。', stuck: false, episodeId: '' },
        { id: uid(), question: 'チームで対立したときの経験は？', answer: 'うまく答えられなかった。', stuck: true, episodeId: '' },
      ],
    },
    {
      ...emptyInterview(id('Cコンサル'), '二次面接'),
      at: `${addDays(t, -6)}T16:00`,
      format: 'Web',
      rating: 4,
      questions: [
        { id: uid(), question: '学生時代に力を入れたことは？', answer: '新歓改革の話。', stuck: false, episodeId: episodes[0]!.id },
        { id: uid(), question: 'チームで意見が割れたらどうしますか？', answer: 'ゼミの話を少しだけした。', stuck: false, episodeId: episodes[2]!.id },
      ],
    },
  ];

  const esAnswers: EsAnswer[] = [
    {
      ...emptyEsAnswer('ガクチカ'),
      title: '新歓改革（400字）',
      text: '大学1年のとき、所属するテニスサークルの新入生勧誘を作り直しました。…',
      charLimit: 400,
      companyIds: [id('B商事'), id('Cコンサル')],
      episodeIds: [episodes[0]!.id],
    },
    { ...emptyEsAnswer('志望動機'), title: 'B商事 志望動機', text: '人と人をつなぎ、現場で価値を生み出す仕事がしたいと考え…', charLimit: 300, companyIds: [id('B商事')] },
  ];

  return { companies, interviews, episodes, sheets: EMPTY_SHEETS, esAnswers, industries: [], profile: null, doneTasks: {}, sample: true };
}
