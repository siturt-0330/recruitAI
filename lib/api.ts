import { API_URL } from './app-config';
import type { RemoteAnswer, RemoteQuestion } from './types';

/**
 * Sophon 判定の中継 API（worker/）に問い合わせる。
 * 送るのはフォームの見出しなどの構造と、インストールごとのランダムな ID だけで、プロフィールの中身は送らない。
 */
export async function classifyViaApi(installId: string, formText: string, questions: RemoteQuestion[]): Promise<RemoteAnswer[]> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId, formText, questions }),
    });
  } catch {
    throw new Error('Sophon に接続できませんでした');
  }
  if (res.status === 429) throw new Error('今日の Sophon の利用回数の上限に達しました。明日また使えます');
  if (!res.ok) throw new Error(`Sophon に接続できませんでした（${res.status}）`);
  const data = (await res.json()) as { answers?: RemoteAnswer[] };
  return data.answers ?? [];
}

export interface Sponsor {
  title: string;
  body: string;
  url: string;
  cta: string;
}

/** ポップアップのスポンサー枠。中身は中継 API の設定で差し替える（なければ null） */
export async function fetchSponsor(): Promise<Sponsor | null> {
  try {
    const res = await fetch(`${API_URL}/v1/sponsor`);
    if (!res.ok) return null;
    const s = (await res.json()) as { sponsor?: Partial<Sponsor> | null };
    const x = s.sponsor;
    if (!x?.title || !x.url || !/^https:\/\//.test(x.url)) return null;
    return { title: x.title, body: x.body ?? '', url: x.url, cta: x.cta || '詳しく見る' };
  } catch {
    return null;
  }
}
