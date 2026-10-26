import { PREFECTURES } from '../../../lib/prefectures';
import type { Case } from '../cases';

/**
 * 見た目の見出しは同じ（「フリガナ」「電話番号」「生年月日」など）でも、書式の指定が
 * pattern・maxlength・inputmode・type・クラス名・data-* 属性・title・aria-describedby・別のセルの注意書きなど、
 * 表示テキスト以外のところに書かれている形。日本の応募サイトは書式が合わないと送信できないことが多い
 */

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const opts = (items: (string | [string, string])[], empty = '選択してください') =>
  [`<option value="">${empty}</option>`, ...items.map((o) => (Array.isArray(o) ? `<option value="${o[0]}">${o[1]}</option>` : `<option>${o}</option>`))].join('');
const row = (th: string, td: string, note = '') => `<tr><th>${th}</th><td>${td}</td>${note ? `<td class="note">${note}</td>` : ''}</tr>`;
const wareki = (y: number) => (y >= 2019 ? `R${y - 2018}` : y >= 1989 ? `H${y - 1988}` : `S${y - 1925}`);

export const CASES: Case[] = [
  // ───────── フリガナ：pattern 属性 ─────────
  {
    name: 'H-K1 見出しは「ふりがな」でも pattern が全角カタカナならカタカナ',
    html: `<form><label>ふりがな <input name="hk1" pattern="[ァ-ヶー　]+"></label></form>`,
    expect: { '[name=hk1]': 'ヤマダ　タロウ' },
  },
  {
    name: 'H-K2 見出しは「フリガナ」でも pattern がひらがなならひらがな',
    html: `<form><label>フリガナ <input name="hk2" pattern="[ぁ-んー　]+"></label></form>`,
    expect: { '[name=hk2]': 'やまだ　たろう' },
  },
  {
    name: 'H-K3 pattern が半角カナ（[ｦ-ﾟ ]+）のフリガナ',
    html: `<form><label>フリガナ <input name="hk3" pattern="[ｦ-ﾟ ]+"></label></form>`,
    expect: { '[name=hk3]': 'ﾔﾏﾀﾞ ﾀﾛｳ' },
  },
  {
    name: 'H-K4 pattern がスペースを含まない全角カタカナ',
    html: `<form><label>フリガナ <input name="hk4" pattern="[ァ-ヶー]+"></label></form>`,
    expect: { '[name=hk4]': 'ヤマダタロウ' },
  },
  {
    name: 'H-K5 pattern が \\u エスケープのひらがな（^…$ 付き）',
    html: `<form><label>フリガナ <input name="hk5" pattern="^[\\u3041-\\u3096\\u30FC\\u3000]+$"></label></form>`,
    expect: { '[name=hk5]': 'やまだ　たろう' },
  },
  {
    name: 'H-K6 セイ・メイの2つの欄の pattern が半角カナ',
    html: `<form><table>${row('フリガナ', '<input name="hk6a" pattern="[ｦ-ﾟ]+"> <input name="hk6b" pattern="[ｦ-ﾟ]+">')}</table></form>`,
    expect: { '[name=hk6a]': 'ﾔﾏﾀﾞ', '[name=hk6b]': 'ﾀﾛｳ' },
  },
  {
    name: 'H-K7 pattern が「姓　名」の形（全角スペース1つ）',
    html: `<form><label>フリガナ <input name="hk7" pattern="[ァ-ヶー]+　[ァ-ヶー]+"></label></form>`,
    expect: { '[name=hk7]': 'ヤマダ　タロウ' },
  },
  // ───────── フリガナ：検証ライブラリのクラス・data-* 属性 ─────────
  {
    name: 'H-K8 jQuery Validation Engine の validate[required,custom[hiragana]]',
    html: `<form><label>フリガナ <input name="hk8" class="validate[required,custom[hiragana]]"></label></form>`,
    expect: { '[name=hk8]': 'やまだ　たろう' },
  },
  {
    name: 'H-K9 jQuery Validation Engine の validate[required,custom[hankana]]（半角カナ）',
    html: `<form><label>フリガナ <input name="hk9" class="validate[required,custom[hankana]]"></label></form>`,
    expect: { '[name=hk9]': 'ﾔﾏﾀﾞ ﾀﾛｳ' },
  },
  {
    name: 'H-K10 jQuery Validation Engine の custom[katakana]（見出しは「ふりがな」）',
    html: `<form><label>ふりがな <input name="hk10" class="validate[required,custom[katakana]]"></label></form>`,
    expect: { '[name=hk10]': 'ヤマダ　タロウ' },
  },
  {
    name: 'H-K11 Parsley の data-parsley-pattern がひらがな',
    html: `<form><label>フリガナ <input name="hk11" data-parsley-pattern="^[ぁ-んー　]+$" data-parsley-required="true"></label></form>`,
    expect: { '[name=hk11]': 'やまだ　たろう' },
  },
  {
    name: 'H-K12 jquery-validation の data-rule-katakana（見出しは「ふりがな」）',
    html: `<form><label>ふりがな <input name="hk12" data-rule-required="true" data-rule-katakana="true"></label></form>`,
    expect: { '[name=hk12]': 'ヤマダ　タロウ' },
  },
  {
    name: 'H-K13 vee-validate（旧版）の data-vv-rules="required|hiragana"',
    html: `<form><label>フリガナ <input name="hk13" data-vv-rules="required|hiragana"></label></form>`,
    expect: { '[name=hk13]': 'やまだ　たろう' },
  },
  {
    name: 'H-K14 クラス名が「hiragana」だけ（class="form-control hiragana"）',
    html: `<form><label>フリガナ <input name="hk14" class="form-control hiragana"></label></form>`,
    expect: { '[name=hk14]': 'やまだ　たろう' },
  },
  // ───────── フリガナ：title・aria-describedby・別のセルの注意書き ─────────
  {
    name: 'H-K15 title 属性のツールチップ「全角ひらがなで入力」',
    html: `<form><label>フリガナ <input name="hk15" title="全角ひらがなで入力してください"></label></form>`,
    expect: { '[name=hk15]': 'やまだ　たろう' },
  },
  {
    name: 'H-K16 title 属性のツールチップ「半角カタカナ」',
    html: `<form><table>${row('フリガナ', '<input name="hk16" title="半角カタカナ">')}</table></form>`,
    expect: { '[name=hk16]': 'ﾔﾏﾀﾞ ﾀﾛｳ' },
  },
  {
    name: 'H-K17 aria-describedby で表の外の注意書き（半角カタカナ）を指す',
    html: `<form><table>${row('フリガナ', '<input name="hk17" aria-describedby="hk17n">')}</table>
      <p id="hk17n">※フリガナは半角カタカナで入力してください。</p></form>`,
    expect: { '[name=hk17]': 'ﾔﾏﾀﾞ ﾀﾛｳ' },
  },
  {
    name: 'H-K18 3列の表：見出し「ふりがな」・欄・右の列の注意書き「全角カタカナ」',
    html: `<form><table>${row('ふりがな', '<input name="hk18">', '全角カタカナで入力')}</table></form>`,
    expect: { '[name=hk18]': 'ヤマダ　タロウ' },
  },
  {
    name: 'H-K19 注意書き「スペースを入れずに半角カタカナで」',
    html: `<form><div class="form-item"><label for="hk19">フリガナ</label><input id="hk19" name="hk19"><p class="note">※スペースを入れずに半角カタカナで入力</p></div></form>`,
    expect: { '[name=hk19]': 'ﾔﾏﾀﾞﾀﾛｳ' },
  },
  {
    name: 'H-K20 CSS の ime-mode（active / disabled）は書式を変えない',
    html: `<form>
      <p><label>フリガナ <input name="hk20a" style="ime-mode:active"></label></p>
      <p><label>電話番号 <input name="hk20b" style="ime-mode:disabled"></label></p>
    </form>`,
    expect: { '[name=hk20a]': 'ヤマダ　タロウ', '[name=hk20b]': '090-1234-5678' },
  },

  // ───────── 電話番号 ─────────
  {
    name: 'H-P1 電話番号の pattern が \\d{10,11}',
    html: `<form><label>電話番号 <input type="tel" name="hp1" pattern="\\d{10,11}"></label></form>`,
    expect: { '[name=hp1]': '09012345678' },
  },
  {
    name: 'H-P2 電話番号の pattern が 0\\d{1,4}-\\d{1,4}-\\d{4}',
    html: `<form><label>電話番号 <input type="tel" name="hp2" pattern="0\\d{1,4}-\\d{1,4}-\\d{4}" maxlength="13"></label></form>`,
    expect: { '[name=hp2]': '090-1234-5678' },
  },
  {
    name: 'H-P3 電話番号の maxlength=13（ハイフンあり）',
    html: `<form><label>電話番号 <input type="tel" name="hp3" maxlength="13"></label></form>`,
    expect: { '[name=hp3]': '090-1234-5678' },
  },
  {
    name: 'H-P4 inputmode="numeric" の電話番号（数字のキーボード＝ハイフンなし）',
    html: `<form><label>電話番号 <input name="hp4" inputmode="numeric"></label></form>`,
    expect: { '[name=hp4]': '09012345678' },
  },
  {
    name: 'H-P5 inputmode="tel" の電話番号（ハイフンあり）',
    html: `<form><label>電話番号 <input name="hp5" inputmode="tel"></label></form>`,
    expect: { '[name=hp5]': '090-1234-5678' },
  },
  {
    name: 'H-P6 3列の表：右の列の注意書き「半角数字・ハイフンなし」',
    html: `<form><table>${row('携帯電話番号', '<input name="hp6">', '半角数字・ハイフンなし')}</table></form>`,
    expect: { '[name=hp6]': '09012345678' },
  },
  {
    name: 'H-P7 aria-describedby の注意書き「ハイフンなしで入力」',
    html: `<form><div class="field"><div><label for="hp7">電話番号</label></div><div><div class="control"><input id="hp7" name="hp7" aria-describedby="hp7h"></div></div></div>
      <div class="help-area"><span id="hp7h">ハイフンなしで入力してください</span></div></form>`,
    expect: { '[name=hp7]': '09012345678' },
  },
  {
    name: 'H-P8 欄の下の <small> の入力例「例：09012345678」',
    html: `<form><div class="form-group"><label for="hp8">電話番号</label><input id="hp8" name="hp8"><small>例：09012345678</small></div></form>`,
    expect: { '[name=hp8]': '09012345678' },
  },
  {
    name: 'H-P9 欄の下の <small> の入力例「例：090-1234-5678」',
    html: `<form><div class="form-group"><label for="hp9">電話番号</label><input id="hp9" name="hp9"><small>例：090-1234-5678</small></div></form>`,
    expect: { '[name=hp9]': '090-1234-5678' },
  },
  {
    name: 'H-P10 国際形式の pattern（\\+81…）と入力例「+81-90-1234-5678」',
    html: `<form><label>Phone number <input type="tel" name="hp10" pattern="\\+81[0-9\\-]+" placeholder="+81-90-1234-5678"></label></form>`,
    expect: { '[name=hp10]': '+81-90-1234-5678' },
  },
  {
    name: 'H-P11 「ハイフン（－）不要」と括弧付きで書かれた電話番号',
    html: `<form><label>電話番号（ハイフン（－）不要） <input name="hp11"></label></form>`,
    expect: { '[name=hp11]': '09012345678' },
  },
  {
    name: 'H-P12 「ハイフンは入れずに」と書かれた電話番号',
    html: `<form><label>電話番号（ハイフンは入れずに入力） <input name="hp12"></label></form>`,
    expect: { '[name=hp12]': '09012345678' },
  },
  {
    name: 'H-P13 type="number" の電話番号',
    html: `<form><label>電話番号 <input type="number" name="hp13"></label></form>`,
    expect: { '[name=hp13]': '09012345678' },
  },
  {
    name: 'H-P14 pattern が全角数字と全角ハイフンだけ',
    html: `<form><label>電話番号 <input name="hp14" pattern="[０-９－]+"></label></form>`,
    expect: { '[name=hp14]': '０９０－１２３４－５６７８' },
  },
  {
    name: 'H-P15 Parsley の data-parsley-pattern="^\\d{10,11}$"',
    html: `<form><label>電話番号 <input name="hp15" data-parsley-pattern="^\\d{10,11}$" data-parsley-trigger="change"></label></form>`,
    expect: { '[name=hp15]': '09012345678' },
  },

  // ───────── 郵便番号 ─────────
  {
    name: 'H-Z1 郵便番号の pattern が [0-9]{7}',
    html: `<form><label>郵便番号 <input name="hz1" pattern="[0-9]{7}"></label></form>`,
    expect: { '[name=hz1]': '1500041' },
  },
  {
    name: 'H-Z2 郵便番号の pattern が \\d{3}-\\d{4}',
    html: `<form><label>郵便番号 <input name="hz2" pattern="\\d{3}-\\d{4}"></label></form>`,
    expect: { '[name=hz2]': '150-0041' },
  },
  {
    name: 'H-Z3 郵便番号の maxlength=8（ハイフンあり）',
    html: `<form><label>郵便番号 <input name="hz3" maxlength="8"></label></form>`,
    expect: { '[name=hz3]': '150-0041' },
  },
  {
    name: 'H-Z4 「半角数字７桁」（全角の７）',
    html: `<form><label>郵便番号（半角数字７桁） <input name="hz4"></label></form>`,
    expect: { '[name=hz4]': '1500041' },
  },
  {
    name: 'H-Z5 3列の表：右の列の注意書き「ハイフンなし」',
    html: `<form><table>${row('郵便番号', '<input name="hz5">', 'ハイフンなし・半角数字')}</table></form>`,
    expect: { '[name=hz5]': '1500041' },
  },
  {
    name: 'H-Z6 inputmode="numeric" の郵便番号（入力マスクなし）',
    html: `<form><label>郵便番号 <input name="hz6" inputmode="numeric"></label></form>`,
    expect: { '[name=hz6]': '1500041' },
  },
  {
    name: 'H-Z7 Parsley の data-parsley-pattern="^[0-9]{7}$"',
    html: `<form><label>郵便番号 <input name="hz7" data-parsley-pattern="^[0-9]{7}$"></label></form>`,
    expect: { '[name=hz7]': '1500041' },
  },

  // ───────── 住所：全角指定 ─────────
  {
    name: 'H-A1 番地の pattern が全角だけ（[^\\x01-\\x7E]+）',
    html: `<form><table>${row('都道府県', `<select name="ha1p">${opts(PREFECTURES)}</select>`)}${row('市区町村', '<input name="ha1c">')}${row('番地', '<input name="ha1" pattern="[^\\x01-\\x7E]+">')}</table></form>`,
    expect: { '[name=ha1p]': '東京都', '[name=ha1c]': '渋谷区', '[name=ha1]': '神南１－２－３' },
  },
  {
    name: 'H-A2 番地のクラス validate[required,custom[zenkaku]]',
    html: `<form><table>${row('市区町村', '<input name="ha2c">')}${row('番地', '<input name="ha2" class="validate[required,custom[zenkaku]]">')}</table></form>`,
    expect: { '[name=ha2c]': '渋谷区', '[name=ha2]': '神南１－２－３' },
  },
  {
    name: 'H-A3 番地の title 属性「全角で入力してください」',
    html: `<form><table>${row('市区町村', '<input name="ha3c">')}${row('番地', '<input name="ha3" title="全角で入力してください">')}</table></form>`,
    expect: { '[name=ha3c]': '渋谷区', '[name=ha3]': '神南１－２－３' },
  },

  // ───────── 生年月日（1つの文字欄） ─────────
  {
    name: 'H-D1 生年月日の pattern が \\d{8}（placeholder・maxlength なし）',
    html: `<form><label>生年月日 <input name="hd1" pattern="\\d{8}"></label></form>`,
    expect: { '[name=hd1]': '19990401' },
  },
  {
    name: 'H-D2 生年月日の pattern が \\d{4}-\\d{2}-\\d{2}',
    html: `<form><label>生年月日 <input name="hd2" pattern="\\d{4}-\\d{2}-\\d{2}"></label></form>`,
    expect: { '[name=hd2]': '1999-04-01' },
  },
  {
    name: 'H-D3 生年月日の pattern が和暦（平成11年4月1日）',
    html: `<form><label>生年月日 <input name="hd3" pattern="(昭和|平成|令和)\\d{1,2}年\\d{1,2}月\\d{1,2}日"></label></form>`,
    expect: { '[name=hd3]': '平成11年4月1日' },
  },
  {
    name: 'H-D4 生年月日の入力例「例：H11.04.01」',
    html: `<form><label>生年月日 <input name="hd4" placeholder="例：H11.04.01"></label></form>`,
    expect: { '[name=hd4]': 'H11.04.01' },
  },
  {
    name: 'H-D5 生年月日の入力例「例：1999.04.01」（ドット区切り）',
    html: `<form><label>生年月日 <input name="hd5" placeholder="例：1999.04.01"></label></form>`,
    expect: { '[name=hd5]': '1999.04.01' },
  },
  {
    name: 'H-D6 欄の下の <small> の入力例「例：1999年4月1日」',
    html: `<form><div class="form-group"><label for="hd6">生年月日</label><input id="hd6" name="hd6"><small>例：1999年4月1日</small></div></form>`,
    expect: { '[name=hd6]': '1999年4月1日' },
  },
  {
    name: 'H-D7 英語のフォームの MM/DD/YYYY',
    html: `<form><label>Date of Birth <input name="hd7" placeholder="MM/DD/YYYY"></label></form>`,
    expect: { '[name=hd7]': '04/01/1999' },
  },
  {
    name: 'H-D8 英語のフォームの DD/MM/YYYY',
    html: `<form><label>Date of Birth <input name="hd8" placeholder="DD/MM/YYYY"></label></form>`,
    expect: { '[name=hd8]': '01/04/1999' },
  },
  {
    name: 'H-D9 type="number" の生年月日（8桁）',
    html: `<form><label>生年月日 <input type="number" name="hd9"></label></form>`,
    expect: { '[name=hd9]': '19990401' },
  },
  {
    name: 'H-D10 type="tel"・maxlength=8 の生年月日（placeholder なし）',
    html: `<form><label>生年月日 <input type="tel" name="hd10" maxlength="8"></label></form>`,
    expect: { '[name=hd10]': '19990401' },
  },

  // ───────── 生年月日（分かれた欄・プルダウン） ─────────
  {
    name: 'H-D11 年・月・日が type="number"（min・max あり）',
    html: `<form><table>${row('生年月日', '<input type="number" name="hd11y" min="1950" max="2010">年 <input type="number" name="hd11m" min="1" max="12">月 <input type="number" name="hd11d" min="1" max="31">日')}</table></form>`,
    expect: { '[name=hd11y]': '1999', '[name=hd11m]': '4', '[name=hd11d]': '1' },
  },
  {
    name: 'H-D12 元号のプルダウンが略号（S／H／R）・和暦の年の文字欄',
    html: `<form><table>${row('生年月日', `<select name="hd12e">${opts([['3', 'S'], ['4', 'H'], ['5', 'R']], '--')}</select> <input name="hd12y" size="2">年 <input name="hd12m" size="2">月 <input name="hd12d" size="2">日`)}</table></form>`,
    expect: { '[name=hd12e]': 'H', '[name=hd12y]': '11', '[name=hd12m]': '4', '[name=hd12d]': '1' },
  },
  {
    name: 'H-D13 生年のプルダウンが略号の和暦（S55〜H19）・value もコード',
    html: `<form><table>${row('生年月日', `<select name="hd13y">${opts(range(1980, 2007).map((y) => [wareki(y).toLowerCase(), wareki(y)]), '--')}</select>年 <select name="hd13m">${opts(range(1, 12).map((m) => [String(m), `${m}月`]), '--')}</select> <select name="hd13d">${opts(range(1, 31).map((d) => [String(d), `${d}日`]), '--')}</select>`)}</table></form>`,
    expect: { '[name=hd13y]': 'H11', '[name=hd13m]': '4', '[name=hd13d]': '1' },
  },
  {
    name: 'H-D14 生年の選択肢が「1999(H11)」・value は並び順',
    html: `<form><table>${row('生年月日', `<select name="hd14y">${opts(range(1985, 2006).map((y, i) => [String(i + 1), `${y}(${wareki(y)})`]), '--')}</select>年 <select name="hd14m">${opts(range(1, 12).map((m) => [String(m), String(m).padStart(2, '0')]), '--')}</select>月 <select name="hd14d">${opts(range(1, 31).map((d) => [String(d), String(d).padStart(2, '0')]), '--')}</select>日`)}</table></form>`,
    expect: { '[name=hd14y]': '1999(H11)', '[name=hd14m]': '4', '[name=hd14d]': '1' },
  },
  {
    name: 'H-D15 月の選択肢が英語の略称（Apr）・value は数字',
    html: `<form><label>Birth month <select name="hd15">${opts(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => [String(i + 1), m]), 'Month')}</select></label></form>`,
    expect: { '[name=hd15]': '4' },
  },

  // ───────── 卒業年月 ─────────
  {
    name: 'H-G1 卒業予定年月の maxlength=6・placeholder「YYYYMM」',
    html: `<form><label>卒業予定年月 <input name="hg1" maxlength="6" placeholder="YYYYMM"></label></form>`,
    expect: { '[name=hg1]': '202603' },
  },
  {
    name: 'H-G2 卒業予定年月の pattern が \\d{6}',
    html: `<form><label>卒業予定年月 <input name="hg2" pattern="\\d{6}"></label></form>`,
    expect: { '[name=hg2]': '202603' },
  },
  {
    name: 'H-G3 卒業予定年月の pattern が \\d{4}/\\d{2}',
    html: `<form><label>卒業予定年月 <input name="hg3" pattern="\\d{4}/\\d{2}"></label></form>`,
    expect: { '[name=hg3]': '2026/03' },
  },
  {
    name: 'H-G4 卒業予定年月が1つのプルダウン「2026年3月卒業見込み」',
    html: `<form><label>卒業予定年月 <select name="hg4">${opts(['2025年3月卒業', '2025年9月卒業', '2026年3月卒業見込み', '2026年9月卒業見込み', '2027年3月卒業見込み'])}</select></label></form>`,
    expect: { '[name=hg4]': '2026年3月卒業見込み' },
  },
  {
    name: 'H-G5 卒業年度のプルダウン「26卒」',
    html: `<form><label>卒業年度 <select name="hg5">${opts(['25卒', '26卒', '27卒', '28卒'])}</select></label></form>`,
    expect: { '[name=hg5]': '26卒' },
  },
  {
    name: 'H-G6 卒業年の選択肢が「2026（令和8）年」・月は「3月」「9月」だけ',
    html: `<form><table>${row('卒業予定年月', `<select name="hg6y">${opts(range(2024, 2029).map((y) => [String(y), `${y}（令和${y - 2018}）年`]))}</select> <select name="hg6m">${opts(['3月', '9月'])}</select>`)}</table></form>`,
    expect: { '[name=hg6y]': '2026', '[name=hg6m]': '3月' },
  },
  {
    name: 'H-G7 卒業年の選択肢が令和だけ（R7・R8 の略号）',
    html: `<form><table>${row('卒業予定年月', `<select name="hg7y">${opts(range(2024, 2029).map((y) => [String(y), `R${y - 2018}`]))}</select>年 <select name="hg7m">${opts(range(1, 12).map((m) => [String(m), String(m)]))}</select>月`)}</table></form>`,
    expect: { '[name=hg7y]': '2026', '[name=hg7m]': '3' },
  },
  {
    name: 'H-G8 卒業年の選択肢が3つだけ（2025年〜2027年）',
    html: `<form><table>${row('卒業予定年月', `<select name="hg8y">${opts(['2025年', '2026年', '2027年'])}</select> <select name="hg8m">${opts(['3月', '9月'])}</select>`)}</table></form>`,
    expect: { '[name=hg8y]': '2026年', '[name=hg8m]': '3月' },
  },

  // ───────── 性別・都道府県・学校区分の選択肢の書き方 ─────────
  {
    name: 'H-S1 性別の選択肢が「M」「F」',
    html: `<form><label>性別 <select name="hs1">${opts([['M', 'M'], ['F', 'F']])}</select></label></form>`,
    expect: { '[name=hs1]': 'M' },
  },
  {
    name: 'H-S2 性別の選択肢が「Male」「Female」・value は 1/2',
    html: `<form><label>Gender <select name="hs2">${opts([['2', 'Female'], ['1', 'Male'], ['9', 'Prefer not to say']])}</select></label></form>`,
    expect: { '[name=hs2]': '1' },
  },
  {
    name: 'H-S3 性別の選択肢が「男子」「女子」',
    html: `<form><label>性別 <select name="hs3">${opts([['1', '男子'], ['2', '女子']])}</select></label></form>`,
    expect: { '[name=hs3]': '1' },
  },
  {
    name: 'H-S4 性別の選択肢が「男性 / Male」の併記',
    html: `<form><label>性別 <select name="hs4">${opts([['f', '女性 / Female'], ['m', '男性 / Male']])}</select></label></form>`,
    expect: { '[name=hs4]': 'm' },
  },
  {
    name: 'H-S5 都道府県の選択肢が英語（Tokyo）',
    html: `<form><label>Prefecture <select name="hs5">${opts(['Hokkaido', 'Aomori', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa', 'Kyoto', 'Osaka', 'Okinawa'].map((p, i) => [String(i + 1), p]))}</select></label></form>`,
    expect: { '[name=hs5]': 'Tokyo' },
  },
  {
    name: 'H-S6 都道府県の選択肢が「東京都 (Tokyo)」の併記',
    html: `<form><label>都道府県 <select name="hs6">${opts(PREFECTURES.map((p, i) => [String(i + 1), `${p} (${i === 12 ? 'Tokyo' : 'X'})`]))}</select></label></form>`,
    expect: { '[name=hs6]': '13' },
  },
  {
    name: 'H-S7 学校区分の選択肢が「大学（4年制）」で、大学院が先に並ぶ',
    html: `<form><label>学校区分 <select name="hs7">${opts([['11', '大学院（博士）'], ['12', '大学院（修士）'], ['21', '大学（4年制）'], ['31', '短期大学'], ['41', '高等専門学校'], ['51', '専門学校'], ['99', 'その他']])}</select></label></form>`,
    expect: { '[name=hs7]': '21' },
  },
  {
    name: 'H-S8 学校区分の選択肢が「学部生」「大学院生（修士）」',
    html: `<form><label>学校区分 <select name="hs8">${opts(['大学院生（修士）', '大学院生（博士）', '学部生', '短大生', '高専生', '専門学校生'])}</select></label></form>`,
    expect: { '[name=hs8]': '学部生' },
  },
  {
    name: 'H-S9 学校区分の選択肢が「四年制大学」・value はコード',
    html: `<form><label>学校区分 <select name="hs9">${opts([['A', '大学院'], ['B', '四年制大学'], ['C', '短期大学'], ['D', '専門学校']])}</select></label></form>`,
    expect: { '[name=hs9]': 'B' },
  },
  {
    name: 'H-S10 学校区分のラジオが「大学（学部）」・value はコード',
    html: `<form><table><tr><th>学校区分</th><td>
      <label><input type="radio" name="hs10" value="1">大学院</label>
      <label><input type="radio" name="hs10" value="2">大学（学部）</label>
      <label><input type="radio" name="hs10" value="3">短大</label>
      <label><input type="radio" name="hs10" value="4">高専</label>
    </td></tr></table></form>`,
    expect: { 'radio:hs10': '大学（学部）' },
  },
];
