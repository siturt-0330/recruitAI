/**
 * Sophon（AI）の窓口。OpenAI の API キーはサーバー側（.env.local の OPENAI_API_KEY）にだけ置く。
 * キーがなければ 501 を返し、ブラウザ側はルールで作る簡易版に切り替える。
 */

type Task = 'review' | 'organize' | 'deepdive';

const SCHEMAS: Record<Task, { name: string; schema: object; instructions: string }> = {
  review: {
    name: 'interview_review',
    instructions:
      'あなたは就活生を支える AI「Sophon」です。面接の記録を読み、良かった点、次に直したいこと、気づき（他社でもよく聞かれる質問、前回の面接との食い違いなど）を、やさしく具体的な日本語で短く返してください。気づきは最大3つ。',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['good', 'improve', 'notes'],
      properties: {
        good: { type: 'string' },
        improve: { type: 'string' },
        notes: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  organize: {
    name: 'interview_notes',
    instructions:
      'あなたは就活生を支える AI「Sophon」です。面接直後のまとまっていないメモ（音声の書き起こしなど）を、聞かれた質問と自分の答え、逆質問、次に直したいことに整理してください。答えに詰まった質問は stuck を true にしてください。メモにないことは作らないでください。',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['questions', 'reverseQuestions', 'improvements'],
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['question', 'answer', 'stuck'],
            properties: { question: { type: 'string' }, answer: { type: 'string' }, stuck: { type: 'boolean' } },
          },
        },
        reverseQuestions: { type: 'string' },
        improvements: { type: 'string' },
      },
    },
  },
  deepdive: {
    name: 'episode_deepdive',
    instructions:
      'あなたは就活生の自己分析を手伝う AI「Sophon」です。エピソード（状況・課題・行動・結果）とこれまでのやり取りを読み、面接で深掘りされそうな点を1つだけ質問してください。質問は短く、答えやすく。あわせて、このエピソードから見える強みを最大3つ、短い言葉で返してください。',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['question', 'strengths'],
      properties: { question: { type: 'string' }, strengths: { type: 'array', items: { type: 'string' } } },
    },
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: 'no-api-key' }, { status: 501 });

  const { task, input } = (await request.json()) as { task: Task; input: unknown };
  const def = SCHEMAS[task];
  if (!def) return Response.json({ error: 'unknown-task' }, { status: 400 });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-6-luna',
      messages: [
        { role: 'system', content: def.instructions },
        { role: 'user', content: JSON.stringify(input) },
      ],
      response_format: { type: 'json_schema', json_schema: { name: def.name, schema: def.schema, strict: true } },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return Response.json({ error: `openai-${res.status}`, detail: body.slice(0, 300) }, { status: 502 });
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  try {
    return Response.json({ result: JSON.parse(data.choices?.[0]?.message?.content ?? '{}') });
  } catch {
    return Response.json({ error: 'bad-response' }, { status: 502 });
  }
}
