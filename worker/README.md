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

## コラム（/column）

就活生が記事を書き合うページ。読むのはだれでも、書けるのは招待コードを持つ人だけ（いまは招待制）。コードは `src/column/`。

| URL | 中身 |
| --- | --- |
| `/column` | 一覧（おすすめ＝新着・フォロー中・ハッシュタグ・検索） |
| `/column/p/<id>` | 記事 |
| `/column/u/<handle>` | 書き手のページ |
| `/column/write`、`/column/write/<id>` | 書く画面（`column-app/` の React。`npm run build:column` で `site/column-assets/write/` に書き出す） |
| `/column/settings` | プロフィール・ログアウト・退会 |
| `/column/join` | 招待コードを入れて書き手になる |
| `/column/admin` | 運営の画面（通報・非表示と戻し・招待コード）。`COLUMN_ADMIN_EMAILS`（シークレット）のアカウントだけ |
| `/column/terms` | 利用規約と投稿のルール |
| `/column/sitemap.xml` | 記事のサイトマップ（`site/robots.txt` から案内） |

- データは D1（`COLUMN_DB`、表は `migrations/`）、画像は R2（`COLUMN_IMAGES`）。画像はブラウザで長辺 1600px の WebP に縮めてから送る
- ログインは Google（OpenID Connect）。セッションは D1、Cookie は `__Host-col_sid`（30 日）
- 記事の本文は JSON のブロック（`src/column/blocks.ts`）。表示するときに HTML にし、利用者の HTML はそのまま出さない
- 1 日の上限：記事 20・画像 40・コメント 50・スキ 300・フォロー 200・通報 20（`api.ts` と `write.ts` の `DAILY`）
- コメントを書ける人は `vars.COLUMN_COMMENTS`（`members`＝書き手どうしだけ、`everyone`＝ログインした人ならだれでも）
- コラムのページには AdSense を出さない（人が書いた記事に広告を出すと、問題のある投稿で AdSense が止まるおそれがあるため）

### 初めて公開するとき

```bash
cd worker
npx wrangler d1 create rakuraku-column          # 出てきた database_id を wrangler.jsonc に入れる
npx wrangler d1 migrations apply COLUMN_DB --remote
npx wrangler r2 bucket create rakuraku-column-images
npx wrangler secret put GOOGLE_CLIENT_ID         # Google Cloud の OAuth クライアント（ウェブ）
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

- Google Cloud の OAuth クライアントのリダイレクト URI：`https://rakuraku-entry.com/column/auth/callback`（手元で試すなら `http://localhost:8788/column/auth/callback` も）
- 運営の Google アカウントを `npx wrangler secret put COLUMN_ADMIN_EMAILS` で入れる（カンマ区切り。リポジトリに書かない）
- 公開したら、運営のアカウントでログインして `/column/admin` で招待コードを作る

### 手元で試す

`.claude/launch.json` の `column`（`npx wrangler dev --port 8790 --local-upstream localhost:8790 --var COLUMN_DEV_LOGIN:1 --var COLUMN_ADMIN_EMAILS:admin@example.com`）。
D1 と R2 は手元の模擬で動く。最初に `npx wrangler d1 migrations apply COLUMN_DB --local` で表を作る。

- Google を使わずにログインするには `http://localhost:8790/column/auth/dev?email=admin@example.com`（`COLUMN_DEV_LOGIN=1` で、http の localhost のときだけ動く。**本番には入れない**）
- `--local-upstream` を付けないと、wrangler dev が URL を本番のドメインに書きかえるので、ログインや送信元の確認がうまくいかない
- 書く画面を直したら `npm run build:column`（ルートで）
