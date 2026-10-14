# Sophon（就活管理 Web アプリ）

企業ボード・面接の振り返り・自己分析・ES・予定をひとつにまとめる Web アプリです。
拡張機能（RecruitAI）とは別に動きます。のちほど統合する予定です。

## 起動

```bash
npm install
npm run dev -- --port 3100
```

http://localhost:3100 を開きます。最初はサンプルデータが入っています（ホームの「消して始める」で消せます）。

## Sophon（AI）をつなぐ

`web/.env.local` を作って、次のように書きます（このファイルは Git に含まれません）。

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-6-luna
```

キーがないときは、ルールだけで動く簡易版の Sophon が答えます。

## データの保存先

いまはブラウザの localStorage に保存しています。データの読み書きは `src/lib/store.ts` にまとめてあるので、あとで Supabase などに置き換えられます。

## 拡張機能（RecruitAI）との連携

拡張機能を入れた Chrome で Sophon を開くと、自動でつながります（プロフィール画面に「拡張機能と同期済み」と出ます）。

- プロフィール：Sophon と拡張機能の設定画面のどちらで直しても、新しいほうに合わせます
- 企業と ES：Sophon から拡張機能に渡します。応募フォームで企業を見分けたり、記述欄に ES を出したりするのに使います
- 「ボードに記録」：応募フォームのバーで押すと、次に Sophon を開いたときに企業が「ES提出済」になります

やり取りは、Sophon のページでだけ動く拡張機能の中継スクリプト（`entrypoints/sophon-bridge.content.ts`）と `window.postMessage` で行い、外部には送りません。
共有する型・プロフィールの項目は、リポジトリ直下の `lib/`（`@ext/*`）にあります。
Sophon の URL を変えるときは `lib/sophon-link.ts` の `SOPHON_URL` と `SOPHON_MATCHES` を直してください。
