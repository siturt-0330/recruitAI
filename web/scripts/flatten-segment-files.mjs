// next build（output: "export"）のあとに動かす。
// Windows で書き出すと、ページを先読みするためのファイルが
//   out/companies/__next.companies/__PAGE__.txt
// のようにフォルダに分かれてしまう（Next.js が \ 区切りのパスを / だけ . に置き換えているため）。
// ブラウザは out/companies/__next.companies.__PAGE__.txt を取りに来るので、
// __next. で始まるフォルダの中身を . でつないだ 1 つのファイル名にまとめ直す。
// Mac や Linux で書き出したときは、まとめ直すものがないので何もしない。
import { promises as fs } from "node:fs";
import path from "node:path";

const outDir = path.join(import.meta.dirname, "..", "out");

async function filesIn(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const lists = await Promise.all(
    entries.map((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? filesIn(p) : [p];
    }),
  );
  return lists.flat();
}

let moved = 0;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const p = path.join(dir, e.name);
    if (dir === outDir && e.name === "_next") continue;
    if (!e.name.startsWith("__next.")) {
      await walk(p);
      continue;
    }
    for (const file of await filesIn(p)) {
      const parts = path.relative(p, file).split(path.sep);
      const dest = path.join(dir, [e.name, ...parts].join("."));
      await fs.rename(file, dest);
      moved++;
    }
    await fs.rm(p, { recursive: true });
  }
}

await walk(outDir);
console.log(`flatten-segment-files: ${moved} 個のファイルをまとめ直しました`);
