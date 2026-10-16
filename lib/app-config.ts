/**
 * 公開に関わる設定。名前を変えるときや、中継 API の URL を変えるときはここと wxt.config.ts を直す。
 */

/** 拡張機能の名前（manifest の name とあわせる） */
export const APP_NAME = 'RecruitAI';

declare const __API_URL__: string;

/** Sophon 判定の中継 API（worker/）。ビルド時に wxt.config.ts で決まる */
export const API_URL: string = __API_URL__;
