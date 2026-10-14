import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // データはすべてブラウザ側（localStorage）にあるので、サーバー側のキャッシュは使わない
  cacheComponents: false,
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
