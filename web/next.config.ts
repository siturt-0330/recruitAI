import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // サーバーを使わず、HTML として書き出して配信する（app.rakuraku-entry.com）。データは使う人のブラウザの中にある
  output: "export",
  // データはすべてブラウザ側（localStorage）にあるので、サーバー側のキャッシュは使わない
  cacheComponents: false,
  // 開発中に左下に出る Next.js のマーク（N）を出さない。エラーは今までどおり表示される
  devIndicators: false,
  turbopack: {
    // 拡張機能（リポジトリ直下の lib/）の型とプロフィール定義を共有する
    root: path.join(__dirname, ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
