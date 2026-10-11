import { FIELD_KEYS } from './fieldKeys';
import type { RemoteAnswer, RemoteQuestion } from './types';

const ENDPOINT = 'https://api.openai.com/v1/decisions';
const MODEL = 'gpt-6-luna';

const CHOICES = [
  ...Object.entries(FIELD_KEYS).map(([value, k]) => ({ value, description: k.ai })),
  {
    value: 'none',
    description: '上記のどれにも当てはまらない（志望動機・自由記述・パスワード・同意チェック・検索欄など）',
  },
];

interface DecisionsAnswer {
  type: string;
  name: string | null;
  choice?: string;
  confidence?: number;
}

/**
 * OpenAI Decisions API で各欄がどのプロフィール項目かを判定する。
 * input にはフォームの構造（ラベル・name 属性など）だけを渡し、ユーザーの個人情報は含めない。
 */
export async function classifyWithOpenAI(
  apiKey: string,
  formText: string,
  questions: RemoteQuestion[],
): Promise<RemoteAnswer[]> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: formText,
      questions: questions.map((q) => ({
        type: 'choice',
        name: q.name,
        instructions: q.instructions,
        choices: CHOICES,
      })),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { answers?: DecisionsAnswer[] };
  return (data.answers ?? [])
    .filter((a) => a.type === 'choice' && a.name && a.choice)
    .map((a) => ({ name: a.name!, choice: a.choice!, confidence: a.confidence ?? 0 }));
}
