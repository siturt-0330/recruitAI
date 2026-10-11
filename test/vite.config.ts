import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// テストフォーム（/test/）と、拡張機能 API をスタブにした UI プレビュー（/test/popup.html・/test/options.html）を配信する
const root = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root,
  resolve: {
    alias: [
      { find: '#imports', replacement: fileURLToPath(new URL('./imports-stub.ts', import.meta.url)) },
      { find: /^@\//, replacement: `${root.replace(/\\/g, '/')}` },
    ],
  },
  server: { port: 5179, strictPort: true },
});
