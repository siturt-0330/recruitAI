# RecruitAI 中継 API（Cloudflare Workers）

拡張機能の「Sophon 判定」を中継する API。OpenAI の API キーはここにだけ置き、拡張機能には入れない。

- `POST /v1/classify` … 入力欄の判定（インストール・IP・全体の1日の回数に上限あり）
- `GET /v1/sponsor` … ポップアップのスポンサー枠の中身（`vars.SPONSOR`）
- `GET /v1/stats` … 今日の利用回数（`Authorization: Bearer <ADMIN_TOKEN>`）
- `GET /privacy` … プライバシーポリシー（`store/privacy.html`）

## 公開の手順

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ADMIN_TOKEN
npx wrangler deploy
```

中継 API の URL は `https://api.rakuraku-entry.com`（`wrangler.jsonc` の `routes`）。公開後に変えると拡張機能が止まるので変えないこと。
拡張機能は `npm run zip:release` で作る（`wxt.config.ts` の `PROD_API_URL` と同じ URL）。

## 上限と料金

`wrangler.jsonc` の `vars` で変える（変えたら `npx wrangler deploy`）。

- `LIMIT_PER_INSTALL` … 1インストールあたり1日の回数
- `LIMIT_PER_IP` … 1つの IP あたり1日の回数
- `LIMIT_GLOBAL` … 全体の1日の回数。これ × 1回あたりの料金 が、1日に払う API 使用料の上限になる

上限は日本時間の0時にリセットされる。上限に達した利用者は、その日はルールだけで入力される。

## スポンサー枠

`vars.SPONSOR` に JSON を入れて deploy すると、拡張機能を出し直さずに差し替えられる（空にすると非表示）。

```json
{"title":"〇〇","body":"一言の説明","url":"https://...","cta":"見てみる"}
```

## ローカルで試す

`.dev.vars.example` を `.dev.vars` にコピーして `npx wrangler dev`。`MOCK_AI=1` なら OpenAI を呼ばない。
