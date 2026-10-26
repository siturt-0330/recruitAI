import { PREFECTURES } from '../../../lib/prefectures';
import type { Case } from '../cases';

/**
 * 見た目は同じ「分割された欄」（姓／名、電話の3分割、郵便番号の2分割、年／月／日、local@domain、住所の分割）を、
 * 区切りの書き方（文字・<span>・CSS の ::before/::after・なし）、部分ごとのラベルの付け方、
 * 包み要素（td・div・li・label）、DOM と見た目の順番の違いで作り分けたもの。
 * DOM の順番と、部分ごとのラベル（placeholder・aria-label・title・name 属性）を正とする。
 */

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const opts = (items: (string | [string, string])[], empty = '選択してください') =>
  [`<option value="">${empty}</option>`, ...items.map((o) => (Array.isArray(o) ? `<option value="${o[0]}">${o[1]}</option>` : `<option>${o}</option>`))].join('');
const prefs = opts(PREFECTURES);
const years = (a: number, b: number) => opts(range(a, b).map(String), '----');
const months = opts(range(1, 12).map(String), '--');
const days = opts(range(1, 31).map(String), '--');

/** 区切りを CSS で描く（DOM に文字がない） */
const CSS_SEP = `<style>
  .sx-hy > * + *::before, .sx-hy input + input::before { content: "-"; }
  .sx-hy .part + .part::before { content: "－"; margin: 0 4px; }
  .sx-at .part + .part::before { content: "@"; margin: 0 4px; }
  .sx-zip::before { content: "〒"; }
  .sx-y::after { content: "年"; } .sx-m::after { content: "月"; } .sx-d::after { content: "日"; }
  .sx-flex { display: flex; gap: 8px; align-items: center; }
  .sx-rev { display: flex; flex-direction: row-reverse; justify-content: flex-end; gap: 8px; }
  .sx-grid { display: grid; grid-template-columns: repeat(3, 80px); gap: 8px; }
  .sx-grid > :nth-child(1) { grid-column: 3; grid-row: 1; }
  .sx-grid > :nth-child(3) { grid-column: 1; grid-row: 1; }
</style>`;

