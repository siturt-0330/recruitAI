import { PREFECTURES } from '../../lib/prefectures';
import type { Profile } from '../../lib/types';

/**
 * 入力エンジンの回帰テスト用のフォーム。
 * expect のキーは CSS セレクタ。値の意味：
 *   文字列 … 入力欄はその値、select は選択中の value かテキスト、`radio:name` はチェックされた選択肢のテキスト
 *   ''     … 触ってはいけない（空のまま、または元の値のまま）
 *   true/false … チェックボックスの状態
 * `shadow:ホスト|内側` は Shadow DOM の中の要素。
 */
export interface Case {
  name: string;
  html: string;
  expect: Record<string, string | boolean>;
  profile?: Partial<Profile>;
  setup?(root: HTMLElement): void;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const opts = (items: (string | [string, string])[], empty = '選択してください') =>
  [`<option value="">${empty}</option>`, ...items.map((o) => (Array.isArray(o) ? `<option value="${o[0]}">${o[1]}</option>` : `<option>${o}</option>`))].join('');

export const CASES: Case[] = [
  {
    name: 'label for で紐づいた基本の欄',
    html: `<form>
      <p><label for="c1a">氏名</label><input id="c1a" name="c1_name"></p>
      <p><label for="c1b">フリガナ</label><input id="c1b" name="c1_kana"></p>
      <p><label for="c1c">メールアドレス</label><input id="c1c" type="email" name="c1_mail"></p>
    </form>`,
    expect: { '[name=c1_name]': '山田　太郎', '[name=c1_kana]': 'ヤマダ　タロウ', '[name=c1_mail]': 'taro@example.com' },
  },
  {
    name: 'placeholder だけの欄',
    html: `<form>
      <input name="c2a" placeholder="姓"> <input name="c2b" placeholder="名"><br>
      <input name="c2c" placeholder="セイ"> <input name="c2d" placeholder="メイ"><br>
      <input name="c2e" placeholder="メールアドレス"><br>
      <input name="c2f" placeholder="電話番号（ハイフンなし）">
    </form>`,
    expect: {
      '[name=c2a]': '山田',
      '[name=c2b]': '太郎',
      '[name=c2c]': 'ヤマダ',
      '[name=c2d]': 'タロウ',
      '[name=c2e]': 'taro@example.com',
      '[name=c2f]': '09012345678',
    },
  },
  {
    name: 'aria-label の欄',
    html: `<form>
      <input aria-label="姓" name="c3a"> <input aria-label="名" name="c3b">
      <input aria-label="生年月日" type="date" name="c3c">
    </form>`,
    expect: { '[name=c3a]': '山田', '[name=c3b]': '太郎', '[name=c3c]': '1999-04-01' },
  },
  {
    name: 'autocomplete 属性だけが手がかり',
    html: `<form>
      <input name="x1" autocomplete="family-name"> <input name="x2" autocomplete="given-name">
      <input name="x3" autocomplete="email"> <input name="x4" autocomplete="tel">
      <input name="x5" autocomplete="postal-code">
      <select name="x6" autocomplete="address-level1">${opts(PREFECTURES)}</select>
      <input name="x7" autocomplete="address-level2"> <input name="x8" autocomplete="address-line1">
      <input name="x9" type="date" autocomplete="bday">
    </form>`,
    expect: {
      '[name=x1]': '山田',
      '[name=x2]': '太郎',
      '[name=x3]': 'taro@example.com',
      '[name=x4]': '090-1234-5678',
      '[name=x5]': '150-0041',
      '[name=x6]': '東京都',
      '[name=x7]': '渋谷区',
      '[name=x8]': '神南1-2-3',
      '[name=x9]': '1999-04-01',
    },
  },
  {
    name: 'dl / dt / dd とひらがなのふりがな',
    html: `<form><dl>
      <dt>氏名</dt><dd><input name="c5a" placeholder="山田"> <input name="c5b" placeholder="太郎"></dd>
      <dt>ふりがな</dt><dd><input name="c5c" placeholder="やまだ"> <input name="c5d" placeholder="たろう"></dd>
    </dl></form>`,
    expect: { '[name=c5a]': '山田', '[name=c5b]': '太郎', '[name=c5c]': 'やまだ', '[name=c5d]': 'たろう' },
  },
  {
    name: 'ラベルが入力欄の後ろにある（Material UI 風）',
    html: `<form>
      <div class="mui"><input id="c6a" name="c6a"><label for="c6a">お名前（姓）</label></div>
      <div class="mui"><input id="c6b" name="c6b"><label for="c6b">お名前（名）</label></div>
      <div class="mui"><input id="c6c" name="c6c" type="tel"><label for="c6c">携帯電話番号</label></div>
    </form>`,
    expect: { '[name=c6a]': '山田', '[name=c6b]': '太郎', '[name=c6c]': '090-1234-5678' },
  },
  {
    name: '英語のフォーム（外資系）',
    html: `<form>
      <label>First name <input name="c7a"></label>
      <label>Last name <input name="c7b"></label>
      <label>Email address <input name="c7c"></label>
      <label>Phone number <input name="c7d"></label>
      <label>Date of birth <input name="c7e" type="date"></label>
      <label>Postal code <input name="c7f"></label>
    </form>`,
    expect: {
      '[name=c7a]': 'Taro',
      '[name=c7b]': 'Yamada',
      '[name=c7c]': 'taro@example.com',
      '[name=c7d]': '090-1234-5678',
      '[name=c7e]': '1999-04-01',
      '[name=c7f]': '150-0041',
    },
  },
  {
    name: '生年月日：「1999年」「01」表記のプルダウン',
    html: `<form><table><tr><th>生年月日</th><td>
      <select name="c8y">${opts(range(1980, 2008).map((y) => [String(y), `${y}年`]), '----')}</select>
      <select name="c8m">${opts(range(1, 12).map((m) => [String(m), String(m).padStart(2, '0')]), '--')}</select>
      <select name="c8d">${opts(range(1, 31).map((d) => [String(d), String(d).padStart(2, '0')]), '--')}</select>
    </td></tr></table></form>`,
    expect: { '[name=c8y]': '1999', '[name=c8m]': '4', '[name=c8d]': '1' },
  },
  {
    name: '生年月日：8桁の文字欄',
    html: `<form><label>生年月日 <input name="c9" placeholder="例：19990401" maxlength="8"></label></form>`,
    expect: { '[name=c9]': '19990401' },
  },
  {
    name: '生年月日：YYYY/MM/DD の文字欄',
    html: `<form><label>生年月日 <input name="c10" placeholder="YYYY/MM/DD"></label></form>`,
    expect: { '[name=c10]': '1999/04/01' },
  },
  {
    name: '生年月日：年・月・日の3つの文字欄',
    html: `<form><table><tr><th>生年月日</th><td>
      <input name="c11y" maxlength="4" size="4">年 <input name="c11m" maxlength="2" size="2">月 <input name="c11d" maxlength="2" size="2">日
    </td></tr></table></form>`,
    expect: { '[name=c11y]': '1999', '[name=c11m]': '4', '[name=c11d]': '1' },
  },
  {
    name: '生年月日：元号のプルダウン＋和暦の年の文字欄',
    html: `<form><table><tr><th>生年月日</th><td>
      <select name="c12e">${opts(['昭和', '平成', '令和'], '--')}</select>
      <input name="c12y" size="2">年 <input name="c12m" size="2">月 <input name="c12d" size="2">日
    </td></tr></table></form>`,
    expect: { '[name=c12e]': '平成', '[name=c12y]': '11', '[name=c12m]': '4', '[name=c12d]': '1' },
  },
  {
    name: '生年月日：新しい年が先頭・和暦併記の選択肢',
    html: `<form><label>生年 <select name="c13">${opts(
      range(1980, 2008)
        .reverse()
        .map((y) => [String(y), `${y}年（${y >= 1989 ? `平成${y - 1988}` : `昭和${y - 1925}`}年）`]),
      '----',
    )}</select></label></form>`,
    expect: { '[name=c13]': '1999' },
  },
  {
    name: '性別：ラベルなしのラジオ（隣のテキストだけ）',
    html: `<form><table><tr><th>性別</th><td>
      <span><input type="radio" name="c14" value="1"> 男</span> <span><input type="radio" name="c14" value="2"> 女</span>
    </td></tr></table></form>`,
    expect: { 'radio:c14': '男' },
  },
  {
    name: '性別：値がコードのプルダウン',
    html: `<form><label>性別 <select name="c15">${opts([['1', '男性'], ['2', '女性'], ['9', '回答しない']], '-- 選択 --')}</select></label></form>`,
    expect: { '[name=c15]': '1' },
  },
  {
    name: '性別：fieldset と legend',
    html: `<form><fieldset><legend>性別</legend>
      <label><input type="radio" name="c16">男性</label><label><input type="radio" name="c16">女性</label>
    </fieldset></form>`,
    expect: { 'radio:c16': '男性' },
  },
  {
    name: '電話番号：括弧付きの3分割',
    html: `<form><table><tr><th>電話番号</th><td>
      <input name="c17a" size="4"> ( <input name="c17b" size="4"> ) <input name="c17c" size="4">
    </td></tr></table></form>`,
    expect: { '[name=c17a]': '090', '[name=c17b]': '1234', '[name=c17c]': '5678' },
  },
  {
    name: '電話番号：全角指定',
    html: `<form><label>電話番号（全角） <input name="c18"></label></form>`,
    expect: { '[name=c18]': '０９０－１２３４－５６７８' },
  },
  {
    name: '郵便番号：〒 付き・7桁',
    html: `<form><label>郵便番号 <span>〒</span><input name="c19" placeholder="1500041" maxlength="7"></label></form>`,
    expect: { '[name=c19]': '1500041' },
  },
  {
    name: '都道府県：値がコードのプルダウン',
    html: `<form><label>都道府県 <select name="c20">${opts(PREFECTURES.map((p, i) => [String(i + 1), p]))}</select></label></form>`,
    expect: { '[name=c20]': '13' },
  },
  {
    name: '都道府県：optgroup 付き',
    html: `<form><label>都道府県 <select name="c21"><option value="">選択</option>
      <optgroup label="北海道・東北"><option>北海道</option><option>青森県</option></optgroup>
      <optgroup label="関東"><option>茨城県</option><option>東京都</option><option>神奈川県</option></optgroup>
    </select></label></form>`,
    expect: { '[name=c21]': '東京都' },
  },
  {
    name: '住所1（市区町村・番地）／住所2（建物名）',
    html: `<form>
      <label>住所1（市区町村・番地） <input name="c22a"></label>
      <label>住所2（建物名・部屋番号） <input name="c22b"></label>
    </form>`,
    expect: { '[name=c22a]': '渋谷区神南1-2-3', '[name=c22b]': 'サンプルマンション101' },
  },
  {
    name: '住所のふりがな（ひらがな）',
    html: `<form><label>住所（ふりがな） <input name="c23" size="40"></label></form>`,
    expect: { '[name=c23]': 'とうきょうとしぶやくじんなん1-2-3' },
  },
  {
    name: 'メールアドレスと確認用（縦並び）',
    html: `<form><table>
      <tr><th>メールアドレス</th><td><input name="c24a" size="30"></td></tr>
      <tr><th>メールアドレス（確認用）</th><td><input name="c24b" size="30"></td></tr>
    </table></form>`,
    expect: { '[name=c24a]': 'taro@example.com', '[name=c24b]': 'taro@example.com' },
  },
  {
    name: 'メールアドレス：@ の後ろがプルダウン',
    html: `<form><label>メールアドレス <input name="c25a"> @ <select name="c25b">${opts(['gmail.com', 'example.com', 'yahoo.co.jp'])}</select></label></form>`,
    expect: { '[name=c25a]': 'taro', '[name=c25b]': 'example.com' },
  },
  {
    name: '学校名・学部名・学科名',
    html: `<form>
      <label>大学名 <input name="c26a"></label><label>学部名 <input name="c26b"></label><label>学科名 <input name="c26c"></label>
    </form>`,
    expect: { '[name=c26a]': 'サンプル大学', '[name=c26b]': '経済学部', '[name=c26c]': '経済学科' },
  },
  {
    name: '卒業予定年月：「2026年」「3月」のプルダウン',
    html: `<form><table><tr><th>卒業予定年月</th><td>
      <select name="c27y">${opts(range(2024, 2030).map((y) => `${y}年`), '--')}</select>
      <select name="c27m">${opts(range(1, 12).map((m) => `${m}月`), '--')}</select>
    </td></tr></table></form>`,
    expect: { '[name=c27y]': '2026年', '[name=c27m]': '3月' },
  },
  {
    name: '卒業年月：type="month"',
    html: `<form><label>卒業年月 <input type="month" name="c28"></label></form>`,
    expect: { '[name=c28]': '2026-03' },
  },
  {
    name: '文理区分のラジオと学校区分のプルダウン',
    html: `<form>
      <p>文理区分 <label><input type="radio" name="c29a">文系</label><label><input type="radio" name="c29a">理系</label></p>
      <p><label>学校区分 <select name="c29b">${opts(['大学院（修士課程）', '大学（学部）', '短期大学', '専門学校'])}</select></label></p>
    </form>`,
    expect: { 'radio:c29a': '文系', '[name=c29b]': '大学（学部）' },
  },
  {
    name: '会員登録（パスワードと確認用あり）は入れる',
    html: `<form>
      <label>メールアドレス <input name="c30a" type="email"></label>
      <label>パスワード <input name="c30b" type="password"></label>
      <label>パスワード（確認） <input name="c30c" type="password"></label>
      <label>氏名 <input name="c30d"></label>
      <button>登録する</button>
    </form>`,
    expect: { '[name=c30a]': 'taro@example.com', '[name=c30b]': '', '[name=c30c]': '', '[name=c30d]': '山田　太郎' },
  },
  {
    name: 'ログインフォームには入れない',
    html: `<form>
      <label>メールアドレス <input name="c31a"></label>
      <label>パスワード <input name="c31b" type="password"></label>
      <button>ログイン</button>
    </form>`,
    expect: { '[name=c31a]': '', '[name=c31b]': '' },
  },
  {
    name: 'ハニーポット・非表示の欄には入れない',
    html: `<form>
      <label>氏名 <input name="c32a"></label>
      <div style="position:absolute;left:-9999px"><label>メールアドレス <input name="c32b"></label></div>
      <input name="c32c" placeholder="電話番号" style="display:none">
      <div style="display:none"><input name="c32d" placeholder="姓"></div>
      <input name="c32e" placeholder="メールアドレス" tabindex="-1" style="opacity:0;width:1px;height:1px">
    </form>`,
    expect: { '[name=c32a]': '山田　太郎', '[name=c32b]': '', '[name=c32c]': '', '[name=c32d]': '', '[name=c32e]': '' },
  },
  {
    name: '無効・読み取り専用・入力済みの欄は変えない',
    html: `<form>
      <input name="c33a" placeholder="姓" disabled>
      <input name="c33b" placeholder="名" readonly value="固定">
      <label>メールアドレス <input name="c33c" value="already@example.jp"></label>
    </form>`,
    expect: { '[name=c33a]': '', '[name=c33b]': '固定', '[name=c33c]': 'already@example.jp' },
  },
  {
    name: '半角カナ指定',
    html: `<form><label>フリガナ（半角カナ） <input name="c34"></label></form>`,
    expect: { '[name=c34]': 'ﾔﾏﾀﾞ ﾀﾛｳ' },
  },
  {
    name: '同意のチェックボックスと自己PR には触らない',
    html: `<form>
      <label>氏名 <input name="c35a"></label>
      <label><input type="checkbox" name="c35b"> 個人情報の取り扱いに同意する</label>
      <label>自己PR <textarea name="c35c"></textarea></label>
      <label>志望動機 <textarea name="c35d"></textarea></label>
    </form>`,
    expect: { '[name=c35a]': '山田　太郎', '[name=c35b]': false, '[name=c35c]': '', '[name=c35d]': '' },
  },
  {
    name: '年齢：type="number"',
    html: `<form><label>年齢 <input type="number" name="c36"></label></form>`,
    expect: { '[name=c36]': '27' },
  },
  {
    name: '「お名前（漢字）」「お名前（カナ）」を姓・名の placeholder で分ける',
    html: `<form><table>
      <tr><th>お名前（漢字）</th><td><input name="c37a" placeholder="姓"> <input name="c37b" placeholder="名"></td></tr>
      <tr><th>お名前（カナ）</th><td><input name="c37c" placeholder="セイ"> <input name="c37d" placeholder="メイ"></td></tr>
    </table></form>`,
    expect: { '[name=c37a]': '山田', '[name=c37b]': '太郎', '[name=c37c]': 'ヤマダ', '[name=c37d]': 'タロウ' },
  },
  {
    name: '英語の生年月日（月・日・年の順、月は英語名）',
    html: `<form><label>Date of birth</label>
      <select name="c38m">${opts(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], 'Month')}</select>
      <select name="c38d">${opts(range(1, 31).map(String), 'Day')}</select>
      <select name="c38y">${opts(range(1980, 2008).map(String), 'Year')}</select>
    </form>`,
    expect: { '[name=c38m]': 'April', '[name=c38d]': '1', '[name=c38y]': '1999' },
  },
  {
    name: 'ページ上部のログインと応募フォームが同じページにある',
    html: `<form id="c39login"><input name="c39a" placeholder="メールアドレス"><input name="c39b" type="password"><button>ログイン</button></form>
      <form><label>氏名 <input name="c39c"></label><label>メールアドレス <input name="c39d"></label></form>`,
    expect: { '[name=c39a]': '', '[name=c39c]': '山田　太郎', '[name=c39d]': 'taro@example.com' },
  },
  {
    name: 'Shadow DOM の中のフォーム',
    html: `<form><shadow-form id="c40"></shadow-form></form>`,
    setup(root) {
      const host = root.querySelector('#c40')!;
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<label>姓 <input name="s1"></label> <label>名 <input name="s2"></label>`;
    },
    expect: { 'shadow:#c40|[name=s1]': '山田', 'shadow:#c40|[name=s2]': '太郎' },
  },
  {
    name: '必須マークが見出しの前後にある',
    html: `<form><table>
      <tr><th><span class="req">必須</span>氏名</th><td><input name="c41a"></td></tr>
      <tr><th>メールアドレス<span class="req">※必須</span></th><td><input name="c41b"></td></tr>
    </table></form>`,
    expect: { '[name=c41a]': '山田　太郎', '[name=c41b]': 'taro@example.com' },
  },
  {
    name: '緊急連絡先は本人の情報を入れない',
    html: `<form>
      <h3>緊急連絡先</h3>
      <table><tr><th>氏名</th><td><input name="c42a"></td></tr><tr><th>電話番号</th><td><input name="c42b"></td></tr><tr><th>続柄</th><td><input name="c42c"></td></tr></table>
    </form>`,
    expect: { '[name=c42a]': '', '[name=c42b]': '', '[name=c42c]': '' },
  },
  {
    name: '緊急連絡先が登録済みなら入れる',
    profile: { emergencyName: '山田 花子', emergencyRelation: '母', emergencyPhone: '090-0000-1111' },
    html: `<form>
      <h3>緊急連絡先</h3>
      <table><tr><th>氏名</th><td><input name="c43a"></td></tr><tr><th>電話番号</th><td><input name="c43b"></td></tr><tr><th>続柄</th><td><input name="c43c"></td></tr></table>
    </form>`,
    expect: { '[name=c43a]': '山田 花子', '[name=c43b]': '090-0000-1111', '[name=c43c]': '母' },
  },
  // ---- 第2弾：実際のサイトで起こりそうな形 ----
  {
    name: '「住所」と「建物名」が別の欄なら、住所に建物名を重ねない',
    html: `<form><table>
      <tr><th>住所</th><td><input name="d1a" size="40"></td></tr>
      <tr><th>建物名</th><td><input name="d1b" size="40"></td></tr>
    </table></form>`,
    expect: { '[name=d1a]': '東京都渋谷区神南1-2-3', '[name=d1b]': 'サンプルマンション101' },
  },
  {
    name: '都道府県が別のプルダウンなら、住所に都道府県を重ねない',
    html: `<form><table>
      <tr><th>都道府県</th><td><select name="d2a">${opts(PREFECTURES)}</select></td></tr>
      <tr><th>住所</th><td><input name="d2b" size="40"></td></tr>
    </table></form>`,
    expect: { '[name=d2a]': '東京都', '[name=d2b]': '渋谷区神南1-2-3　サンプルマンション101' },
  },
  {
    name: '「番地・建物名」をまとめた欄',
    html: `<form>
      <label>市区町村 <input name="d3a"></label>
      <label>番地・建物名 <input name="d3b" size="40"></label>
    </form>`,
    expect: { '[name=d3a]': '渋谷区', '[name=d3b]': '神南1-2-3　サンプルマンション101' },
  },
  {
    name: '「フリガナ（セイ・メイ）」は1つの欄にまとめて入れる',
    html: `<form>
      <label>氏名（姓・名） <input name="d4a"></label>
      <label>フリガナ（セイ・メイ） <input name="d4b"></label>
    </form>`,
    expect: { '[name=d4a]': '山田　太郎', '[name=d4b]': 'ヤマダ　タロウ' },
  },
  {
    name: 'placeholder の例に合わせて姓と名の間のスペースを変える',
    html: `<form>
      <label>氏名 <input name="d5a" placeholder="例）山田 太郎"></label>
      <label>フリガナ <input name="d5b" placeholder="例）ヤマダタロウ"></label>
    </form>`,
    expect: { '[name=d5a]': '山田 太郎', '[name=d5b]': 'ヤマダタロウ' },
  },
  {
    name: '卒業年月が type="date"',
    html: `<form><label>卒業予定日 <input type="date" name="d6"></label></form>`,
    expect: { '[name=d6]': '2026-03-01' },
  },
  {
    name: 'Bootstrap 風（for のない label と div）',
    html: `<form>
      <div class="form-group"><label>氏名</label><input class="form-control" name="d7a"></div>
      <div class="form-group"><label>メールアドレス</label><input class="form-control" name="d7b"></div>
      <div class="form-group"><label>電話番号</label><input class="form-control" name="d7c"></div>
    </form>`,
    expect: { '[name=d7a]': '山田　太郎', '[name=d7b]': 'taro@example.com', '[name=d7c]': '090-1234-5678' },
  },
  {
    name: '見出しが前の div、入力欄が次の div',
    html: `<form>
      <div class="row"><div class="th">氏名</div><div class="td"><input name="d8a" placeholder="山田"><input name="d8b" placeholder="太郎"></div></div>
      <div class="row"><div class="th">生年月日</div><div class="td"><input type="date" name="d8c"></div></div>
    </form>`,
    expect: { '[name=d8a]': '山田', '[name=d8b]': '太郎', '[name=d8c]': '1999-04-01' },
  },
  {
    name: '電話番号の3分割が別々のセル',
    html: `<form><table><tr><th>電話番号</th>
      <td><input name="d9a" size="4"></td><td>-</td><td><input name="d9b" size="4"></td><td>-</td><td><input name="d9c" size="4"></td>
    </tr></table></form>`,
    expect: { '[name=d9a]': '090', '[name=d9b]': '1234', '[name=d9c]': '5678' },
  },
  {
    name: '電話番号の pattern 属性',
    html: `<form><label>電話番号 <input type="tel" name="d10" pattern="\\d{2,4}-\\d{2,4}-\\d{4}"></label></form>`,
    expect: { '[name=d10]': '090-1234-5678' },
  },
  {
    name: '英語＋日本語のラベル（Last Name (Kanji)・Furigana）',
    html: `<form>
      <label>Last Name (姓) <input name="d11a"></label><label>First Name (名) <input name="d11b"></label>
      <label>Last name (Furigana) <input name="d11c"></label><label>First name (Furigana) <input name="d11d"></label>
    </form>`,
    expect: { '[name=d11a]': '山田', '[name=d11b]': '太郎', '[name=d11c]': 'ヤマダ', '[name=d11d]': 'タロウ' },
  },
  {
    name: '「学年」のプルダウンには触らない',
    html: `<form><label>学年 <select name="d12">${opts(['1年', '2年', '3年', '4年', '修士1年', '修士2年'])}</select></label></form>`,
    expect: { '[name=d12]': '' },
  },
  {
    name: '「卒業区分」のラジオ',
    html: `<form><p>卒業区分 <label><input type="radio" name="d13">卒業見込み</label><label><input type="radio" name="d13">既卒</label></p></form>`,
    expect: { 'radio:d13': '卒業見込み' },
  },
  {
    name: '性別「その他・回答しない」',
    profile: { gender: 'other' },
    html: `<form><p>性別 <label><input type="radio" name="d14">男性</label><label><input type="radio" name="d14">女性</label><label><input type="radio" name="d14">無回答</label></p></form>`,
    expect: { 'radio:d14': '無回答' },
  },
  {
    name: 'キーワード検索の欄には入れない',
    html: `<form><input type="search" name="d15a" placeholder="キーワード"><input name="d15b" placeholder="サイト内検索"></form>`,
    expect: { '[name=d15a]': '', '[name=d15b]': '' },
  },
  {
    name: '入社希望時期のプルダウン',
    html: `<form><label>入社希望時期 <select name="d16">${opts(['2026年4月', '2026年10月', '2027年4月'])}</select></label></form>`,
    expect: { '[name=d16]': '2026年4月' },
  },
  {
    name: '帰省先の見出しのある住所（現住所と同じ設定・チェックボックスなし）',
    html: `<form>
      <h3>現住所</h3><table><tr><th>郵便番号</th><td><input name="d17a"></td></tr><tr><th>住所</th><td><input name="d17b" size="40"></td></tr></table>
      <h3>帰省先</h3><table><tr><th>郵便番号</th><td><input name="d17c"></td></tr><tr><th>住所</th><td><input name="d17d" size="40"></td></tr></table>
    </form>`,
    expect: {
      '[name=d17a]': '150-0041',
      '[name=d17b]': '東京都渋谷区神南1-2-3　サンプルマンション101',
      '[name=d17c]': '150-0041',
      '[name=d17d]': '東京都渋谷区神南1-2-3　サンプルマンション101',
    },
  },
  {
    name: '帰省先が別の住所',
    profile: { kiseiSame: false, kiseiPostalCode: '976-0053', kiseiPrefecture: '福島県', kiseiCity: '相馬市', kiseiAddressLine: '小野字金谷台268-4' },
    html: `<form>
      <h3>現住所</h3><table><tr><th>郵便番号</th><td><input name="d18a"></td></tr></table>
      <h3>帰省先</h3><table><tr><th>郵便番号</th><td><input name="d18b"></td></tr><tr><th>都道府県</th><td><select name="d18c">${opts(PREFECTURES)}</select></td></tr><tr><th>住所</th><td><input name="d18d" size="40"></td></tr></table>
    </form>`,
    expect: { '[name=d18a]': '150-0041', '[name=d18b]': '976-0053', '[name=d18c]': '福島県', '[name=d18d]': '相馬市小野字金谷台268-4' },
  },
  {
    name: 'select の最初の選択肢が本物の値（年の初期値が 2005）',
    html: `<form><table><tr><th>生年月日</th><td>
      <select name="d19y">${range(1990, 2010).map((y) => `<option${y === 2005 ? ' selected' : ''}>${y}</option>`).join('')}</select>年
      <select name="d19m">${range(1, 12).map((m) => `<option>${m}</option>`).join('')}</select>月
      <select name="d19d">${range(1, 31).map((d) => `<option>${d}</option>`).join('')}</select>日
    </td></tr></table></form>`,
    expect: { '[name=d19y]': '1999', '[name=d19m]': '4', '[name=d19d]': '1' },
  },
  {
    name: '全角数字の placeholder の電話番号',
    html: `<form><label>電話番号 <input name="d20" placeholder="０９０－１２３４－５６７８"></label></form>`,
    expect: { '[name=d20]': '０９０－１２３４－５６７８' },
  },
  {
    name: '文言のないログインフォーム（ID とパスワードだけ）',
    html: `<form><input name="d21a" placeholder="メールアドレス"> <input type="password" name="d21b"></form>`,
    expect: { '[name=d21a]': '' },
  },
  {
    name: 'パスワード1つの会員登録（メール・氏名・パスワード）',
    html: `<form><label>メールアドレス <input name="d22a"></label><label>氏名 <input name="d22b"></label><label>パスワード <input type="password" name="d22c"></label><button>登録</button></form>`,
    expect: { '[name=d22a]': 'taro@example.com', '[name=d22b]': '山田　太郎', '[name=d22c]': '' },
  },
  {
    name: '性別が未設定なら選ばない',
    profile: { gender: '' },
    html: `<form><label>性別 <select name="c44">${opts(['男性', '女性'])}</select></label></form>`,
    expect: { '[name=c44]': '' },
  },
];
