import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'RecruitAI',
    description: '応募フォームの氏名・生年月日などを、保存したプロフィールから自動で入力します',
    permissions: ['activeTab', 'scripting', 'storage'],
    host_permissions: ['https://api.openai.com/*'],
    action: { default_title: 'RecruitAI' },
    commands: {
      'fill-page': {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'このページのフォームに入力',
      },
    },
  },
});
