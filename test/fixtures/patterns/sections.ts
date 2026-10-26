import { PREFECTURES } from '../../../lib/prefectures';
import type { Profile } from '../../../lib/types';
import type { Case } from '../cases';

/**
 * 区切り（セクション）の文脈。「氏名」「電話番号」「住所」「郵便番号」の見た目は同じでも、
 * 本人・帰省先・保護者・緊急連絡先・勤務先などのどれに当たるかを、いろいろな DOM の区切り方で確かめる。
 */

const opts = (items: (string | [string, string])[], empty = '選択してください') =>
  [`<option value="">${empty}</option>`, ...items.map((o) => (Array.isArray(o) ? `<option value="${o[0]}">${o[1]}</option>` : `<option>${o}</option>`))].join('');

/** 帰省先が別の住所 */
const K: Partial<Profile> = {
  kiseiSame: false,
  kiseiPostalCode: '530-0001',
  kiseiPrefecture: '福島県',
  kiseiCity: '大阪市北区',
  kiseiAddressLine: '梅田1-2-3',
  kiseiPhone: '06-1234-5678',
};
/** 緊急連絡先が登録済み */
const E: Partial<Profile> = { emergencyName: '山田花子', emergencyRelation: '母', emergencyPhone: '03-9876-5432' };

const CUR_ADDR = '東京都渋谷区神南1-2-3　サンプルマンション101';
const KISEI_ADDR = '福島県大阪市北区梅田1-2-3';

const row = (th: string, td: string) => `<tr><th>${th}</th><td>${td}</td></tr>`;
/** 郵便番号・住所・電話番号の3行（p は name の頭） */
const rows3 = (p: string) => row('郵便番号', `<input name="${p}z">`) + row('住所', `<input name="${p}a" size="40">`) + row('電話番号', `<input name="${p}t">`);
const table3 = (p: string) => `<table>${rows3(p)}</table>`;
const cur = (p: string) => ({ [`[name=${p}z]`]: '150-0041', [`[name=${p}a]`]: CUR_ADDR, [`[name=${p}t]`]: '090-1234-5678' });
const kisei = (p: string) => ({ [`[name=${p}z]`]: '530-0001', [`[name=${p}a]`]: KISEI_ADDR, [`[name=${p}t]`]: '06-1234-5678' });
const none = (p: string) => ({ [`[name=${p}z]`]: '', [`[name=${p}a]`]: '', [`[name=${p}t]`]: '' });

/** 現住所の区切りと帰省先の区切りを、見出しの書き方だけ変えて並べる */
const twoSections = (name: string, head: (title: string) => string): Case => ({
  name,
  html: `<form>${head('現住所')}${table3('c')}${head('帰省先')}${table3('k')}</form>`,
  profile: K,
  expect: { ...cur('c'), ...kisei('k') },
});

/** 「帰省先が現住所と同じか」をプルダウン・ラジオで聞く形 */
const sameSelect = (p: string) =>
  `<select name="${p}">${opts(['現住所と同じ', '現住所と異なる'])}</select>`;

