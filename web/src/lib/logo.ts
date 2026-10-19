'use client';

import { isSharedHost, siteOf } from '@ext/sophon-link';
import type { Company } from './types';

/** 同じ会社名で何度も問い合わせないよう、このページを開いている間は結果を覚えておく */
const cache = new Map<string, Promise<string>>();

async function request(query: string): Promise<string> {
  try {
    const res = await fetch(`/api/logo?${query}`);
    return ((await res.json()) as { logo?: string }).logo ?? '';
  } catch {
    return '';
  }
}

/** 会社名からロゴを探す（見つからなければ空） */
export function logoByName(name: string): Promise<string> {
  const key = name.trim();
  if (!key) return Promise.resolve('');
  if (!cache.has(key)) cache.set(key, request(`name=${encodeURIComponent(key)}`));
  return cache.get(key)!;
}

/** 会社のロゴを探す。マイページが会社自身のサイトにあればそこから、なければ会社名から */
export async function logoFor(c: Pick<Company, 'name' | 'mypageUrl' | 'url'>): Promise<string> {
  // マイページは「mypage.example.co.jp」のような採用用のサイトが多いので、会社の本体のドメインから取る
  for (const [raw, root] of [
    [c.url, false],
    [c.mypageUrl, true],
  ] as const) {
    try {
      const u = new URL(raw);
      if (isSharedHost(u.hostname)) continue;
      const site = root ? `https://${siteOf(u.hostname)}` : u.origin;
      const logo = await request(`url=${encodeURIComponent(site)}`);
      if (logo) return logo;
    } catch {
      // URL がなければ次へ
    }
  }
  return logoByName(c.name);
}