export const CASES: Case[] = [
  // ---------------- 氏名（姓・名） ----------------
  {
    name: 'S-N1 姓・名：name 属性（sei/mei）だけ、行見出しは「氏名」',
    html: `<form><table><tr><th>氏名</th><td><input name="sei" size="10"> <input name="mei" size="10"></td></tr></table></form>`,
    expect: { '[name=sei]': '山田', '[name=mei]': '太郎' },
  },
  {
    name: 'S-N2 姓・名：DOM が「名・姓」の順でも name 属性（given/family）で分ける',
    html: `<form><table><tr><th>氏名</th><td class="sx-rev">${CSS_SEP}<input name="given" size="10"><input name="family" size="10"></td></tr></table></form>`,
    expect: { '[name=family]': '山田', '[name=given]': '太郎' },
  },
  {
    name: 'S-N3 姓・名：欄ごとの <label> の中に「姓」「名」',
    html: `<form><table><tr><th>氏名</th><td><label>姓 <input name="n3a" size="10"></label> <label>名 <input name="n3b" size="10"></label></td></tr></table></form>`,
    expect: { '[name=n3a]': '山田', '[name=n3b]': '太郎' },
  },
  {
    name: 'S-N4 姓・名：<label> の中で欄の後ろに「（姓）」「（名）」',
    html: `<form><table><tr><th>氏名</th><td><label><input name="n4a" size="10">（姓）</label> <label><input name="n4b" size="10">（名）</label></td></tr></table></form>`,
    expect: { '[name=n4a]': '山田', '[name=n4b]': '太郎' },
  },
  {
    name: 'S-N5 姓・名：ラベルのない「［ ］姓 ［ ］名」（部分の名前が欄の後ろの文字）',
    html: `<form><table><tr><th>氏名</th><td><input name="n5a" size="10"> 姓　<input name="n5b" size="10"> 名</td></tr></table></form>`,
    expect: { '[name=n5a]': '山田', '[name=n5b]': '太郎' },
  },
  {
    name: 'S-N6 姓・名：部分のラベルが CSS の ::before だけ（DOM に文字なし）',
    html: `<form><style>.sx-sei::before{content:"姓"}.sx-mei::before{content:"名"}</style>
      <div class="row"><div>お名前</div><div><span class="sx-sei"></span><input name="n6a"> <span class="sx-mei"></span><input name="n6b"></div></div></form>`,
    expect: { '[name=n6a]': '山田', '[name=n6b]': '太郎' },
  },
  {
    name: 'S-N7 姓・名：欄ごとに包み要素があり、それぞれに小さなラベル（「姓」「名」）',
    html: `<form><div class="form-row"><p class="ttl">氏名</p>
      <div class="sx-flex"><div class="unit"><span class="sub">姓</span><input name="n7a"></div><div class="unit"><span class="sub">名</span><input name="n7b"></div></div>
    </div></form>`,
    expect: { '[name=n7a]': '山田', '[name=n7b]': '太郎' },
  },
  {
    name: 'S-N8 姓・名：title 属性だけ',
    html: `<form><dl><dt>氏名</dt><dd><input name="n8a" title="姓"> <input name="n8b" title="名"></dd></dl></form>`,
    expect: { '[name=n8a]': '山田', '[name=n8b]': '太郎' },
  },
  {
    name: 'S-N9 姓・名：別々の <td> に「姓」「名」と欄',
    html: `<form><table><tr><th>氏名</th><td>姓</td><td><input name="n9a"></td><td>名</td><td><input name="n9b"></td></tr></table></form>`,
    expect: { '[name=n9a]': '山田', '[name=n9b]': '太郎' },
  },
  {
    name: 'S-N10 姓・名：label for が1つ目の欄だけ（name1/name2）',
    html: `<form><div class="field"><label for="n10a">氏名</label><input id="n10a" name="name1"> <input id="n10b" name="name2"></div></form>`,
    expect: { '[name=name1]': '山田', '[name=name2]': '太郎' },
  },
  {
    name: 'S-N11 姓・名：1つの <label> が「氏名」と2つの欄を包む',
    html: `<form><label>氏名 <input name="n11a"> <input name="n11b"></label></form>`,
    expect: { '[name=n11a]': '山田', '[name=n11b]': '太郎' },
  },
  {
    name: 'S-N12 姓・名：見た目は「姓・名」だが DOM は「名・姓」（CSS の order）、placeholder で分かる',
    html: `<form><style>.sx-ord{display:flex;gap:8px}.sx-ord .a{order:2}.sx-ord .b{order:1}</style>
      <table><tr><th>氏名</th><td><div class="sx-ord"><input class="a" name="n12a" placeholder="名"><input class="b" name="n12b" placeholder="姓"></div></td></tr></table></form>`,
    expect: { '[name=n12a]': '太郎', '[name=n12b]': '山田' },
  },
  {
    name: 'S-N13 姓・名：last_name / first_name の name 属性と aria-label なしの input（見出しなし）',
    html: `<form><div><input name="last_name" placeholder="山田"> <input name="first_name" placeholder="太郎"></div></form>`,
    expect: { '[name=last_name]': '山田', '[name=first_name]': '太郎' },
  },

  // ---------------- フリガナ ----------------
  {
    name: 'S-K1 漢字は姓・名の2欄、フリガナは1欄',
    html: `<form><table>
      <tr><th>氏名</th><td><input name="k1a" placeholder="姓"> <input name="k1b" placeholder="名"></td></tr>
      <tr><th>フリガナ</th><td><input name="k1c"></td></tr>
    </table></form>`,
    expect: { '[name=k1a]': '山田', '[name=k1b]': '太郎', '[name=k1c]': 'ヤマダ　タロウ' },
  },
  {
    name: 'S-K2 フリガナ：aria-label が「セイ」「メイ」',
    html: `<form><table><tr><th>フリガナ</th><td><input name="k2a" aria-label="セイ"> <input name="k2b" aria-label="メイ"></td></tr></table></form>`,
    expect: { '[name=k2a]': 'ヤマダ', '[name=k2b]': 'タロウ' },
  },
  {
    name: 'S-K3 1つのセルに「漢字 姓［ ］名［ ］」「カナ セイ［ ］メイ［ ］」の2行',
    html: `<form><table><tr><th>氏名</th><td>
      漢字　姓 <input name="k3a" size="8"> 名 <input name="k3b" size="8"><br>
      カナ　セイ <input name="k3c" size="8"> メイ <input name="k3d" size="8">
    </td></tr></table></form>`,
    expect: { '[name=k3a]': '山田', '[name=k3b]': '太郎', '[name=k3c]': 'ヤマダ', '[name=k3d]': 'タロウ' },
  },
  {
    name: 'S-K4 フリガナ：name 属性だけ（kana_sei / kana_mei）、見出しは同じ行の th',
    html: `<form><table><tr><th>氏名</th><td><input name="name_sei"> <input name="name_mei"></td><th>フリガナ</th><td><input name="kana_sei"> <input name="kana_mei"></td></tr></table></form>`,
    expect: { '[name=name_sei]': '山田', '[name=name_mei]': '太郎', '[name=kana_sei]': 'ヤマダ', '[name=kana_mei]': 'タロウ' },
  },

  // ---------------- ローマ字 ----------------
  {
    name: 'S-R1 英語のフォーム：Name の見出しに First・Last の順（fname/lname）',
    html: `<form><table><tr><th>Name</th><td><input name="fname" placeholder="First"> <input name="lname" placeholder="Last"></td></tr></table></form>`,
    expect: { '[name=fname]': 'Taro', '[name=lname]': 'Yamada' },
  },
  {
    name: 'S-R2 英語のフォーム：Given name・Family name の順の label',
    html: `<form><div class="row"><label for="r2a">Given name</label><input id="r2a" name="r2a"></div><div class="row"><label for="r2b">Family name</label><input id="r2b" name="r2b"></div></form>`,
    expect: { '[name=r2a]': 'Taro', '[name=r2b]': 'Yamada' },
  },
  {
    name: 'S-R3 日本語のフォームの「氏名（ローマ字）」：First・Last の小ラベルが前の <span>',
    html: `<form><table><tr><th>氏名（ローマ字）</th><td><span>First</span><input name="r3a"> <span>Last</span><input name="r3b"></td></tr></table></form>`,
    expect: { '[name=r3a]': 'Taro', '[name=r3b]': 'Yamada' },
  },

  // ---------------- 電話番号 ----------------
  {
    name: 'S-P1 携帯電話の3分割：区切りが CSS の ::before（DOM に文字なし）',
    html: `<form>${CSS_SEP}<table><tr><th>携帯電話</th><td class="sx-hy"><input name="p1a" size="4"><input name="p1b" size="4"><input name="p1c" size="4"></td></tr></table></form>`,
    expect: { '[name=p1a]': '090', '[name=p1b]': '1234', '[name=p1c]': '5678' },
  },
  {
    name: 'S-P2 電話番号の3分割：区切りなし、aria-label が「市外局番」「市内局番」「加入者番号」',
    html: `<form><table><tr><th>電話番号</th><td><input name="p2a" aria-label="市外局番" size="4"><input name="p2b" aria-label="市内局番" size="4"><input name="p2c" aria-label="加入者番号" size="4"></td></tr></table></form>`,
    expect: { '[name=p2a]': '090', '[name=p2b]': '1234', '[name=p2c]': '5678' },
  },
  {
    name: 'S-P3 自宅電話の3分割：maxlength 5/4/4（固定電話 03-1234-5678）',
    html: `<form><table><tr><th>自宅電話番号</th><td><input name="p3a" maxlength="5" size="5"> - <input name="p3b" maxlength="4" size="4"> - <input name="p3c" maxlength="4" size="4"></td></tr></table></form>`,
    expect: { '[name=p3a]': '03', '[name=p3b]': '1234', '[name=p3c]': '5678' },
  },
  {
    name: 'S-P4 自宅電話の3分割：3-4-4 前提の maxlength 3/4/4 でも固定電話は 03 / 1234 / 5678',
    html: `<form><table><tr><th>自宅電話</th><td><input name="p4a" maxlength="3"> - <input name="p4b" maxlength="4"> - <input name="p4c" maxlength="4"></td></tr></table></form>`,
    expect: { '[name=p4a]': '03', '[name=p4b]': '1234', '[name=p4c]': '5678' },
  },
  {
    name: 'S-P5 電話番号：name 属性が配列形式 phone[0]〜phone[2]',
    html: `<form><dl><dt>電話番号</dt><dd><input name="phone[0]" type="tel"> <span>-</span> <input name="phone[1]" type="tel"> <span>-</span> <input name="phone[2]" type="tel"></dd></dl></form>`,
    expect: { '[name="phone[0]"]': '090', '[name="phone[1]"]': '1234', '[name="phone[2]"]': '5678' },
  },
  {
    name: 'S-P6 電話番号：placeholder が部分の例（090 / 1234 / 5678）',
    html: `<form><dl><dt>携帯電話番号</dt><dd><input name="p6a" placeholder="090">-<input name="p6b" placeholder="1234">-<input name="p6c" placeholder="5678"></dd></dl></form>`,
    expect: { '[name=p6a]': '090', '[name=p6b]': '1234', '[name=p6c]': '5678' },
  },
  {
    name: 'S-P7 電話番号：label for が1つ目の欄だけ（tel1/tel2/tel3）',
    html: `<form><div class="field"><label for="tel1">電話番号</label><input id="tel1" name="tel1" size="4">-<input id="tel2" name="tel2" size="4">-<input id="tel3" name="tel3" size="4"></div></form>`,
    expect: { '[name=tel1]': '090', '[name=tel2]': '1234', '[name=tel3]': '5678' },
  },
  {
    name: 'S-P8 電話番号：欄ごとに Bootstrap の input-group で包む',
    html: `<form><div class="form-row"><label class="col-label">携帯電話番号</label><div class="col">
      <div class="input-group"><input name="p8a" class="form-control"></div><span>-</span>
      <div class="input-group"><input name="p8b" class="form-control"></div><span>-</span>
      <div class="input-group"><input name="p8c" class="form-control"></div>
    </div></div></form>`,
    expect: { '[name=p8a]': '090', '[name=p8b]': '1234', '[name=p8c]': '5678' },
  },
  {
    name: 'S-P9 電話番号：dd の中の ul に欄ごとの li',
    html: `<form><dl><dt>携帯電話番号</dt><dd><ul class="tel"><li><input name="p9a"></li><li><input name="p9b"></li><li><input name="p9c"></li></ul></dd></dl></form>`,
    expect: { '[name=p9a]': '090', '[name=p9b]': '1234', '[name=p9c]': '5678' },
  },
  {
    name: 'S-P10 1つのセルに「自宅［ ］-［ ］-［ ］ 携帯［ ］-［ ］-［ ］」（同じ行）',
    html: `<form><table><tr><th>電話番号</th><td>
      自宅 <input name="p10a" size="4">-<input name="p10b" size="4">-<input name="p10c" size="4">
      携帯 <input name="p10d" size="4">-<input name="p10e" size="4">-<input name="p10f" size="4">
    </td></tr></table></form>`,
    expect: {
      '[name=p10a]': '03', '[name=p10b]': '1234', '[name=p10c]': '5678',
      '[name=p10d]': '090', '[name=p10e]': '1234', '[name=p10f]': '5678',
    },
  },
  {
    name: 'S-P11 1つのセルに自宅と携帯の3分割が2行（<br> 区切り）',
    html: `<form><table><tr><th>連絡先電話番号</th><td>
      自宅：<input name="p11a" size="4">-<input name="p11b" size="4">-<input name="p11c" size="4"><br>
      携帯：<input name="p11d" size="4">-<input name="p11e" size="4">-<input name="p11f" size="4">
    </td></tr></table></form>`,
    expect: {
      '[name=p11a]': '03', '[name=p11b]': '1234', '[name=p11c]': '5678',
      '[name=p11d]': '090', '[name=p11e]': '1234', '[name=p11f]': '5678',
    },
  },
  {
    name: 'S-P12 rowspan の「電話番号」の下に「自宅」「携帯」のセル',
    html: `<form><table>
      <tr><th rowspan="2">電話番号</th><td>自宅</td><td><input name="p12a" size="4">-<input name="p12b" size="4">-<input name="p12c" size="4"></td></tr>
      <tr><td>携帯</td><td><input name="p12d" size="4">-<input name="p12e" size="4">-<input name="p12f" size="4"></td></tr>
    </table></form>`,
    expect: {
      '[name=p12a]': '03', '[name=p12b]': '1234', '[name=p12c]': '5678',
      '[name=p12d]': '090', '[name=p12e]': '1234', '[name=p12f]': '5678',
    },
  },
  {
    name: 'S-P13 携帯電話：先頭がプルダウン（090/080/070）＋文字の2欄',
    html: `<form><table><tr><th>携帯電話番号</th><td><select name="p13a">${opts(['090', '080', '070'], '---')}</select> - <input name="p13b" size="4"> - <input name="p13c" size="4"></td></tr></table></form>`,
    expect: { '[name=p13a]': '090', '[name=p13b]': '1234', '[name=p13c]': '5678' },
  },
  {
    name: 'S-P14 電話番号：見た目の順番を grid で入れ替えても DOM の順番で入れる',
    html: `<form>${CSS_SEP}<div class="row"><p>携帯電話番号</p><div class="sx-grid"><input name="p14a"><input name="p14b"><input name="p14c"></div></div></form>`,
    expect: { '[name=p14a]': '090', '[name=p14b]': '1234', '[name=p14c]': '5678' },
  },
  {
    name: 'S-P15 電話番号：欄ごとの div の中に「－」が CSS で描かれ、aria-label が「電話番号1〜3」',
    html: `<form>${CSS_SEP}<div class="group"><span class="ttl">携帯番号</span><div class="sx-hy sx-flex">
      <div class="part"><input name="p15a" aria-label="電話番号1" maxlength="4"></div>
      <div class="part"><input name="p15b" aria-label="電話番号2" maxlength="4"></div>
      <div class="part"><input name="p15c" aria-label="電話番号3" maxlength="4"></div>
    </div></div></form>`,
    expect: { '[name=p15a]': '090', '[name=p15b]': '1234', '[name=p15c]': '5678' },
  },
  {
    name: 'S-P16 自宅と携帯の3分割が別々の行（自宅が「電話番号」、携帯が「携帯電話」）で、自宅を入れる',
    html: `<form><table>
      <tr><th>電話番号</th><td><input name="p16a" type="tel">-<input name="p16b" type="tel">-<input name="p16c" type="tel"></td></tr>
      <tr><th>携帯電話</th><td><input name="p16d" type="tel">-<input name="p16e" type="tel">-<input name="p16f" type="tel"></td></tr>
    </table></form>`,
    expect: {
      '[name=p16a]': '03', '[name=p16b]': '1234', '[name=p16c]': '5678',
      '[name=p16d]': '090', '[name=p16e]': '1234', '[name=p16f]': '5678',
    },
  },

  // ---------------- 郵便番号 ----------------
  {
    name: 'S-Z1 郵便番号：〒 と区切りが CSS、name が postal_code_1 / postal_code_2',
    html: `<form>${CSS_SEP}<table><tr><th>郵便番号</th><td><span class="sx-zip"></span><span class="sx-hy"><input name="postal_code_1" maxlength="3"><input name="postal_code_2" maxlength="4"></span></td></tr></table></form>`,
    expect: { '[name=postal_code_1]': '150', '[name=postal_code_2]': '0041' },
  },
  {
    name: 'S-Z2 郵便番号：見出しがなく、aria-label が「郵便番号（前半）」「郵便番号（後半）」',
    html: `<form><div class="zip"><input name="zz1" maxlength="3" aria-label="郵便番号（前半）"> - <input name="zz2" maxlength="4" aria-label="郵便番号（後半）"></div></form>`,
    expect: { '[name=zz1]': '150', '[name=zz2]': '0041' },
  },
  {
    name: 'S-Z3 郵便番号：label for が1つ目の欄だけ（zip1/zip2）',
    html: `<form><div class="field"><label for="zip1">郵便番号</label><input id="zip1" name="zip1" maxlength="3">-<input id="zip2" name="zip2" maxlength="4"></div></form>`,
    expect: { '[name=zip1]': '150', '[name=zip2]': '0041' },
  },
  {
    name: 'S-Z4 郵便番号：〒・欄・「-」・欄がそれぞれ別の <td>',
    html: `<form><table><tr><th>郵便番号</th><td>〒</td><td><input name="z4a" size="3"></td><td>-</td><td><input name="z4b" size="4"></td></tr></table></form>`,
    expect: { '[name=z4a]': '150', '[name=z4b]': '0041' },
  },
  {
    name: 'S-Z5 郵便番号：Bootstrap の col と label（for なし）',
    html: `<form><div class="form-group row"><label class="col-3">郵便番号</label><div class="col-2"><input name="z5a" class="form-control"></div><div class="col-1">-</div><div class="col-2"><input name="z5b" class="form-control"></div><button type="button">住所検索</button></div></form>`,
    expect: { '[name=z5a]': '150', '[name=z5b]': '0041' },
  },
  {
    name: 'S-Z6 郵便番号：欄ごとの input-group で包む（「〒」はアドオン）',
    html: `<form><div class="form-row"><label>郵便番号</label>
      <div class="input-group"><span class="input-group-text">〒</span><input name="z6a" maxlength="3"></div><span>-</span>
      <div class="input-group"><input name="z6b" maxlength="4"></div>
    </div></form>`,
    expect: { '[name=z6a]': '150', '[name=z6b]': '0041' },
  },
  {
    name: 'S-Z7 郵便番号：placeholder が「123」「4567」',
    html: `<form><dl><dt>〒（郵便番号）</dt><dd><input name="z7a" placeholder="123"> － <input name="z7b" placeholder="4567"></dd></dl></form>`,
    expect: { '[name=z7a]': '150', '[name=z7b]': '0041' },
  },

  // ---------------- 生年月日 ----------------
  {
    name: 'S-B1 生年月日：年は文字欄、月・日はプルダウン',
    html: `<form><table><tr><th>生年月日</th><td><input name="b1y" size="4">年 <select name="b1m">${months}</select>月 <select name="b1d">${days}</select>日</td></tr></table></form>`,
    expect: { '[name=b1y]': '1999', '[name=b1m]': '4', '[name=b1d]': '1' },
  },
  {
    name: 'S-B2 生年月日：元号プルダウン＋年の文字欄（単位なし・placeholder「年」）＋月・日プルダウン',
    html: `<form><table><tr><th>生年月日</th><td>
      <select name="b2e">${opts(['昭和', '平成', '令和'], '元号')}</select>
      <input name="b2y" size="2" placeholder="年">
      <select name="b2m">${months}</select>
      <select name="b2d">${days}</select>
    </td></tr></table></form>`,
    expect: { '[name=b2e]': '平成', '[name=b2y]': '11', '[name=b2m]': '4', '[name=b2d]': '1' },
  },
  {
    name: 'S-B3 生年月日：name が birth_y / birth_m / birth_d、単位は CSS の ::after',
    html: `<form>${CSS_SEP}<dl><dt>生年月日</dt><dd><span class="sx-y"><input name="birth_y" size="4"></span><span class="sx-m"><input name="birth_m" size="2"></span><span class="sx-d"><input name="birth_d" size="2"></span></dd></dl></form>`,
    expect: { '[name=birth_y]': '1999', '[name=birth_m]': '4', '[name=birth_d]': '1' },
  },
  {
    name: 'S-B4 生年月日：name が year / month / day、プルダウンと文字欄が混ざる',
    html: `<form><table><tr><th>生年月日</th><td><select name="year">${years(1980, 2008)}</select> / <input name="month" size="2"> / <input name="day" size="2"></td></tr></table></form>`,
    expect: { '[name=year]': '1999', '[name=month]': '4', '[name=day]': '1' },
  },
  {
    name: 'S-B5 生年月日：aria-label が「年」「月」「日」、区切りなし',
    html: `<form><table><tr><th>生年月日</th><td><input name="b5a" aria-label="年"><input name="b5b" aria-label="月"><input name="b5c" aria-label="日"></td></tr></table></form>`,
    expect: { '[name=b5a]': '1999', '[name=b5b]': '4', '[name=b5c]': '1' },
  },
  {
    name: 'S-B6 生年月日：title 属性が「生年月日（年）」など',
    html: `<form><div class="row"><span>生年月日</span><input name="b6a" title="生年月日（年）"> <input name="b6b" title="生年月日（月）"> <input name="b6c" title="生年月日（日）"></div></form>`,
    expect: { '[name=b6a]': '1999', '[name=b6b]': '4', '[name=b6c]': '1' },
  },
  {
    name: 'S-B7 生年月日：欄ごとの div に単位の <span>、見出しは前の <p>',
    html: `<form><div class="item"><p class="label">生年月日</p><div class="sx-flex">
      <div class="unit"><input name="b7y" size="4"><span>年</span></div>
      <div class="unit"><input name="b7m" size="2"><span>月</span></div>
      <div class="unit"><input name="b7d" size="2"><span>日</span></div>
    </div></div></form>`,
    expect: { '[name=b7y]': '1999', '[name=b7m]': '4', '[name=b7d]': '1' },
  },
  {
    name: 'S-B8 生年月日：「年」「月」「日」がそれぞれ別の <td> の placeholder',
    html: `<form><table><tr><th>生年月日</th><td><input name="b8a" placeholder="年"></td><td><input name="b8b" placeholder="月"></td><td><input name="b8c" placeholder="日"></td></tr></table></form>`,
    expect: { '[name=b8a]': '1999', '[name=b8b]': '4', '[name=b8c]': '1' },
  },
  {
    name: 'S-B9 生年月日：見た目は年・月・日だが DOM は日・月・年（row-reverse）、label for がある',
    html: `<form>${CSS_SEP}<fieldset><legend>生年月日</legend><div class="sx-rev">
      <label for="b9d">日</label><input id="b9d" name="b9d" size="2">
      <label for="b9m">月</label><input id="b9m" name="b9m" size="2">
      <label for="b9y">年</label><input id="b9y" name="b9y" size="4">
    </div></fieldset></form>`,
    expect: { '[name=b9y]': '1999', '[name=b9m]': '4', '[name=b9d]': '1' },
  },
  {
    name: 'S-B10 生年月日：単位も name の手がかりもない3つの文字欄、区切りは「/」',
    html: `<form><table><tr><th>生年月日</th><td><input name="b10a" maxlength="4"> / <input name="b10b" maxlength="2"> / <input name="b10c" maxlength="2"></td></tr></table></form>`,
    expect: { '[name=b10a]': '1999', '[name=b10b]': '4', '[name=b10c]': '1' },
  },
  {
    name: 'S-B11 生年月日：欄ごとの li、単位は CSS（name は手がかりなし）',
    html: `<form>${CSS_SEP}<dl><dt>生年月日</dt><dd><ul class="sx-flex"><li class="sx-y"><input name="b11a" size="4"></li><li class="sx-m"><input name="b11b" size="2"></li><li class="sx-d"><input name="b11c" size="2"></li></ul></dd></dl></form>`,
    expect: { '[name=b11a]': '1999', '[name=b11b]': '4', '[name=b11c]': '1' },
  },

  // ---------------- 卒業年月・入学年月 ----------------
  {
    name: 'S-G1 卒業予定年月：年は文字欄、月はプルダウン',
    html: `<form><table><tr><th>卒業予定年月</th><td><input name="g1y" size="4">年 <select name="g1m">${months}</select>月</td></tr></table></form>`,
    expect: { '[name=g1y]': '2026', '[name=g1m]': '3' },
  },
  {
    name: 'S-G2 卒業予定：name が graduation_year / graduation_month、単位は CSS',
    html: `<form>${CSS_SEP}<dl><dt>卒業予定</dt><dd><span class="sx-y"><input name="graduation_year" size="4"></span><span class="sx-m"><input name="graduation_month" size="2"></span></dd></dl></form>`,
    expect: { '[name=graduation_year]': '2026', '[name=graduation_month]': '3' },
  },
  {
    name: 'S-G3 「在籍期間」の1つのセルに「入学［年］年［月］月 〜 卒業見込［年］年［月］月」（各部分は <span>）',
    html: `<form><table><tr><th>在籍期間</th><td>
      <span>入学</span><select name="g3a">${years(2018, 2027)}</select><span>年</span><select name="g3b">${months}</select><span>月</span>
      <span>〜</span>
      <span>卒業見込</span><select name="g3c">${years(2018, 2030)}</select><span>年</span><select name="g3d">${months}</select><span>月</span>
    </td></tr></table></form>`,
    expect: { '[name=g3a]': '2022', '[name=g3b]': '4', '[name=g3c]': '2026', '[name=g3d]': '3' },
  },
  {
    name: 'S-G4 卒業予定年月：元号プルダウン＋和暦の年の文字欄＋月の文字欄',
    html: `<form><table><tr><th>卒業予定年月</th><td><select name="g4e">${opts(['平成', '令和'], '--')}</select><input name="g4y" size="2">年<input name="g4m" size="2">月</td></tr></table></form>`,
    expect: { '[name=g4e]': '令和', '[name=g4y]': '8', '[name=g4m]': '3' },
  },

  // ---------------- メールアドレス ----------------
  {
    name: 'S-E1 メールアドレス：@ が CSS で描かれ、ドメインは文字欄',
    html: `<form>${CSS_SEP}<table><tr><th>メールアドレス</th><td class="sx-at sx-flex"><span class="part"><input name="e1a"></span><span class="part"><input name="e1b"></span></td></tr></table></form>`,
    expect: { '[name=e1a]': 'taro', '[name=e1b]': 'example.com' },
  },
  {
    name: 'S-E2 メールアドレス：@ が CSS で描かれ、ドメインはプルダウン',
    html: `<form>${CSS_SEP}<table><tr><th>メールアドレス</th><td class="sx-at sx-flex"><span class="part"><input name="e2a"></span><span class="part"><select name="e2b">${opts(['gmail.com', 'example.com', 'yahoo.co.jp', 'icloud.com'])}</select></span></td></tr></table></form>`,
    expect: { '[name=e2a]': 'taro', '[name=e2b]': 'example.com' },
  },
  {
    name: 'S-E3 メールアドレス：@ の後ろが datalist 付きの文字欄',
    html: `<form><table><tr><th>メールアドレス</th><td><input name="e3a"> @ <input name="e3b" list="e3list"><datalist id="e3list"><option value="gmail.com"><option value="example.com"></datalist></td></tr></table></form>`,
    expect: { '[name=e3a]': 'taro', '[name=e3b]': 'example.com' },
  },
  {
    name: 'S-E4 メールアドレス：@ の文字がなく、aria-label が「アカウント」「ドメイン」',
    html: `<form><table><tr><th>メールアドレス</th><td><input name="e4a" aria-label="アカウント"> <input name="e4b" aria-label="ドメイン"></td></tr></table></form>`,
    expect: { '[name=e4a]': 'taro', '[name=e4b]': 'example.com' },
  },
  {
    name: 'S-E5 メールアドレス：入力と確認用の両方が local@domain（1つのセルに2行）',
    html: `<form><table><tr><th>メールアドレス</th><td>
      <input name="e5a"> @ <input name="e5b"><br>
      確認用 <input name="e5c"> @ <input name="e5d">
    </td></tr></table></form>`,
    expect: { '[name=e5a]': 'taro', '[name=e5b]': 'example.com', '[name=e5c]': 'taro', '[name=e5d]': 'example.com' },
  },
  {
    name: 'S-E6 メールアドレス：見た目はドメインが左（row-reverse）でも DOM の順番（name が mail_local / mail_domain）',
    html: `<form>${CSS_SEP}<div class="row"><p>メールアドレス</p><div class="sx-rev"><input name="mail_local"><span>@</span><input name="mail_domain"></div></div></form>`,
    expect: { '[name=mail_local]': 'taro', '[name=mail_domain]': 'example.com' },
  },

  // ---------------- 住所 ----------------
  {
    name: 'S-A1 住所の3分割：「住所1（市区町村）」「住所2（番地）」「住所3（建物名）」',
    html: `<form><table>
      <tr><th>都道府県</th><td><select name="a1p">${prefs}</select></td></tr>
      <tr><th>住所1（市区町村）</th><td><input name="a1a"></td></tr>
      <tr><th>住所2（番地）</th><td><input name="a1b"></td></tr>
      <tr><th>住所3（建物名）</th><td><input name="a1c"></td></tr>
    </table></form>`,
    expect: { '[name=a1p]': '東京都', '[name=a1a]': '渋谷区', '[name=a1b]': '神南1-2-3', '[name=a1c]': 'サンプルマンション101' },
  },
  {
    name: 'S-A2 住所の2分割：「市区町村以下」「マンション名等」',
    html: `<form><table>
      <tr><th>都道府県</th><td><select name="a2p">${prefs}</select></td></tr>
      <tr><th>市区町村以下</th><td><input name="a2a"></td></tr>
      <tr><th>マンション名等</th><td><input name="a2b"></td></tr>
    </table></form>`,
    expect: { '[name=a2p]': '東京都', '[name=a2a]': '渋谷区神南1-2-3', '[name=a2b]': 'サンプルマンション101' },
  },
  {
    name: 'S-A3 住所：「市区郡」「町名・番地」「建物名」',
    html: `<form><dl>
      <dt>都道府県</dt><dd><select name="a3p">${prefs}</select></dd>
      <dt>市区郡</dt><dd><input name="a3a"></dd>
      <dt>町名・番地</dt><dd><input name="a3b"></dd>
      <dt>建物名</dt><dd><input name="a3c"></dd>
    </dl></form>`,
    expect: { '[name=a3p]': '東京都', '[name=a3a]': '渋谷区', '[name=a3b]': '神南1-2-3', '[name=a3c]': 'サンプルマンション101' },
  },
  {
    name: 'S-A4 住所の5分割：1つの「住所」の見出しに〒・都道府県・市区町村・番地・建物の placeholder',
    html: `<form><table><tr><th>現住所</th><td>
      <input name="a4z" placeholder="郵便番号"><br>
      <select name="a4p">${prefs}</select><br>
      <input name="a4a" placeholder="市区町村"><br>
      <input name="a4b" placeholder="番地"><br>
      <input name="a4c" placeholder="建物名・部屋番号">
    </td></tr></table></form>`,
    expect: { '[name=a4z]': '150-0041', '[name=a4p]': '東京都', '[name=a4a]': '渋谷区', '[name=a4b]': '神南1-2-3', '[name=a4c]': 'サンプルマンション101' },
  },
  {
    name: 'S-A5 住所：小ラベルが欄の前の <span>（1つのセルに縦に並ぶ）',
    html: `<form><table><tr><th>住所</th><td>
      <span>都道府県</span><select name="a5p">${prefs}</select><br>
      <span>市区町村</span><input name="a5a"><br>
      <span>番地</span><input name="a5b"><br>
      <span>建物名</span><input name="a5c">
    </td></tr></table></form>`,
    expect: { '[name=a5p]': '東京都', '[name=a5a]': '渋谷区', '[name=a5b]': '神南1-2-3', '[name=a5c]': 'サンプルマンション101' },
  },
  {
    name: 'S-A6 住所：小ラベルが欄の後ろ（「［ ］（市区町村）」）',
    html: `<form><table><tr><th>住所</th><td>
      <select name="a6p">${prefs}</select>（都道府県）<br>
      <input name="a6a">（市区町村）<br>
      <input name="a6b">（番地）<br>
      <input name="a6c">（建物名）
    </td></tr></table></form>`,
    expect: { '[name=a6p]': '東京都', '[name=a6a]': '渋谷区', '[name=a6b]': '神南1-2-3', '[name=a6c]': 'サンプルマンション101' },
  },
  {
    name: 'S-A7 住所：aria-label だけ（都道府県・市区町村・番地・建物名）',
    html: `<form><div class="row"><p>ご住所</p>
      <select name="a7p" aria-label="都道府県">${prefs}</select>
      <input name="a7a" aria-label="市区町村"><input name="a7b" aria-label="番地"><input name="a7c" aria-label="建物名">
    </div></form>`,
    expect: { '[name=a7p]': '東京都', '[name=a7a]': '渋谷区', '[name=a7b]': '神南1-2-3', '[name=a7c]': 'サンプルマンション101' },
  },
  {
    name: 'S-A8 住所：name 属性だけ（pref / city / address1 / address2）、見出しは「住所」',
    html: `<form><table><tr><th>住所</th><td><select name="pref">${prefs}</select> <input name="city"> <input name="address1"> <input name="address2"></td></tr></table></form>`,
    expect: { '[name=pref]': '東京都', '[name=city]': '渋谷区', '[name=address1]': '神南1-2-3', '[name=address2]': 'サンプルマンション101' },
  },
  {
    name: 'S-A9 住所の2分割：「住所1」「住所2」だけ（都道府県は別）',
    html: `<form><table>
      <tr><th>都道府県</th><td><select name="a9p">${prefs}</select></td></tr>
      <tr><th>住所1</th><td><input name="a9a" placeholder="市区町村・番地"></td></tr>
      <tr><th>住所2</th><td><input name="a9b" placeholder="建物名・部屋番号"></td></tr>
    </table></form>`,
    expect: { '[name=a9p]': '東京都', '[name=a9a]': '渋谷区神南1-2-3', '[name=a9b]': 'サンプルマンション101' },
  },
];
