import { PREFECTURES } from '../../../lib/prefectures';
import type { Case } from '../cases';

/**
 * 見た目は同じ「氏名 / フリガナ / 生年月日 / 性別 / 電話番号 / 郵便番号 / 住所 / メール / 大学名 / 学部」のフォームで、
 * 見出し（ラベル）の DOM への付け方だけを変えたもの。
 * name・id は q01〜q10 のように手がかりにならない値にして、ラベルの付け方だけで判定できるかを見る（L-4x の name だけのケースを除く）。
 */

type Kind = 'text' | 'date' | 'radio';
interface F {
  n: string;
  label: string;
  kind: Kind;
  exp: string;
}

const ADDR = '東京都渋谷区神南1-2-3　サンプルマンション101';

const BASE: F[] = [
  { n: 'q01', label: '氏名', kind: 'text', exp: '山田　太郎' },
  { n: 'q02', label: 'フリガナ', kind: 'text', exp: 'ヤマダ　タロウ' },
  { n: 'q03', label: '生年月日', kind: 'date', exp: '1999-04-01' },
  { n: 'q04', label: '性別', kind: 'radio', exp: '男性' },
  { n: 'q05', label: '電話番号', kind: 'text', exp: '090-1234-5678' },
  { n: 'q06', label: '郵便番号', kind: 'text', exp: '150-0041' },
  { n: 'q07', label: '住所', kind: 'text', exp: ADDR },
  { n: 'q08', label: 'メールアドレス', kind: 'text', exp: 'taro@example.com' },
  { n: 'q09', label: '大学名', kind: 'text', exp: 'サンプル大学' },
  { n: 'q10', label: '学部', kind: 'text', exp: '経済学部' },
];

/** ラベルの文字だけ差し替える（q01: '...' の形） */
const relabel = (labels: Record<string, string>, over: Partial<Record<string, Partial<F>>> = {}): F[] =>
  BASE.map((f) => ({ ...f, label: labels[f.n] ?? f.label, ...(over[f.n] ?? {}) }));

const radios = (n: string, attrs = '') =>
  `<label><input type="radio" id="${n}a" name="${n}" value="1" ${attrs}>男性</label> <label><input type="radio" id="${n}b" name="${n}" value="2" ${attrs}>女性</label>`;

/** 入力欄。attrs は input に付ける属性 */
const ctl = (f: F, attrs = '') =>
  f.kind === 'radio' ? radios(f.n) : `<input type="${f.kind}" id="${f.n}" name="${f.n}" size="30" ${attrs}>`;

const expectOf = (fields: F[], over: Record<string, string | boolean> = {}): Record<string, string | boolean> => ({
  ...Object.fromEntries(fields.map((f) => [f.kind === 'radio' ? `radio:${f.n}` : `[name=${f.n}]`, f.exp])),
  ...over,
});

const rows = (fields: F[], row: (f: F, i: number) => string) => fields.map(row).join('\n');

/** 標準の「見出し＋欄」の行（th / td の表） */
const thTable = (fields: F[]) =>
  `<form><table>${rows(fields, (f) => `<tr><th>${f.label}</th><td>${ctl(f)}</td></tr>`)}</table></form>`;

/** label[for] を使った div の行 */
const forRows = (fields: F[]) =>
  `<form>${rows(fields, (f) =>
    f.kind === 'radio'
      ? `<div class="row"><div class="th"><span>${f.label}</span></div><div class="td">${ctl(f)}</div></div>`
      : `<div class="row"><div class="th"><label for="${f.n}">${f.label}</label></div><div class="td">${ctl(f)}</div></div>`,
  )}</form>`;

const opts = (items: string[]) => [`<option value="">選択してください</option>`, ...items.map((o) => `<option>${o}</option>`)].join('');

