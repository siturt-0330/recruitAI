// コラムの書く画面（React）を、site/column-assets/write/ に write.js と write.css として書き出す。
//   npm run build:column
// ファイル名にハッシュを付けない（Worker の入れ物の HTML が決まった名前で読み込むため）。静的ファイルは毎回 ETag で確かめられるので、古いものは残らない
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = fileURLToPath(new URL('../site/column-assets/write', import.meta.url));

/** 書き出したファイルの中身から版を作り、Worker が ?v= に付けられるようにする（新しい版を確実に読みこんでもらうため） */
function writeVersion(): Plugin {
  return {
    name: 'column-write-version',
    closeBundle() {
      const hash = createHash('sha1');
      for (const f of ['write.js', 'write.css']) hash.update(fs.readFileSync(path.join(outDir, f)));
      const file = fileURLToPath(new URL('../worker/src/column/write-version.ts', import.meta.url));
      fs.writeFileSync(file, `// npm run build:column が書く。書く画面の JS・CSS の版（?v= に付ける）\nexport const WRITE_VERSION = '${hash.digest('hex').slice(0, 10)}';\n`);
    },
  };
}

export default defineConfig({
  root: here,
  plugins: [react(), writeVersion()],
  build: {
    outDir,
    emptyOutDir: true,
    cssCodeSplit: false,
    target: 'es2022',
    rollupOptions: {
      input: fileURLToPath(new URL('./src/main.tsx', import.meta.url)),
      output: { entryFileNames: 'write.js', chunkFileNames: 'write-[name].js', assetFileNames: 'write[extname]' },
    },
  },
});
