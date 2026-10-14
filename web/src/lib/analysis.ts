import type { AppData, Episode, Interview } from './types';

/** 質問文を比べやすくする（「〜ですか？」の揺れをそろえる） */
export function normalizeQuestion(q: string): string {
  return q
    .normalize('NFKC')
    .replace(/[？?。、！!\s]/g, '')
    .replace(/(ですか|ますか|でしょうか|ください|教えて)$/g, '');
}

/** 質問の話題。似た質問を同じものとして数える */
const TOPICS: [string, RegExp][] = [
  ['学生時代に力を入れたこと', /力を入れ|ガクチカ|頑張った/],
  ['チームでの対立', /意見が割れ|対立|衝突|チームで.*(意見|もめ)/],
  ['志望理由', /なぜ|志望|理由|選んだ/],
  ['自己PR・強み', /強み|自己PR|長所|アピール/],
  ['弱み・短所', /弱み|短所/],
  ['挫折経験', /挫折|失敗|困難|苦労/],
  ['将来のキャリア', /将来|キャリア|何年後|やりたいこと/],
];

export function topicOf(question: string): string {
  return TOPICS.find(([, re]) => re.test(question))?.[0] ?? normalizeQuestion(question).slice(0, 20);
}

export interface FrequentQuestion {
  topic: string;
  count: number;
  companies: string[];
  stuck: number;
  examples: string[];
}

/** 企業をまたいで、よく聞かれる質問・詰まった質問を集める */
export function frequentQuestions(data: AppData): FrequentQuestion[] {
  const map = new Map<string, FrequentQuestion>();
  const name = new Map(data.companies.map((c) => [c.id, c.name]));
  for (const i of data.interviews) {
    for (const q of i.questions) {
      if (!q.question.trim()) continue;
      const topic = topicOf(q.question);
      const f = map.get(topic) ?? { topic, count: 0, companies: [], stuck: 0, examples: [] };
      f.count++;
      const company = name.get(i.companyId) ?? '';
      if (company && !f.companies.includes(company)) f.companies.push(company);
      if (q.stuck) f.stuck++;
      if (f.examples.length < 3 && !f.examples.includes(q.question)) f.examples.push(q.question);
      map.set(topic, f);
    }
  }
  return [...map.values()].sort((a, b) => b.companies.length - a.companies.length || b.stuck - a.stuck);
}

/** エピソードを使った企業 */
export function companiesUsingEpisode(data: AppData, episodeId: string): string[] {
  const name = new Map(data.companies.map((c) => [c.id, c.name]));
  const set = new Set<string>();
  for (const i of data.interviews) if (i.questions.some((q) => q.episodeId === episodeId)) set.add(name.get(i.companyId) ?? '');
  for (const a of data.esAnswers) if (a.episodeIds.includes(episodeId)) a.companyIds.forEach((id) => set.add(name.get(id) ?? ''));
  set.delete('');
  return [...set];
}

/** 同じ企業の前回の面接（比較用） */
export function previousInterview(data: AppData, interview: Interview): Interview | undefined {
  return data.interviews
    .filter((i) => i.companyId === interview.companyId && i.id !== interview.id && i.at < interview.at)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
}

export function episodeCompleteness(e: Episode): number {
  return [e.situation, e.task, e.action, e.result].filter((x) => x.trim()).length / 4;
}
