/**
 * 公開に関わる設定。名前を変えるときや、中継 API の URL を変えるときはここと wxt.config.ts を直す。
 */

/** 拡張機能の名前（manifest の name とあわせる） */
export const APP_NAME = 'らくらくエントリー';

declare const __API_URL__: string;

/** Sophon 判定の中継 API（worker/）。ビルド時に wxt.config.ts で決まる */
export const API_URL: string = __API_URL__;

declare const __WEB_URL__: string;

/** Web 版（マイページ管理）の URL。公開用は app.rakuraku-entry.com、開発中は手元の next dev */
export const WEB_URL: string = __WEB_URL__;
