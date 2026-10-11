# RecruitAI

応募フォームの氏名・フリガナ・生年月日・住所などを、保存したプロフィールから自動で入力する Chrome 拡張機能です。

- 欄の判定はまずルール（`autocomplete` 属性・ラベル・見出し・name 属性）で行い、判定できない欄だけ OpenAI Decisions API に問い合わせます
- AI に送るのはフォームの構造（ラベル・placeholder・name 属性・選択肢）だけで、プロフィールの内容は送りません
- 和暦・カナ（全角/ひらがな/半角）・全角数字・ハイフン有無・3分割の電話番号などは、コードで変換します
- 確信度がしきい値未満の欄は黄色く表示し、ポップアップで候補から選び直せます

## 開発

```bash
npm install
npm run dev      # Chrome が起動し、拡張機能が読み込まれた状態になる
npm run build    # .output/chrome-mv3 に出力
npm run compile  # 型チェック
```

手元の Chrome で試す場合は `npm run build` のあと、`chrome://extensions` でデベロッパーモードをオンにし、「パッケージ化されていない拡張機能を読み込む」で `.output/chrome-mv3` を選びます。

### 拡張機能を読み込まずに試す

```bash
npm run harness
```

- http://localhost:5179/test/ … いろいろな形のテストフォームに入力エンジンを直接当てる（「AI モック」でAI判定の流れも確認できる）
- http://localhost:5179/test/popup.html ・ /test/options.html … 拡張 API をスタブにした UI プレビュー

## 構成

| パス | 役割 |
| --- | --- |
| `lib/extract.ts` | ページから入力欄を集め、ラベル・見出し・グループなどの特徴を取り出す |
| `lib/rules.ts` | 特徴からプロフィール項目を判定し、書式のヒント（和暦・カナ種別など）を出す |
| `lib/values.ts` | プロフィールから欄に入れる値の候補を作る |
| `lib/fill.ts` | 値の入力・選択肢のマッチング・元に戻す |
| `lib/engine.ts` | 上記をまとめ、AI 判定のマージとオーバーレイ表示を行う |
| `lib/openai.ts` | OpenAI Decisions API (`/v1/decisions`, `gpt-6-luna`) の呼び出し |
| `entrypoints/content.ts` | ポップアップ・ショートカットから注入されるコンテンツスクリプト |
| `entrypoints/background.ts` | ショートカット（Alt+Shift+F）と AI への問い合わせ |
| `entrypoints/popup` / `entrypoints/options` | ポップアップと設定画面 |

コンテンツスクリプトは常駐させず、`activeTab` 権限でボタンやショートカットが押されたときだけ注入します。