export const CASES: Case[] = [
  // ---- 見出しの DOM の違い ----
  twoSections('X-S01 h4 の見出し', (t) => `<h4>${t}</h4>`),
  twoSections('X-S02 div.title の見出し', (t) => `<div class="title">${t}</div>`),
  twoSections('X-S03 p.heading の見出し', (t) => `<p class="heading">${t}</p>`),
  twoSections('X-S04 クラスのない strong だけの見出し', (t) => `<strong>${t}</strong>`),
  {
    name: 'X-S05 table の caption が見出し',
    html: `<form><table><caption>現住所</caption>${rows3('c')}</table><table><caption>帰省先</caption>${rows3('k')}</table></form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S06 1つの大きな表の中の th[colspan] 行が区切り',
    html: `<form><table>
      <tr><th colspan="2">現住所</th></tr>${rows3('c')}
      <tr><th colspan="2">帰省先</th></tr>${rows3('k')}
    </table></form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S07 区切りの行から数行離れた欄（都道府県・市区町村・番地・建物・注意書き・電話）',
    html: `<form><table>
      <tr><th colspan="2">現住所</th></tr>
      ${row('郵便番号', '<input name="cz">')}${row('都道府県', `<select name="cp">${opts(PREFECTURES)}</select>`)}
      ${row('市区町村', '<input name="cc">')}${row('番地', '<input name="cl">')}${row('建物名', '<input name="cb">')}
      ${row('電話番号', '<input name="ct">')}
      <tr><th colspan="2">帰省先</th></tr>
      ${row('郵便番号', '<input name="kz">')}${row('都道府県', `<select name="kp">${opts(PREFECTURES)}</select>`)}
      ${row('市区町村', '<input name="kc">')}${row('番地', '<input name="kl">')}${row('建物名', '<input name="kb">')}
      <tr><td colspan="2">※固定電話がない場合は携帯電話をご入力ください</td></tr>
      ${row('電話番号', '<input name="kt">')}
    </table></form>`,
    profile: K,
    expect: {
      '[name=cz]': '150-0041', '[name=cp]': '東京都', '[name=cc]': '渋谷区', '[name=cl]': '神南1-2-3', '[name=cb]': 'サンプルマンション101', '[name=ct]': '090-1234-5678',
      '[name=kz]': '530-0001', '[name=kp]': '福島県', '[name=kc]': '大阪市北区', '[name=kl]': '梅田1-2-3', '[name=kb]': '', '[name=kt]': '06-1234-5678',
    },
  },
  {
    name: 'X-S08 fieldset / legend（欄は label で包む）',
    html: `<form>
      <fieldset><legend>現住所</legend><label>郵便番号 <input name="cz"></label><label>住所 <input name="ca" size="40"></label><label>電話番号 <input name="ct"></label></fieldset>
      <fieldset><legend>帰省先</legend><label>郵便番号 <input name="kz"></label><label>住所 <input name="ka" size="40"></label><label>電話番号 <input name="kt"></label></fieldset>
    </form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S09 fieldset / legend の中に th の表',
    html: `<form><fieldset><legend>現住所</legend>${table3('c')}</fieldset><fieldset><legend>帰省先</legend>${table3('k')}</fieldset></form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S10 タブ（role=tablist）：帰省先のタブが開いていて、現住所のパネルは隠れている',
    html: `<form>
      <div role="tablist"><button type="button" role="tab" id="t1" aria-controls="p1" aria-selected="false">現住所</button><button type="button" role="tab" id="t2" aria-controls="p2" aria-selected="true">帰省先</button></div>
      <div role="tabpanel" id="p1" aria-labelledby="t1" hidden>${table3('c')}</div>
      <div role="tabpanel" id="p2" aria-labelledby="t2">${table3('k')}</div>
    </form>`,
    profile: K,
    expect: { ...none('c'), ...kisei('k') },
  },
  {
    name: 'X-S11 タブ（role=tablist）：現住所のタブが開いていて、帰省先のパネルは隠れている',
    html: `<form>
      <div role="tablist"><button type="button" role="tab" id="t1" aria-controls="p1" aria-selected="true">現住所</button><button type="button" role="tab" id="t2" aria-controls="p2" aria-selected="false">帰省先</button></div>
      <div role="tabpanel" id="p1" aria-labelledby="t1">${table3('c')}</div>
      <div role="tabpanel" id="p2" aria-labelledby="t2" hidden>${table3('k')}</div>
    </form>`,
    profile: K,
    expect: { ...cur('c'), ...none('k') },
  },
  {
    name: 'X-S12 アコーディオン（details / summary）：帰省先が開いている',
    html: `<form><details open><summary>現住所</summary>${table3('c')}</details><details open><summary>帰省先</summary>${table3('k')}</details></form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S13 アコーディオン（details / summary）：帰省先は閉じている',
    html: `<form><details open><summary>現住所</summary>${table3('c')}</details><details><summary>帰省先</summary>${table3('k')}</details></form>`,
    profile: K,
    expect: { ...cur('c'), ...none('k') },
  },
  {
    name: 'X-S14 Bootstrap の card-header',
    html: `<form>
      <div class="card"><div class="card-header">現住所</div><div class="card-body">${table3('c')}</div></div>
      <div class="card"><div class="card-header">帰省先</div><div class="card-body">${table3('k')}</div></div>
    </form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S15 Bootstrap のアコーディオン（card-header の中が開閉ボタン）',
    html: `<form>
      <div class="card"><div class="card-header"><button type="button" class="btn btn-link">現住所</button></div><div class="collapse show"><div class="card-body">${table3('c')}</div></div></div>
      <div class="card"><div class="card-header"><button type="button" class="btn btn-link">帰省先</button></div><div class="collapse show"><div class="card-body">${table3('k')}</div></div></div>
    </form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  twoSections('X-S16 番号付きの見出し（「1. 現住所」「2. 帰省先」）', (t) => `<h3>${t === '現住所' ? '1.' : '2.'} ${t}</h3>`),
  twoSections('X-S16b 記号付きの div 見出し（■帰省先情報）', (t) => `<div>■${t}情報</div>`),
  {
    name: 'X-S17 見出しが画像（img の alt だけ）',
    html: `<form><h3><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="現住所" width="80" height="20"></h3>${table3('c')}<h3><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="帰省先" width="80" height="20"></h3>${table3('k')}</form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S18 見出しが、欄の表の手前にある別の1セルの表',
    html: `<form>
      <table><tr><td><b>現住所</b></td></tr></table>${table3('c')}
      <table><tr><td><b>帰省先</b></td></tr></table>${table3('k')}
    </form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S19 見出しの文字が CSS（::before）だけ',
    html: `<form><style>.sec-c::before{content:"現住所"}.sec-k::before{content:"帰省先"}</style>
      <div class="sec-c"></div>${table3('c')}<div class="sec-k"></div>${table3('k')}</form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S20 見出しが表の thead の行',
    html: `<form>
      <table><thead><tr><th colspan="2">現住所</th></tr></thead><tbody>${rows3('c')}</tbody></table>
      <table><thead><tr><th colspan="2">帰省先</th></tr></thead><tbody>${rows3('k')}</tbody></table>
    </form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S21 見出しの中に「現住所をコピー」ボタン',
    html: `<form><h3>現住所</h3>${table3('c')}<h3>帰省先 <button type="button" id="copy">現住所をコピー</button></h3>${table3('k')}</form>`,
    profile: K,
    setup(root) {
      root.querySelector('#copy')!.addEventListener('click', () => {
        for (const s of ['z', 'a', 't']) (root.querySelector(`[name=k${s}]`) as HTMLInputElement).value = (root.querySelector(`[name=c${s}]`) as HTMLInputElement).value;
      });
    },
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S22 左の列の rowspan の th が区切り（現住所・帰省先）',
    html: `<form><table>
      <tr><th rowspan="3">現住所</th><th>郵便番号</th><td><input name="cz"></td></tr>
      <tr><th>住所</th><td><input name="ca" size="40"></td></tr>
      <tr><th>電話番号</th><td><input name="ct"></td></tr>
      <tr><th rowspan="3">帰省先</th><th>郵便番号</th><td><input name="kz"></td></tr>
      <tr><th>住所</th><td><input name="ka" size="40"></td></tr>
      <tr><th>電話番号</th><td><input name="kt"></td></tr>
    </table></form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S23 左の列の rowspan の th が区切り（本人・保護者）',
    html: `<form><table>
      <tr><th rowspan="2">本人</th><th>氏名</th><td><input name="sn"></td></tr>
      <tr><th>携帯電話</th><td><input name="st"></td></tr>
      <tr><th rowspan="4">保護者</th><th>氏名</th><td><input name="gn"></td></tr>
      <tr><th>携帯電話</th><td><input name="gt"></td></tr>
      <tr><th>郵便番号</th><td><input name="gz"></td></tr>
      <tr><th>住所</th><td><input name="ga" size="40"></td></tr>
    </table></form>`,
    expect: { '[name=sn]': '山田　太郎', '[name=st]': '090-1234-5678', '[name=gn]': '', '[name=gt]': '', '[name=gz]': '', '[name=ga]': '' },
  },
  {
    name: 'X-S24 左の列の rowspan の th が区切り（緊急連絡先・登録済み）',
    html: `<form><table>
      <tr><th>氏名</th><td colspan="2"><input name="sn"></td></tr>
      <tr><th rowspan="4">緊急連絡先</th><th>氏名</th><td><input name="en"></td></tr>
      <tr><th>続柄</th><td><input name="er"></td></tr>
      <tr><th>電話番号</th><td><input name="et"></td></tr>
      <tr><th>住所</th><td><input name="ea" size="40"></td></tr>
    </table></form>`,
    profile: E,
    expect: { '[name=sn]': '山田　太郎', '[name=en]': '山田花子', '[name=er]': '母', '[name=et]': '03-9876-5432', '[name=ea]': '' },
  },
  {
    name: 'X-S25 ul / li の形（見出しの li の中に h3）',
    html: `<form><ul>
      <li><h3>現住所</h3></li><li>郵便番号 <input name="cz"></li><li>住所 <input name="ca" size="40"></li><li>電話番号 <input name="ct"></li>
      <li><h3>帰省先</h3></li><li>郵便番号 <input name="kz"></li><li>住所 <input name="ka" size="40"></li><li>電話番号 <input name="kt"></li>
    </ul></form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S26 見出しが section の aria-label だけ',
    html: `<form><section aria-label="現住所">${table3('c')}</section><section aria-label="帰省先">${table3('k')}</section></form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S27 見出しと表のあいだに短い説明文（「入力は任意です」）',
    html: `<form><h3>現住所</h3>${table3('c')}<h3>帰省先</h3><p>入力は任意です</p>${table3('k')}</form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S28 div の行（ラベルの div・欄の div）が h3 の見出しの下に並ぶ',
    html: `<form>
      <h3>現住所</h3>
      <div class="form-row"><div class="form-label">郵便番号</div><div class="form-input"><input name="cz"></div></div>
      <div class="form-row"><div class="form-label">住所</div><div class="form-input"><input name="ca" size="40"></div></div>
      <div class="form-row"><div class="form-label">電話番号</div><div class="form-input"><input name="ct"></div></div>
      <h3>帰省先</h3>
      <div class="form-row"><div class="form-label">郵便番号</div><div class="form-input"><input name="kz"></div></div>
      <div class="form-row"><div class="form-label">住所</div><div class="form-input"><input name="ka" size="40"></div></div>
      <div class="form-row"><div class="form-label">電話番号</div><div class="form-input"><input name="kt"></div></div>
    </form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S29 Bootstrap の form-group（for のない label）が h3 の見出しの下に並ぶ',
    html: `<form>
      <h3>現住所</h3>
      <div class="form-group"><label class="col-form-label">郵便番号</label><input class="form-control" name="cz"></div>
      <div class="form-group"><label class="col-form-label">住所</label><input class="form-control" name="ca" size="40"></div>
      <div class="form-group"><label class="col-form-label">電話番号</label><input class="form-control" name="ct"></div>
      <h3>帰省先</h3>
      <div class="form-group"><label class="col-form-label">郵便番号</label><input class="form-control" name="kz"></div>
      <div class="form-group"><label class="col-form-label">住所</label><input class="form-control" name="ka" size="40"></div>
      <div class="form-group"><label class="col-form-label">電話番号</label><input class="form-control" name="kt"></div>
    </form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-S30 2列のレイアウト（左の列に見出し、右の列に欄）',
    html: `<form>
      <div class="row"><div class="col-3"><h4>現住所</h4></div><div class="col-9">${table3('c')}</div></div>
      <div class="row"><div class="col-3"><h4>帰省先</h4></div><div class="col-9">${table3('k')}</div></div>
    </form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },

  // ---- 帰省先の言い回し ----
  twoSections('X-W01 「休暇期間中の連絡先」', (t) => `<h3>${t === '帰省先' ? '休暇期間中の連絡先' : t}</h3>`),
  twoSections('X-W02 「長期休暇時の住所」', (t) => `<div class="title">${t === '帰省先' ? '長期休暇時の住所' : t}</div>`),
  twoSections('X-W03 「長期休暇中の住所」', (t) => `<h3>${t === '帰省先' ? '長期休暇中の住所' : t}</h3>`),
  twoSections('X-W04 「実家」', (t) => `<h3>${t === '帰省先' ? '実家' : t}</h3>`),
  twoSections('X-W05 「帰郷先」', (t) => `<h3>${t === '帰省先' ? '帰郷先' : t}</h3>`),

  // ---- 本人以外の人・本人以外の住所 ----
  {
    name: 'X-P01 保護者の区切り：郵便番号・都道府県・住所・電話番号にも本人の情報を入れない',
    html: `<form>
      <h3>本人</h3><table>${row('氏名', '<input name="sn">')}${row('郵便番号', '<input name="sz">')}</table>
      <h3>保護者</h3><table>
        ${row('氏名', '<input name="gn">')}${row('郵便番号', '<input name="gz">')}
        ${row('都道府県', `<select name="gp">${opts(PREFECTURES)}</select>`)}${row('市区町村', '<input name="gc">')}
        ${row('住所', '<input name="ga" size="40">')}${row('電話番号', '<input name="gt">')}
      </table></form>`,
    expect: { '[name=sn]': '山田　太郎', '[name=sz]': '150-0041', '[name=gn]': '', '[name=gz]': '', '[name=gp]': '', '[name=gc]': '', '[name=ga]': '', '[name=gt]': '' },
  },
  {
    name: 'X-P02 保証人の区切り（caption）',
    html: `<form><table><caption>保証人</caption>${row('氏名', '<input name="gn">')}${row('フリガナ', '<input name="gk">')}${row('郵便番号', '<input name="gz">')}${row('住所', '<input name="ga" size="40">')}</table></form>`,
    expect: { '[name=gn]': '', '[name=gk]': '', '[name=gz]': '', '[name=ga]': '' },
  },
  {
    name: 'X-P03 家族構成の表（氏名・続柄・年齢の列）には何も入れない',
    html: `<form><h3>家族構成</h3><table>
      <tr><th>氏名</th><th>続柄</th><th>年齢</th></tr>
      <tr><td><input name="f1n"></td><td><input name="f1r"></td><td><input name="f1a" size="3"></td></tr>
      <tr><td><input name="f2n"></td><td><input name="f2r"></td><td><input name="f2a" size="3"></td></tr>
    </table></form>`,
    profile: E,
    expect: { '[name=f1n]': '', '[name=f1r]': '', '[name=f1a]': '', '[name=f2n]': '', '[name=f2r]': '', '[name=f2a]': '' },
  },
  {
    name: 'X-P04 推薦者の fieldset（label で包んだ欄）',
    html: `<form><fieldset><legend>推薦者</legend>
      <label>氏名 <input name="rn"></label><label>所属 <input name="ro"></label><label>電話番号 <input name="rt"></label><label>メールアドレス <input name="rm"></label>
    </fieldset></form>`,
    expect: { '[name=rn]': '', '[name=ro]': '', '[name=rt]': '', '[name=rm]': '' },
  },
  {
    name: 'X-P05 紹介者の区切り（div.title）',
    html: `<form><div class="title">紹介者</div><table>${row('社員番号', '<input name="rid">')}${row('氏名', '<input name="rn">')}${row('部署', '<input name="rd">')}</table></form>`,
    expect: { '[name=rid]': '', '[name=rn]': '', '[name=rd]': '' },
  },
  {
    name: 'X-P06 勤務先の区切り：会社名だけ入れ、郵便番号・住所・電話番号には本人の情報を入れない',
    html: `<form><h3>勤務先</h3><table>
      ${row('会社名', '<input name="wn">')}${row('郵便番号', '<input name="wz">')}${row('住所', '<input name="wa" size="40">')}${row('電話番号', '<input name="wt">')}
    </table></form>`,
    profile: { currentCompany: 'サンプル商事' },
    expect: { '[name=wn]': 'サンプル商事', '[name=wz]': '', '[name=wa]': '', '[name=wt]': '' },
  },
  {
    name: 'X-P07 「勤務先電話番号」「勤務先住所」の行見出しに会社名・本人の住所を入れない',
    html: `<form><table>${row('勤務先名', '<input name="wn">')}${row('勤務先住所', '<input name="wa" size="40">')}${row('勤務先電話番号', '<input name="wt">')}</table></form>`,
    profile: { currentCompany: 'サンプル商事' },
    expect: { '[name=wn]': 'サンプル商事', '[name=wa]': '', '[name=wt]': '' },
  },
  {
    name: 'X-P08 「学校所在地」の文字欄に本人の住所を入れない（都道府県のプルダウンは学校の所在地）',
    html: `<form><table>
      ${row('学校名', '<input name="sc">')}
      ${row('学校所在地（都道府県）', `<select name="sp">${opts(PREFECTURES)}</select>`)}
      ${row('学校所在地', '<input name="sa" size="40">')}
    </table></form>`,
    expect: { '[name=sc]': 'サンプル大学', '[name=sp]': '東京都', '[name=sa]': '' },
  },
  {
    name: 'X-P09 「在籍学校」の区切りの郵便番号・所在地・電話番号に本人の情報を入れない',
    html: `<form><h3>在籍学校</h3><table>
      ${row('学校名', '<input name="sc">')}${row('郵便番号', '<input name="sz">')}${row('所在地', '<input name="sa" size="40">')}${row('電話番号', '<input name="st">')}
    </table></form>`,
    expect: { '[name=sc]': 'サンプル大学', '[name=sz]': '', '[name=sa]': '', '[name=st]': '' },
  },
  {
    name: 'X-P10 「前職」の区切りの会社名に現在の勤務先を入れない',
    html: `<form>
      <h3>現在の勤務先</h3><table>${row('会社名', '<input name="cn">')}</table>
      <h3>前職</h3><table>${row('会社名', '<input name="pn">')}${row('在籍期間', '<input name="pp">')}</table>
    </form>`,
    profile: { currentCompany: 'サンプル商事' },
    expect: { '[name=cn]': 'サンプル商事', '[name=pn]': '', '[name=pp]': '' },
  },
  {
    name: 'X-P11 同じ表の中の「携帯電話（本人）」「携帯電話（保護者）」「緊急連絡先電話番号」',
    html: `<form><table>
      ${row('携帯電話（本人）', '<input name="st">')}
      ${row('携帯電話（保護者）', '<input name="gt">')}
      ${row('保護者氏名', '<input name="gn">')}
      ${row('緊急連絡先電話番号', '<input name="et">')}
    </table></form>`,
    profile: E,
    expect: { '[name=st]': '090-1234-5678', '[name=gt]': '', '[name=gn]': '', '[name=et]': '03-9876-5432' },
  },
  {
    name: 'X-P12 緊急時連絡先（th[colspan] の区切り）・登録済み',
    html: `<form><table>
      <tr><th colspan="2">本人連絡先</th></tr>${row('電話番号', '<input name="st">')}
      <tr><th colspan="2">緊急時連絡先</th></tr>${row('氏名', '<input name="en">')}${row('続柄', '<input name="er">')}${row('電話番号', '<input name="et">')}${row('郵便番号', '<input name="ez">')}
    </table></form>`,
    profile: E,
    expect: { '[name=st]': '090-1234-5678', '[name=en]': '山田花子', '[name=er]': '母', '[name=et]': '03-9876-5432', '[name=ez]': '' },
  },
  {
    name: 'X-P13 緊急時連絡先（未登録なら空のまま）・div.title の区切り',
    html: `<form><div class="title">緊急時連絡先</div><table>${row('氏名', '<input name="en">')}${row('続柄', '<input name="er">')}${row('電話番号', '<input name="et">')}</table></form>`,
    expect: { '[name=en]': '', '[name=er]': '', '[name=et]': '' },
  },
  {
    name: 'X-P14 「非常時の連絡先」の区切り（登録済み）',
    html: `<form><h3>非常時の連絡先</h3><table>${row('氏名', '<input name="en">')}${row('続柄', '<input name="er">')}${row('電話番号', '<input name="et">')}${row('住所', '<input name="ea" size="40">')}</table></form>`,
    profile: E,
    expect: { '[name=en]': '山田花子', '[name=er]': '母', '[name=et]': '03-9876-5432', '[name=ea]': '' },
  },
  {
    name: 'X-P15 英語：Emergency Contact（Name / Relationship / Phone）',
    html: `<form><h3>Emergency Contact</h3>
      <label>Name <input name="en"></label><label>Relationship <input name="er"></label><label>Phone <input name="et"></label>
    </form>`,
    profile: E,
    expect: { '[name=en]': '山田花子', '[name=er]': '母', '[name=et]': '03-9876-5432' },
  },
  {
    name: 'X-P16 英語：Current Address / Permanent Address',
    html: `<form>
      <h3>Current Address</h3><label>Postal code <input name="cz"></label><label>Address <input name="ca" size="40"></label><label>Phone <input name="ct"></label>
      <h3>Permanent Address</h3><label>Postal code <input name="kz"></label><label>Address <input name="ka" size="40"></label><label>Phone <input name="kt"></label>
    </form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },
  {
    name: 'X-P17 英語：Address during vacation',
    html: `<form>
      <h3>Current Address</h3><label>Postal code <input name="cz"></label><label>Address <input name="ca" size="40"></label><label>Phone <input name="ct"></label>
      <h3>Address during vacation</h3><label>Postal code <input name="kz"></label><label>Address <input name="ka" size="40"></label><label>Phone <input name="kt"></label>
    </form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k') },
  },

  // ---- 「現住所と同じ」の色々な形 ----
  {
    name: 'X-C01 「現住所と同じ」チェックが帰省先の欄の後ろ（同じ）',
    html: `<form><h3>現住所</h3>${table3('c')}<h3>帰省先</h3>${table3('k')}<label><input type="checkbox" name="same"> 現住所と同じ</label></form>`,
    expect: { ...cur('c'), ...none('k'), '[name=same]': true },
  },
  {
    name: 'X-C02 「現住所と同じ」チェックが帰省先の欄の後ろ（別の住所）',
    html: `<form><h3>現住所</h3>${table3('c')}<h3>帰省先</h3>${table3('k')}<label><input type="checkbox" name="same"> 現住所と同じ</label></form>`,
    profile: K,
    expect: { ...cur('c'), ...kisei('k'), '[name=same]': false },
  },
  {
    name: 'X-C03 「現住所と異なる場合はチェック」（意味が逆）・同じなら触らない',
    html: `<form><h3>現住所</h3>${table3('c')}<h3>帰省先</h3>
      <label><input type="checkbox" name="diff"> 帰省先が現住所と異なる場合はチェックしてください</label>
      <div id="kb" style="display:none">${table3('k')}</div></form>`,
    setup(root) {
      const cb = root.querySelector<HTMLInputElement>('[name=diff]')!;
      cb.addEventListener('change', () => (root.querySelector<HTMLElement>('#kb')!.style.display = cb.checked ? '' : 'none'));
    },
    expect: { ...cur('c'), ...none('k'), '[name=diff]': false },
  },
  {
    name: 'X-C04 「現住所と異なる場合はチェック」（意味が逆）・別の住所ならチェックして帰省先を入れる',
    html: `<form><h3>現住所</h3>${table3('c')}<h3>帰省先</h3>
      <label><input type="checkbox" name="diff"> 帰省先が現住所と異なる場合はチェックしてください</label>
      <div id="kb" style="display:none">${table3('k')}</div></form>`,
    setup(root) {
      const cb = root.querySelector<HTMLInputElement>('[name=diff]')!;
      cb.addEventListener('change', () => (root.querySelector<HTMLElement>('#kb')!.style.display = cb.checked ? '' : 'none'));
    },
    profile: K,
    expect: { ...cur('c'), ...kisei('k'), '[name=diff]': true },
  },
  {
    name: 'X-C05 「現住所と同じ／異なる」のプルダウン（同じ）',
    html: `<form><h3>現住所</h3>${table3('c')}<h3>帰省先</h3><table>${row('帰省先住所', sameSelect('sel'))}</table>${table3('k')}</form>`,
    expect: { ...cur('c'), '[name=sel]': '現住所と同じ', ...none('k') },
  },
  {
    name: 'X-C06 「現住所と同じ／異なる」のプルダウン（別の住所）',
    html: `<form><h3>現住所</h3>${table3('c')}<h3>帰省先</h3><table>${row('帰省先住所', sameSelect('sel'))}</table>${table3('k')}</form>`,
    profile: K,
    expect: { ...cur('c'), '[name=sel]': '現住所と異なる', ...kisei('k') },
  },
  {
    name: 'X-C07 「同じ／別の住所」のラジオ（別の住所）',
    html: `<form><h3>現住所</h3>${table3('c')}<h3>帰省先</h3><table>
      ${row('帰省先', '<label><input type="radio" name="rs" value="1">現住所と同じ</label><label><input type="radio" name="rs" value="2">別の住所を入力</label>')}
    </table>${table3('k')}</form>`,
    profile: K,
    expect: { ...cur('c'), 'radio:rs': '別の住所を入力', ...kisei('k') },
  },
  {
    name: 'X-C08 最初からチェックの入った「現住所と同じ」（外すと帰省先の欄が出る）・別の住所',
    html: `<form><h3>現住所</h3>${table3('c')}<h3>帰省先</h3>
      <label><input type="checkbox" name="same" checked> 現住所と同じ</label>
      <div id="kb" style="display:none">${table3('k')}</div></form>`,
    setup(root) {
      const cb = root.querySelector<HTMLInputElement>('[name=same]')!;
      cb.addEventListener('change', () => (root.querySelector<HTMLElement>('#kb')!.style.display = cb.checked ? 'none' : ''));
    },
    profile: K,
    expect: { ...cur('c'), ...kisei('k'), '[name=same]': false },
  },
  {
    name: 'X-C09 「現住所をコピー」ボタン（押さない）・チェックなし・同じなら帰省先にも現住所',
    html: `<form><h3>現住所</h3>${table3('c')}<h3>帰省先</h3><p><button type="button" id="copy">現住所をコピー</button></p>${table3('k')}</form>`,
    setup(root) {
      root.querySelector('#copy')!.addEventListener('click', () => {
        for (const s of ['z', 'a', 't']) (root.querySelector(`[name=k${s}]`) as HTMLInputElement).value = (root.querySelector(`[name=c${s}]`) as HTMLInputElement).value;
      });
    },
    expect: { ...cur('c'), '[name=kz]': '150-0041', '[name=ka]': CUR_ADDR, '[name=kt]': '03-1234-5678' },
  },

  // ---- 繰り返しの区切り（学歴・職歴） ----
  {
    name: 'X-R01 学歴の行（高校・大学・大学院の行見出し、セルの中に「学校名」「入学」「卒業」）',
    html: `<form><table>
      <tr><th>高校</th><td>学校名 <input name="hs"></td><td>入学 <input type="month" name="ha"></td><td>卒業 <input type="month" name="hg"></td></tr>
      <tr><th>大学</th><td>学校名 <input name="us"></td><td>入学 <input type="month" name="ua"></td><td>卒業 <input type="month" name="ug"></td></tr>
      <tr><th>大学院</th><td>学校名 <input name="gs"></td><td>入学 <input type="month" name="ga"></td><td>卒業 <input type="month" name="gg"></td></tr>
    </table></form>`,
    profile: { highSchool: 'サンプル高校', highSchoolAdmission: '2019-04', highSchoolGraduation: '2022-03' },
    expect: {
      '[name=hs]': 'サンプル高校', '[name=ha]': '2019-04', '[name=hg]': '2022-03',
      '[name=us]': 'サンプル大学', '[name=ua]': '2022-04', '[name=ug]': '2026-03',
      '[name=gs]': '', '[name=ga]': '', '[name=gg]': '',
    },
  },
  {
    name: 'X-R02 学歴の区切りが h4（高等学校・大学・大学院）、それぞれ同じ形の表',
    html: (() => {
      const t = (p: string) => `<table>${row('学校名', `<input name="${p}s">`)}${row('入学年月', `<input type="month" name="${p}a">`)}${row('卒業年月', `<input type="month" name="${p}g">`)}</table>`;
      return `<form><h4>高等学校</h4>${t('h')}<h4>大学</h4>${t('u')}<h4>大学院</h4>${t('g')}</form>`;
    })(),
    profile: { highSchool: 'サンプル高校', highSchoolAdmission: '2019-04', highSchoolGraduation: '2022-03' },
    expect: {
      '[name=hs]': 'サンプル高校', '[name=ha]': '2019-04', '[name=hg]': '2022-03',
      '[name=us]': 'サンプル大学', '[name=ua]': '2022-04', '[name=ug]': '2026-03',
      '[name=gs]': '', '[name=ga]': '', '[name=gg]': '',
    },
  },
  {
    name: 'X-R03 職歴の行（会社名・入社年月・退社年月・職種）は新卒なら空のまま',
    html: `<form><h3>職歴</h3><table>
      <tr><th></th><th>会社名</th><th>入社年月</th><th>退社年月</th><th>職種</th></tr>
      <tr><th>1</th><td><input name="w1n"></td><td><input type="month" name="w1s"></td><td><input type="month" name="w1e"></td><td><input name="w1j"></td></tr>
      <tr><th>2</th><td><input name="w2n"></td><td><input type="month" name="w2s"></td><td><input type="month" name="w2e"></td><td><input name="w2j"></td></tr>
    </table></form>`,
    profile: { desiredJob: '営業' },
    expect: { '[name=w1n]': '', '[name=w1s]': '', '[name=w1e]': '', '[name=w1j]': '', '[name=w2n]': '', '[name=w2j]': '' },
  },
];
