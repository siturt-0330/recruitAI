'use client';

import { useEffect, useState } from 'react';
import { daysUntil, today } from './dates';
import { SITE_URL } from './site-url';

export interface SpiWord {
  w: string;
  y: string;
  m: string;
  e: string;
}

/** 言葉のリストは公式サイトの SPI 用語集から読む（ページを開いている間は覚えておく） */
let list: Promise<SpiWord[]> | null = null;
function loadWords(): Promise<SpiWord[]> {
  list ??= fetch(`${SITE_URL}/game/spi-goi/words.json`)
    .then((r) => (r.ok ? (r.json() as Promise<SpiWord[]>) : []))
    .catch(() => {
      list = null;
      return [];
    });
  return list;
}

/** 今日の SPI 語。日付で決めるので、同じ日はだれが見ても同じ言葉になる（読めなければ null） */
export function useTodayWord(): SpiWord | null {
  const [word, setWord] = useState<SpiWord | null>(null);
  useEffect(() => {
    let alive = true;
    loadWords().then((words) => {
      if (!alive || !words.length) return;
      const day = -daysUntil('2026-01-01', today());
      setWord(words[((day % words.length) + words.length) % words.length]!);
    });
    return () => {
      alive = false;
    };
  }, []);
  return word;
}
