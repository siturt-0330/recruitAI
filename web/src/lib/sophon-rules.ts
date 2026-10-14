import { frequentQuestions, previousInterview, topicOf } from './analysis';
import type { AppData, Episode, Interview, InterviewQuestion, SophonReview } from './types';
import { nowIso } from './dates';
import { uid } from './seed';

/**
 * Sophon の簡易版。AI のキーがないとき・失敗したときに、ルールだけで振り返りや質問を作る。
 */

/** 文字の2つ組（日本語は単語の区切りがないので、2文字ずつで比べる） */
const words = (s: string) => {
  const t = s.normalize('NFKC').replace(/[、。！？!?\s「」]/g, '');
  const set = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
};

function similarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 1;
  let hit = 0;
  A.forEach((w) => B.has(w) && hit++);
  return hit / Math.min(A.size, B.size);
}

/** 詰まった質問に使えそうなエピソードを探す */
function episodeFor(question: string, episodes: Episode[]): Episode | undefined {
  const hints: Record<string, string[]> = {
    チームでの対立: ['意見', '対立', '割れ', '調整', '説得', 'チーム', '議論'],
    挫折経験: ['失敗', '困難', '孤立', '挫折', '悔し', 'つまず'],
    '自己PR・強み': [],
    学生時代に力を入れたこと: [],
  };
  const keywords = hints[topicOf(question)];
  if (!keywords) return undefined;
  if (!keywords.length) return episodes[0];
  // 当てはまる言葉がいちばん多いエピソードを選ぶ
  let best: { e: Episode; score: number } | undefined;
  for (const e of episodes) {
    const text = `${e.situation}${e.task}${e.action}${e.result}${e.strengths.join('')}`;
    const score = keywords.filter((k) => text.includes(k)).length;
    if (score && (!best || score > best.score)) best = { e, score };
  }
  return best?.e;
}

export function reviewInterviewByRules(data: AppData, interview: Interview): SophonReview {
  const goods: string[] = [];
  const improves: string[] = [];
  const notes: string[] = [];

  const linked = interview.questions.filter((q) => q.episodeId);
  if (linked.length) goods.push(`${linked.length}つの質問で、エピソードを使って具体的に話せています。`);
  if (interview.rating >= 4) goods.push('手応えは良好です。');
  if (interview.reverseQuestions.trim()) goods.push('逆質問も用意できていました。');
  if (!goods.length) goods.push('記録を残せたことが、次の面接の準備になります。');

  for (const q of interview.questions.filter((x) => x.stuck)) {
    const ep = episodeFor(q.question, data.episodes);
    improves.push(
      ep
        ? `「${q.question}」には、エピソード「${ep.title}」が使えそうです。`
        : `「${q.question}」は答えを準備しておきましょう。自己分析でエピソードを探してみてください。`,
    );
  }
  if (!improves.length) improves.push('大きな詰まりはありませんでした。次の面接でも同じ流れで話せそうです。');

  // 企業をまたいでよく聞かれる質問
  const freq = frequentQuestions(data);
  for (const q of interview.questions) {
    const f = freq.find((x) => x.topic === topicOf(q.question));
    if (f && f.companies.length >= 2) notes.push(`「${f.topic}」は ${f.companies.length}社で聞かれています。答えを固めておきましょう。`);
  }

  // 前回の面接との食い違い
  const prev = previousInterview(data, interview);
  if (prev) {
    for (const q of interview.questions) {
      const topic = topicOf(q.question);
      const before = prev.questions.find((p) => topicOf(p.question) === topic);
      if (before && before.answer && q.answer && topic === '志望理由' && similarity(before.answer, q.answer) < 0.3) {
        notes.push(`${prev.round}と志望理由の話し方が違います（前回：「${before.answer.slice(0, 24)}…」）。軸をそろえましょう。`);
      }
    }
  }

  return { good: goods.join(''), improve: improves.join('\n'), notes: [...new Set(notes)], createdAt: nowIso(), by: 'rules' };
}

/** 音声メモなどのまとまっていないメモから、質問と答えを取り出す */
export function organizeNotesByRules(raw: string): { questions: InterviewQuestion[]; reverseQuestions: string; improvements: string } {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const questions: InterviewQuestion[] = [];
  let reverse = '';
  let improve = '';
  let current: InterviewQuestion | null = null;
  for (const line of lines) {
    const body = line.replace(/^(Q|質問|問)[:：.．\s]*/i, '').replace(/^(A|回答|答え)[:：.．\s]*/i, '');
    if (/^(逆質問)/.test(line)) {
      reverse += `${line.replace(/^逆質問[:：\s]*/, '')}\n`;
      continue;
    }
    if (/^(反省|改善|次は)/.test(line)) {
      improve += `${line.replace(/^(反省|改善|次は)[:：\s]*/, '')}\n`;
      continue;
    }
    if (/^(Q|質問|問)[:：.．\s]/i.test(line) || /[？?]$/.test(line)) {
      current = { id: uid(), question: body, answer: '', stuck: /詰ま|答えられ|出てこな/.test(line), episodeId: '' };
      questions.push(current);
    } else if (current) {
      current.answer = `${current.answer}${current.answer ? ' ' : ''}${body}`;
      if (/詰ま|答えられ|出てこな/.test(line)) current.stuck = true;
    }
  }
  return { questions, reverseQuestions: reverse.trim(), improvements: improve.trim() };
}

const PROBES = [
  'そのとき、なぜその方法を選んだのですか？',
  '一番大変だったのはどんな場面でしたか？',
  'ほかの人から反対されたことはありましたか？ どう乗り越えましたか？',
  'その経験から、今の自分に活きていることは何ですか？',
  'もう一度やるとしたら、何を変えますか？',
];

/** エピソードの掘り下げの質問。足りない部分（状況・課題・行動・結果）を先に聞く */
export function nextQuestionByRules(e: Episode): { question: string; strengths: string[] } {
  let question = '';
  if (!e.situation.trim()) question = `「${e.title}」は、どんな状況での出来事でしたか？`;
  else if (!e.task.trim()) question = 'そのとき、何が問題になっていましたか？';
  else if (!e.action.trim()) question = 'その問題に対して、あなたは具体的に何をしましたか？';
  else if (!e.result.trim()) question = '結果はどうなりましたか？ 数字で言えることはありますか？';
  else {
    const asked = new Set(e.chat.filter((m) => m.role === 'sophon').map((m) => m.text));
    question = PROBES.find((p) => !asked.has(p)) ?? 'ほかに、この経験で印象に残っていることはありますか？';
  }
  const text = `${e.task}${e.action}${e.chat.filter((m) => m.role === 'me').map((m) => m.text).join('')}`;
  const strengths = new Set(e.strengths);
  if (/説得|巻き込|協力|周り/.test(text)) strengths.add('巻き込む力');
  if (/仕組み|マニュアル|ルール|改善/.test(text)) strengths.add('仕組みを作る');
  if (/続け|毎日|継続/.test(text)) strengths.add('継続力');
  if (/整理|調整|まとめ/.test(text)) strengths.add('調整力');
  if (/挑戦|初めて|留学/.test(text)) strengths.add('挑戦');
  return { question, strengths: [...strengths] };
}
