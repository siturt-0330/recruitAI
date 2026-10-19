/** 中継 API（worker/）の URL。公開版は api.rakuraku-entry.com、手元では wrangler dev（8787） */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://api.rakuraku-entry.com' : 'http://localhost:8787');
