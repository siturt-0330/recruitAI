// wrangler types が作らない、コラムのシークレットと手元の確認用の設定
interface Env {
  /** Google Cloud の OAuth クライアント（npx wrangler secret put で入れる） */
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /** "1" のとき、localhost でだけ仮のログイン（/column/auth/dev）を使える。本番では入れない */
  COLUMN_DEV_LOGIN: string;
}