export const CASES: Case[] = [
  // ---- ラベルの付け方（属性） ----
  {
    name: 'L-01 label[for]：見出しの列と入力欄の列が別の div',
    html: forRows(BASE),
    expect: expectOf(BASE),
  },
  {
    name: 'L-02 入力欄を包む label（label > span＋div > input）',
    html: `<form>${rows(BASE, (f) =>
      f.kind === 'radio'
        ? `<div class="field"><span class="field-label">${f.label}</span><div class="control">${ctl(f)}</div></div>`
        : `<label class="field"><span class="field-label">${f.label}</span><div class="control"><div class="input-wrap">${ctl(f)}</div></div></label>`,
    )}</form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-03 aria-label だけ（画面に見出しの文字なし）',
    html: `<form>${rows(BASE, (f) =>
      f.kind === 'radio'
        ? `<div class="row" role="radiogroup" aria-label="${f.label}">${ctl(f)}</div>`
        : `<div class="row">${ctl(f, `aria-label="${f.label}"`)}</div>`,
    )}</form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-04 aria-labelledby に複数の id（区切りの見出し＋項目名＋必須マーク）',
    html: `<form>
      <h2 id="sec-basic">基本情報</h2>
      ${rows(BASE, (f) =>
        f.kind === 'radio'
          ? `<div class="row" role="radiogroup" aria-labelledby="sec-basic l${f.n} r${f.n}"><span id="l${f.n}">${f.label}</span><span id="r${f.n}" class="req">必須</span>${ctl(f)}</div>`
          : `<div class="row"><span id="l${f.n}">${f.label}</span><span id="r${f.n}" class="req">必須</span>${ctl(
              f,
              `aria-labelledby="sec-basic l${f.n} r${f.n}"`,
            )}</div>`,
      )}
    </form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-05 aria-labelledby がフォームの別の場所（左の列の見出し）を指す',
    // 見出しは左の列にまとめてあり、入力欄は右の列。DOM 上は隣にない
    html: `<form><style>.l5{display:flex;gap:8px}.l5 .c{display:flex;flex-direction:column;gap:6px}</style>
      <div class="l5">
        <div class="c">${rows(BASE, (f) => `<span id="h${f.n}">${f.label}</span>`)}</div>
        <div class="c">${rows(BASE, (f) =>
          f.kind === 'radio' ? `<div role="radiogroup" aria-labelledby="h${f.n}">${ctl(f)}</div>` : `<div>${ctl(f, `aria-labelledby="h${f.n}"`)}</div>`,
        )}</div>
      </div></form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-06 aria-describedby の説明文が欄のすぐ後ろ（見出しなし）',
    html: `<form>${rows(
      relabel({
        q01: '氏名を全角で入力してください',
        q02: 'フリガナを全角カタカナで入力してください',
        q03: '生年月日を選択してください',
        q04: '性別を選択してください',
        q05: '電話番号をハイフン付きで入力してください',
        q06: '郵便番号をハイフン付きで入力してください',
        q07: '住所を建物名まで入力してください',
        q08: 'メールアドレスを入力してください',
        q09: '大学名を正式名称で入力してください',
        q10: '学部名を入力してください',
      }),
      (f) =>
        f.kind === 'radio'
          ? `<div class="row">${ctl(f)}<p class="help">${f.label}</p></div>`
          : `<div class="row">${ctl(f, `aria-describedby="d${f.n}"`)}<p class="help" id="d${f.n}">${f.label}</p></div>`,
    )}</form>`,
    expect: expectOf(BASE),
  },
  {
    // 判断が分かれる：見出しが画面になく、説明はフォーカス時のツールチップ（aria-describedby）だけ
    name: 'L-07 aria-describedby のツールチップがフォームの末尾にまとめてある',
    html: `<form>
      ${rows(BASE, (f) => (f.kind === 'radio' ? `<div class="row">${ctl(f)}</div>` : `<div class="row">${ctl(f, `aria-describedby="t${f.n}"`)}</div>`))}
      <div class="tooltips">${rows(BASE, (f) => `<div role="tooltip" id="t${f.n}" class="tooltip">${f.label}を入力</div>`)}</div>
    </form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-08 title 属性だけ',
    html: `<form>${rows(BASE, (f) =>
      f.kind === 'radio' ? `<div class="row" title="${f.label}">${ctl(f)}</div>` : `<div class="row">${ctl(f, `title="${f.label}"`)}</div>`,
    )}</form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-09 placeholder だけ',
    html: `<form>${rows(relabel({ q03: '生年月日（例：1999/04/01）' }, { q03: { kind: 'text', exp: '1999/04/01' } }), (f) =>
      f.kind === 'radio' ? `<div class="row">${ctl(f)}</div>` : `<div class="row">${ctl(f, `placeholder="${f.label}"`)}</div>`,
    )}</form>`,
    expect: expectOf(relabel({}, { q03: { kind: 'text', exp: '1999/04/01' } })),
  },
  {
    name: 'L-10 見出しが手前の兄弟要素（div・span・p・strong・b・h4 が混在）',
    html: `<form>
      <div class="item"><div>氏名</div><input name="q01" size="30"></div>
      <div class="item"><span>フリガナ</span><input name="q02" size="30"></div>
      <div class="item"><p>生年月日</p><input type="date" name="q03"></div>
      <div class="item"><strong>性別</strong>${radios('q04')}</div>
      <div class="item"><b>電話番号</b><br><input name="q05" size="30"></div>
      <div class="item"><h4>郵便番号</h4><input name="q06" size="30"></div>
      <div class="item"><p><strong>住所</strong></p><div><input name="q07" size="30"></div></div>
      <div class="item"><em>メールアドレス</em> <input name="q08" size="30"></div>
      <div class="item"><span class="lbl"><span>大学名</span></span><span class="in"><input name="q09" size="30"></span></div>
      <div class="item"><div class="lbl">学部</div><div class="in"><div><input name="q10" size="30"></div></div></div>
    </form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-11 1つの箱に平文の見出し・<br>・欄を並べる',
    html: `<form><div class="box">
      氏名<br><input name="q01" size="30"><br>
      フリガナ<br><input name="q02" size="30"><br>
      生年月日<br><input type="date" name="q03"><br>
      性別<br>${radios('q04')}<br>
      電話番号<br><input name="q05" size="30"><br>
      郵便番号<br><input name="q06" size="30"><br>
      住所<br><input name="q07" size="30"><br>
      メールアドレス<br><input name="q08" size="30"><br>
      大学名<br><input name="q09" size="30"><br>
      学部<br><input name="q10" size="30">
    </div></form>`,
    expect: expectOf(BASE),
  },

  // ---- CSS のレイアウトで DOM の順と見た目の順が違う ----
  {
    name: 'L-12 CSS grid：見出し（label[for]）がすべて先、入力欄がすべて後',
    html: `<form><style>.g12{display:grid;grid-template-columns:10em 1fr;grid-template-rows:repeat(10,auto);grid-auto-flow:column;gap:6px}</style>
      <div class="g12">
        ${rows(BASE, (f) => (f.kind === 'radio' ? `<span id="g12${f.n}">${f.label}</span>` : `<label for="${f.n}">${f.label}</label>`))}
        ${rows(BASE, (f) => (f.kind === 'radio' ? `<div role="radiogroup" aria-labelledby="g12${f.n}">${ctl(f)}</div>` : ctl(f)))}
      </div></form>`,
    expect: expectOf(BASE),
  },
  {
    // 判断が分かれる：DOM に紐づけがなく、見た目の位置（同じ行の左）でしか分からない
    name: 'L-13 CSS grid：見出し（for なしの div）がすべて先、入力欄がすべて後',
    html: `<form><style>.g13{display:grid;grid-template-columns:10em 1fr;grid-template-rows:repeat(10,auto);grid-auto-flow:column;gap:6px}</style>
      <div class="g13">
        ${rows(BASE, (f) => `<div class="lbl">${f.label}</div>`)}
        ${rows(BASE, (f) => (f.kind === 'radio' ? `<div>${ctl(f)}</div>` : ctl(f)))}
      </div></form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-14 label が入力欄の後ろ・flex-direction: row-reverse で左に表示（label[for]）',
    html: `<form><style>.r14{display:flex;flex-direction:row-reverse;justify-content:flex-end;gap:8px;margin:4px 0}</style>
      ${rows(BASE, (f) =>
        f.kind === 'radio'
          ? `<div class="r14"><div>${ctl(f)}</div><span>${f.label}</span></div>`
          : `<div class="r14">${ctl(f)}<label for="${f.n}">${f.label}</label></div>`,
      )}</form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-15 label が入力欄の後ろ・CSS の order で左に表示（for なしの span）',
    html: `<form><style>.r15{display:flex;gap:8px;margin:4px 0}.r15 .lbl{order:-1;width:10em}</style>
      ${rows(BASE, (f) => `<div class="r15">${f.kind === 'radio' ? `<div>${ctl(f)}</div>` : ctl(f)}<span class="lbl">${f.label}</span></div>`)}</form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-16 label[for] が入力欄の後ろ・1つの箱に平らに並ぶ（float で左に表示）',
    html: `<form><style>.f16 label{float:left;clear:left;width:10em}.f16 input,.f16 .rg{float:left}.f16 br{clear:both}</style>
      <div class="f16">
        ${rows(BASE, (f) =>
          f.kind === 'radio'
            ? `<span class="rg">${ctl(f)}</span><span class="lbl">${f.label}</span><br>`
            : `${ctl(f)}<label for="${f.n}">${f.label}</label><br>`,
        )}
      </div></form>`,
    expect: expectOf(BASE),
  },

  // ---- 表 ----
  {
    name: 'L-17 横長の表：thead の見出し行の下に入力欄の行',
    html: `<form><table>
      <thead><tr>${rows(BASE.slice(0, 5), (f) => `<th>${f.label}</th>`)}</tr></thead>
      <tbody><tr>${rows(BASE.slice(0, 5), (f) => `<td>${ctl(f, 'size="10"')}</td>`)}</tr></tbody>
    </table><table>
      <thead><tr>${rows(BASE.slice(5), (f) => `<th>${f.label}</th>`)}</tr></thead>
      <tbody><tr>${rows(BASE.slice(5), (f) => `<td>${ctl(f, 'size="10"')}</td>`)}</tr></tbody>
    </table></form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-18 横長の表：thead なし・1行目が th、2行目が入力欄（1つの表に2段）',
    html: `<form><table>
      <tr>${rows(BASE.slice(0, 5), (f) => `<th>${f.label}</th>`)}</tr>
      <tr>${rows(BASE.slice(0, 5), (f) => `<td>${ctl(f, 'size="10"')}</td>`)}</tr>
      <tr>${rows(BASE.slice(5), (f) => `<th>${f.label}</th>`)}</tr>
      <tr>${rows(BASE.slice(5), (f) => `<td>${ctl(f, 'size="10"')}</td>`)}</tr>
    </table></form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-19 th の rowspan で複数行をまとめ、td に小見出し（氏名／住所／連絡先／学校）',
    html: `<form><table>
      <tr><th rowspan="2">氏名</th><td class="sub">漢字</td><td><input name="q01" size="30"></td></tr>
      <tr><td class="sub">フリガナ</td><td><input name="q02" size="30"></td></tr>
      <tr><th colspan="2">生年月日</th><td><input type="date" name="q03"></td></tr>
      <tr><th colspan="2">性別</th><td>${radios('q04')}</td></tr>
      <tr><th rowspan="2">住所</th><td class="sub">郵便番号</td><td><input name="q06" size="30"></td></tr>
      <tr><td class="sub">住所</td><td><input name="q07" size="30"></td></tr>
      <tr><th rowspan="2">連絡先</th><td class="sub">電話番号</td><td><input name="q05" size="30"></td></tr>
      <tr><td class="sub">メールアドレス</td><td><input name="q08" size="30"></td></tr>
      <tr><th rowspan="2">学校</th><td class="sub">大学名</td><td><input name="q09" size="30"></td></tr>
      <tr><td class="sub">学部</td><td><input name="q10" size="30"></td></tr>
    </table></form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-20 th の colspan の区切り行（基本情報／連絡先／学歴）',
    html: `<form><table>
      <tr><th colspan="2">基本情報</th></tr>
      ${rows(BASE.slice(0, 4), (f) => `<tr><th>${f.label}</th><td>${ctl(f)}</td></tr>`)}
      <tr><th colspan="2">連絡先</th></tr>
      ${rows(BASE.slice(4, 8), (f) => `<tr><th>${f.label}</th><td>${ctl(f)}</td></tr>`)}
      <tr><th colspan="2">学歴</th></tr>
      ${rows(BASE.slice(8), (f) => `<tr><th>${f.label}</th><td>${ctl(f)}</td></tr>`)}
    </table></form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-21 見出しが1つ前の tr（td の見出し行・スマホ向けの縦積み）',
    html: `<form><table>${rows(BASE, (f) => `<tr><td class="label">${f.label}</td></tr><tr><td>${ctl(f)}</td></tr>`)}</table></form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-22 見出しが1つ前の tr（th の見出し行・スマホ向けの縦積み）',
    html: `<form><table>${rows(BASE, (f) => `<tr><th>${f.label}</th></tr><tr><td>${ctl(f)}</td></tr>`)}</table></form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-23 1つの td に見出し・<br>・欄（1列の表）',
    html: `<form><table>${rows(BASE, (f) => `<tr><td>${f.label}<span class="req">*</span><br>${ctl(f)}</td></tr>`)}</table></form>`,
    expect: expectOf(BASE),
  },

  // ---- dl・fieldset ----
  {
    name: 'L-24 dl の入れ子（外側の dt が区切り、内側の dt が項目名）',
    html: `<form><dl class="outer">
      <dt>基本情報</dt><dd><dl class="inner">${rows(BASE.slice(0, 4), (f) => `<dt>${f.label}</dt><dd>${ctl(f)}</dd>`)}</dl></dd>
      <dt>連絡先</dt><dd><dl class="inner">${rows(BASE.slice(4, 8), (f) => `<dt>${f.label}</dt><dd>${ctl(f)}</dd>`)}</dl></dd>
      <dt>学校</dt><dd><dl class="inner">${rows(BASE.slice(8), (f) => `<dt>${f.label}</dt><dd><div class="w"><div>${ctl(f)}</div></div></dd>`)}</dl></dd>
    </dl></form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-25 dl の dt / dd を div で包み、dt の中に label[for]・必須マーク',
    html: `<form><dl>${rows(BASE, (f) =>
      f.kind === 'radio'
        ? `<div class="dl-row"><dt><span>${f.label}</span><img src="data:," alt="必須" width="20" height="10"></dt><dd>${ctl(f)}</dd></div>`
        : `<div class="dl-row"><dt><label for="${f.n}">${f.label}</label><img src="data:," alt="必須" width="20" height="10"></dt><dd>${ctl(f)}</dd></div>`,
    )}</dl></form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-26 fieldset / legend の2段の入れ子（外側が区切り、内側が項目）',
    html: `<form>
      <fieldset><legend>応募者情報</legend>
        ${rows(BASE.slice(0, 4), (f) => `<fieldset><legend>${f.label}</legend>${ctl(f)}</fieldset>`)}
      </fieldset>
      <fieldset><legend>連絡先</legend>
        ${rows(BASE.slice(4, 8), (f) => `<fieldset><legend>${f.label}</legend><div class="w">${ctl(f)}</div></fieldset>`)}
      </fieldset>
      <fieldset><legend>学校</legend>
        ${rows(BASE.slice(8), (f) => `<fieldset><legend>${f.label}</legend>${ctl(f)}</fieldset>`)}
      </fieldset>
    </form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-27 フォーム全体が legend のない fieldset・中に性別だけ legend 付きの fieldset、見出しは欄の4段上',
    html: `<form><fieldset class="form-body">
      ${rows(BASE, (f) =>
        f.kind === 'radio'
          ? `<fieldset class="item"><legend>${f.label}</legend>${ctl(f)}</fieldset>`
          : `<div class="item"><div class="item-label">${f.label}</div><div class="item-body"><div class="input-wrap"><span class="input-inner">${ctl(f)}</span></div></div></div>`,
      )}
    </fieldset></form>`,
    expect: expectOf(BASE),
  },

  // ---- 見出しの文字の書き方 ----
  {
    name: 'L-28 ruby のふりがな付き見出し（単語ごと：<ruby>氏名<rt>しめい</rt></ruby>）',
    html: thTable(
      relabel({
        q01: '<ruby>氏名<rp>(</rp><rt>しめい</rt><rp>)</rp></ruby>',
        q03: '<ruby>生年月日<rt>せいねんがっぴ</rt></ruby>',
        q04: '<ruby>性別<rt>せいべつ</rt></ruby>',
        q05: '<ruby>電話番号<rt>でんわばんごう</rt></ruby>',
        q06: '<ruby>郵便番号<rt>ゆうびんばんごう</rt></ruby>',
        q07: '<ruby>住所<rt>じゅうしょ</rt></ruby>',
        q09: '<ruby>大学名<rt>だいがくめい</rt></ruby>',
        q10: '<ruby>学部<rt>がくぶ</rt></ruby>',
      }),
    ),
    expect: expectOf(BASE),
  },
  {
    name: 'L-29 ruby のふりがな付き見出し（1文字ずつ：氏<rt>し</rt>名<rt>めい</rt>）',
    html: thTable(
      relabel({
        q01: '<ruby>氏<rt>し</rt>名<rt>めい</rt></ruby>',
        q07: '<ruby>住<rt>じゅう</rt>所<rt>しょ</rt></ruby>',
        q10: '<ruby>学<rt>がく</rt>部<rt>ぶ</rt></ruby>',
      }),
    ),
    expect: expectOf(BASE),
  },
  {
    name: 'L-30 全角スペースで字間を空けた見出し（氏　名・住　所・学　部・性　別）',
    html: thTable(relabel({ q01: '氏　名', q04: '性　別', q07: '住　所', q10: '学　部', q09: '大 学 名' })),
    expect: expectOf(BASE),
  },
  {
    name: 'L-31 全角スペースで字間を空けた label[for]（氏　名・住　所・学　部）',
    html: forRows(relabel({ q01: '氏　名', q07: '住　所', q10: '学　部' })),
    expect: expectOf(BASE),
  },
  {
    name: 'L-32 見出しの途中に <br>（郵便<br>番号・フリ<br>ガナ・電話<br>番号・メール<br>アドレス）',
    html: thTable(
      relabel({
        q01: '氏名<br><small>（漢字）</small>',
        q02: 'フリ<br>ガナ',
        q03: '生年<br>月日',
        q05: '電話<br>番号',
        q06: '郵便<br>番号',
        q08: 'メール<br>アドレス',
        q09: '大学<br>名',
      }),
    ),
    expect: expectOf(BASE),
  },
  {
    name: 'L-33 いろいろな必須マーク（img alt・span.req の *・バッジ・（必須）・※）',
    html: thTable(
      relabel({
        q01: '氏名<img src="data:," alt="必須" width="24" height="12">',
        q02: '<span class="req">*</span>フリガナ',
        q03: '生年月日<span class="badge badge-danger">必須</span>',
        q04: '性別（必須）',
        q05: '<span class="req">※</span>電話番号',
        q06: '<span class="must">必須</span><span>郵便番号</span>',
        q07: '住所<span class="req" aria-hidden="true">*</span><span class="sr-only">（必須）</span>',
        q08: 'メールアドレス<span class="any">任意</span>',
        q09: '<i class="icon-required"></i>大学名',
        q10: '学部<sup>*</sup>',
      }),
    ),
    expect: expectOf(BASE),
  },
  {
    name: 'L-34 見た目はアイコンだけ・本当の見出しは sr-only の文字',
    html: `<form><style>.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}</style>
      ${rows(BASE, (f) =>
        f.kind === 'radio'
          ? `<div class="row"><span class="icon" aria-hidden="true">●</span><span class="sr-only">${f.label}</span>${ctl(f)}</div>`
          : `<div class="row"><label for="${f.n}"><i class="icon icon-${f.n}" aria-hidden="true"></i><span class="sr-only">${f.label}</span></label>${ctl(f)}</div>`,
      )}</form>`,
    expect: expectOf(BASE),
  },
  {
    // 判断が分かれる：見出しの文字が DOM になく、CSS の ::before の content でだけ表示される
    name: 'L-35 見出しの文字が CSS の ::before の content だけ（DOM に文字なし）',
    html: `<form><style>${BASE.map((f) => `.lb-${f.n}::before{content:"${f.label}"}`).join('')}</style>
      ${rows(BASE, (f) =>
        f.kind === 'radio'
          ? `<div class="row"><span class="lb-${f.n}"></span>${ctl(f)}</div>`
          : `<div class="row"><label for="${f.n}" class="lb-${f.n}"></label>${ctl(f)}</div>`,
      )}</form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-36 見出しの横にツールチップの説明文（住所「建物名まで」・メール「携帯のアドレスは不可」）',
    html: `<form><table>
      <tr><th>氏名<span class="tip">姓と名の間にスペースを入れてください</span></th><td><input name="q01" size="30"></td></tr>
      <tr><th>フリガナ<span class="tip">全角カタカナ</span></th><td><input name="q02" size="30"></td></tr>
      <tr><th>生年月日<span class="tip">西暦で選択</span></th><td><input type="date" name="q03"></td></tr>
      <tr><th>性別</th><td>${radios('q04')}</td></tr>
      <tr><th>電話番号<span class="tip">日中に連絡のつく番号（携帯可）</span></th><td><input name="q05" size="30"></td></tr>
      <tr><th>郵便番号</th><td><input name="q06" size="30"></td></tr>
      <tr><th>住所<span class="tip">マンション名・部屋番号までご記入ください</span></th><td><input name="q07" size="30"></td></tr>
      <tr><th>メールアドレス<span class="tip">携帯のアドレスは不可</span></th><td><input name="q08" size="30"></td></tr>
      <tr><th>大学名<span class="tip">正式名称で</span></th><td><input name="q09" size="30"></td></tr>
      <tr><th>学部</th><td><input name="q10" size="30"></td></tr>
    </table></form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-37 label[for] の中に括弧書きの注意（住所（建物名まで）・メール（携帯キャリアメール不可））',
    html: forRows(
      relabel({
        q01: '氏名（全角）',
        q05: '電話番号（携帯可）',
        q07: '住所（建物名・部屋番号まで）',
        q08: 'メールアドレス（携帯キャリアのメールは不可）',
        q09: '大学名（正式名称）',
      }),
    ),
    expect: expectOf(BASE),
  },

  // ---- 見出しが遠い ----
  {
    name: 'L-38 見出しが2段上の包み要素・間に入力例リンクの文字',
    html: `<form>${rows(BASE, (f) =>
      `<div class="field"><div class="field-header"><h4>${f.label}</h4><a href="#" class="ex">入力例を見る</a></div><div class="field-body"><div class="a"><div class="b">${ctl(f)}</div></div></div></div>`,
    )}</form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-39 見出しと欄の間に「※」の注意書き（注意書きに別の項目名が含まれる）',
    html: `<form>
      <div class="item"><div class="head"><span>氏名</span><span class="req">必須</span></div><p class="note">※戸籍上の氏名を入力してください</p><div class="body"><input name="q01" size="30"></div></div>
      <div class="item"><div class="head"><span>フリガナ</span></div><p class="note">※全角カタカナ</p><div class="body"><input name="q02" size="30"></div></div>
      <div class="item"><div class="head"><span>生年月日</span></div><div class="body"><input type="date" name="q03"></div></div>
      <div class="item"><div class="head"><span>性別</span></div><div class="body">${radios('q04')}</div></div>
      <div class="item"><div class="head"><span>電話番号</span></div><p class="note">※日中に連絡のつく番号</p><div class="body"><input name="q05" size="30"></div></div>
      <div class="item"><div class="head"><span>郵便番号</span></div><div class="body"><input name="q06" size="30"></div></div>
      <div class="item"><div class="head"><span>住所</span></div><p class="note">※郵便番号を入力すると自動で入力されます</p><div class="body"><input name="q07" size="30"></div></div>
      <div class="item"><div class="head"><span>メールアドレス</span></div><p class="note">※携帯電話のメールは受信設定をご確認ください</p><div class="body"><input name="q08" size="30"></div></div>
      <div class="item"><div class="head"><span>大学名</span></div><p class="note">※在籍中の学校名</p><div class="body"><input name="q09" size="30"></div></div>
      <div class="item"><div class="head"><span>学部</span></div><p class="note">※学部・研究科名</p><div class="body"><input name="q10" size="30"></div></div>
    </form>`,
    expect: expectOf(BASE),
  },

  // ---- 英語・言い換え ----
  {
    name: 'L-40 英語だけの見出し（Last name / Given name / Date of birth / Mobile / Zip）',
    html: `<form>
      <div class="row"><label for="e1">Last name</label><input id="e1" name="q01a"></div>
      <div class="row"><label for="e2">Given name</label><input id="e2" name="q01b"></div>
      <div class="row"><label for="e3">Date of birth</label><input id="e3" type="date" name="q03"></div>
      <fieldset><legend>Gender</legend><label><input type="radio" name="q04" value="m">Male</label><label><input type="radio" name="q04" value="f">Female</label></fieldset>
      <div class="row"><label for="e5">Mobile</label><input id="e5" name="q05"></div>
      <div class="row"><label for="e6">Zip</label><input id="e6" name="q06"></div>
      <div class="row"><label for="e8">E-mail</label><input id="e8" name="q08"></div>
      <div class="row"><label for="e9">University</label><input id="e9" name="q09"></div>
      <div class="row"><label for="e10">Faculty</label><input id="e10" name="q10"></div>
    </form>`,
    expect: {
      '[name=q01a]': 'Yamada',
      '[name=q01b]': 'Taro',
      '[name=q03]': '1999-04-01',
      'radio:q04': 'Male',
      '[name=q05]': '090-1234-5678',
      '[name=q06]': '150-0041',
      '[name=q08]': 'taro@example.com',
      '[name=q09]': 'サンプル大学',
      '[name=q10]': '経済学部',
    },
  },
  {
    name: 'L-41 英語の見出し（Family name (Kanji) / Family name (Katakana) / Phone / ZIP code / Address）',
    html: `<form><table>
      <tr><th>Family name (Kanji)</th><td><input name="a1"></td><th>Given name (Kanji)</th><td><input name="a2"></td></tr>
      <tr><th>Family name (Katakana)</th><td><input name="a3"></td><th>Given name (Katakana)</th><td><input name="a4"></td></tr>
      <tr><th>Date of Birth</th><td colspan="3"><input type="date" name="a5"></td></tr>
      <tr><th>Phone</th><td colspan="3"><input name="a6"></td></tr>
      <tr><th>ZIP code</th><td colspan="3"><input name="a7"></td></tr>
      <tr><th>Address</th><td colspan="3"><input name="a8" size="40"></td></tr>
      <tr><th>Email address</th><td colspan="3"><input name="a9"></td></tr>
    </table></form>`,
    expect: {
      '[name=a1]': '山田',
      '[name=a2]': '太郎',
      '[name=a3]': 'ヤマダ',
      '[name=a4]': 'タロウ',
      '[name=a5]': '1999-04-01',
      '[name=a6]': '090-1234-5678',
      '[name=a7]': '150-0041',
      '[name=a8]': ADDR,
      '[name=a9]': 'taro@example.com',
    },
  },
  {
    name: 'L-42 言い換え（お名前・お名前（フリガナ）・誕生日・携帯番号・〒・ご住所・Eメール・学校名・学部名）',
    html: thTable(
      relabel({
        q01: 'お名前',
        q02: 'お名前（フリガナ）',
        q03: '誕生日',
        q05: '携帯番号',
        q06: '〒',
        q07: 'ご住所',
        q08: 'Eメール',
        q09: '学校名',
        q10: '学部名',
      }),
    ),
    expect: expectOf(BASE),
  },
  {
    name: 'L-43 言い換え（ご氏名・ご氏名（カナ）・Date of Birth・携帯電話・ZIP・現住所・E-mail・在籍校・所属学部）',
    html: thTable(
      relabel({
        q01: 'ご氏名',
        q02: 'ご氏名（カナ）',
        q03: 'Date of Birth',
        q05: '携帯電話',
        q06: 'ZIP',
        q07: '現住所',
        q08: 'E-mail',
        q09: '在籍校',
        q10: '所属学部',
      }),
    ),
    expect: expectOf(BASE),
  },
  {
    name: 'L-44 言い換え（名前・連絡先電話番号・郵便番号・住所1／住所2・PCメール・大学名・学部・研究科）',
    html: `<form><table>
      <tr><th>名前</th><td><input name="q01"></td></tr>
      <tr><th>フリガナ</th><td><input name="q02"></td></tr>
      <tr><th>生年月日</th><td><input type="date" name="q03"></td></tr>
      <tr><th>性別</th><td>${radios('q04')}</td></tr>
      <tr><th>連絡先電話番号</th><td><input name="q05"></td></tr>
      <tr><th>郵便番号</th><td><input name="q06"></td></tr>
      <tr><th>住所1</th><td><input name="q07a" size="40"></td></tr>
      <tr><th>住所2</th><td><input name="q07b" size="40"></td></tr>
      <tr><th>PCメール</th><td><input name="q08"></td></tr>
      <tr><th>大学名</th><td><input name="q09"></td></tr>
      <tr><th>学部・研究科</th><td><input name="q10"></td></tr>
    </table></form>`,
    expect: {
      ...expectOf(BASE.filter((f) => f.n !== 'q07')),
      '[name=q07a]': '東京都渋谷区神南1-2-3',
      '[name=q07b]': 'サンプルマンション101',
    },
  },
  {
    name: 'L-45 言い換え（氏名（漢字）・氏名（カナ）・TEL・〒・住所・メールアドレス・在学校名・学部）',
    html: thTable(relabel({ q01: '氏名（漢字）', q02: '氏名（カナ）', q05: 'TEL', q06: '〒', q09: '在学校名' })),
    expect: expectOf(BASE),
  },
  {
    name: 'L-46 言い換え（本人氏名・本人氏名（フリガナ）・ご連絡先TEL・郵便番号（ZIP）・現住所・メール・在籍大学・学部名）',
    html: forRows(
      relabel({
        q01: '本人氏名',
        q02: '本人氏名（フリガナ）',
        q05: 'ご連絡先TEL',
        q06: '郵便番号（ZIP）',
        q07: '現住所',
        q08: 'メール',
        q09: '在籍大学',
        q10: '学部名',
      }),
    ),
    expect: expectOf(BASE),
  },
  {
    name: 'L-47 言い換え（名前（姓）・名前（名）・セイ・メイ・携帯TEL・郵便番号・都道府県・市区町村・番地・建物名）',
    html: `<form><table>
      <tr><th>名前（姓）</th><td><input name="n1"></td></tr>
      <tr><th>名前（名）</th><td><input name="n2"></td></tr>
      <tr><th>セイ</th><td><input name="n3"></td></tr>
      <tr><th>メイ</th><td><input name="n4"></td></tr>
      <tr><th>携帯TEL</th><td><input name="n5"></td></tr>
      <tr><th>郵便番号</th><td><input name="n6"></td></tr>
      <tr><th>都道府県</th><td><select name="n7">${opts(PREFECTURES)}</select></td></tr>
      <tr><th>市区町村</th><td><input name="n8"></td></tr>
      <tr><th>番地</th><td><input name="n9"></td></tr>
      <tr><th>建物名</th><td><input name="n10"></td></tr>
    </table></form>`,
    expect: {
      '[name=n1]': '山田',
      '[name=n2]': '太郎',
      '[name=n3]': 'ヤマダ',
      '[name=n4]': 'タロウ',
      '[name=n5]': '090-1234-5678',
      '[name=n6]': '150-0041',
      '[name=n7]': '東京都',
      '[name=n8]': '渋谷区',
      '[name=n9]': '神南1-2-3',
      '[name=n10]': 'サンプルマンション101',
    },
  },

  // ---- name / id だけが手がかり ----
  {
    name: 'L-48 name だけ（sei / mei / sei_kana / mei_kana / birthday / sex / tel / zip / address / email / univ / gakubu）',
    html: `<form>
      <p><input name="sei"> <input name="mei"></p>
      <p><input name="sei_kana"> <input name="mei_kana"></p>
      <p><input type="date" name="birthday"></p>
      <p>${radios('sex')}</p>
      <p><input name="tel"></p><p><input name="zip"></p><p><input name="address" size="40"></p>
      <p><input name="email"></p><p><input name="univ"></p><p><input name="gakubu"></p>
    </form>`,
    expect: {
      '[name=sei]': '山田',
      '[name=mei]': '太郎',
      '[name=sei_kana]': 'ヤマダ',
      '[name=mei_kana]': 'タロウ',
      '[name=birthday]': '1999-04-01',
      'radio:sex': '男性',
      '[name=tel]': '090-1234-5678',
      '[name=zip]': '150-0041',
      '[name=address]': ADDR,
      '[name=email]': 'taro@example.com',
      '[name=univ]': 'サンプル大学',
      '[name=gakubu]': '経済学部',
    },
  },
  {
    name: 'L-49 name だけ（kanji_sei / kanji_mei / kana_sei / kana_mei）',
    html: `<form><div><input name="kanji_sei"><input name="kanji_mei"></div><div><input name="kana_sei"><input name="kana_mei"></div></form>`,
    expect: { '[name=kanji_sei]': '山田', '[name=kanji_mei]': '太郎', '[name=kana_sei]': 'ヤマダ', '[name=kana_mei]': 'タロウ' },
  },
  {
    name: 'L-50 name だけ（lastName / firstName / lastNameKana / firstNameKana / familyName / givenName）',
    html: `<form>
      <div><input name="lastName"><input name="firstName"></div>
      <div><input name="lastNameKana"><input name="firstNameKana"></div>
      <div><input name="applicant[familyName]"><input name="applicant[givenName]"></div>
    </form>`,
    expect: {
      '[name=lastName]': '山田',
      '[name=firstName]': '太郎',
      '[name=lastNameKana]': 'ヤマダ',
      '[name=firstNameKana]': 'タロウ',
      '[name="applicant[familyName]"]': '山田',
      '[name="applicant[givenName]"]': '太郎',
    },
  },
  {
    name: 'L-51 name だけ（tel1 / tel2 / tel3 と zip1 / zip2 の分割欄・maxlength 付き・フォームの先頭に長い説明文）',
    html: `<form>
      <p class="lead">以下の項目をすべて入力してください。ご入力いただいた個人情報は、採用選考および採用に関するご連絡にのみ利用し、第三者に提供することはありません。</p>
      <p><input name="tel1" maxlength="4" size="4"> - <input name="tel2" maxlength="4" size="4"> - <input name="tel3" maxlength="4" size="4"></p>
      <p><input name="zip1" maxlength="3" size="3"> - <input name="zip2" maxlength="4" size="4"></p>
    </form>`,
    expect: { '[name=tel1]': '090', '[name=tel2]': '1234', '[name=tel3]': '5678', '[name=zip1]': '150', '[name=zip2]': '0041' },
  },
  {
    name: 'L-52 name だけ・フォームの先頭に長い説明文（EC-CUBE 風：name01 / name02 / kana01 / kana02 / zip01 / zip02 / pref / addr01 / addr02 / tel01〜03）',
    html: `<form>
      <p class="lead">以下の項目をすべて入力してください。ご入力いただいた個人情報は、採用選考および採用に関するご連絡にのみ利用し、第三者に提供することはありません。</p>
      <p><input name="name01"> <input name="name02"></p>
      <p><input name="kana01"> <input name="kana02"></p>
      <p><input name="zip01" maxlength="3" size="3"> - <input name="zip02" maxlength="4" size="4"></p>
      <p><select name="pref">${opts(PREFECTURES)}</select></p>
      <p><input name="addr01" size="40"></p>
      <p><input name="addr02" size="40"></p>
      <p><input name="tel01" maxlength="5" size="5"> - <input name="tel02" maxlength="4" size="4"> - <input name="tel03" maxlength="4" size="4"></p>
    </form>`,
    expect: {
      '[name=name01]': '山田',
      '[name=name02]': '太郎',
      '[name=kana01]': 'ヤマダ',
      '[name=kana02]': 'タロウ',
      '[name=zip01]': '150',
      '[name=zip02]': '0041',
      '[name=pref]': '東京都',
      '[name=addr01]': '渋谷区神南1-2-3',
      '[name=addr02]': 'サンプルマンション101',
      '[name=tel01]': '090',
      '[name=tel02]': '1234',
      '[name=tel03]': '5678',
    },
  },
  {
    name: 'L-53 id だけ（name 属性なし：id="lastname" など）',
    html: `<form>
      <div><input id="lastname"> <input id="firstname"></div>
      <div><input id="lastname_kana"> <input id="firstname_kana"></div>
      <div><input id="birthdate" type="date"></div>
      <div><input id="phone_number"></div><div><input id="postal_code"></div><div><input id="email_address"></div>
      <div><input id="school_name"></div><div><input id="faculty_name"></div>
    </form>`,
    expect: {
      '#lastname': '山田',
      '#firstname': '太郎',
      '#lastname_kana': 'ヤマダ',
      '#firstname_kana': 'タロウ',
      '#birthdate': '1999-04-01',
      '#phone_number': '090-1234-5678',
      '#postal_code': '150-0041',
      '#email_address': 'taro@example.com',
      '#school_name': 'サンプル大学',
      '#faculty_name': '経済学部',
    },
  },
  {
    name: 'L-54 label[for] の見出しが表の別の行（見出しの行と欄の行が交互・for で紐づけ）',
    html: `<form><table>${rows(BASE, (f) =>
      f.kind === 'radio'
        ? `<tr><th>${f.label}</th></tr><tr><td>${ctl(f)}</td></tr>`
        : `<tr><th><label for="${f.n}">${f.label}</label></th></tr><tr><td>${ctl(f)}</td></tr>`,
    )}</table></form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-55 aria-labelledby が表の見出しセル（role="grid" 風の表）',
    html: `<form><table role="presentation">${rows(BASE, (f) =>
      f.kind === 'radio'
        ? `<tr><td id="c${f.n}" class="th">${f.label}</td><td><div role="radiogroup" aria-labelledby="c${f.n}">${ctl(f)}</div></td></tr>`
        : `<tr><td id="c${f.n}" class="th">${f.label}</td><td>${ctl(f, `aria-labelledby="c${f.n}"`)}</td></tr>`,
    )}</table></form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-56 見出しは th、td の中に「姓」「名」「セイ」「メイ」の小見出し（span と label[for] が混在）',
    html: `<form><table>
      <tr><th>氏名</th><td><span>姓</span><input name="s1" size="10"><label for="s2x">名</label><input id="s2x" name="s2" size="10"></td></tr>
      <tr><th>フリガナ</th><td><label for="s3x">セイ</label><input id="s3x" name="s3" size="10"><span>メイ</span><input name="s4" size="10"></td></tr>
      <tr><th>電話番号</th><td><input name="s5"></td></tr>
    </table></form>`,
    expect: { '[name=s1]': '山田', '[name=s2]': '太郎', '[name=s3]': 'ヤマダ', '[name=s4]': 'タロウ', '[name=s5]': '090-1234-5678' },
  },
  {
    name: 'L-57 label[for] と aria-label が両方あり、aria-label は汎用の文字（「入力欄」「テキスト」）',
    html: `<form>${rows(BASE, (f) =>
      f.kind === 'radio'
        ? `<div class="row"><span>${f.label}</span>${ctl(f)}</div>`
        : `<div class="row"><label for="${f.n}">${f.label}</label>${ctl(f, 'aria-label="入力欄"')}</div>`,
    )}</form>`,
    expect: expectOf(BASE),
  },
  {
    name: 'L-58 見出しが表の左の列、欄は右の列の中の dl（th＋dt の2段）',
    html: `<form><table>
      <tr><th>氏名</th><td><dl><dt>漢字</dt><dd><input name="q01"></dd><dt>フリガナ</dt><dd><input name="q02"></dd></dl></td></tr>
      <tr><th>連絡先</th><td><dl><dt>電話番号</dt><dd><input name="q05"></dd><dt>メールアドレス</dt><dd><input name="q08"></dd></dl></td></tr>
      <tr><th>住所</th><td><dl><dt>郵便番号</dt><dd><input name="q06"></dd><dt>住所</dt><dd><input name="q07" size="40"></dd></dl></td></tr>
    </table></form>`,
    expect: expectOf(BASE.filter((f) => ['q01', 'q02', 'q05', 'q06', 'q07', 'q08'].includes(f.n))),
  },
];
