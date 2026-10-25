import { PREFECTURES } from '../../lib/prefectures';
import type { Profile } from '../../lib/types';
import { mountCombo, type ComboOptions } from './combos';

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
  /** 確認なしで入力する確信度（ポップアップのスライダー）。省くと初期設定 */
  threshold?: number;
  /** AI（Sophon）の答え。渡すと、AI に聞かれたすべての欄にこの項目を返す */
  ai?: string;
  setup?(root: HTMLElement): void;
  /** 入力のあとにユーザーが書き直す操作。書き直した欄のセレクタと値を返し、「元に戻す」で消えないことを確かめる */
  afterFill?(root: HTMLElement): Record<string, string>;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const opts = (items: (string | [string, string])[], empty = '選択してください') =>
  [`<option value="">${empty}</option>`, ...items.map((o) => (Array.isArray(o) ? `<option value="${o[0]}">${o[1]}</option>` : `<option>${o}</option>`))].join('');


/** 独自プルダウンを並べたフォーム。html の <div data-combo="name"> の位置に組み立てる */
const combos = (list: (Omit<ComboOptions, 'name'> & { name: string })[]) => (root: HTMLElement) => {
  for (const c of list) mountCombo(root.querySelector<HTMLElement>(`[data-combo="${c.name}"]`)!, { clearable: true, ...c });
};

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
    profile: { kiseiSame: false, kiseiPostalCode: '530-0001', kiseiPrefecture: '福島県', kiseiCity: '大阪市北区', kiseiAddressLine: '梅田1-2-3' },
    html: `<form>
      <h3>現住所</h3><table><tr><th>郵便番号</th><td><input name="d18a"></td></tr></table>
      <h3>帰省先</h3><table><tr><th>郵便番号</th><td><input name="d18b"></td></tr><tr><th>都道府県</th><td><select name="d18c">${opts(PREFECTURES)}</select></td></tr><tr><th>住所</th><td><input name="d18d" size="40"></td></tr></table>
    </form>`,
    expect: { '[name=d18a]': '150-0041', '[name=d18b]': '530-0001', '[name=d18c]': '福島県', '[name=d18d]': '大阪市北区梅田1-2-3' },
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
    name: '休暇中の連絡先：「現在の連絡先と同じ」チェックボックス（実サイトの形）',
    html: `<form><table>
      <tr><th>現住所</th><td><input name="e1a" placeholder="郵便番号"></td></tr>
      <tr><th>休暇中の連絡先</th><td>
        <div>現在の連絡先と同じ場合はチェックしてください。<br><label><input type="checkbox" name="e1same"> 現在の連絡先と同じ</label></div>
        <div>日本国外の場合はチェックしてください。<br><label><input type="checkbox" name="e1abroad"> 日本国外の場合</label></div>
        <div><b>郵便番号</b><br><input name="e1z1" size="4"> - <input name="e1z2" size="4"></div>
        <div><b>都道府県</b><br><select name="e1p">${opts(PREFECTURES)}</select></div>
        <div><b>市区郡町村</b><br><input name="e1c"></div>
        <div><b>町域・番地</b><br><input name="e1l"></div>
        <div><b>電話番号</b><br><input name="e1t1" size="4"> - <input name="e1t2" size="4"> - <input name="e1t3" size="4"></div>
      </td></tr>
    </table></form>`,
    expect: {
      '[name=e1same]': true,
      '[name=e1abroad]': false,
      '[name=e1z1]': '',
      '[name=e1z2]': '',
      '[name=e1p]': '',
      '[name=e1c]': '',
      '[name=e1l]': '',
      '[name=e1t1]': '',
    },
  },
  {
    name: '「上記と同じ」だけの文言でも、見出しが帰省先なら対象',
    html: `<form><h3>帰省先</h3><label><input type="checkbox" name="e2a"> 上記と同じ</label><table><tr><th>住所</th><td><input name="e2b" size="40"></td></tr></table></form>`,
    expect: { '[name=e2a]': true, '[name=e2b]': '' },
  },
  {
    name: 'メール配信の「上記と同じ」チェックボックスには触らない',
    html: `<form><label>メールアドレス <input name="e3a"></label><label><input type="checkbox" name="e3b"> 上記と同じアドレスにお知らせメールを配信する</label></form>`,
    expect: { '[name=e3a]': 'taro@example.com', '[name=e3b]': false },
  },
  {
    name: '学校情報（実サイトの形）：頭文字・設置区分・卒業高校',
    profile: {
      school: '学習院大学',
      schoolKana: 'ガクシュウインダイガク',
      schoolOwnership: '私立',
      highSchool: '大阪府立サンプル高等学校',
      highSchoolPrefecture: '福島県',
    },
    html: `<form><table>
      <tr><th>学校区分</th><td>${['大学院', '大学', '短期大学', '高等専門学校', '専門学校', '高等学校'].map((t) => `<label><input type="radio" name="f1type">${t}</label>`).join(' ')}</td></tr>
      <tr><th>設置区分</th><td>${['国立', '公立', '私立', '日本国外'].map((t) => `<label><input type="radio" name="f1own">${t}</label>`).join(' ')}</td></tr>
      <tr><th>学校名の頭文字</th><td><div>（全角カタカナ１文字＜濁点含む＞、日本国外の場合は空欄）</div><input name="f1init" maxlength="1" size="3"> <button type="button">学校検索</button></td></tr>
      <tr><th>卒業高校</th><td><div><b>都道府県</b><br><select name="f1hspref">${opts(PREFECTURES, '（選択してください）')}</select></div><div><b>高校名の一部</b><br><input name="f1hs"> <button type="button">高校検索</button></div></td></tr>
    </table></form>`,
    expect: {
      'radio:f1type': '大学',
      'radio:f1own': '私立',
      '[name=f1init]': 'ガ',
      '[name=f1hspref]': '福島県',
      '[name=f1hs]': '大阪府立サンプル高等学校',
    },
  },
  {
    name: '頭文字：清音の指定なら濁点を外す',
    profile: { schoolKana: 'ガクシュウインダイガク' },
    html: `<form><label>学校名の頭文字（清音・カタカナ1文字） <input name="f2" maxlength="1"></label></form>`,
    expect: { '[name=f2]': 'カ' },
  },
  {
    name: '入学年月を選ぶと卒業年月が選べるようになる',
    html: `<form><table>
      <tr><th>入学年月</th><td><select name="f3ay">${opts(range(2018, 2026).map(String), '--')}</select>年 <select name="f3am">${opts(range(1, 12).map((m) => String(m).padStart(2, '0')), '--')}</select>月</td></tr>
      <tr><th>卒業（予定）年月</th><td><select name="f3gy" disabled>${opts(range(2024, 2030).map(String), '--')}</select>年 <select name="f3gm" disabled>${opts(range(1, 12).map((m) => String(m).padStart(2, '0')), '--')}</select>月</td></tr>
    </table></form>`,
    setup(root) {
      const am = root.querySelector<HTMLSelectElement>('[name=f3am]')!;
      am.addEventListener('change', () =>
        setTimeout(() => {
          root.querySelectorAll<HTMLSelectElement>('[name=f3gy], [name=f3gm]').forEach((s) => (s.disabled = false));
        }, 50),
      );
    },
    expect: { '[name=f3ay]': '2022', '[name=f3am]': '04', '[name=f3gy]': '2026', '[name=f3gm]': '03' },
  },
  // ---- 第3弾：ATS 風の作り・表記ゆれ・似ているけれど入れてはいけない欄 ----
  {
    name: 'aria-labelledby で別の要素をラベルにしている（ATS 風）',
    html: `<form>
      <div><div id="g1l1">姓</div><input aria-labelledby="g1l1" name="g1a" data-automation-id="legalNameSection_lastName"></div>
      <div><div id="g1l2">名</div><input aria-labelledby="g1l2" name="g1b"></div>
      <div><div id="g1l3">メールアドレス</div><input aria-labelledby="g1l3" name="g1c"></div>
    </form>`,
    expect: { '[name=g1a]': '山田', '[name=g1b]': '太郎', '[name=g1c]': 'taro@example.com' },
  },
  {
    name: '配列形式の name 属性（name[last] / name[first]）',
    html: `<form><table><tr><th>氏名</th><td><input name="name[last]"> <input name="name[first]"></td></tr></table></form>`,
    expect: { '[name="name[last]"]': '山田', '[name="name[first]"]': '太郎' },
  },
  {
    name: '都道府県の選択肢が「東京」（都道府県の文字なし）',
    html: `<form><label>都道府県 <select name="g3">${opts(PREFECTURES.map((p) => [p, p === '北海道' ? p : p.replace(/[都府県]$/, '')]))}</select></label></form>`,
    expect: { '[name=g3]': '東京都' },
  },
  {
    name: '都道府県の選択肢が「13:東京都」',
    html: `<form><label>都道府県 <select name="g4">${opts(PREFECTURES.map((p, i) => [String(i + 1), `${String(i + 1).padStart(2, '0')}:${p}`]))}</select></label></form>`,
    expect: { '[name=g4]': '13' },
  },
  {
    name: '年齢の選択肢が「27歳」',
    html: `<form><label>年齢 <select name="g5">${opts(range(18, 40).map((n) => `${n}歳`))}</select></label></form>`,
    expect: { '[name=g5]': '27歳' },
  },
  {
    name: '生年の選択肢が「平成11年（1999年）」',
    html: `<form><label>生まれた年 <select name="g6">${opts(range(1985, 2005).map((y) => [String(y), `${y >= 1989 ? `平成${y - 1988}` : `昭和${y - 1925}`}年（${y}年）`]))}</select></label></form>`,
    expect: { '[name=g6]': '1999' },
  },
  {
    name: 'FAX・内線には入れない',
    html: `<form><table>
      <tr><th>電話番号</th><td><input name="g7a" size="4">-<input name="g7b" size="4">-<input name="g7c" size="4"> 内線<input name="g7d" size="4"></td></tr>
      <tr><th>FAX番号</th><td><input name="g7e"></td></tr>
    </table></form>`,
    expect: { '[name=g7a]': '090', '[name=g7b]': '1234', '[name=g7c]': '5678', '[name=g7d]': '', '[name=g7e]': '' },
  },
  {
    name: '学籍番号・ユーザーID・マイページID には入れない',
    html: `<form>
      <label>学籍番号 <input name="g8a"></label>
      <label>ユーザーID <input name="g8b"></label>
      <label>マイページID <input name="g8c"></label>
      <label>紹介者のお名前 <input name="g8d"></label>
    </form>`,
    expect: { '[name=g8a]': '', '[name=g8b]': '', '[name=g8c]': '', '[name=g8d]': '' },
  },
  {
    name: '見出しは「ふりがな」でも placeholder がカタカナならカタカナ',
    html: `<form><label>ふりがな <input name="g9" placeholder="ヤマダ　タロウ"></label></form>`,
    expect: { '[name=g9]': 'ヤマダ　タロウ' },
  },
  {
    name: '氏名（ひらがな）',
    html: `<form><label>氏名（ひらがな） <input name="g10"></label></form>`,
    expect: { '[name=g10]': 'やまだ　たろう' },
  },
  {
    name: '卒業見込年月が「2026/03」形式の文字欄',
    html: `<form><label>卒業見込年月 <input name="g11" placeholder="2026/03"></label></form>`,
    expect: { '[name=g11]': '2026/03' },
  },
  {
    name: '郵便番号が type="number"',
    html: `<form><label>郵便番号 <input type="number" name="g12"></label></form>`,
    expect: { '[name=g12]': '1500041' },
  },
  {
    name: '文字数制限より長い値は入れない',
    html: `<form><label>フリガナ <input name="g13" maxlength="4"></label></form>`,
    expect: { '[name=g13]': '' },
  },
  {
    name: '都道府県を選ぶと市区町村の選択肢が作られる',
    html: `<form>
      <label>都道府県 <select name="g14a">${opts(PREFECTURES)}</select></label>
      <label>市区町村 <select name="g14b"><option value="">選択してください</option></select></label>
    </form>`,
    setup(root) {
      const pref = root.querySelector<HTMLSelectElement>('[name=g14a]')!;
      const city = root.querySelector<HTMLSelectElement>('[name=g14b]')!;
      pref.addEventListener('change', () =>
        setTimeout(() => {
          city.length = 1;
          for (const c of pref.value === '東京都' ? ['千代田区', '港区', '渋谷区', '新宿区'] : ['その他']) city.add(new Option(c));
        }, 80),
      );
    },
    expect: { '[name=g14a]': '東京都', '[name=g14b]': '渋谷区' },
  },
  {
    name: '履歴書形式の学歴・職歴の表には入れない',
    html: `<form><table>
      <tr><th>年</th><th>月</th><th>学歴・職歴</th></tr>
      <tr><td><input name="g15y1" size="4"></td><td><input name="g15m1" size="2"></td><td><input name="g15t1" size="40"></td></tr>
      <tr><td><input name="g15y2" size="4"></td><td><input name="g15m2" size="2"></td><td><input name="g15t2" size="40"></td></tr>
    </table></form>`,
    expect: { '[name=g15y1]': '', '[name=g15m1]': '', '[name=g15t1]': '', '[name=g15y2]': '', '[name=g15t2]': '' },
  },
  {
    name: '生年月日（西暦）の3つの文字欄',
    html: `<form><table><tr><th>生年月日（西暦）</th><td><input name="g16y" size="4">年<input name="g16m" size="2">月<input name="g16d" size="2">日</td></tr></table></form>`,
    expect: { '[name=g16y]': '1999', '[name=g16m]': '4', '[name=g16d]': '1' },
  },
  {
    name: '女性・「選択しない」付きの性別プルダウン',
    profile: { gender: 'female' },
    html: `<form><label>性別 <select name="g17">${opts(['男性', '女性', '選択しない'])}</select></label></form>`,
    expect: { '[name=g17]': '女性' },
  },
  {
    name: '日付ピッカー（読み取り専用の文字欄）には入れない',
    html: `<form><label>生年月日 <input name="g18" class="datepicker" readonly></label></form>`,
    expect: { '[name=g18]': '' },
  },
  {
    name: 'ラベルの中の入力欄の後ろに説明文',
    html: `<form>
      <label><span>氏名</span><input name="g19a"><small>全角で入力してください</small></label>
      <label><span>メールアドレス</span><input name="g19b"><small>半角英数字</small></label>
    </form>`,
    expect: { '[name=g19a]': '山田　太郎', '[name=g19b]': 'taro@example.com' },
  },
  {
    name: '連絡用メール・PC メール',
    html: `<form><label>連絡用メールアドレス <input name="g20a"></label><label>PCメール <input name="g20b"></label></form>`,
    expect: { '[name=g20a]': 'taro@example.com', '[name=g20b]': 'taro@example.com' },
  },
  {
    name: '郵便番号から住所を自動入力するサイト（ajaxzip3 風）で番地が消えない',
    html: `<form>
      <label>郵便番号 <input name="g21a"></label>
      <label>都道府県 <select name="g21b">${opts(PREFECTURES)}</select></label>
      <label>市区町村 <input name="g21c"></label>
      <label>番地 <input name="g21d"></label>
    </form>`,
    setup(root) {
      const zip = root.querySelector<HTMLInputElement>('[name=g21a]')!;
      zip.addEventListener('keyup', () =>
        setTimeout(() => {
          // テストが終わって欄が消えたあとに動いても、エラーにしない
          const set = (name: string, v: string) => {
            const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[name=${name}]`);
            if (el) el.value = v;
          };
          set('g21b', '東京都');
          set('g21c', '渋谷区');
          set('g21d', '神南');
        }, 150),
      );
    },
    expect: { '[name=g21a]': '150-0041', '[name=g21b]': '東京都', '[name=g21c]': '渋谷区', '[name=g21d]': '神南1-2-3' },
  },
  {
    name: '学校情報（実サイトの形・第2版）：学位の注意書き・入学年月・卒業年月',
    profile: { schoolKana: 'ニイガタダイガク', schoolOwnership: '国立', highSchool: '大阪府立サンプル高等学校', highSchoolPrefecture: '福島県' },
    html: `<form><table>
      <tr><th>学校区分</th><td><label><input type="radio" name="h1type">大学院</label> <label><input type="radio" name="h1type">大学</label></td></tr>
      <tr><th>設置区分</th><td>${['国立', '公立', '私立', '日本国外'].map((t) => `<label><input type="radio" name="h1own">${t}</label>`).join(' ')}</td></tr>
      <tr><th>学位</th><td><p>※学位の選択は、大学院（国立・公立・私立）の方のみ対象です。</p></td></tr>
      <tr><th>学校名の頭文字</th><td><p>全角カタカナ１文字＜濁点含む＞（日本国外の学校の場合は、設置区分「日本国外」を選択したうえで、本項目は空欄で検索）</p><input name="h1init" size="3"> <button type="button">学校検索</button></td></tr>
      <tr><th>学校</th><td>（上記より学校を検索してください。）</td></tr>
      <tr><th>入学年月</th><td><select name="h1ay">${opts(range(2015, 2026).map(String), '--')}</select>年 <select name="h1am">${opts(range(1, 12).map((m) => String(m).padStart(2, '0')), '--')}</select>月</td></tr>
      <tr><th>卒業（予定）年月</th><td><select name="h1gy">${opts(range(2020, 2030).map(String), '--')}</select>年 <select name="h1gm">${opts(range(1, 12).map((m) => String(m).padStart(2, '0')), '--')}</select>月</td></tr>
      <tr><th>卒業高校</th><td><div><b>都道府県</b><br><select name="h1hp">${opts(PREFECTURES, '（選択してください）')}</select></div><div><b>高校名の一部</b><br><input name="h1hs"> <button type="button">高校検索</button></div></td></tr>
    </table></form>`,
    expect: {
      'radio:h1type': '大学',
      'radio:h1own': '国立',
      '[name=h1init]': 'ニ',
      '[name=h1ay]': '2022',
      '[name=h1am]': '04',
      '[name=h1gy]': '2026',
      '[name=h1gm]': '03',
      '[name=h1hp]': '福島県',
      '[name=h1hs]': '大阪府立サンプル高等学校',
    },
  },
  {
    name: '学校情報（実サイトの形・第3版）：入学年月なし・高校の入学年月と卒業年月',
    profile: {
      schoolKana: 'ニイガタダイガク',
      schoolOwnership: '国立',
      highSchool: '大阪府立サンプル高等学校',
      highSchoolPrefecture: '福島県',
      highSchoolAdmission: '2019-04',
      highSchoolGraduation: '2022-03',
    },
    html: `<form><table>
      <tr><th>学校区分</th><td>${['大学院', '大学', '短期大学'].map((t) => `<label><input type="radio" name="h2type">${t}</label>`).join(' ')}</td></tr>
      <tr><th>設置区分<span>※交換留学・短期留学の場合は国内で正規在籍している大学名を記入ください</span></th><td>${['国立', '公立', '私立', '日本国外'].map((t) => `<label><input type="radio" name="h2own">${t}</label>`).join(' ')}</td></tr>
      <tr><th>学位</th><td><p>※学位の選択は、大学院（国立・公立・私立）の方のみ対象です。</p></td></tr>
      <tr><th>学校名の頭文字</th><td><p>（全角カタカナ１文字＜濁点含む＞、日本国外の場合は空欄）</p><input name="h2init" size="3"> <button type="button">学校検索</button></td></tr>
      <tr><th>学校</th><td>（上記より学校を検索してください。）</td></tr>
      <tr><th>卒業（予定）年月</th><td><select name="h2gy">${opts(range(2020, 2030).map(String), '--')}</select>年 <select name="h2gm">${opts(range(1, 12).map((m) => String(m).padStart(2, '0')), '--')}</select>月</td></tr>
      <tr><th>卒業高校</th><td><div><b>都道府県</b><br><select name="h2hp">${opts(PREFECTURES, '（選択してください）')}</select></div><div><b>高校名の一部</b><br><input name="h2hs"> <button type="button">高校検索</button></div><div><b>高校名</b><br>（上記より高校を検索してください。）</div></td></tr>
      <tr><th>高校入学年月</th><td><select name="h2hay">${opts(range(2010, 2026).map(String), '--')}</select>年 <select name="h2ham">${opts(range(1, 12).map((m) => String(m).padStart(2, '0')), '--')}</select>月</td></tr>
      <tr><th>高校卒業年月</th><td><select name="h2hgy">${opts(range(2010, 2026).map(String), '--')}</select>年 <select name="h2hgm">${opts(range(1, 12).map((m) => String(m).padStart(2, '0')), '--')}</select>月</td></tr>
    </table></form>`,
    expect: {
      'radio:h2type': '大学',
      'radio:h2own': '国立',
      '[name=h2init]': 'ニ',
      '[name=h2gy]': '2026',
      '[name=h2gm]': '03',
      '[name=h2hp]': '福島県',
      '[name=h2hay]': '2019',
      '[name=h2ham]': '04',
      '[name=h2hgy]': '2022',
      '[name=h2hgm]': '03',
    },
  },
  {
    name: 'アンケート（実サイトの形）：持っている／決まっている／ある・ない',
    profile: { lab: '山本ゼミ', toeic: '780', studyAbroad: 'なし', partTime: '飲食店ホール（3年）' },
    html: `<form><table>
      <tr><th>設問 1</th><td><p>入社を予定している時期を教えてください。</p><select name="q1">${opts(['2026年4月', '2026年10月', '2027年4月', 'その他'], '（選択してください）')}</select></td></tr>
      <tr><th>設問 2</th><td><p>ゼミ（研究室）について</p><p>ゼミ（研究室）が決まっているか教えてください。</p>${['決まっている', '決まっていない'].map((t) => `<label><input type="radio" name="q2">${t}</label>`).join('<br>')}</td></tr>
      <tr><th>設問 5</th><td><p>アルバイト経験等（時期・期間・内容等）についてご入力ください。</p><p>50文字以下</p><textarea name="q5"></textarea></td></tr>
      <tr><th>設問 6</th><td><p>留学経験についてご回答ください。</p><p>留学経験はありますか？</p>${['ある', 'ない'].map((t) => `<label><input type="radio" name="q6">${t}</label>`).join('<br>')}</td></tr>
      <tr><th>設問 8</th><td><p>TOEICのスコアについて</p><p>スコアはお持ちですか？</p>${['持っている', '持っていない'].map((t) => `<label><input type="radio" name="q8">${t}</label>`).join('<br>')}</td></tr>
      <tr><th>設問 9</th><td><p>TOEFLのスコアについて</p><p>スコアはお持ちですか？</p>${['持っている', '持っていない'].map((t) => `<label><input type="radio" name="q9">${t}</label>`).join('<br>')}</td></tr>
    </table></form>`,
    expect: {
      '[name=q1]': '2026年4月',
      'radio:q2': '決まっている',
      '[name=q5]': '飲食店ホール（3年）',
      'radio:q6': 'ない',
      'radio:q8': '持っている',
      'radio:q9': '',
    },
  },
  {
    name: '「メールアドレス2」と確認用（実サイトの形）',
    profile: { emailSub: 'taro.sub@example.com' },
    html: `<form><table>
      <tr><th>メールアドレス</th><td>taro@example.com</td></tr>
      <tr><th>メールアドレス2</th><td>
        <p>入力ミス防止のため同じメールアドレスを２度ご記入ください。</p>
        <div style="display:flex;gap:8px">
          <label style="display:flex;flex-direction:column">メールアドレス2<input name="h2a" size="30"></label>
          <label style="display:flex;flex-direction:column">確認用<input name="h2b" size="30"></label>
        </div>
      </td></tr>
    </table></form>`,
    expect: { '[name=h2a]': 'taro.sub@example.com', '[name=h2b]': 'taro.sub@example.com' },
  },
  {
    name: 'メールアドレスとメールアドレス2が1つの見出しにまとまり、それぞれに確認用がある',
    profile: { emailSub: 'taro.sub@example.com' },
    html: `<form><table>
      <tr><th rowspan="2">メールアドレス</th><td>
        <p>携帯電話のメールアドレスはご遠慮ください。</p>
        <div style="display:flex;gap:8px">
          <label style="display:flex;flex-direction:column">メールアドレス<input name="h3a" size="30"></label>
          <label style="display:flex;flex-direction:column">確認用<input name="h3b" size="30"></label>
        </div>
      </td></tr>
      <tr><td>
        <p>入力ミス防止のため同じメールアドレスを２度ご記入ください。</p>
        <div style="display:flex;gap:8px">
          <label style="display:flex;flex-direction:column">メールアドレス2<input name="h3c" size="30"></label>
          <label style="display:flex;flex-direction:column">確認用<input name="h3d" size="30"></label>
        </div>
      </td></tr>
    </table></form>`,
    expect: {
      '[name=h3a]': 'taro@example.com',
      '[name=h3b]': 'taro@example.com',
      '[name=h3c]': 'taro.sub@example.com',
      '[name=h3d]': 'taro.sub@example.com',
    },
  },
  {
    name: '性別が未設定なら選ばない',
    profile: { gender: '' },
    html: `<form><label>性別 <select name="c44">${opts(['男性', '女性'])}</select></label></form>`,
    expect: { '[name=c44]': '' },
  },
  {
    name: '飾りで覆ったプルダウン・ラジオ（-▼- の先頭、◆付きの見出し、リセットボタン）',
    html: `<style>.u-sel{position:relative;display:inline-block;width:120px;height:40px}.u-sel select{position:absolute;inset:0;opacity:0;width:100%;height:100%}.u-rad{display:inline-block;width:20px;height:20px}.u-rad input{opacity:0;margin:0;width:20px;height:20px}</style>
    <form><table>
      <tr><th colspan="2">お名前</th></tr>
      <tr><th>◆漢字氏名<br><small>（全角入力のみ）</small></th><td>姓：<input name="u1a"> 名：<input name="u1b"></td></tr>
      <tr><th colspan="2">生年月日・性別</th></tr>
      <tr><th>◆生年月日</th><td>
        <div class="u-sel"><span>-▼-</span><select name="u2y">${opts(range(1980, 2008).map(String), '-▼-')}</select></div> 年
        <div class="u-sel"><span>-▼-</span><select name="u2m">${opts(range(1, 12).map(String), '-▼-')}</select></div> 月
        <div class="u-sel"><span>-▼-</span><select name="u2d">${opts(range(1, 31).map(String), '-▼-')}</select></div> 日
      </td></tr>
      <tr><th>◆性別</th><td>
        <label><div class="u-rad"><input type="radio" name="u3" value="1"></div>男</label>
        <label><div class="u-rad"><input type="radio" name="u3" value="2"></div>女</label>
        <input type="button" value="リセット">
      </td></tr>
    </table></form>`,
    expect: { '[name=u1a]': '山田', '[name=u2y]': '1999', '[name=u2m]': '4', '[name=u2d]': '1', 'radio:u3': '男' },
  },
  // ---- 第4弾：プルダウンの value の罠・遅れて作り直される選択肢・Select2・行見出しだけの姓名・元に戻す ----
  {
    name: 'D1 月の value が 0 始まり（JS の月）',
    html: `<form><table><tr><th>生年月日</th><td>
      <select name="d1y">${opts(range(1980, 2008).map(String))}</select>
      <select name="d1m">${opts(range(1, 12).map((m) => [String(m - 1), `${m}月`]))}</select>
      <select name="d1d">${opts(range(1, 31).map((d) => [String(d), `${d}日`]))}</select></td></tr></table></form>`,
    expect: { '[name=d1y]': '1999', '[name=d1m]': '4月', '[name=d1d]': '1日' },
  },
  {
    name: 'D2 日の value が 0 始まり',
    html: `<form><table><tr><th>生年月日</th><td>
      <select name="d2y">${opts(range(1980, 2008).map(String))}</select>
      <select name="d2m">${opts(range(1, 12).map(String))}</select>
      <select name="d2d">${opts(range(1, 31).map((d) => [String(d - 1), `${d}`]))}</select></td></tr></table></form>`,
    profile: { birthDate: '1999-04-05' },
    expect: { '[name=d2y]': '1999', '[name=d2m]': '4', '[name=d2d]': '5' },
  },
  {
    name: 'D3 英語の性別プルダウン（Female が先・男性）',
    html: `<form><label>Gender <select name="d3">${opts(['Female', 'Male', 'Prefer not to say'], 'Select')}</select></label></form>`,
    expect: { '[name=d3]': 'Male' },
  },
  {
    name: 'D4 英語の性別プルダウン（女性）',
    html: `<form><label>Gender <select name="d4">${opts(['Male', 'Female'], 'Select')}</select></label></form>`,
    profile: { gender: 'female' },
    expect: { '[name=d4]': 'Female' },
  },
  {
    name: 'D5 全角数字の選択肢（１９９９年・４月）',
    html: `<form><table><tr><th>生年月日</th><td>
      <select name="d5y">${opts(range(1980, 2008).map((y) => [String(y), `${String(y).replace(/\d/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0))}年`]))}</select>
      <select name="d5m">${opts(range(1, 12).map((m) => [String(m), `${String(m).replace(/\d/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0))}月`]))}</select>
      <select name="d5d">${opts(range(1, 31).map(String))}</select></td></tr></table></form>`,
    expect: { '[name=d5y]': '1999', '[name=d5m]': '4', '[name=d5d]': '1' },
  },
  {
    name: 'D6 年を選ぶと月・日の選択肢が非同期で作り直される',
    html: `<form><table><tr><th>生年月日</th><td>
      <select name="d6y">${opts(range(1980, 2008).map(String))}</select>
      <select name="d6m"><option value="">--</option></select>
      <select name="d6d"><option value="">--</option></select></td></tr></table></form>`,
    setup(root) {
      const y = root.querySelector<HTMLSelectElement>('[name=d6y]')!;
      const m = root.querySelector<HTMLSelectElement>('[name=d6m]')!;
      const d = root.querySelector<HTMLSelectElement>('[name=d6d]')!;
      y.addEventListener('change', () => setTimeout(() => (m.innerHTML = opts(range(1, 12).map(String), '--')), 100));
      m.addEventListener('change', () => setTimeout(() => (d.innerHTML = opts(range(1, 30).map(String), '--')), 100));
    },
    expect: { '[name=d6y]': '1999', '[name=d6m]': '4', '[name=d6d]': '1' },
  },
  {
    name: 'D7 月を選ぶと日の選択肢を作り直す（選択がリセットされる）',
    html: `<form><table><tr><th>生年月日</th><td>
      <select name="d7y">${opts(range(1980, 2008).map(String))}</select>
      <select name="d7m">${opts(range(1, 12).map(String))}</select>
      <select name="d7d">${opts(range(1, 31).map(String))}</select></td></tr></table></form>`,
    setup(root) {
      const m = root.querySelector<HTMLSelectElement>('[name=d7m]')!;
      const y = root.querySelector<HTMLSelectElement>('[name=d7y]')!;
      const d = root.querySelector<HTMLSelectElement>('[name=d7d]')!;
      const rebuild = () => setTimeout(() => (d.innerHTML = opts(range(1, new Date(+y.value || 2000, +m.value || 1, 0).getDate()).map(String))), 400);
      m.addEventListener('change', rebuild);
      y.addEventListener('change', rebuild);
    },
    expect: { '[name=d7y]': '1999', '[name=d7m]': '4', '[name=d7d]': '1' },
  },
  {
    name: 'D8 都道府県を選ぶと市区町村のプルダウンが非同期で読み込まれる',
    html: `<form><table>
      <tr><th>都道府県</th><td><select name="d8p">${opts(['北海道', '東京都', '大阪府'])}</select></td></tr>
      <tr><th>市区町村</th><td><select name="d8c"><option value="">先に都道府県を選択</option></select></td></tr></table></form>`,
    setup(root) {
      const p = root.querySelector<HTMLSelectElement>('[name=d8p]')!;
      const c = root.querySelector<HTMLSelectElement>('[name=d8c]')!;
      p.addEventListener('change', () => setTimeout(() => (c.innerHTML = opts(['千代田区', '新宿区', '渋谷区'])), 500));
    },
    expect: { '[name=d8p]': '東京都', '[name=d8c]': '渋谷区' },
  },
  {
    name: 'D9 都道府県：京都府の人（東京都が先にある）',
    html: `<form><label>都道府県 <select name="d9">${opts(['東京都', '京都府'])}</select></label></form>`,
    profile: { prefecture: '京都府' },
    expect: { '[name=d9]': '京都府' },
  },
  {
    name: 'D10 都道府県：京都の人・「都府県」なしの選択肢',
    html: `<form><label>都道府県 <select name="d10">${opts(['東京', '京都', '大阪'])}</select></label></form>`,
    profile: { prefecture: '京都府' },
    expect: { '[name=d10]': '京都' },
  },
  {
    name: 'D11 卒業年月が1つのプルダウン（2026年3月）',
    html: `<form><label>卒業予定年月 <select name="d11">${opts(['2025年3月', '2025年9月', '2026年3月', '2026年9月'])}</select></label></form>`,
    expect: { '[name=d11]': '2026年3月' },
  },
  {
    name: 'D12 卒業年月が1つのプルダウン（2026/03 表記）',
    html: `<form><label>卒業予定年月 <select name="d12">${opts(['2025/03', '2026/03', '2027/03'])}</select></label></form>`,
    expect: { '[name=d12]': '2026/03' },
  },
  {
    name: 'D13 Select2 などで本物の select が非表示',
    html: `<form><label for="d13">都道府県</label><select id="d13" name="d13" class="select2-hidden-accessible" style="position:absolute;width:1px;height:1px;clip:rect(0 0 0 0);overflow:hidden" tabindex="-1" aria-hidden="true">${opts(['北海道', '東京都'])}</select><span class="select2 select2-container">選択してください ▼</span></form>`,
    expect: { '[name=d13]': '東京都' },
  },
  {
    name: 'D13b display:none で隠れただけの select（Select2 ではない）には入れない',
    html: `<form><div><label>都道府県 <select name="d13b" style="display:none">${opts(['北海道', '東京都'])}</select></label></div></form>`,
    expect: { '[name=d13b]': '' },
  },
  {
    name: 'D14 複数選択の select には変な値を入れない',
    html: `<form><label>希望勤務地 <select name="d14" multiple>${opts(['東京都', '大阪府'], '指定なし')}</select></label></form>`,
    expect: { '[name=d14]': '' },
  },
  {
    name: 'D15 選択肢の前後にスペース・nbsp',
    html: `<form><label>都道府県 <select name="d15"><option value="">--</option><option value="13">&nbsp; 東京都 &nbsp;</option></select></label></form>`,
    expect: { '[name=d15]': '13' },
  },
  {
    name: 'D16 性別の選択肢が「男性」「女性」で value が 0/1',
    html: `<form><label>性別 <select name="d16">${opts([['0', '男性'], ['1', '女性']])}</select></label></form>`,
    profile: { gender: 'female' },
    expect: { '[name=d16]': '1' },
  },
  {
    name: 'D17 学校区分：大学院の人に「大学」を選ばない',
    html: `<form><label>学校区分 <select name="d17">${opts(['大学', '大学院', '短期大学', '専門学校'])}</select></label></form>`,
    profile: { schoolType: '大学院（修士）' },
    expect: { '[name=d17]': '大学院' },
  },
  {
    name: 'D18 文理区分のプルダウン',
    html: `<form><label>文理区分 <select name="d18">${opts(['文系', '理系', 'その他'])}</select></label></form>`,
    profile: { bunri: '理系' },
    expect: { '[name=d18]': '理系' },
  },
  {
    name: 'D19 月の選択肢が「1月(Jan)」形式',
    html: `<form><table><tr><th>生年月日</th><td>
      <select name="d19y">${opts(range(1980, 2008).map(String))}</select>
      <select name="d19m">${opts(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((e, i) => [String(i + 1), `${i + 1}月(${e})`]))}</select>
      <select name="d19d">${opts(range(1, 31).map(String))}</select></td></tr></table></form>`,
    expect: { '[name=d19y]': '1999', '[name=d19m]': '4', '[name=d19d]': '1' },
  },
  {
    name: 'D20 生年の選択肢が新しい順・value は index',
    html: `<form><table><tr><th>生年月日</th><td>
      <select name="d20y">${opts(range(1980, 2008).reverse().map((y, i) => [String(i), `${y}年`]))}</select>
      <select name="d20m">${opts(range(1, 12).map(String))}</select>
      <select name="d20d">${opts(range(1, 31).map(String))}</select></td></tr></table></form>`,
    expect: { '[name=d20y]': '1999年', '[name=d20m]': '4', '[name=d20d]': '1' },
  },
  {
    name: 'D21 都道府県の value が JIS コード 01〜47',
    html: `<form><label>都道府県 <select name="d21">${opts([['01', '北海道'], ['04', '宮城県'], ['13', '東京都']])}</select></label></form>`,
    expect: { '[name=d21]': '13' },
  },
  {
    name: 'D22 ユーザーが選び済みのプルダウン（都道府県）',
    html: `<form><label>都道府県 <select name="d22">${opts(['北海道', '東京都', '大阪府'])}</select></label></form>`,
    setup(root) {
      root.querySelector<HTMLSelectElement>('[name=d22]')!.value = '大阪府';
    },
    expect: { '[name=d22]': '大阪府' },
  },
  {
    name: 'D23 国籍プルダウン',
    html: `<form><label>国籍 <select name="d23">${opts(['日本', 'アメリカ', '中国', '韓国'])}</select></label></form>`,
    expect: { '[name=d23]': '日本' },
  },
  {
    name: 'D24 datalist 付きの大学名欄',
    html: `<form><label>大学名 <input name="d24" list="d24l"></label><datalist id="d24l"><option value="サンプル大学"><option value="テスト大学"></datalist></form>`,
    expect: { '[name=d24]': 'サンプル大学' },
  },
  {
    name: 'D25 卒業見込みのプルダウン',
    html: `<form><label>卒業区分 <select name="d25">${opts(['卒業', '卒業見込み', '中退'])}</select></label></form>`,
    expect: { '[name=d25]': '卒業見込み' },
  },
  {
    name: 'D26 学部の選択肢「経済学部」（学校で変わるプルダウン）',
    html: `<form><label>学部 <select name="d26">${opts(['法学部', '経済学部', '経営学部'])}</select></label></form>`,
    expect: { '[name=d26]': '経済学部' },
  },
  {
    name: 'D27 経営学部の人に経済学部を選ばない・ない場合は空のまま',
    html: `<form><label>学部 <select name="d27">${opts(['法学部', '経済学部'])}</select></label></form>`,
    profile: { faculty: '経営学部' },
    expect: { '[name=d27]': '' },
  },
  {
    name: 'D28 1月生まれ（「1」が「10」「11」「12」に化けない）',
    html: `<form><table><tr><th>生年月日</th><td>
      <select name="d28y">${opts(range(1980, 2008).map(String))}</select>
      <select name="d28m">${opts(range(1, 12).map((m) => `${m}月`))}</select>
      <select name="d28d">${opts(range(1, 31).map((d) => `${d}日`))}</select></td></tr></table></form>`,
    profile: { birthDate: '2001-01-01' },
    expect: { '[name=d28y]': '2001', '[name=d28m]': '1月', '[name=d28d]': '1日' },
  },
  {
    name: 'N1 「姓」「名」「セイ」「メイ」がそれぞれ別の行の見出し（name は手がかりなし）',
    html: `<form><table>
      <tr><th>姓</th><td><input name="q1"></td></tr><tr><th>名</th><td><input name="q2"></td></tr>
      <tr><th>セイ</th><td><input name="q3"></td></tr><tr><th>メイ</th><td><input name="q4"></td></tr></table></form>`,
    expect: { '[name=q1]': '山田', '[name=q2]': '太郎', '[name=q3]': 'ヤマダ', '[name=q4]': 'タロウ' },
  },
  {
    name: 'N2 「氏名」の行見出しに2つの欄（従来どおり位置で分ける）',
    html: `<form><table><tr><th>氏名</th><td><input name="n2a"> <input name="n2b"></td></tr></table></form>`,
    expect: { '[name=n2a]': '山田', '[name=n2b]': '太郎' },
  },
  {
    name: 'N3 「氏名」の行見出しに1つの欄（姓名をまとめて入れる）',
    html: `<form><table><tr><th>氏名</th><td><input name="n3"></td></tr></table></form>`,
    expect: { '[name=n3]': '山田　太郎' },
  },
  {
    name: 'U1 入力後にユーザーが書き直した欄は「元に戻す」で消さない',
    html: `<form><label>大学名 <input name="u1a"></label><label>学部 <select name="u1b"><option value="">--</option><option>経済学部</option><option>法学部</option></select></label><label>メールアドレス <input name="u1c" type="email"></label></form>`,
    afterFill(root: HTMLElement) {
      root.querySelector<HTMLInputElement>('[name=u1a]')!.value = 'サンプル大学大学院';
      root.querySelector<HTMLSelectElement>('[name=u1b]')!.value = '法学部';
      return { '[name=u1a]': 'サンプル大学大学院', '[name=u1b]': '法学部' };
    },
    expect: { '[name=u1a]': 'サンプル大学', '[name=u1b]': '経済学部', '[name=u1c]': 'taro@example.com' },
  },

  // ---- 第5弾：独自デザインのプルダウン（MUI・react-select・Ant Design・Radix・Headless UI 風） ----
  {
    name: 'C1 MUI 風の都道府県（一覧は body 直下に出る）',
    html: `<form><div data-combo="c1"></div></form>`,
    setup: combos([{ style: 'mui', name: 'c1', label: '都道府県', options: PREFECTURES }]),
    expect: { '[name=c1]': '東京都' },
  },
  {
    name: 'C2 MUI 風の性別',
    html: `<form><div data-combo="c2"></div></form>`,
    setup: combos([{ style: 'mui', name: 'c2', label: '性別', options: ['男性', '女性', '回答しない'] }]),
    profile: { gender: 'female' },
    expect: { '[name=c2]': '女性' },
  },
  {
    name: 'C3 react-select 風（選択肢に role がない）',
    html: `<form><div data-combo="c3"></div></form>`,
    setup: combos([{ style: 'reactSelect', name: 'c3', label: '都道府県', placeholder: 'Select...', options: PREFECTURES }]),
    expect: { '[name=c3]': '東京都' },
  },
  {
    name: 'C4 Ant Design 風の仮想リスト（最後の沖縄県までスクロール）',
    html: `<form><div data-combo="c4"></div></form>`,
    setup: combos([{ style: 'antVirtual', name: 'c4', label: '都道府県', placeholder: '選択してください', options: PREFECTURES }]),
    profile: { prefecture: '沖縄県' },
    expect: { '[name=c4]': '沖縄県' },
  },
  {
    name: 'C5 入力候補つきの大学名（候補から選ぶ）',
    html: `<form><div data-combo="c5"></div></form>`,
    setup: combos([{ style: 'autocomplete', name: 'c5', label: '大学名', options: ['サンプル大学', 'サンプル工業大学', 'テスト大学'] }]),
    expect: { '[name=c5]': 'サンプル大学' },
  },
  {
    name: 'C6 入力候補つきの大学名（候補にないので文字のまま）',
    html: `<form><div data-combo="c6"></div></form>`,
    setup: combos([{ style: 'autocomplete', name: 'c6', label: '大学名', options: ['テスト大学'] }]),
    expect: { '[name=c6]': 'サンプル大学' },
  },
  {
    name: 'C7 Headless UI 風（click でだけ開く）の学校区分',
    html: `<form><div data-combo="c7"></div></form>`,
    setup: combos([{ style: 'headless', name: 'c7', label: '学校区分', placeholder: '選択してください', options: ['大学院', '大学', '短期大学', '専門学校'] }]),
    expect: { '[name=c7]': '大学' },
  },
  {
    name: 'C8 Radix 風（pointer で開き、開いた位置からの pointerup では選ばない）の文理区分',
    html: `<form><div data-combo="c8"></div></form>`,
    setup: combos([{ style: 'radix', name: 'c8', label: '文理区分', placeholder: '選択してください', options: ['文系', '理系', 'その他'] }]),
    expect: { '[name=c8]': '文系' },
  },
  {
    name: 'C9 生年月日の年・月・日（月は年を、日は月を選ぶと作られる）',
    html: `<form><div class="title">生年月日</div><div style="display:flex;gap:8px"><div data-combo="c9y"></div><div data-combo="c9m"></div><div data-combo="c9d"></div></div></form>`,
    setup(root) {
      let y = '';
      let m = '';
      combos([
        { style: 'mui', name: 'c9y', label: '年', options: range(1980, 2008).map((v) => `${v}年`), onChange: (v) => (y = v) },
        { style: 'mui', name: 'c9m', label: '月', options: () => (y ? range(1, 12).map((v) => `${v}月`) : []), onChange: (v) => (m = v) },
        { style: 'mui', name: 'c9d', label: '日', options: () => (m ? range(1, 30).map((v) => `${v}日`) : []) },
      ])(root);
    },
    profile: { birthDate: '1999-04-30' },
    expect: { '[name=c9y]': '1999年', '[name=c9m]': '4月', '[name=c9d]': '30日' },
  },
  {
    name: 'C10 自分で選び済みの独自プルダウンは変えない',
    html: `<form><div data-combo="c10"></div></form>`,
    setup: combos([{ style: 'mui', name: 'c10', label: '都道府県', options: PREFECTURES, value: '大阪府' }]),
    expect: { '[name=c10]': '大阪府' },
  },
  {
    name: 'C11 関係のない独自プルダウン（学年）には触らない',
    html: `<form><div data-combo="c11"></div></form>`,
    setup: combos([{ style: 'mui', name: 'c11', label: '学年', options: ['1年', '2年', '3年', '4年'] }]),
    expect: { '[name=c11]': '' },
  },
  {
    name: 'C12 ふつうの欄と独自プルダウンが混ざったフォーム',
    html: `<form><table>
      <tr><th>氏名</th><td><input name="c12a"> <input name="c12b"></td></tr>
      <tr><th>都道府県</th><td><div data-combo="c12p"></div></td></tr>
      <tr><th>市区町村</th><td><input name="c12c"></td></tr>
      <tr><th>学校区分</th><td><div data-combo="c12s"></div></td></tr></table></form>`,
    setup: combos([
      { style: 'mui', name: 'c12p', label: '', options: PREFECTURES },
      { style: 'reactSelect', name: 'c12s', label: '', placeholder: 'Select...', options: ['大学', '大学院', '短期大学'] },
    ]),
    expect: { '[name=c12a]': '山田', '[name=c12b]': '太郎', '[name=c12p]': '東京都', '[name=c12c]': '渋谷区', '[name=c12s]': '大学' },
  },
  {
    name: 'C13 選択肢に合うものがなければ何も選ばずに閉じる',
    html: `<form><div data-combo="c13"></div></form>`,
    setup: combos([{ style: 'mui', name: 'c13', label: '都道府県', options: ['北海道', '大阪府'] }]),
    expect: { '[name=c13]': '' },
  },

  // ---- 第6弾：読み取り専用の欄・書式を自動で整える欄・文字数制限 ----
  {
    name: 'R2 読み取り専用で値の入ったメールアドレス（登録済み）は変えない',
    html: `<form><label>メールアドレス <input name="r2" readonly value="old@example.com"></label></form>`,
    expect: { '[name=r2]': 'old@example.com' },
  },
  {
    name: 'R3 読み取り専用の年齢（自動計算）には入れない',
    html: `<form><label>年齢 <input name="r3" readonly></label></form>`,
    expect: { '[name=r3]': '' },
  },
  {
    name: 'R5 電話番号：maxlength=11（ハイフンなし）',
    html: `<form><label>携帯電話番号 <input name="r5" type="tel" maxlength="11"></label></form>`,
    expect: { '[name=r5]': '09012345678' },
  },
  {
    name: 'R6 郵便番号：maxlength=7',
    html: `<form><label>郵便番号 <input name="r6" maxlength="7"></label></form>`,
    expect: { '[name=r6]': '1500041' },
  },
  {
    name: 'R7 入力マスク（数字だけ残して自動でハイフンを付ける電話番号）',
    html: `<form><label>電話番号 <input name="r7" type="tel" placeholder="090-0000-0000"></label></form>`,
    setup(root) {
      const el = root.querySelector<HTMLInputElement>('[name=r7]')!;
      el.addEventListener('input', () => {
        const d = el.value.replace(/\D/g, '').slice(0, 11);
        el.value = d.length > 7 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
      });
    },
    expect: { '[name=r7]': '090-1234-5678' },
  },
  {
    name: 'R8 入力マスク（数字以外を消す・ハイフンなしの郵便番号）',
    html: `<form><label>郵便番号 <input name="r8" inputmode="numeric"></label></form>`,
    setup(root) {
      const el = root.querySelector<HTMLInputElement>('[name=r8]')!;
      el.addEventListener('input', () => (el.value = el.value.replace(/\D/g, '')));
    },
    expect: { '[name=r8]': '1500041' },
  },
  {
    name: 'R9 貼り付け禁止のメールアドレス確認欄',
    html: `<form><label>メールアドレス <input name="r9a" type="email"></label><label>メールアドレス（確認） <input name="r9b" type="email" onpaste="return false"></label></form>`,
    expect: { '[name=r9a]': 'taro@example.com', '[name=r9b]': 'taro@example.com' },
  },
  {
    name: 'R10 全角カナ指定・maxlength のあるフリガナ',
    html: `<form><label>フリガナ（全角カナ）<input name="r10" maxlength="10"></label></form>`,
    expect: { '[name=r10]': 'ヤマダ　タロウ' },
  },

  {
    name: 'R11 name のないラジオ（Vue の v-model）を1つの質問としてまとめる',
    html: `<form><table>
      <tr><th>性別</th><td><label><input type="radio" value="男性" id="r11a">男性</label><label><input type="radio" value="女性" id="r11b">女性</label></td></tr>
      <tr><th>文理区分</th><td><label><input type="radio" value="文系" id="r11c">文系</label><label><input type="radio" value="理系" id="r11d">理系</label></td></tr></table></form>`,
    profile: { gender: 'female', bunri: '理系' },
    expect: { '#r11a': false, '#r11b': true, '#r11c': false, '#r11d': true },
  },
  {
    name: 'snar.jp：見出しが左の td、右の td にラベルなしの欄が並ぶ（フリガナ・携帯3分割・郵便2分割）',
    html: `<form><table>
      <tr id="input01"><td class="td01">氏名<span class="required">*</span><input type="hidden" name="hdn_name_T" value="氏名"><input type="hidden" name="hdn_name" value="1"></td><td><input name="sn_name1" type="text" class="inputMText"> <input name="sn_name2" type="text" class="inputMText"><p></p></td></tr>
      <tr id="input02"><td class="td01">フリガナ<span class="required">*</span><input type="hidden" name="hdn_kana_T" value="フリガナ"><input type="hidden" name="hdn_kana" value="1"></td><td><input name="sn_kana1" type="text" class="inputMText"> <input name="sn_kana2" type="text" class="inputMText"><p></p></td></tr>
      <tr id="input18"><td class="td01">携帯電話<span class="required">*</span><input type="hidden" name="hdn_keitai_T" value="携帯電話"><input type="hidden" name="hdn_keitai" value="1"></td><td><input name="sn_keitai1" type="text" class="inputSText"> - <input name="sn_keitai2" type="text" class="inputSText"> - <input name="sn_keitai3" type="text" class="inputSText"><p></p></td></tr>
      <tr id="input07"><td class="td01">郵便番号<span class="required">*</span></td><td><input name="sn_zip1" type="text" maxlength="3" class="inputSText"> - <input name="sn_zip2" type="text" maxlength="4" class="inputSText"> <a href="#">住所検索</a><p></p></td></tr>
    </table></form>`,
    expect: {
      '[name=sn_name1]': '山田',
      '[name=sn_name2]': '太郎',
      '[name=sn_kana1]': 'ヤマダ',
      '[name=sn_kana2]': 'タロウ',
      '[name=sn_keitai1]': '090',
      '[name=sn_keitai2]': '1234',
      '[name=sn_keitai3]': '5678',
      '[name=sn_zip1]': '150',
      '[name=sn_zip2]': '0041',
    },
  },
  {
    name: 'マイナビ（My CareerID）：自宅・携帯の3分割の区切りが、欄ごとの div の中の「–」（en ダッシュ）',
    html: `<form><div class="c-formSection__group__inner">
      <div class="c-formSection__group__col1"><div class="c-formSection__group__ttl__wrap"><p class="c-required-tag">必須</p><div class="c-formSection__group__ttl"><p>電話番号</p><ul class="c-markList c-notes"><li><i>※</i><span>「自宅電話番号」「携帯電話番号」のいずれかは必ず入力してください。</span></li></ul></div></div></div>
      <div class="c-formSection__group__col2">
        ${(
          [
            ['自宅電話番号（050で始まるものも含む）', 'local.phone'],
            ['携帯電話番号', 'local.mobilePhone'],
          ] as const
        )
          .map(
            ([label, name], k) =>
              `${k ? '<ul class="c-form-unit"><li><p class="c-form-unit__txt">内線番号/呼び出しの方</p><input type="tel" name="data.extentionNumber" class="c-form-input-text" placeholder="半角数字"></li></ul>' : ''}
              <ul class="c-form-unit"><li><p class="c-form-unit__txt">${label}</p><div class="c-form-input-require-wrap"><div class="c-form-unit-tel__wrap">
                <div class="c-form-unit-tel__unit"><input type="tel" name="${name}1" size="8" class="c-form-input-text" placeholder="半角数字"> <span class="__txt">–</span></div>
                <div class="c-form-unit-tel__unit"><input type="tel" name="${name}2" size="8" class="c-form-input-text" placeholder="半角数字"> <span class="__txt">–</span></div>
                <div class="c-form-unit-tel__unit"><input type="tel" name="${name}3" size="8" class="c-form-input-text" placeholder="半角数字"></div>
              </div></div><input type="hidden" name="${name}Search"><span class="error field-error-msg"></span></li></ul>`,
          )
          .join('')}
      </div>
    </div></form>`,
    expect: {
      '[name="local.phone1"]': '03',
      '[name="local.phone2"]': '1234',
      '[name="local.phone3"]': '5678',
      '[name="data.extentionNumber"]': '',
      '[name="local.mobilePhone1"]': '090',
      '[name="local.mobilePhone2"]': '1234',
      '[name="local.mobilePhone3"]': '5678',
    },
  },
  {
    name: '区切りがいろいろなダッシュ：郵便番号の「−」（マイナス）、「（－なし）」の全角ハイフン',
    html: `<form>
      <div class="item"><p>郵便番号</p><div class="wrap"><div class="unit"><input name="dz1"><span>−</span></div><div class="unit"><input name="dz2"></div></div></div>
      <div class="item"><p>携帯電話（－なし）</p><div class="unit"><input name="dtel"></div></div>
    </form>`,
    expect: { '[name=dz1]': '150', '[name=dz2]': '0041', '[name=dtel]': '09012345678' },
  },

  // ---- 第6弾：監査で見つかった外れ方 ----
  {
    name: 'D1 1行に「姓」「名」の th と欄が交互に並ぶ表',
    html: `<form><table><tr><th>姓</th><td><input name="d1a"></td><th>名</th><td><input name="d1b"></td></tr></table></form>`,
    expect: { '[name=d1a]': '山田', '[name=d1b]': '太郎' },
  },
  {
    name: 'D2 「全角カタカナで入力してください」という placeholder はひらがなの例ではない',
    html: `<form>
      <p><label>フリガナ <input name="d2a" placeholder="全角カタカナで入力してください"></label></p>
      <p><label>ふりがな（カナ）<input name="d2b" placeholder="カタカナで入力"></label></p>
    </form>`,
    expect: { '[name=d2a]': 'ヤマダ　タロウ', '[name=d2b]': 'ヤマダ　タロウ' },
  },
  {
    name: 'D3 「〜不可」「〜は使用できません」と書かれた書式は使わない',
    html: `<form>
      <p><label>フリガナ（全角カナ・半角カナ不可）<input name="d3a"></label></p>
      <p><label>電話番号（半角数字・全角不可）<input name="d3b"></label></p>
      <p><label>携帯電話番号（全角文字は使用できません）<input name="d3c"></label></p>
      <p><label>生年月日（西暦で入力・和暦不可）<input name="d3d"></label></p>
    </form>`,
    expect: { '[name=d3a]': 'ヤマダ　タロウ', '[name=d3b]': '03-1234-5678', '[name=d3c]': '090-1234-5678', '[name=d3d]': '1999/04/01' },
  },
  {
    name: 'D4 「番地」の行見出しと入力例の placeholder',
    html: `<form><table>
      <tr><th>都道府県</th><td><select name="d4p">${opts(PREFECTURES)}</select></td></tr>
      <tr><th>市区町村</th><td><input name="d4c"></td></tr>
      <tr><th>番地</th><td><input name="d4a" placeholder="例：神南1-2-3"></td></tr>
      <tr><th>建物名</th><td><input name="d4b"></td></tr>
    </table></form>`,
    expect: { '[name=d4p]': '東京都', '[name=d4c]': '渋谷区', '[name=d4a]': '神南1-2-3', '[name=d4b]': 'サンプルマンション101' },
  },
  {
    name: 'D5 見出しが「保護者連絡先」の区切りには本人の情報を入れない',
    html: `<form>
      <h3>本人情報</h3>
      <table><tr><th>氏名</th><td><input name="d5x"></td></tr></table>
      <h3>保護者連絡先</h3>
      <table>
        <tr><th>氏名</th><td><input name="d5a"></td></tr>
        <tr><th>電話番号</th><td><input name="d5b"></td></tr>
        <tr><th>メールアドレス</th><td><input name="d5c"></td></tr>
      </table></form>`,
    expect: { '[name=d5x]': '山田　太郎', '[name=d5a]': '', '[name=d5b]': '', '[name=d5c]': '' },
  },
  {
    name: 'D6 autocomplete があってもフリガナ・帰省先の判定を優先する',
    html: `<form>
      <p><label>セイ <input name="d6a" autocomplete="family-name"></label> <label>メイ <input name="d6b" autocomplete="given-name"></label></p>
      <h3>帰省先</h3>
      <table><tr><th>電話番号</th><td><input name="d6c" autocomplete="tel"></td></tr></table>
    </form>`,
    profile: { kiseiSame: false, kiseiPhone: '011-123-4567' },
    expect: { '[name=d6a]': 'ヤマダ', '[name=d6b]': 'タロウ', '[name=d6c]': '011-123-4567' },
  },
  {
    name: 'D7 緊急連絡先の区切りでは、氏名・続柄・電話番号以外に本人の情報を入れない',
    html: `<form><h3>緊急連絡先</h3><table>
      <tr><th>氏名</th><td><input name="d7a"></td></tr>
      <tr><th>フリガナ</th><td><input name="d7b"></td></tr>
      <tr><th>続柄</th><td><input name="d7c"></td></tr>
      <tr><th>電話番号</th><td><input name="d7d"></td></tr>
      <tr><th>携帯電話</th><td><input name="d7h"> - <input name="d7i"> - <input name="d7j"></td></tr>
      <tr><th>郵便番号</th><td><input name="d7e"></td></tr>
      <tr><th>住所</th><td><input name="d7f"></td></tr>
      <tr><th>メールアドレス</th><td><input name="d7g"></td></tr>
    </table></form>`,
    profile: { emergencyName: '山田花子', emergencyRelation: '母', emergencyPhone: '03-9876-5432' },
    expect: {
      '[name=d7a]': '山田花子',
      '[name=d7b]': '',
      '[name=d7c]': '母',
      '[name=d7d]': '03-9876-5432',
      '[name=d7h]': '',
      '[name=d7i]': '',
      '[name=d7j]': '',
      '[name=d7e]': '',
      '[name=d7f]': '',
      '[name=d7g]': '',
    },
  },
  {
    name: 'D8 都道府県が並ぶプルダウンでも、見出しが希望勤務地・出身地なら現住所の都道府県にしない',
    html: `<form><table>
      <tr><th>第1希望勤務地</th><td><select name="d8a">${opts(PREFECTURES)}</select></td></tr>
      <tr><th>出身地</th><td><select name="d8b">${opts(PREFECTURES)}</select></td></tr>
    </table></form>`,
    profile: { desiredLocations: ['大阪府'] },
    expect: { '[name=d8a]': '大阪府', '[name=d8b]': '' },
  },
  {
    name: 'D9 学校名・学部名のフリガナ欄に漢字を入れない',
    html: `<form><table>
      <tr><th>学校名</th><td><input name="d9a"></td></tr>
      <tr><th>学校名（フリガナ）</th><td><input name="d9b"></td></tr>
      <tr><th>学部名</th><td><input name="d9d"></td></tr>
      <tr><th>学部名（フリガナ）</th><td><input name="d9c"></td></tr>
    </table></form>`,
    expect: { '[name=d9a]': 'サンプル大学', '[name=d9b]': 'サンプルダイガク', '[name=d9d]': '経済学部', '[name=d9c]': '' },
  },
  {
    name: 'D10 「卒業学校名」「卒業学部」は卒業年月ではない',
    html: `<form>
      <p><label>卒業学校名 <input name="d10a"></label></p>
      <p><label>卒業学部 <input name="d10b"></label></p>
      <p><label>卒業年月 <input name="d10c"></label></p>
    </form>`,
    expect: { '[name=d10a]': 'サンプル大学', '[name=d10b]': '経済学部', '[name=d10c]': '2026年3月' },
  },
  {
    name: 'D11 name 属性の一部だけの一致（grade・work_preference・strength）で判定しない',
    html: `<form>
      <input name="grade"> <input name="work_preference"> <input name="strength"> <input name="challenge">
    </form>`,
    expect: { '[name=grade]': '', '[name=work_preference]': '', '[name=strength]': '', '[name=challenge]': '' },
  },
  {
    name: 'D12 type="url" の欄',
    html: `<form><label>ポートフォリオ <input type="url" name="d12"></label></form>`,
    profile: { portfolioUrl: 'https://example.com/taro' },
    expect: { '[name=d12]': 'https://example.com/taro' },
  },
  {
    name: 'D13 「帰省先住所（現住所と異なる場合のみ記入）」は帰省先の住所',
    html: `<form><table><tr><th>帰省先住所（現住所と異なる場合のみ記入）</th><td><input name="d13"></td></tr></table></form>`,
    profile: { kiseiSame: false, kiseiPrefecture: '北海道', kiseiCity: '札幌市中央区', kiseiAddressLine: '北1条西1-1', kiseiBuilding: '' },
    expect: { '[name=d13]': '北海道札幌市中央区北1条西1-1' },
  },
  {
    name: 'D15 自宅TEL・連絡先TEL・旧姓・Last Name (Kanji)',
    html: `<form>
      <p><label>自宅TEL <input name="d15a"></label></p>
      <p><label>連絡先TEL <input name="d15b"></label></p>
      <p><label>旧姓 <input name="d15c"></label></p>
      <p><label>Last Name (Kanji) <input name="d15d"></label></p>
    </form>`,
    expect: { '[name=d15a]': '03-1234-5678', '[name=d15b]': '090-1234-5678', '[name=d15c]': '', '[name=d15d]': '山田' },
  },
  {
    name: 'V2 状態をページ側で持つラジオ（React 風）も「元に戻す」で戻る',
    html: `<form><table><tr><th>性別</th><td><label><input type="radio" name="v2" value="男性">男性</label><label><input type="radio" name="v2" value="女性" checked>女性</label></td></tr></table></form>`,
    setup(root) {
      // React の制御コンポーネントのように、click で状態を変え、change のたびに状態どおりに描き直す
      const radios = Array.from(root.querySelectorAll<HTMLInputElement>('[name=v2]'));
      let state = '女性';
      const render = () => radios.forEach((r) => (r.checked = r.value === state));
      radios.forEach((r) => {
        r.addEventListener('click', () => (state = r.value));
        r.addEventListener('change', () => queueMicrotask(render));
      });
    },
    expect: { 'radio:v2': '男性' },
  },
  {
    name: 'V3 入力後にユーザーが選び直したラジオは「元に戻す」で消さない',
    html: `<form><table><tr><th>性別</th><td><label><input type="radio" name="v3" value="男性">男性</label><label><input type="radio" name="v3" value="女性">女性</label></td></tr></table></form>`,
    afterFill(root: HTMLElement) {
      root.querySelector<HTMLInputElement>('[name=v3][value=女性]')!.click();
      return { '[name=v3]:checked': '女性' };
    },
    expect: { 'radio:v3': '男性' },
  },
  {
    name: 'V4 少し遅れてハイフンを消すサイトの電話番号も「元に戻す」で戻る',
    html: `<form><label>電話番号 <input name="v4" type="tel"></label></form>`,
    setup(root) {
      const el = root.querySelector<HTMLInputElement>('[name=v4]')!;
      el.addEventListener('input', () => setTimeout(() => (el.value = el.value.replace(/-/g, '')), 30));
    },
    expect: { '[name=v4]': '09012345678' },
  },
  {
    name: 'V5 全角指定の行でも、@ で分かれたメールアドレスは全角にしない',
    html: `<form><table><tr><th>メールアドレス（全角で入力）</th><td><input name="v5a"> @ <input name="v5b"></td></tr></table></form>`,
    expect: { '[name=v5a]': 'taro', '[name=v5b]': 'example.com' },
  },
  {
    name: 'V6 卒業予定年月の placeholder が年月の例（例：2026年3月・YYYY/MM）',
    html: `<form>
      <p><label>卒業予定年月 <input name="v6a" placeholder="例：2026年3月"></label></p>
      <p><label>卒業予定年月 <input name="v6b" placeholder="YYYY/MM"></label></p>
    </form>`,
    expect: { '[name=v6a]': '2026年3月', '[name=v6b]': '2026/03' },
  },
  {
    name: 'V7 「帰省先は現住所と同じですか」のはい／いいえ（同じでない）',
    html: `<form><table><tr><th>帰省先は現住所と同じですか</th><td><label><input type="radio" name="v7" value="1">はい</label><label><input type="radio" name="v7" value="0">いいえ</label></td></tr></table></form>`,
    profile: { kiseiSame: false },
    expect: { 'radio:v7': 'いいえ' },
  },
  {
    name: 'V7b 「帰省先は現住所と同じですか」のはい／いいえ（同じ）',
    html: `<form><table><tr><th>帰省先は現住所と同じですか</th><td><label><input type="radio" name="v7b" value="1">はい</label><label><input type="radio" name="v7b" value="0">いいえ</label></td></tr></table></form>`,
    expect: { 'radio:v7b': 'はい' },
  },
  {
    name: 'V8 平成元年と0埋めの選択肢（平成01年）',
    html: `<form><table><tr><th>生年月日</th><td><select name="v8">${opts(range(1, 31).map((n) => `平成${String(n).padStart(2, '0')}年`))}</select></td></tr></table></form>`,
    profile: { birthDate: '1989-04-01' },
    expect: { '[name=v8]': '平成01年' },
  },
  (() => {
    // i-webs（オムロン）：jqTransform で本物のプルダウン・ラジオ・チェックボックスを隠し、飾りを描いている
    const jqSelect = (name: string, items: [string, string][]) => {
      const all: [string, string][] = [['', '-▼-'], ...items];
      return `<div class="jqTransformSelectWrapper jq-${name}"><div><span>-▼-</span><a href="#" class="jqTransformSelectOpen"></a></div><ul style="display:none">${all.map(([, t], i) => `<li><a href="#" index="${i}"${i ? '' : ' class="selected"'}>${t}</a></li>`).join('')}</ul><select name="${name}" class="jqTransformHidden">${all.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>`;
    };
    const pad = (n: number) => String(n).padStart(2, '0');
    const row = (head: string, body: string) => `<div class="formbox clearfix"><dt class="formbox01"><span class="inportant">◆</span>${head}</dt><dd class="formbox02"><span class="hosoku clearfix">${body}</span></dd></div>`;
    const address = (p: string) =>
      row('郵便番号 <span>（半角数字７桁のみ）</span>', `<input type="text" name="${p}yubin1"> - <input type="text" name="${p}yubin2"><input type="button" value="郵便番号から住所を検索">`) +
      row('都道府県', jqSelect(`${p}ken`, [['01', '北海道'], ['07', '福島県'], ['13', '東京都']])) +
      row('市区郡・地名・番地 <span>（全角入力のみ）</span>', `<input type="text" name="${p}adrs1">`);
    return {
      name: 'i-webs（オムロン）：jqTransform で隠したプルダウン・ラジオと、「現住所と同じ」チェックで帰省先を入れない',
      html: `<style>.jqTransformHidden{display:none}</style><form><dl>
        ${row('生年月日', `${jqSelect('ybirth', range(1988, 2010).map((y) => [String(y), String(y)]))}<label for="text">年</label>${jqSelect('mbirth', range(1, 12).map((m) => [pad(m), pad(m)]))}<label for="text">月</label>${jqSelect('dbirth', range(1, 31).map((d) => [pad(d), pad(d)]))}<label for="text">日</label>`)}
        <div class="formbox clearfix"><dt class="formbox01">性別</dt><dd class="formbox02"><ul class="hosoku clearfix">${[['1', '男', 'male'], ['2', '女', 'female']].map(([v, t, c]) => `<li class="sexcd"><span class="jqTransformRadioWrapper"><a href="#" class="jqTransformRadio" rel="sexcd"></a><input type="radio" name="sexcd" value="${v}" class="jqTransformHidden"></span><label for="text" class="${c}">${t}</label></li>`).join('')}</ul></dd></div>
        <div class="heading_l2">現住所情報</div>
        ${address('g')}
        <div class="heading_l2">帰省先情報</div>
        <div class="formbox clearfix"><span class="heading_l2l hosoku clearfix"><span class="jqTransformCheckboxWrapper"><a href="#" class="jqTransformCheckbox"></a><input type="checkbox" name="adch" class="jqTransformHidden" value="1"></span><label for="text">現住所と同じ場合はこちらにチェックしてください<br><span>※チェックを入れる場合は休暇中住所は入力しないでください。</span></label></span></div>
        ${address('k')}
      </dl></form>`,
      expect: {
        '[name=ybirth]': '1999',
        '[name=mbirth]': '04',
        '[name=dbirth]': '01',
        'text:.jq-ybirth > div > span': '1999',
        '[name=sexcd][value="1"]': true,
        '[name=sexcd][value="2"]': false,
        '[name=gyubin1]': '150',
        '[name=gyubin2]': '0041',
        '[name=gken]': '東京都',
        'text:.jq-gken > div > span': '東京都',
        '[name=adch]': true,
        '[name=kyubin1]': '',
        '[name=kken]': '',
        '[name=kadrs1]': '',
      },
    } satisfies Case;
  })(),
  (() => {
    // snar.jp（マクニカ）の応募フォーム。見出しの td に隠しデータの欄があり、サイトの script が現住所を帰省先に写す
    const row = (key: string, label: string, body: string, required = true) =>
      `<tr><td id="th_${key}" class="td01">${label}${required ? '<span class="required">*</span>' : ''}<input type="hidden" name="hdn_${key}_T" value="${label}"><input type="hidden" name="hdn_${key}" value="${required ? 1 : 0}"></td><td>${body}<p></p></td></tr>`;
    const sel = (name: string, items: (string | [string, string])[]) => `<select name="${name}" id="${name}">${opts(items, '')}</select>`;
    const ken = (name: string) => sel(name, [['1', '北海道'], ['7', '福島県'], ['13', '東京都'], ['14', '神奈川県']]);
    const tel = (n: string) => [1, 2, 3].map((i) => `<input name="tbx_tel${n}${i}" type="text" class="inputSText">`).join(' - ');
    return {
      name: 'snar.jp（マクニカ）：氏名・フリガナの分割、サブメールと再入力、郵便番号、「帰省先がない場合はチェック」、携帯と緊急連絡先',
      html: `<form>
      <table class="entryTb"><tbody><tr><th colspan="2">プロフィール情報</th></tr>
      ${row('name', '氏名', '<input name="tbx_name1" type="text" class="inputMText"> <input name="tbx_name2" type="text" class="inputMText">')}
      ${row('kana', 'フリガナ', '<input name="tbx_kana1" type="text" class="inputMText"> <input name="tbx_kana2" type="text" class="inputMText">')}
      ${row('birth', '生年月日', `${sel('ddl_birthY', range(1990, 2010).reverse().map(String))} 年 ${sel('ddl_birthM', range(1, 12).map(String))} 月 ${sel('ddl_birthD', range(1, 31).map(String))} 日`)}
      ${row('sex', '性別', ['男性', '女性', '無回答'].map((t, i) => `<input id="rbt_sex${i + 1}" type="radio" name="rbt_sex" value="rbt_sex${i + 1}"><label for="rbt_sex${i + 1}"> ${t} </label>`).join(''))}
      ${row('mail', 'メインメールアドレス', '<input name="tbx_mail" type="text" class="inputL"><p>最も連絡の取りやすいメールアドレス</p>')}
      <tr><td>再入力<span class="required">*</span></td><td><input name="tbx_mail_R" type="text" class="inputL"></td></tr>
      ${row('smail', 'サブメールアドレス', '<input name="tbx_smail" type="text" class="inputL"><p>その他のメールアドレス</p>', false)}
      <tr><td>再入力</td><td><input name="tbx_smail_R" type="text" class="inputL"></td></tr>
      ${row('sotsuy', '卒業年月', `${sel('ddl_sotsuyY', range(2015, 2030).map(String))} 年 ${sel('ddl_sotsuyM', range(1, 12).map(String))} 月`)}
      ${row('sotsuk', '卒業区分', sel('ddl_sotsuk', [['1', '卒業予定'], ['2', '既卒']]))}
      </tbody></table>
      <table class="entryTb"><tbody><tr><th colspan="2">住所情報</th></tr>
      ${row('zip', '郵便番号', '<input name="tbx_zip1" type="text" maxlength="3" class="inputSText"> - <input name="tbx_zip2" type="text" maxlength="4" class="inputSText"> <a href="#">住所検索</a><p>例：海外在住の場合、「000-0000」と入力してください。</p>')}
      ${row('ken', '都道府県', `${ken('ddl_ken')}<select name="ddl_kenList" style="visibility:hidden;"><option value=""></option><option value="北海道">1</option></select>`)}
      ${row('addr1', '市区郡番地', '<input name="tbx_addr1" type="text" class="inputL"><p>例）千代田区千代田1-2-3</p>')}
      ${row('addr2', 'マンション・アパート名', '<input name="tbx_addr2" type="text" class="inputL"><p>例）日本アパート201号室</p>', false)}
      <tr><td colspan="2">帰省先住所がある場合は入力して下さい。ない場合はチェックして下さい。<input type="hidden" name="hdn_kflg" value="帰省先住所がある場合は入力して下さい。ない場合はチェックして下さい。"><input id="cbx_kflg" type="checkbox" name="cbx_kflg"><label for="cbx_kflg">チェックしてください。</label></td></tr>
      ${row('kzip', '郵便番号', '<input name="tbx_kzip1" type="text" maxlength="3" class="inputSText"> - <input name="tbx_kzip2" type="text" maxlength="4" class="inputSText"> <a href="#">住所検索</a>', false)}
      ${row('kken', '都道府県', ken('ddl_kken'), false)}
      ${row('kaddr1', '市区郡番地', '<input name="tbx_kaddr1" type="text" class="inputL"><p>例）千代田区千代田1-2-3</p>', false)}
      ${row('kaddr2', 'マンション・アパート名', '<input name="tbx_kaddr2" type="text" class="inputL"><p>例）日本アパート201号室</p>', false)}
      ${row('tel1', '携帯電話番号', tel('1'))}
      ${row('tel2', '緊急連絡先', `${tel('2')}<p>ご実家または保護者様の電話番号をご入力ください</p>`)}
      </tbody></table></form>`,
      profile: { emailSub: 'sub@example.com' },
      expect: {
        '[name=tbx_name1]': '山田',
        '[name=tbx_name2]': '太郎',
        '[name=tbx_kana1]': 'ヤマダ',
        '[name=tbx_kana2]': 'タロウ',
        '[name=ddl_birthY]': '1999',
        '[name=ddl_birthM]': '4',
        '[name=ddl_birthD]': '1',
        '#rbt_sex1': true,
        '[name=tbx_mail]': 'taro@example.com',
        '[name=tbx_mail_R]': 'taro@example.com',
        '[name=tbx_smail]': 'sub@example.com',
        '[name=tbx_smail_R]': 'sub@example.com',
        '[name=ddl_sotsuyY]': '2026',
        '[name=ddl_sotsuyM]': '3',
        '[name=ddl_sotsuk]': '卒業予定',
        '[name=tbx_zip1]': '150',
        '[name=tbx_zip2]': '0041',
        '[name=ddl_ken]': '東京都',
        '[name=tbx_addr1]': '渋谷区神南1-2-3',
        '#cbx_kflg': true,
        '[name=tbx_kzip1]': '',
        '[name=ddl_kken]': '',
        '[name=tbx_kaddr1]': '',
        '[name=tbx_tel11]': '090',
        '[name=tbx_tel12]': '1234',
        '[name=tbx_tel13]': '5678',
        '[name=tbx_tel21]': '',
      },
    } satisfies Case;
  })(),

  // ---- 第7弾：2026-10-25 に直した形の、似た形 ----
  ...(['—', '−', 'ー', '－', '‐'] as const).map(
    (sep): Case => ({
      name: `似た形：欄ごとの div の中に区切りの「${sep}」（携帯 3 分割・郵便 2 分割）`,
      html: `<form>
        <div class="item"><p class="label">携帯電話番号</p><div class="wrap">${[1, 2, 3].map((i) => `<div class="unit"><input type="tel" name="dt${i}">${i < 3 ? sep : ''}</div>`).join('')}</div></div>
        <div class="item"><p class="label">郵便番号</p><div class="wrap"><div class="unit"><input name="dz1"><span>${sep}</span></div><div class="unit"><input name="dz2"></div></div></div>
      </form>`,
      expect: { '[name=dt1]': '090', '[name=dt2]': '1234', '[name=dt3]': '5678', '[name=dz1]': '150', '[name=dz2]': '0041' },
    }),
  ),
  {
    name: '似た形：ハイフンの指定（「-なし」・「ハイフン不要」・入力例の「–」・入力例が数字だけ）',
    html: `<form><table>
      <tr><th>携帯電話（-なし）</th><td><input name="h1"></td></tr>
      <tr><th>郵便番号（ハイフン不要）</th><td><input name="h2"></td></tr>
      <tr><th>電話番号</th><td><input name="h3" placeholder="例：090–1234–5678"></td></tr>
      <tr><th>連絡先電話番号</th><td><input name="h4" placeholder="09012345678"></td></tr>
    </table></form>`,
    expect: { '[name=h1]': '09012345678', '[name=h2]': '1500041', '[name=h3]': '090-1234-5678', '[name=h4]': '09012345678' },
  },
  (() => {
    const jqSelect = (name: string, items: string[]) =>
      `<div class="jqTransformSelectWrapper jq-${name}"><div><span>選択</span><a href="#" class="jqTransformSelectOpen"></a></div><ul style="display:none">${['選択', ...items].map((t, i) => `<li><a href="#" index="${i}">${t}</a></li>`).join('')}</ul><select name="${name}" class="jqTransformHidden">${opts(items, '選択')}</select></div>`;
    const jqRadio = (name: string, items: string[]) =>
      items.map((t, i) => `<span class="jqTransformRadioWrapper"><a href="#" class="jqTransformRadio jq-${name}${i}" rel="${name}"></a><input type="radio" name="${name}" value="${t}" class="jqTransformHidden"></span><label for="text">${t}</label>`).join('');
    return {
      name: '似た形：jqTransform の卒業年月・文理（ラジオ）と、帰省先が別の住所（チェックしない・帰省先を入れる）',
      html: `<style>.jqTransformHidden{display:none}</style><form><dl>
        <div><dt>卒業予定年月</dt><dd>${jqSelect('gy', ['2025', '2026', '2027'])}年${jqSelect('gm', ['1', '2', '3', '4'])}月</dd></div>
        <div><dt>文理区分</dt><dd>${jqRadio('bunri', ['文系', '理系'])}</dd></div>
        <div class="heading_l2">現住所</div>
        <div><dt>都道府県</dt><dd>${jqSelect('gken', ['東京都', '福島県'])}</dd></div>
        <div><dt>市区郡・番地</dt><dd><input name="gaddr"></dd></div>
        <div class="heading_l2">帰省先</div>
        <div><span class="jqTransformCheckboxWrapper"><a href="#" class="jqTransformCheckbox jq-same"></a><input type="checkbox" name="same" class="jqTransformHidden"></span><label for="text">現住所と同じ場合はチェック</label></div>
        <div><dt>都道府県</dt><dd>${jqSelect('kken', ['東京都', '福島県'])}</dd></div>
        <div><dt>市区郡・番地</dt><dd><input name="kaddr"></dd></div>
      </dl></form>`,
      profile: { kiseiSame: false, kiseiPostalCode: '530-0001', kiseiPrefecture: '福島県', kiseiCity: '大阪市北区', kiseiAddressLine: '梅田1-2-3' },
      expect: {
        '[name=gy]': '2026',
        '[name=gm]': '3',
        '[name=bunri][value="文系"]': true,
        'text:.jq-gy > div > span': '2026',
        '[name=gken]': '東京都',
        '[name=gaddr]': '渋谷区神南1-2-3',
        '[name=same]': false,
        '[name=kken]': '福島県',
        'text:.jq-kken > div > span': '福島県',
        '[name=kaddr]': '大阪市北区梅田1-2-3',
      },
    } satisfies Case;
  })(),
  {
    name: '似た形：dl の欄ごとの dt と、h3 の「帰省先」見出し（帰省先が別の住所）',
    html: `<form>
      <h3>現住所</h3>
      <dl><dt>郵便番号</dt><dd><input name="z1"> - <input name="z2"></dd><dt>都道府県</dt><dd><select name="p">${opts(['東京都', '福島県'])}</select></dd><dt>住所</dt><dd><input name="a"></dd></dl>
      <h3>帰省先</h3>
      <dl><dt>郵便番号</dt><dd><input name="kz1"> - <input name="kz2"></dd><dt>都道府県</dt><dd><select name="kp">${opts(['東京都', '福島県'])}</select></dd><dt>住所</dt><dd><input name="ka"></dd></dl>
    </form>`,
    profile: { kiseiSame: false, kiseiPostalCode: '530-0001', kiseiPrefecture: '福島県', kiseiCity: '大阪市北区', kiseiAddressLine: '梅田1-2-3' },
    expect: { '[name=z1]': '150', '[name=z2]': '0041', '[name=p]': '東京都', '[name=kz1]': '976', '[name=kz2]': '0053', '[name=kp]': '福島県', '[name=ka]': '大阪市北区梅田1-2-3' },
  },
  {
    // チェックボックスがなく、帰省先が現住所と同じなら、帰省先の欄にも現住所を入れる（「帰省先の見出しのある住所」と同じ）
    name: '似た形：外側の dt が「帰省先」、内側の dl に欄ごとの dt（現住所と同じなら帰省先にも現住所）',
    html: `<form><dl>
      <dt>現住所</dt><dd><dl><dt>郵便番号</dt><dd><input name="z"></dd><dt>住所</dt><dd><input name="a"></dd></dl></dd>
      <dt>帰省先</dt><dd><dl><dt>郵便番号</dt><dd><input name="kz"></dd><dt>住所</dt><dd><input name="ka"></dd></dl></dd>
    </dl></form>`,
    expect: {
      '[name=z]': '150-0041',
      '[name=a]': '東京都渋谷区神南1-2-3　サンプルマンション101',
      '[name=kz]': '150-0041',
      '[name=ka]': '東京都渋谷区神南1-2-3　サンプルマンション101',
    },
  },
  ...(
    [
      ['帰省先住所がある場合は入力して下さい。ない場合はチェックして下さい。', true],
      ['休暇中の連絡先が現住所と異なる場合のみ入力してください。同じ場合はチェック', true],
    ] as const
  ).flatMap(([text, isSameCheck]) =>
    [true, false].map(
      (same): Case => ({
        name: `似た形：「${text.slice(0, 18)}…」のチェック（帰省先が${same ? '同じ' : '別'}）`,
        html: `<form><table>
          <tr><th>郵便番号</th><td><input name="z1" maxlength="3"> - <input name="z2" maxlength="4"></td></tr>
          <tr><th>都道府県</th><td><select name="p">${opts(['東京都', '福島県'])}</select></td></tr>
          <tr><th>市区町村・番地</th><td><input name="a"></td></tr>
          <tr><td colspan="2">${text}<input type="checkbox" id="c" name="c"><label for="c">チェックしてください。</label></td></tr>
          <tr><th>郵便番号</th><td><input name="kz1" maxlength="3"> - <input name="kz2" maxlength="4"></td></tr>
          <tr><th>都道府県</th><td><select name="kp">${opts(['東京都', '福島県'])}</select></td></tr>
          <tr><th>市区町村・番地</th><td><input name="ka"></td></tr>
          <tr><th>電話番号</th><td><input name="t"></td></tr>
        </table></form>`,
        profile: same ? {} : { kiseiSame: false, kiseiPostalCode: '530-0001', kiseiPrefecture: '福島県', kiseiCity: '大阪市北区', kiseiAddressLine: '梅田1-2-3' },
        expect: {
          '[name=z1]': '150',
          '[name=p]': '東京都',
          '#c': isSameCheck && same,
          '[name=kz1]': same ? '' : '976',
          '[name=kz2]': same ? '' : '0053',
          '[name=kp]': same ? '' : '福島県',
          '[name=ka]': same ? '' : '大阪市北区梅田1-2-3',
          '[name=t]': '090-1234-5678',
        },
      }),
    ),
  ),
  {
    name: '似た形：「帰省先がある場合はチェック」（意味が逆）と「海外在住の場合はチェック」には触らない',
    html: `<form><table>
      <tr><th>住所</th><td><input name="a"></td></tr>
      <tr><td colspan="2"><input type="checkbox" id="c1" name="c1"><label for="c1">帰省先住所がある場合はチェックしてください</label></td></tr>
      <tr><td colspan="2"><input type="checkbox" id="c2" name="c2"><label for="c2">海外在住の場合はチェックしてください</label></td></tr>
    </table></form>`,
    expect: { '[name=a]': '東京都渋谷区神南1-2-3　サンプルマンション101', '#c1': false, '#c2': false },
  },
  {
    name: '似た形：メールの確認用の行（「（確認）」「確認用」「再入力」）と、予備のアドレスが未登録',
    html: `<form><table>
      <tr><th>メールアドレス</th><td><input name="m"></td></tr>
      <tr><th>メールアドレス（確認）</th><td><input name="mc"></td></tr>
      <tr><th>携帯メール</th><td><input name="s"></td></tr>
      <tr><th>確認用</th><td><input name="sc"></td></tr>
      <tr><th>氏名</th><td><input name="n"></td></tr>
      <tr><th>再入力</th><td><input name="nr"></td></tr>
    </table></form>`,
    expect: { '[name=m]': 'taro@example.com', '[name=mc]': 'taro@example.com', '[name=s]': '', '[name=sc]': '', '[name=n]': '山田　太郎', '[name=nr]': '' },
  },
  {
    name: '似た形：予備のアドレスと「再入力」の行（行見出しだけ）',
    html: `<form><table>
      <tr><td>メインメールアドレス</td><td><input name="m"></td></tr>
      <tr><td>再入力</td><td><input name="mr"></td></tr>
      <tr><td>サブメールアドレス</td><td><input name="s"></td></tr>
      <tr><td>再入力</td><td><input name="sr"></td></tr>
      <tr><td>パスワード</td><td><input type="password" name="pw"></td></tr>
      <tr><td>再入力</td><td><input type="password" name="pwr"></td></tr>
    </table></form>`,
    profile: { emailSub: 'sub@example.com' },
    expect: { '[name=m]': 'taro@example.com', '[name=mr]': 'taro@example.com', '[name=s]': 'sub@example.com', '[name=sr]': 'sub@example.com', '[name=pw]': '', '[name=pwr]': '' },
  },
  ...(
    [
      ['卒業予定・既卒のラジオ', 'radio', ['卒業予定', '既卒'], 'expected', '卒業予定'],
      ['「卒業予定（2026年3月）」のプルダウン', 'select', ['卒業予定（2026年3月）', '既卒'], 'expected', '卒業予定（2026年3月）'],
      ['既卒のとき', 'select', ['卒業予定', '既卒'], 'graduated', '既卒'],
      ['「卒業見込」「卒業」のプルダウン', 'select', ['卒業見込', '卒業'], 'expected', '卒業見込'],
    ] as const
  ).map(
    ([label, kind, items, status, want]): Case => ({
      name: `似た形：卒業区分（${label}）`,
      html: `<form><table><tr><th>卒業区分</th><td>${
        kind === 'radio'
          ? items.map((t) => `<label><input type="radio" name="g" value="${t}">${t}</label>`).join('')
          : `<select name="g">${opts([...items])}</select>`
      }</td></tr></table></form>`,
      profile: { graduationStatus: status },
      expect: kind === 'radio' ? { 'radio:g': want } : { '[name=g]': want },
    }),
  ),
  (() => {
    // i-webs の「休暇中の連絡先」。帰省先に現住所と同じ住所（全角の数字・ハイフンの違いだけ）を入れたプロフィール
    const jqSelect = (name: string) =>
      `<div class="jqTransformSelectWrapper"><div><span>-▼-</span><a href="#" class="jqTransformSelectOpen"></a></div><ul style="display:none"></ul><select name="${name}" class="jqTransformHidden">${opts(['東京都', '福島県'], '-▼-')}</select></div>`;
    const row = (head: string, body: string) => `<div class="formbox clearfix"><dt class="formbox01">${head}</dt><dd class="formbox02"><span class="hosoku clearfix">${body}</span></dd></div>`;
    const block = (p: string) =>
      row('郵便番号', `<input type="text" name="${p}yubin1"> - <input type="text" name="${p}yubin2">`) +
      row('都道府県', jqSelect(`${p}ken`)) +
      row('市区郡・地名・番地', `<input type="text" name="${p}adrs1">`) +
      row('電話番号', `<input type="text" name="${p}tel1"> - <input type="text" name="${p}tel2"> - <input type="text" name="${p}tel3">`);
    return {
      name: 'i-webs：帰省先に現住所と同じ住所を入れていたら「現住所と同じ」にチェックし、休暇中の連絡先には入れない',
      html: `<style>.jqTransformHidden{display:none}</style><form><dl>
        <div class="heading_l2">現住所情報</div>${block('g')}
        <div class="heading_l2">休暇中の連絡先</div>
        <div class="formbox clearfix"><span class="heading_l2l hosoku clearfix"><span class="jqTransformCheckboxWrapper"><a href="#" class="jqTransformCheckbox"></a><input type="checkbox" name="adch" class="jqTransformHidden" value="1"></span><label for="text">現住所と同じ場合はこちらにチェックしてください<br><span>※チェックを入れる場合は休暇中住所は入力しないでください。</span></label></span></div>
        ${block('k')}
      </dl></form>`,
      profile: {
        kiseiSame: false,
        kiseiPostalCode: '１５０－００４１',
        kiseiPrefecture: '東京都',
        kiseiCity: '渋谷区',
        kiseiAddressLine: '神南１－２－３',
        kiseiBuilding: 'サンプルマンション１０１',
        kiseiPhone: '03-1234-5678',
      },
      expect: { '[name=gken]': '東京都', '[name=adch]': true, '[name=kyubin1]': '', '[name=kken]': '', '[name=kadrs1]': '', '[name=ktel1]': '' },
    } satisfies Case;
  })(),
  (() => {
    // i-webs（富士フイルム）の学歴。「中学校」「高等学校」「出身大学（学士）」「在籍大学」の見出しの下に、同じ「学校名」の欄が並ぶ
    const jqSelect = (name: string, items: string[]) =>
      `<div class="jqTransformSelectWrapper"><div><span>-▼-</span><a href="#" class="jqTransformSelectOpen"></a></div><ul style="display:none"></ul><select name="${name}" class="jqTransformHidden">${opts(items, '-▼-')}</select></div>`;
    const years = range(2010, 2028).map(String);
    const months = range(1, 12).map((m) => String(m).padStart(2, '0'));
    const row = (head: string, body: string) => `<div class="formbox clearfix"><dt class="formbox01"><span class="inportant">◆</span>${head}</dt><dd class="formbox02">${body}</dd></div>`;
    const school = (p: string, heading: string, note = '') =>
      `<div class="heading_l2">${heading}</div>
      ${row('学校名<br>（全半角50文字以内）', `${note}<input type="text" name="${p}name">`)}
      ${row('入学／卒業年月', `<span>入学年月 ${jqSelect(`${p}ny`, years)}年${jqSelect(`${p}nm`, months)}月</span><br><span>卒業年月 ${jqSelect(`${p}sy`, years)}年${jqSelect(`${p}sm`, months)}月</span>`)}`;
    return {
      name: 'i-webs（富士フイルム）：中学校・高校・「大学院の方は回答」の出身大学の学校名には、在籍中の大学名を入れない',
      html: `<style>.jqTransformHidden{display:none}</style><form><dl>
        ${school('j', '中学校')}
        ${school('h', '高等学校（中等教育学校）')}
        ${school('b', '出身大学（学士）', '<p>※『最終学歴』で「大学院（修士）」「大学院（博士）」 を選択された方は回答してください。</p><p>【例】●●大学</p>')}
        ${school('u', '在籍大学')}
      </dl></form>`,
      profile: { highSchool: 'サンプル高校', highSchoolAdmission: '2019-04', highSchoolGraduation: '2022-03' },
      expect: {
        '[name=jname]': '',
        '[name=jny]': '',
        '[name=hname]': 'サンプル高校',
        '[name=hny]': '2019',
        '[name=hsy]': '2022',
        '[name=hsm]': '03',
        '[name=bname]': '',
        '[name=bsy]': '',
        '[name=uname]': 'サンプル大学',
        '[name=usy]': '2026',
        '[name=usm]': '03',
      },
    } satisfies Case;
  })(),
  {
    name: 'i-webs（アビーム）：「編入前大学名（大学編入歴のある方のみ）」と在籍期間には入れない',
    html: `<form><table>
      <tr><th>大学名</th><td><input name="u"></td></tr>
      <tr><th>編入前大学名<br>（大学編入歴のある方のみ）</th><td><p>※学部・学科までご入力ください。</p><input name="t"></td></tr>
      <tr><th>編入前大学在籍期間<br>（大学編入歴のある方のみ）</th><td>開始年月：<select name="ty">${opts(range(2015, 2026).map(String))}</select>年<br>終了年月：<select name="ey">${opts(range(2015, 2026).map(String))}</select>年</td></tr>
    </table></form>`,
    expect: { '[name=u]': 'サンプル大学', '[name=t]': '', '[name=ty]': '', '[name=ey]': '' },
  },
  {
    name: 'snar.jp（野村不動産）：住所のすぐ下の「携帯番号」「電話番号」の 3 分割に住所を入れない',
    html: `<form><table class="entryTb"><tbody>
      ${[
        ['addr1', '市区郡番地', '<input name="tbx_addr1" type="text" class="inputL"><p>例）千代田区千代田1-2-3</p>'],
        ['addr2', 'マンション・アパート名', '<input name="tbx_addr2" type="text" class="inputL"><p>例）日本アパート201号</p>'],
        ['keitai', '携帯番号', [1, 2, 3].map((i) => `<input name="tbx_keitai${i}" type="text" class="inputSText">`).join(' - ')],
        ['tel1', '電話番号', [1, 2, 3].map((i) => `<input name="tbx_tel1${i}" type="text" class="inputSText">`).join(' - ')],
      ]
        .map(([k, label, body]) => `<tr><td id="th_${k}" class="td01">${label}<input type="hidden" name="hdn_${k}_T" value="${label}"><input type="hidden" name="hdn_${k}" value="1"></td><td>${body}<p></p></td></tr>`)
        .join('')}
    </tbody></table></form>`,
    expect: {
      '[name=tbx_addr1]': '渋谷区神南1-2-3',
      '[name=tbx_keitai1]': '090',
      '[name=tbx_keitai2]': '1234',
      '[name=tbx_keitai3]': '5678',
      '[name=tbx_tel11]': '03',
      '[name=tbx_tel13]': '5678',
    },
  },
  {
    name: 'snar.jp（Speee）：サブメールの「再入力」の行のすぐ下にある携帯番号の 3 分割',
    html: `<form><table class="entryTb"><tbody>
      <tr><td id="th_mail" class="td01">メインメールアドレス<span class="required">*</span><input type="hidden" name="hdn_mail_T" value="メインメールアドレス"><input type="hidden" name="hdn_mail" value="1"></td><td><input name="tbx_mail" type="text" class="inputL"><p>最も連絡の取りやすいメールアドレス</p></td></tr>
      <tr><td>再入力<span class="required">*</span></td><td><input name="tbx_mail_R" type="text" class="inputL"></td></tr>
      <tr><td id="th_smail" class="td01">サブメールアドレス<input type="hidden" name="hdn_smail_T" value="サブメールアドレス"><input type="hidden" name="hdn_smail" value="0"></td><td><input name="tbx_smail" type="text" class="inputL"><p>その他のメールアドレス</p></td></tr>
      <tr><td>再入力</td><td><input name="tbx_smail_R" type="text" class="inputL"></td></tr>
      <tr><td id="th_keitai" class="td01">携帯番号<span class="required">*</span><input type="hidden" name="hdn_keitai_T" value="携帯番号"><input type="hidden" name="hdn_keitai" value="1"></td><td><input name="tbx_keitai1" type="text" class="inputSText"> - <input name="tbx_keitai2" type="text" class="inputSText"> - <input name="tbx_keitai3" type="text" class="inputSText"><p></p></td></tr>
      <tr><td id="th_sex" class="td01">性別<span class="required">*</span><input type="hidden" name="hdn_sex_T" value="性別"><input type="hidden" name="hdn_sex" value="1"></td><td><input id="rbt_sex1" type="radio" name="rbt_sex" value="rbt_sex1"><label for="rbt_sex1"> 男性 </label><input id="rbt_sex2" type="radio" name="rbt_sex" value="rbt_sex2"><label for="rbt_sex2"> 女性 </label><p></p></td></tr>
    </tbody></table></form>`,
    profile: { emailSub: 'sub@example.com' },
    expect: {
      '[name=tbx_smail]': 'sub@example.com',
      '[name=tbx_smail_R]': 'sub@example.com',
      '[name=tbx_keitai1]': '090',
      '[name=tbx_keitai2]': '1234',
      '[name=tbx_keitai3]': '5678',
      '#rbt_sex1': true,
    },
  },
  {
    // 確信度のスライダーを上げると、分かれた欄も AI に聞く対象になる。AI が「電話番号（まとめて）」と答えても、分けて入れる
    name: 'snar.jp（Speee）：確信度を 95% にして AI が「電話番号」と答えても、携帯番号の 3 分割に分けて入れる',
    html: `<form><table class="entryTb"><tbody>
      <tr><td id="th_keitai" class="td01">携帯番号<span class="required">*</span><input type="hidden" name="hdn_keitai_T" value="携帯番号"><input type="hidden" name="hdn_keitai" value="1"></td><td><input name="tbx_keitai1" type="text" class="inputSText"> - <input name="tbx_keitai2" type="text" class="inputSText"> - <input name="tbx_keitai3" type="text" class="inputSText"><p></p></td></tr>
      <tr><td id="th_zip" class="td01">郵便番号<input type="hidden" name="hdn_zip_T" value="郵便番号"><input type="hidden" name="hdn_zip" value="0"></td><td><input name="tbx_zip1" type="text" maxlength="3" class="inputSText"> - <input name="tbx_zip2" type="text" maxlength="4" class="inputSText"><p></p></td></tr>
    </tbody></table></form>`,
    threshold: 0.95,
    ai: 'phone',
    expect: { '[name=tbx_keitai1]': '090', '[name=tbx_keitai2]': '1234', '[name=tbx_keitai3]': '5678', '[name=tbx_zip1]': '150', '[name=tbx_zip2]': '0041' },
  },
];
