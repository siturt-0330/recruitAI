import { defineConfig } from 'wxt';

/**
 * 公開用のビルド（npm run build:release / zip:release）かどうか。
 * 公開用では、まだ公開していない Sophon（Web アプリ）との連携を外す。
 */
const release = process.env.npm_lifecycle_event?.endsWith(':release') ?? false;

/** 公開した中継 API の URL（worker/ を deploy したあとに入れる） */
const PROD_API_URL = 'https://api.rakuraku-entry.com';
const apiUrl = release ? PROD_API_URL : (process.env.API_URL ?? 'http://localhost:8787');
if (release && !PROD_API_URL) {
  throw new Error('wxt.config.ts の PROD_API_URL に、公開した中継 API の URL を入れてください');
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // 公開用では Sophon 連携の中継スクリプト（sophon-bridge）を入れない
  filterEntrypoints: release ? ['background', 'content', 'popup', 'options'] : undefined,
  vite: () => ({
    define: { __API_URL__: JSON.stringify(apiUrl) },
  }),
  manifest: {
    name: 'らくらくエントリー｜就活エントリー自動入力',
    description: '応募フォームの氏名・生年月日などを、保存したプロフィールから自動で入力します',
    permissions: ['activeTab', 'scripting', 'storage'],
    host_permissions: [`${new URL(apiUrl).origin}/*`],
    action: { default_title: 'らくらくエントリー' },
    commands: {
      'fill-page': {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'このページのフォームに入力',
      },
    },
  },
});
