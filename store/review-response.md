# ストアの審査への返事（1.1.5 の「設定画面が真っ白」への対応）

2026-10-28 に、1.1.5 が「Options page is not working, it is blank and could not update the user details to autofill and save」で差し戻された。

手元では再現しなかった（Chrome 155・Edge の新しいプロフィールで、空の状態から設定画面を開き、8 ページ・78 個の欄に入力して開き直しても値が残る）。そのうえで 1.1.6 で次のように直した。

- 保存データの読み込みに失敗しても、空のプロフィールで開く（以前は読み込みが終わらないと何も表示しなかった）
- 画面でエラーが起きたら、真っ白にせず、エラーの内容と「開き直す」ボタンを出す
- 読み込み中も「読み込み中… / Loading…」を出す
- ポップアップも、読み込みのどれかが失敗しても開く
- 設定画面の右上に「保存」ボタンを置いた（入力は自動でも保存する）

## ダッシュボードの「テスト手順」に貼る英語

```
How to test (the UI is in Japanese):
1. After installing, click the extension icon and press 「プロフィールを作成」 (Create profile), or right-click the icon > Options. The options page opens in a new tab.
2. On the first page 「基本情報」 (Basic info), type a last name in 「姓」, a first name in 「名」, and katakana in 「セイ」「メイ」 (e.g. ヤマダ / タロウ). Pick a date in 「生年月日」 (Date of birth).
3. Changes are saved automatically ("保存済み" = Saved, top right). You can also press the black 「保存」 (Save) button.
4. Use the left menu to open other pages (連絡先・住所 = Contact/Address, 学歴 = Education). Reloading the page keeps the values.
5. To test autofill, open any job application form (e.g. a page with name/email/address fields), click the extension icon and press 「このページに入力」 (Fill this page).
```

## 再審査の依頼に書く英語

```
Thank you for the review. We could not reproduce a blank options page in Chrome 155 with a fresh profile: the options page opens, accepts input on all pages, and keeps the values after reload. To make it robust in any environment, version 1.1.6 now (1) opens with an empty profile even if reading storage fails, (2) shows an error message with a Reload button instead of a blank page if anything goes wrong, (3) shows "Loading…" while loading, and (4) adds an explicit Save button (changes are also saved automatically). Test steps are in the test instructions. The UI is in Japanese; "保存" means Save and "保存済み" means Saved.
```
