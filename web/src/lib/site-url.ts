/** 公式サイト（site/）の URL。公開版は rakuraku-entry.com、手元では wrangler dev（8788） */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.NODE_ENV === 'production' ? 'https://rakuraku-entry.com' : 'http://localhost:8788');

/** SPI 用語集のゲーム。mode で意味クイズ（quiz）や単語帳（book）をすぐ開く */
export const gameHref = (mode?: 'quiz' | 'book') => `${SITE_URL}/game/spi-goi${mode ? `?mode=${mode}` : ''}`;
