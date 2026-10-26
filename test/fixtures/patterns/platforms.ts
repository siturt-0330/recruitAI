import { PREFECTURES } from '../../../lib/prefectures';
import type { Case } from '../cases';
import { mountCombo } from '../combos';

/**
 * 実在の採用管理システム・フォーム作成サービスの「作り」をまねた応募フォーム。
 * 見た目は似ていても、表（th/td）・dl・div のグリッド・ARIA だけの部品など、HTML の作りがそれぞれ違う。
 * DOM はそのサービスで見たことのある形をできるだけ再現しているが、細部（クラス名・name 属性）は推測を含む。
 */

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const opts = (items: (string | [string, string])[], empty = '選択してください') =>
  [`<option value="">${empty}</option>`, ...items.map((o) => (Array.isArray(o) ? `<option value="${o[0]}">${o[1]}</option>` : `<option>${o}</option>`))].join('');
const pad = (n: number) => String(n).padStart(2, '0');
const JIS = PREFECTURES.map((p, i): [string, string] => [pad(i + 1), p]);
const SCHOOL_TYPES = ['大学院（博士）', '大学院（修士）', '大学', '短期大学', '高等専門学校', '専門学校'];

export const CASES: Case[] = [
  // ---------------------------------------------------------------------------------------------
  // リクナビ（OpenES 風）：th に「必須」バッジ、td の中に「姓」「名」の小さなラベル、現住所は td の中の dl
  (() => {
    const row = (label: string, body: string, req = true) =>
      `<tr><th scope="row"><span class="ts-p-formTable__label">${label}</span>${req ? '<span class="ts-p-mod-badge ts-p-mod-badge--required">必須</span>' : '<span class="ts-p-mod-badge">任意</span>'}</th><td>${body}</td></tr>`;
    const unit = (label: string, input: string) => `<span class="ts-p-formUnit"><span class="ts-p-formUnit__label">${label}</span>${input}</span>`;
    return {
      name: 'P-リクナビ（OpenES 風）：th の必須バッジ・td 内の姓／名ラベル・td 内 dl の現住所・休暇中連絡先チェック・学校検索（読み取り専用）・ES',
      html: `<form id="openes" method="post">
      <h2 class="ts-h-mod-sectionTitle">基本情報</h2>
      <table class="ts-p-formTable"><tbody>
        ${row('氏名（漢字）', `${unit('姓', '<input type="text" name="nameKanjiSei" maxlength="20" class="ts-p-input">')} ${unit('名', '<input type="text" name="nameKanjiMei" maxlength="20" class="ts-p-input">')}<p class="ts-p-note">※外字・機種依存文字は使用できません</p>`)}
        ${row('氏名（カナ）', `${unit('セイ', '<input type="text" name="nameKanaSei" maxlength="20">')} ${unit('メイ', '<input type="text" name="nameKanaMei" maxlength="20">')}<p class="ts-p-note">全角カタカナで入力してください</p>`)}
        ${row('生年月日', `<select name="birthYear">${opts(range(1990, 2008).map(String), '----')}</select>年 <select name="birthMonth">${opts(range(1, 12).map(String), '--')}</select>月 <select name="birthDay">${opts(range(1, 31).map(String), '--')}</select>日`)}
        ${row('性別', '<input type="radio" name="sex" value="1" id="sex1"><label for="sex1">男性</label> <input type="radio" name="sex" value="2" id="sex2"><label for="sex2">女性</label>', false)}
        ${row('現住所', `<dl class="ts-p-addr">
          <dt>郵便番号</dt><dd><input type="text" name="zip1" maxlength="3" size="4">－<input type="text" name="zip2" maxlength="4" size="5"> <button type="button">住所を検索</button></dd>
          <dt>都道府県</dt><dd><select name="prefCd">${opts(JIS)}</select></dd>
          <dt>市区町村</dt><dd><input type="text" name="address1"></dd>
          <dt>番地</dt><dd><input type="text" name="address2"></dd>
          <dt>建物名・部屋番号</dt><dd><input type="text" name="address3"></dd>
        </dl>`)}
        ${row('携帯電話番号', '<input type="tel" name="telMobile" placeholder="例）09012345678">')}
        ${row('自宅電話番号', '<input type="tel" name="telHome" placeholder="例）0312345678">', false)}
        ${row('メールアドレス', '<input type="email" name="mail1" size="40">')}
        ${row('メールアドレス（確認用）', '<input type="email" name="mail1Conf" size="40">')}
        ${row('携帯メールアドレス', '<input type="email" name="mail2" size="40">', false)}
      </tbody></table>
      <h2 class="ts-h-mod-sectionTitle">休暇中の連絡先</h2>
      <table class="ts-p-formTable"><tbody>
        ${row('休暇中の連絡先', '<label><input type="checkbox" name="vacSame" value="1"> 現住所と同じ</label>', false)}
        ${row('郵便番号', '<input type="text" name="vacZip1" maxlength="3" size="4">－<input type="text" name="vacZip2" maxlength="4" size="5">', false)}
        ${row('都道府県', `<select name="vacPref">${opts(JIS)}</select>`, false)}
        ${row('住所', '<input type="text" name="vacAddress" size="40">', false)}
        ${row('電話番号', '<input type="tel" name="vacTel">', false)}
      </tbody></table>
      <h2 class="ts-h-mod-sectionTitle">学歴</h2>
      <table class="ts-p-formTable"><tbody>
        ${row('学校区分', `<select name="schoolKbn">${opts(SCHOOL_TYPES)}</select>`)}
        ${row('学校名', '<input type="text" name="schoolNameDisp" readonly size="30"><input type="hidden" name="schoolCd"> <button type="button">学校を検索する</button>')}
        ${row('学部', '<input type="text" name="facultyName">')}
        ${row('学科', '<input type="text" name="departmentName">')}
        ${row('文理区分', '<input type="radio" name="bunri" value="1" id="bunri1"><label for="bunri1">文系</label> <input type="radio" name="bunri" value="2" id="bunri2"><label for="bunri2">理系</label>')}
        ${row('入学年月', `<select name="entYear">${opts(range(2016, 2026).map(String), '----')}</select>年 <select name="entMonth">${opts(range(1, 12).map(String), '--')}</select>月`)}
        ${row('卒業（予定）年月', `<select name="gradYear">${opts(range(2024, 2030).map(String), '----')}</select>年 <select name="gradMonth">${opts(range(1, 12).map(String), '--')}</select>月`)}
        ${row('ゼミ・研究室', '<input type="text" name="zemi">', false)}
      </tbody></table>
      <h2 class="ts-h-mod-sectionTitle">エントリーシート</h2>
      <table class="ts-p-formTable"><tbody>
        ${row('自己PR<br><span>（400文字以内）</span>', '<textarea name="es1" maxlength="400" rows="8"></textarea><p class="ts-p-count">0 / 400文字</p>')}
        ${row('学生時代に最も打ち込んだこと', '<textarea name="es2" rows="8"></textarea>')}
        ${row('趣味・特技', '<input type="text" name="hobby">', false)}
      </tbody></table>
      <button type="submit">確認画面へ</button></form>`,
      expect: {
        '[name=nameKanjiSei]': '山田',
        '[name=nameKanjiMei]': '太郎',
        '[name=nameKanaSei]': 'ヤマダ',
        '[name=nameKanaMei]': 'タロウ',
        '[name=birthYear]': '1999',
        '[name=birthMonth]': '4',
        '[name=birthDay]': '1',
        '#sex1': true,
        '[name=zip1]': '150',
        '[name=zip2]': '0041',
        '[name=prefCd]': '東京都',
        '[name=address1]': '渋谷区',
        '[name=address2]': '神南1-2-3',
        '[name=address3]': 'サンプルマンション101',
        '[name=telMobile]': '09012345678',
        '[name=telHome]': '0312345678',
        '[name=mail1]': 'taro@example.com',
        '[name=mail1Conf]': 'taro@example.com',
        '[name=mail2]': '',
        '[name=vacSame]': true,
        '[name=vacZip1]': '',
        '[name=vacPref]': '',
        '[name=vacAddress]': '',
        '[name=vacTel]': '',
        '[name=schoolKbn]': '大学',
        '[name=schoolNameDisp]': '',
        '[name=facultyName]': '経済学部',
        '[name=departmentName]': '経済学科',
        '#bunri1': true,
        '[name=entYear]': '2022',
        '[name=entMonth]': '4',
        '[name=gradYear]': '2026',
        '[name=gradMonth]': '3',
        '[name=zemi]': '',
        '[name=es1]': '',
        '[name=es2]': '',
        '[name=hobby]': '',
      },
    } satisfies Case;
  })(),

  // ---------------------------------------------------------------------------------------------
  // マイナビ（企業エントリー）：BEM の div グリッド。姓・名が横並びの unit、見えないネイティブのラジオ（clip）、休暇中連絡先の「現住所と同じ」
  (() => {
    const grp = (title: string, body: string, req = true) =>
      `<div class="c-formSection__group"><div class="c-formSection__group__inner"><div class="c-formSection__group__col1"><div class="c-formSection__group__ttl__wrap">${req ? '<p class="c-required-tag">必須</p>' : '<p class="c-optional-tag">任意</p>'}<div class="c-formSection__group__ttl"><p>${title}</p></div></div></div><div class="c-formSection__group__col2">${body}</div></div></div>`;
    const nameUnits = (a: [string, string], b: [string, string]) =>
      `<div class="c-form-unit-name">${[a, b].map(([l, n]) => `<div class="c-form-unit-name__unit"><p class="c-form-unit__txt">${l}</p><input type="text" name="${n}" class="c-form-input-text"><span class="error field-error-msg"></span></div>`).join('')}</div>`;
    const radio = (name: string, items: [string, string][]) =>
      `<div class="c-form-radio-wrap">${items.map(([v, t]) => `<label class="c-form-radio"><input type="radio" name="${name}" value="${v}" class="c-form-radio__input" style="position:absolute;width:1px;height:1px;clip:rect(0 0 0 0);overflow:hidden"><span class="c-form-radio__txt">${t}</span></label>`).join('')}</div>`;
    const sel = (name: string, items: (string | [string, string])[], unitText: string) =>
      `<span class="c-form-select"><select name="${name}" class="c-form-select__body">${opts(items, '選択')}</select></span><span class="c-form-select__unit">${unitText}</span>`;
    return {
      name: 'P-マイナビ（企業エントリー・BEM の div グリッド）：横並びの姓名 unit、clip で隠したラジオ、郵便番号7桁、休暇中連絡先、学校、ES',
      html: `<form method="post" class="c-form">
      <section class="c-formSection"><h2 class="c-formSection__ttl">基本情報</h2>
        ${grp('氏名', nameUnits(['姓', 'data.lastName'], ['名', 'data.firstName']))}
        ${grp('氏名（カナ）', nameUnits(['セイ', 'data.lastNameKana'], ['メイ', 'data.firstNameKana']))}
        ${grp('生年月日', `${sel('data.birthYear', range(1990, 2008).map(String), '年')}${sel('data.birthMonth', range(1, 12).map((m) => [pad(m), String(m)]), '月')}${sel('data.birthDay', range(1, 31).map((d) => [pad(d), String(d)]), '日')}`)}
        ${grp('性別', radio('data.gender', [['1', '男性'], ['2', '女性'], ['9', '回答しない']]), false)}
      </section>
      <section class="c-formSection"><h2 class="c-formSection__ttl">現住所</h2>
        ${grp('郵便番号', '<ul class="c-form-unit"><li><input type="tel" name="data.zipCode" class="c-form-input-text" placeholder="半角数字7桁"><button type="button" class="c-btn">住所検索</button></li></ul>')}
        ${grp('都道府県', `<select name="data.prefecture">${opts(JIS, '選択')}</select>`)}
        ${grp('市区町村', '<input type="text" name="data.address1" class="c-form-input-text" placeholder="例）千代田区">')}
        ${grp('番地', '<input type="text" name="data.address2" class="c-form-input-text" placeholder="例）一ツ橋1-1-1">')}
        ${grp('建物名・部屋番号', '<input type="text" name="data.address3" class="c-form-input-text">', false)}
        ${grp('携帯電話番号', '<input type="tel" name="data.mobilePhone" class="c-form-input-text" placeholder="半角数字（ハイフンなし）">')}
        ${grp('メールアドレス', '<input type="email" name="data.mailAddress" class="c-form-input-text"><p class="c-form-unit__txt">確認のため再度入力してください</p><input type="email" name="data.mailAddressConfirm" class="c-form-input-text">')}
      </section>
      <section class="c-formSection"><h2 class="c-formSection__ttl">休暇中連絡先</h2>
        ${grp('休暇中連絡先', '<label class="c-form-checkbox"><input type="checkbox" name="data.vacationSame" value="true" class="c-form-checkbox__input"><span class="c-form-checkbox__txt">現住所と同じ</span></label>', false)}
        ${grp('郵便番号', '<input type="tel" name="data.vacationZipCode" class="c-form-input-text" placeholder="半角数字7桁">', false)}
        ${grp('都道府県', `<select name="data.vacationPrefecture">${opts(JIS, '選択')}</select>`, false)}
        ${grp('住所', '<input type="text" name="data.vacationAddress" class="c-form-input-text">', false)}
        ${grp('電話番号', '<input type="tel" name="data.vacationPhone" class="c-form-input-text" placeholder="半角数字（ハイフンなし）">', false)}
      </section>
      <section class="c-formSection"><h2 class="c-formSection__ttl">学校情報</h2>
        ${grp('学校種別', `<select name="data.schoolType">${opts(SCHOOL_TYPES, '選択')}</select>`)}
        ${grp('学校名', '<input type="text" name="data.schoolName" class="c-form-input-text">')}
        ${grp('学部・研究科', '<input type="text" name="data.facultyName" class="c-form-input-text">')}
        ${grp('学科・専攻', '<input type="text" name="data.departmentName" class="c-form-input-text">')}
        ${grp('卒業予定年月', `${sel('data.graduateYear', range(2024, 2030).map(String), '年')}${sel('data.graduateMonth', range(1, 12).map((m) => [pad(m), String(m)]), '月')}`)}
      </section>
      <section class="c-formSection"><h2 class="c-formSection__ttl">アンケート</h2>
        ${grp('当社を知ったきっかけ', `<select name="data.q1">${opts(['マイナビ', '合同説明会', '大学のキャリアセンター', 'その他'], '選択')}</select>`, false)}
        ${grp('志望動機（200文字以内）', '<textarea name="data.q2" class="c-form-textarea" rows="6"></textarea>')}
      </section>
      </form>`,
      expect: {
        '[name="data.lastName"]': '山田',
        '[name="data.firstName"]': '太郎',
        '[name="data.lastNameKana"]': 'ヤマダ',
        '[name="data.firstNameKana"]': 'タロウ',
        '[name="data.birthYear"]': '1999',
        '[name="data.birthMonth"]': '04',
        '[name="data.birthDay"]': '01',
        '[name="data.gender"][value="1"]': true,
        '[name="data.zipCode"]': '1500041',
        '[name="data.prefecture"]': '東京都',
        '[name="data.address1"]': '渋谷区',
        '[name="data.address2"]': '神南1-2-3',
        '[name="data.address3"]': 'サンプルマンション101',
        '[name="data.mobilePhone"]': '09012345678',
        '[name="data.mailAddress"]': 'taro@example.com',
        '[name="data.mailAddressConfirm"]': 'taro@example.com',
        '[name="data.vacationSame"]': true,
        '[name="data.vacationZipCode"]': '',
        '[name="data.vacationPrefecture"]': '',
        '[name="data.vacationAddress"]': '',
        '[name="data.vacationPhone"]': '',
        '[name="data.schoolType"]': '大学',
        '[name="data.schoolName"]': 'サンプル大学',
        '[name="data.facultyName"]': '経済学部',
        '[name="data.departmentName"]': '経済学科',
        '[name="data.graduateYear"]': '2026',
        '[name="data.graduateMonth"]': '03',
        '[name="data.q1"]': '',
        '[name="data.q2"]': '',
      },
    } satisfies Case;
  })(),

  // ---------------------------------------------------------------------------------------------
  // e2R 風（ASP.NET WebForms）：ctl00$… の name、RadioButtonList が td の中の入れ子の table、__VIEWSTATE
  (() => {
    const n = (s: string) => `name="ctl00$cphMain$${s}" id="ctl00_cphMain_${s}"`;
    const row = (label: string, body: string, req = true) => `<tr><th class="item">${label}${req ? '<span class="hissu">必須</span>' : ''}</th><td class="input">${body}</td></tr>`;
    const rbl = (id: string, items: [string, string][]) =>
      `<table id="ctl00_cphMain_${id}" class="rbl" border="0"><tbody><tr>${items.map(([v, t], i) => `<td><input id="ctl00_cphMain_${id}_${i}" type="radio" name="ctl00$cphMain$${id}" value="${v}"><label for="ctl00_cphMain_${id}_${i}">${t}</label></td>`).join('')}</tr></tbody></table>`;
    const tel3 = (s: string) => [1, 2, 3].map((i) => `<input type="text" ${n(`${s}${i}`)} maxlength="5" size="5">`).join(' - ');
    return {
      name: 'P-e2R 風（ASP.NET WebForms）：ctl00$ の name、入れ子の table のラジオ（RadioButtonList）、和暦併記の年、自宅・携帯の3分割、携帯メール未登録',
      html: `<form method="post" action="./Entry.aspx" id="aspnetForm">
      <div class="aspNetHidden"><input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="/wEPDwUKLTk"><input type="hidden" name="__EVENTVALIDATION" id="__EVENTVALIDATION" value="/wEdAA"></div>
      <table class="tblEntry"><tbody>
        ${row('氏名', `姓 <input type="text" ${n('txtNameSei')} maxlength="20" size="12"> 名 <input type="text" ${n('txtNameMei')} maxlength="20" size="12">`)}
        ${row('フリガナ', `セイ <input type="text" ${n('txtKanaSei')} maxlength="20" size="12"> メイ <input type="text" ${n('txtKanaMei')} maxlength="20" size="12"><br><span class="note">（全角カナ）</span>`)}
        ${row('生年月日', `<select ${n('ddlBirthYear')}>${opts(range(1990, 2008).map((y) => [String(y), `${y}（平成${y - 1988}）`]), '----')}</select>年 <select ${n('ddlBirthMonth')}>${opts(range(1, 12).map(String), '--')}</select>月 <select ${n('ddlBirthDay')}>${opts(range(1, 31).map(String), '--')}</select>日`)}
        ${row('性別', rbl('rblSex', [['1', '男'], ['2', '女']]))}
        ${row('郵便番号', `<input type="text" ${n('txtZip1')} maxlength="3" size="4"> - <input type="text" ${n('txtZip2')} maxlength="4" size="5"> <input type="submit" name="ctl00$cphMain$btnZip" value="住所検索">`)}
        ${row('都道府県', `<select ${n('ddlPref')}>${opts(PREFECTURES.map((p, i) => [String(i + 1), p]), '選択してください')}</select>`)}
        ${row('住所1<br>（市区町村・番地）', `<input type="text" ${n('txtAddress1')} size="40">`)}
        ${row('住所2<br>（建物名・部屋番号）', `<input type="text" ${n('txtAddress2')} size="40">`, false)}
        ${row('自宅電話番号', tel3('txtTel'), false)}
        ${row('携帯電話番号', tel3('txtMobile'))}
        ${row('PCメールアドレス', `<input type="text" ${n('txtMail')} size="40">`)}
        ${row('PCメールアドレス（確認）', `<input type="text" ${n('txtMailConfirm')} size="40">`)}
        ${row('携帯メールアドレス', `<input type="text" ${n('txtMobileMail')} size="40">`, false)}
        ${row('学校区分', `<select ${n('ddlSchoolKbn')}>${opts(SCHOOL_TYPES)}</select>`)}
        ${row('学校名', `<input type="text" ${n('txtSchoolName')} size="30">`)}
        ${row('学部名', `<input type="text" ${n('txtFaculty')} size="30">`)}
        ${row('学科名', `<input type="text" ${n('txtDepartment')} size="30">`)}
        ${row('文理区分', rbl('rblBunri', [['1', '文系'], ['2', '理系']]))}
        ${row('卒業見込年月', `<select ${n('ddlGradYear')}>${opts(range(2024, 2030).map(String), '----')}</select>年 <select ${n('ddlGradMonth')}>${opts(range(1, 12).map(String), '--')}</select>月`)}
        ${row('パスワード', `<input type="password" ${n('txtPassword')}><br><span class="note">マイページのログインに使用します（半角英数字8文字以上）</span>`)}
        ${row('パスワード（確認）', `<input type="password" ${n('txtPasswordConfirm')}>`)}
      </tbody></table>
      <input type="submit" name="ctl00$cphMain$btnConfirm" value="確認画面へ"></form>`,
      expect: {
        '#ctl00_cphMain_txtNameSei': '山田',
        '#ctl00_cphMain_txtNameMei': '太郎',
        '#ctl00_cphMain_txtKanaSei': 'ヤマダ',
        '#ctl00_cphMain_txtKanaMei': 'タロウ',
        '#ctl00_cphMain_ddlBirthYear': '1999',
        '#ctl00_cphMain_ddlBirthMonth': '4',
        '#ctl00_cphMain_ddlBirthDay': '1',
        '#ctl00_cphMain_rblSex_0': true,
        '#ctl00_cphMain_txtZip1': '150',
        '#ctl00_cphMain_txtZip2': '0041',
        '#ctl00_cphMain_ddlPref': '東京都',
        '#ctl00_cphMain_txtAddress1': '渋谷区神南1-2-3',
        '#ctl00_cphMain_txtAddress2': 'サンプルマンション101',
        '#ctl00_cphMain_txtTel1': '03',
        '#ctl00_cphMain_txtTel2': '1234',
        '#ctl00_cphMain_txtTel3': '5678',
        '#ctl00_cphMain_txtMobile1': '090',
        '#ctl00_cphMain_txtMobile2': '1234',
        '#ctl00_cphMain_txtMobile3': '5678',
        '#ctl00_cphMain_txtMail': 'taro@example.com',
        '#ctl00_cphMain_txtMailConfirm': 'taro@example.com',
        '#ctl00_cphMain_txtMobileMail': '',
        '#ctl00_cphMain_ddlSchoolKbn': '大学',
        '#ctl00_cphMain_txtSchoolName': 'サンプル大学',
        '#ctl00_cphMain_txtFaculty': '経済学部',
        '#ctl00_cphMain_txtDepartment': '経済学科',
        '#ctl00_cphMain_rblBunri_0': true,
        '#ctl00_cphMain_ddlGradYear': '2026',
        '#ctl00_cphMain_ddlGradMonth': '3',
        '#ctl00_cphMain_txtPassword': '',
        '#ctl00_cphMain_txtPasswordConfirm': '',
      },
    } satisfies Case;
  })(),

  // ---------------------------------------------------------------------------------------------
  // MIWS 風：dl の dt／dd、元号のプルダウン＋和暦の年の文字欄、ひらがなのふりがな、自宅・携帯が 1 つの dd、住所のフリガナ
  (() => {
    const item = (label: string, body: string, req = true) => `<dt>${req ? '<span class="required">※</span>' : ''}${label}</dt><dd>${body}</dd>`;
    return {
      name: 'P-MIWS 風（dl）：元号＋和暦の年、ひらがなのふりがな（placeholder の例）、自宅・携帯が 1 つの dd、住所のフリガナ、学年には触らない',
      html: `<form method="post" name="entryForm"><div class="entry_box"><h3 class="ttl_entry">個人情報</h3><dl class="form_dl">
        ${item('氏名', '<input type="text" name="shimei_sei" size="10" placeholder="山田"> <input type="text" name="shimei_mei" size="10" placeholder="花子">')}
        ${item('ふりがな', '<input type="text" name="furigana_sei" size="10" placeholder="やまだ"> <input type="text" name="furigana_mei" size="10" placeholder="はなこ">')}
        ${item('生年月日', `<select name="birth_gengo">${opts(['昭和', '平成', '令和'], '--')}</select> <input type="text" name="birth_nen" size="2" maxlength="2">年 <select name="birth_tsuki">${opts(range(1, 12).map(String), '--')}</select>月 <select name="birth_hi">${opts(range(1, 31).map(String), '--')}</select>日`)}
        ${item('性別', '<label><input type="radio" name="seibetsu" value="M">男</label> <label><input type="radio" name="seibetsu" value="F">女</label>')}
        ${item('郵便番号', '〒<input type="text" name="yubin" size="10" maxlength="8"> <a href="javascript:void(0)" class="btn_zip">住所自動入力</a><br><span class="note">例：123-4567</span>')}
        ${item('都道府県', `<select name="todofuken">${opts(PREFECTURES, '-- 選択 --')}</select>`)}
        ${item('住所', '<input type="text" name="jusho" size="50"><br><span class="note">市区町村・番地・建物名まで入力してください</span>')}
        ${item('住所（フリガナ）', '<input type="text" name="jusho_kana" size="50">', false)}
        ${item('電話番号<br><span class="note">（いずれか必須）</span>', '自宅 <input type="text" name="tel_jitaku" size="15"> 携帯 <input type="text" name="tel_keitai" size="15">')}
        ${item('E-mail', '<input type="text" name="email" size="40">')}
        ${item('E-mail（確認）', '<input type="text" name="email_kakunin" size="40">')}
      </dl></div>
      <div class="entry_box"><h3 class="ttl_entry">学校情報</h3><dl class="form_dl">
        ${item('学校名', '<input type="text" name="gakko_mei" size="30"> 大学')}
        ${item('学部', '<input type="text" name="gakubu" size="20"> 学部')}
        ${item('学科', '<input type="text" name="gakka" size="20"> 学科')}
        ${item('学年', `<select name="gakunen">${opts(['1年', '2年', '3年', '4年', '修士1年', '修士2年'])}</select>`)}
        ${item('卒業予定', `<select name="sotsu_nen">${opts(range(2024, 2030).map((y) => [String(y), `${y}年`]))}</select> <select name="sotsu_tsuki">${opts(range(1, 12).map((m) => [String(m), `${m}月`]))}</select>`)}
      </dl></div></form>`,
      expect: {
        '[name=shimei_sei]': '山田',
        '[name=shimei_mei]': '太郎',
        '[name=furigana_sei]': 'やまだ',
        '[name=furigana_mei]': 'たろう',
        '[name=birth_gengo]': '平成',
        '[name=birth_nen]': '11',
        '[name=birth_tsuki]': '4',
        '[name=birth_hi]': '1',
        'radio:seibetsu': '男',
        '[name=yubin]': '150-0041',
        '[name=todofuken]': '東京都',
        '[name=jusho]': '渋谷区神南1-2-3　サンプルマンション101',
        '[name=jusho_kana]': 'トウキョウトシブヤクジンナン1-2-3',
        '[name=tel_jitaku]': '03-1234-5678',
        '[name=tel_keitai]': '090-1234-5678',
        '[name=email]': 'taro@example.com',
        '[name=email_kakunin]': 'taro@example.com',
        '[name=gakko_mei]': 'サンプル大学',
        '[name=gakubu]': '経済学部',
        '[name=gakka]': '経済学科',
        '[name=gakunen]': '',
        '[name=sotsu_nen]': '2026',
        '[name=sotsu_tsuki]': '3',
      },
    } satisfies Case;
  })(),

  // ---------------------------------------------------------------------------------------------
  // i-web（table.formTable 版、jqTransform を使わない新しめのテンプレート）
  (() => {
    const row = (label: string, body: string, req = true) =>
      `<tr><th>${req ? '<span class="must">必須</span>' : '<span class="any">任意</span>'}${label}</th><td>${body}</td></tr>`;
    const block = (p: string) =>
      row('郵便番号', `<input type="text" name="${p}yubin1" size="3" maxlength="3">-<input type="text" name="${p}yubin2" size="4" maxlength="4"><input type="button" value="住所検索" class="btn_search">`, p === 'g') +
      row('都道府県', `<select name="${p}ken">${opts(JIS, '-▼-')}</select>`, p === 'g') +
      row('市区郡・地名・番地', `<input type="text" name="${p}adrs1" size="40"><p class="hosoku">（全角入力）</p>`, p === 'g') +
      row('マンション・建物名・部屋番号', `<input type="text" name="${p}adrs2" size="40">`, false) +
      row('電話番号', `<input type="text" name="${p}tel1" size="5">-<input type="text" name="${p}tel2" size="5">-<input type="text" name="${p}tel3" size="5">`, p === 'g');
    return {
      name: 'P-i-web（table.formTable 版）：「必須」バッジが th の先頭、漢字・カナの姓名、現住所と休暇中住所が同じ並び（「現住所と同じ」チェック）、携帯は別の行',
      html: `<form name="entryform" method="post"><div class="formArea">
      <h3 class="heading_l2">個人情報</h3>
      <table class="formTable"><tbody>
        ${row('氏名（漢字）', '姓 <input type="text" name="kanjisei" size="10"> 名 <input type="text" name="kanjimei" size="10">')}
        ${row('氏名（カナ）', 'セイ <input type="text" name="kanasei" size="10"> メイ <input type="text" name="kanamei" size="10"><p class="hosoku">（全角カタカナ）</p>')}
        ${row('生年月日', `<select name="ybirth">${opts(range(1990, 2008).map(String), '-▼-')}</select>年<select name="mbirth">${opts(range(1, 12).map((m) => pad(m)), '-▼-')}</select>月<select name="dbirth">${opts(range(1, 31).map((d) => pad(d)), '-▼-')}</select>日`)}
        ${row('性別', '<label><input type="radio" name="sexcd" value="1">男</label><label><input type="radio" name="sexcd" value="2">女</label>')}
        ${row('E-mail', '<input type="text" name="email" size="40">')}
        ${row('E-mail（確認用）', '<input type="text" name="email2" size="40">')}
        ${row('携帯電話番号', '<input type="text" name="keitai1" size="5">-<input type="text" name="keitai2" size="5">-<input type="text" name="keitai3" size="5">')}
      </tbody></table>
      <h3 class="heading_l2">現住所</h3>
      <table class="formTable"><tbody>${block('g')}</tbody></table>
      <h3 class="heading_l2">休暇中住所</h3>
      <p class="hosoku"><label><input type="checkbox" name="adch" value="1">現住所と同じ場合はこちらにチェックしてください</label></p>
      <table class="formTable"><tbody>${block('k')}</tbody></table>
      </div></form>`,
      expect: {
        '[name=kanjisei]': '山田',
        '[name=kanjimei]': '太郎',
        '[name=kanasei]': 'ヤマダ',
        '[name=kanamei]': 'タロウ',
        '[name=ybirth]': '1999',
        '[name=mbirth]': '04',
        '[name=dbirth]': '01',
        '[name=sexcd][value="1"]': true,
        '[name=email]': 'taro@example.com',
        '[name=email2]': 'taro@example.com',
        '[name=keitai1]': '090',
        '[name=keitai2]': '1234',
        '[name=keitai3]': '5678',
        '[name=gyubin1]': '150',
        '[name=gyubin2]': '0041',
        '[name=gken]': '東京都',
        // 行に「（全角入力）」とあるので全角にする
        '[name=gadrs1]': '渋谷区神南１－２－３',
        '[name=gadrs2]': 'サンプルマンション101',
        '[name=gtel1]': '03',
        '[name=gtel2]': '1234',
        '[name=gtel3]': '5678',
        '[name=adch]': true,
        '[name=kyubin1]': '',
        '[name=kken]': '',
        '[name=kadrs1]': '',
        '[name=kadrs2]': '',
        '[name=ktel1]': '',
      },
    } satisfies Case;
  })(),

  // ---------------------------------------------------------------------------------------------
  // sonar（snar.jp）の学歴とアンケート：td.td01 の見出し・tbx_／ddl_／rbt_ の name、「学校検索」、ES の textarea、はい／いいえ
  (() => {
    const row = (key: string, label: string, body: string, required = true) =>
      `<tr><td id="th_${key}" class="td01">${label}${required ? '<span class="required">*</span>' : ''}<input type="hidden" name="hdn_${key}_T" value="${label}"><input type="hidden" name="hdn_${key}" value="${required ? 1 : 0}"></td><td>${body}<p></p></td></tr>`;
    const radios = (name: string, items: string[]) => items.map((t, i) => `<input id="${name}${i + 1}" type="radio" name="${name}" value="${name}${i + 1}"><label for="${name}${i + 1}"> ${t} </label>`).join('');
    return {
      name: 'P-sonar（snar.jp）学歴とアンケート：学校区分・大学名と学校検索・学部・学科・文理・卒業年月、志望動機と自己PR、資格のはい／いいえ、自由記述',
      html: `<form>
      <table class="entryTb"><tbody><tr><th colspan="2">学歴情報</th></tr>
        ${row('gakkokbn', '学校区分', `<select name="ddl_gakkokbn" id="ddl_gakkokbn">${opts(SCHOOL_TYPES, '')}</select>`)}
        ${row('daigaku', '学校名', '<input name="tbx_daigaku" type="text" class="inputL"> <a href="#" class="btnSearch">学校検索</a><p>例）○○大学</p>')}
        ${row('gakubu', '学部名', '<input name="tbx_gakubu" type="text" class="inputL">')}
        ${row('gakka', '学科名', '<input name="tbx_gakka" type="text" class="inputL">')}
        ${row('bunri', '文理区分', radios('rbt_bunri', ['文系', '理系']))}
        ${row('sotsuy', '卒業年月', `<select name="ddl_sotsuyY" id="ddl_sotsuyY">${opts(range(2015, 2030).map(String), '')}</select> 年 <select name="ddl_sotsuyM" id="ddl_sotsuyM">${opts(range(1, 12).map(String), '')}</select> 月`)}
        ${row('zemi', 'ゼミ・研究室名', '<input name="tbx_zemi" type="text" class="inputL">', false)}
      </tbody></table>
      <table class="entryTb"><tbody><tr><th colspan="2"><span class="required">*</span>当社を志望する理由を400字以内で入力してください。</th></tr>
        <tr><td colspan="2"><textarea name="tbx_q1" rows="8" cols="60"></textarea><p class="count">残り400文字</p></td></tr></tbody></table>
      <table class="entryTb"><tbody><tr><th colspan="2"><span class="required">*</span>あなたの強みを教えてください（自己PR）。</th></tr>
        <tr><td colspan="2"><textarea name="tbx_q2" rows="8" cols="60"></textarea></td></tr></tbody></table>
      <table class="entryTb"><tbody><tr><th colspan="2"><span class="required">*</span>普通自動車免許をお持ちですか。</th></tr>
        <tr><td colspan="2">${radios('rbt_q3', ['はい', 'いいえ'])}</td></tr></tbody></table>
      <table class="entryTb"><tbody><tr><th colspan="2">当社の説明会に参加したことがある方は、参加日を入力してください。</th></tr>
        <tr><td colspan="2"><input name="tbx_q4" type="text" class="inputL"></td></tr></tbody></table>
      </form>`,
      expect: {
        '[name=ddl_gakkokbn]': '大学',
        '[name=tbx_daigaku]': 'サンプル大学',
        '[name=tbx_gakubu]': '経済学部',
        '[name=tbx_gakka]': '経済学科',
        '#rbt_bunri1': true,
        '[name=ddl_sotsuyY]': '2026',
        '[name=ddl_sotsuyM]': '3',
        '[name=tbx_zemi]': '',
        '[name=tbx_q1]': '',
        '[name=tbx_q2]': '',
        '#rbt_q31': false,
        '#rbt_q32': false,
        '[name=tbx_q4]': '',
      },
    } satisfies Case;
  })(),

  // ---------------------------------------------------------------------------------------------
  // HRMOS 採用風（Angular Material）：mat-form-field の浮くラベル（label for）、formcontrolname だけで name なし、mat-select（role=combobox）、履歴書の添付
  (() => {
    let seq = 0;
    const field = (label: string, input: (id: string) => string, req = true) => {
      const id = `mat-input-${seq++}`;
      return `<mat-form-field class="mat-mdc-form-field mat-form-field-appearance-outline"><div class="mat-mdc-text-field-wrapper"><div class="mat-mdc-form-field-flex"><div class="mat-mdc-form-field-infix"><label class="mdc-floating-label" for="${id}" id="${id}-label"><mat-label>${label}</mat-label>${req ? '<span aria-hidden="true" class="mat-mdc-form-field-required-marker mdc-floating-label--required"></span>' : ''}</label>${input(id)}</div></div></div><div class="mat-mdc-form-field-subscript-wrapper"></div></mat-form-field>`;
    };
    const text = (fc: string, type = 'text') => (id: string) => `<input matinput class="mat-mdc-input-element" id="${id}" formcontrolname="${fc}" type="${type}"${'' /* name なし */} aria-required="true">`;
    return {
      name: 'P-HRMOS 採用風（Angular Material）：浮くラベル・formcontrolname だけ・mat-select の都道府県・中途の現職欄・履歴書の添付・自由記述',
      html: `<form class="apply-form ng-untouched ng-pristine ng-invalid" novalidate>
        <h2 class="section-title">基本情報</h2>
        <div class="row">${field('姓', text('lastName'))}${field('名', text('firstName'))}</div>
        <div class="row">${field('セイ', text('lastNameKana'))}${field('メイ', text('firstNameKana'))}</div>
        ${field('メールアドレス', text('email', 'email'))}
        ${field('電話番号', text('phoneNumber', 'tel'))}
        ${field('生年月日', text('birthday', 'date'))}
        <div class="combo-row"><div data-combo="hrmosPref"></div></div>
        ${field('市区町村・番地', text('address'))}
        <h2 class="section-title">職務経歴</h2>
        ${field('現在の勤務先', text('currentCompany'), false)}
        ${field('現在の年収（万円）', text('currentSalary', 'number'), false)}
        <div class="file-upload"><p class="file-upload__label">履歴書</p><input type="file" id="resume" formcontrolname="resume" accept=".pdf,.doc,.docx"></div>
        <div class="file-upload"><p class="file-upload__label">職務経歴書</p><input type="file" id="cv" formcontrolname="cv" accept=".pdf,.doc,.docx"></div>
        ${field('LinkedIn / GitHub などの URL', text('url', 'url'), false)}
        ${field('志望動機・メッセージ', (id) => `<textarea matinput class="mat-mdc-input-element" id="${id}" formcontrolname="message" cdktextareaautosize></textarea>`, false)}
        <button mat-flat-button color="primary" type="submit">応募する</button>
      </form>`,
      setup(root) {
        mountCombo(root.querySelector<HTMLElement>('[data-combo="hrmosPref"]')!, { style: 'mui', name: 'hrmosPref', label: '都道府県', options: PREFECTURES, clearable: true });
      },
      expect: {
        '[formcontrolname=lastName]': '山田',
        '[formcontrolname=firstName]': '太郎',
        '[formcontrolname=lastNameKana]': 'ヤマダ',
        '[formcontrolname=firstNameKana]': 'タロウ',
        '[formcontrolname=email]': 'taro@example.com',
        '[formcontrolname=phoneNumber]': '090-1234-5678',
        '[formcontrolname=birthday]': '1999-04-01',
        '[name=hrmosPref]': '東京都',
        '[formcontrolname=address]': '渋谷区神南1-2-3　サンプルマンション101',
        '[formcontrolname=currentCompany]': '',
        '[formcontrolname=currentSalary]': '',
        '[formcontrolname=url]': '',
        '[formcontrolname=message]': '',
      },
    } satisfies Case;
  })(),

  // ---------------------------------------------------------------------------------------------
  // Talentio 風（Rails）：candidate[...] の name、date_select の (1i)(2i)(3i)、月が「1月」表記、collection_radio_buttons
  {
    name: 'P-Talentio 風（Rails）：candidate[...] の name・date_select の (1i)(2i)(3i)・「1月」の月・Rails の hidden・自由記述',
    html: `<form class="new_candidate" id="new_candidate" action="/r/xxxx/apply" accept-charset="UTF-8" method="post"><input type="hidden" name="authenticity_token" value="abc">
      <div class="form-group required"><label class="control-label" for="candidate_last_name">姓</label><input class="form-control" type="text" name="candidate[last_name]" id="candidate_last_name"></div>
      <div class="form-group required"><label class="control-label" for="candidate_first_name">名</label><input class="form-control" type="text" name="candidate[first_name]" id="candidate_first_name"></div>
      <div class="form-group"><label class="control-label" for="candidate_last_name_kana">姓（かな）</label><input class="form-control" type="text" name="candidate[last_name_kana]" id="candidate_last_name_kana"></div>
      <div class="form-group"><label class="control-label" for="candidate_first_name_kana">名（かな）</label><input class="form-control" type="text" name="candidate[first_name_kana]" id="candidate_first_name_kana"></div>
      <div class="form-group required"><label class="control-label" for="candidate_email">メールアドレス</label><input class="form-control" type="email" name="candidate[email]" id="candidate_email"></div>
      <div class="form-group"><label class="control-label" for="candidate_tel">電話番号</label><input class="form-control" type="tel" name="candidate[tel]" id="candidate_tel"></div>
      <div class="form-group"><label class="control-label" for="candidate_birthday_1i">生年月日</label><div class="form-inline">
        <select id="candidate_birthday_1i" name="candidate[birthday(1i)]" class="form-control"><option value=""></option>${range(1960, 2008).map((y) => `<option value="${y}">${y}</option>`).join('')}</select>
        <select id="candidate_birthday_2i" name="candidate[birthday(2i)]" class="form-control"><option value=""></option>${range(1, 12).map((m) => `<option value="${m}">${m}月</option>`).join('')}</select>
        <select id="candidate_birthday_3i" name="candidate[birthday(3i)]" class="form-control"><option value=""></option>${range(1, 31).map((d) => `<option value="${d}">${d}</option>`).join('')}</select>
      </div></div>
      <div class="form-group"><label class="control-label">性別</label><input type="hidden" name="candidate[gender]" value="">
        <div class="radio"><label for="candidate_gender_male"><input type="radio" value="male" name="candidate[gender]" id="candidate_gender_male">男性</label></div>
        <div class="radio"><label for="candidate_gender_female"><input type="radio" value="female" name="candidate[gender]" id="candidate_gender_female">女性</label></div>
        <div class="radio"><label for="candidate_gender_other"><input type="radio" value="other" name="candidate[gender]" id="candidate_gender_other">回答しない</label></div>
      </div>
      <div class="form-group"><label class="control-label" for="candidate_address">住所</label><input class="form-control" type="text" name="candidate[address]" id="candidate_address"></div>
      <div class="form-group"><label class="control-label" for="candidate_school">最終学歴（学校名）</label><input class="form-control" type="text" name="candidate[school]" id="candidate_school"></div>
      <div class="form-group"><label class="control-label" for="candidate_resume">履歴書</label><input type="file" name="candidate[resume]" id="candidate_resume"></div>
      <div class="form-group"><label class="control-label" for="candidate_answers_attributes_0_body">応募の理由</label><input type="hidden" name="candidate[answers_attributes][0][question_id]" value="12"><textarea class="form-control" name="candidate[answers_attributes][0][body]" id="candidate_answers_attributes_0_body"></textarea></div>
      <input type="submit" name="commit" value="応募する" class="btn btn-primary"></form>`,
    expect: {
      '#candidate_last_name': '山田',
      '#candidate_first_name': '太郎',
      '#candidate_last_name_kana': 'やまだ',
      '#candidate_first_name_kana': 'たろう',
      '#candidate_email': 'taro@example.com',
      '#candidate_tel': '090-1234-5678',
      '#candidate_birthday_1i': '1999',
      '#candidate_birthday_2i': '4',
      '#candidate_birthday_3i': '1',
      '#candidate_gender_male': true,
      '#candidate_address': '東京都渋谷区神南1-2-3　サンプルマンション101',
      '#candidate_school': 'サンプル大学',
      '#candidate_answers_attributes_0_body': '',
    },
  },

  // ---------------------------------------------------------------------------------------------
  // HERP 風（React）：label は for のない div、name は意味のない ID、aria-required、項目ごとの説明文が欄の下
  {
    name: 'P-HERP 風（React）：for のない見出し div・意味のない name（q_xxxx）・欄の下の説明文・氏名1欄とフリガナ1欄・ポートフォリオ未登録',
    html: `<form class="sc-applyForm">
      ${(
        [
          ['氏名', '<input type="text" name="q_8f3a1" aria-required="true" class="sc-input" placeholder="山田 太郎">', '必須'],
          ['フリガナ', '<input type="text" name="q_8f3a2" aria-required="true" class="sc-input" placeholder="ヤマダ タロウ">', '必須'],
          ['メールアドレス', '<input type="text" inputmode="email" name="q_8f3a3" aria-required="true" class="sc-input">', '必須'],
          ['電話番号', '<input type="text" inputmode="tel" name="q_8f3a4" class="sc-input" placeholder="09012345678">', '必須'],
          ['生年月日', '<input type="text" name="q_8f3a5" class="sc-input" placeholder="YYYY/MM/DD">', '任意'],
          ['現住所（都道府県）', `<select name="q_8f3a6" class="sc-select">${opts(PREFECTURES, '選択してください')}</select>`, '任意'],
          ['ポートフォリオ / GitHub', '<input type="text" name="q_8f3a7" class="sc-input" placeholder="https://">', '任意'],
          ['職務経歴（簡単に）', '<textarea name="q_8f3a8" class="sc-textarea"></textarea>', '任意'],
          ['応募にあたってのメッセージ', '<textarea name="q_8f3a9" class="sc-textarea"></textarea>', '任意'],
        ] as const
      )
        .map(
          ([label, input, req]) =>
            `<div class="sc-field"><div class="sc-field__head"><div class="sc-field__label">${label}</div><span class="sc-badge">${req}</span></div><div class="sc-field__body">${input}</div><p class="sc-field__help">${label === '電話番号' ? 'ハイフンなしで入力してください' : ''}</p></div>`,
        )
        .join('')}
      <button type="submit" class="sc-button">応募する</button></form>`,
    expect: {
      '[name=q_8f3a1]': '山田 太郎',
      '[name=q_8f3a2]': 'ヤマダ タロウ',
      '[name=q_8f3a3]': 'taro@example.com',
      '[name=q_8f3a4]': '09012345678',
      '[name=q_8f3a5]': '1999/04/01',
      '[name=q_8f3a6]': '東京都',
      '[name=q_8f3a7]': '',
      '[name=q_8f3a8]': '',
      '[name=q_8f3a9]': '',
    },
  },

  // ---------------------------------------------------------------------------------------------
  // ジョブカン採用管理風：dl の dt に「必須」、生年月日が type=date、最終学歴のプルダウン、卒業（見込み）年月が type=month、応募経路のアンケート
  {
    name: 'P-ジョブカン採用管理風（dl）：姓・名が別の dt、type=date・type=month、最終学歴、応募経路の「その他」記述',
    html: `<form id="entry-form" method="post"><dl class="entry-form__list">
      <dt class="entry-form__term">姓<span class="label label-danger">必須</span></dt><dd class="entry-form__desc"><input type="text" name="applicant[last_name]" class="form-control"></dd>
      <dt class="entry-form__term">名<span class="label label-danger">必須</span></dt><dd class="entry-form__desc"><input type="text" name="applicant[first_name]" class="form-control"></dd>
      <dt class="entry-form__term">姓（フリガナ）</dt><dd class="entry-form__desc"><input type="text" name="applicant[last_name_kana]" class="form-control"></dd>
      <dt class="entry-form__term">名（フリガナ）</dt><dd class="entry-form__desc"><input type="text" name="applicant[first_name_kana]" class="form-control"></dd>
      <dt class="entry-form__term">生年月日</dt><dd class="entry-form__desc"><input type="date" name="applicant[birthday]" class="form-control"></dd>
      <dt class="entry-form__term">性別</dt><dd class="entry-form__desc"><select name="applicant[gender]" class="form-control">${opts([['1', '男性'], ['2', '女性'], ['0', '回答しない']], '')}</select></dd>
      <dt class="entry-form__term">メールアドレス<span class="label label-danger">必須</span></dt><dd class="entry-form__desc"><input type="email" name="applicant[email]" class="form-control"></dd>
      <dt class="entry-form__term">携帯電話番号</dt><dd class="entry-form__desc"><input type="tel" name="applicant[mobile]" class="form-control"></dd>
      <dt class="entry-form__term">郵便番号</dt><dd class="entry-form__desc"><input type="text" name="applicant[zip]" class="form-control" placeholder="1234567"></dd>
      <dt class="entry-form__term">都道府県</dt><dd class="entry-form__desc"><select name="applicant[prefecture_id]" class="form-control">${opts(PREFECTURES.map((p, i) => [String(i + 1), p]), '')}</select></dd>
      <dt class="entry-form__term">住所</dt><dd class="entry-form__desc"><input type="text" name="applicant[address]" class="form-control"></dd>
      <dt class="entry-form__term">最終学歴</dt><dd class="entry-form__desc"><select name="applicant[education]" class="form-control">${opts(['大学院', '大学', '短期大学', '専門学校', '高等学校'], '')}</select></dd>
      <dt class="entry-form__term">学校名</dt><dd class="entry-form__desc"><input type="text" name="applicant[school_name]" class="form-control"></dd>
      <dt class="entry-form__term">卒業（見込み）年月</dt><dd class="entry-form__desc"><input type="month" name="applicant[graduated_on]" class="form-control"></dd>
      <dt class="entry-form__term">応募経路</dt><dd class="entry-form__desc"><select name="applicant[route]" class="form-control">${opts(['自社サイト', '知人の紹介', 'SNS', 'その他'], '')}</select><input type="text" name="applicant[route_other]" class="form-control" placeholder="その他の場合はご記入ください"></dd>
      <dt class="entry-form__term">備考</dt><dd class="entry-form__desc"><textarea name="applicant[note]" class="form-control"></textarea></dd>
    </dl><button type="submit" class="btn btn-primary">応募する</button></form>`,
    expect: {
      '[name="applicant[last_name]"]': '山田',
      '[name="applicant[first_name]"]': '太郎',
      '[name="applicant[last_name_kana]"]': 'ヤマダ',
      '[name="applicant[first_name_kana]"]': 'タロウ',
      '[name="applicant[birthday]"]': '1999-04-01',
      '[name="applicant[gender]"]': '男性',
      '[name="applicant[email]"]': 'taro@example.com',
      '[name="applicant[mobile]"]': '090-1234-5678',
      '[name="applicant[zip]"]': '1500041',
      '[name="applicant[prefecture_id]"]': '東京都',
      '[name="applicant[address]"]': '渋谷区神南1-2-3　サンプルマンション101',
      '[name="applicant[education]"]': '大学',
      '[name="applicant[school_name]"]': 'サンプル大学',
      '[name="applicant[graduated_on]"]': '2026-03',
      '[name="applicant[route]"]': '',
      '[name="applicant[route_other]"]': '',
      '[name="applicant[note]"]': '',
    },
  },

  // ---------------------------------------------------------------------------------------------
  // Wantedly 風（React・CSS-in-JS）：name も id も label もなく、見出しは p、欄の手がかりは placeholder と見出しだけ
  {
    name: 'P-Wantedly 風（React）：name・id・label なし、見出しは p、placeholder だけの姓名、自己紹介文',
    html: `<form class="css-1x2y3z">
      <div class="css-a1"><p class="css-t1">名前</p><div class="css-row"><input class="css-in" placeholder="姓" value=""><input class="css-in" placeholder="名" value=""></div></div>
      <div class="css-a1"><p class="css-t1">メールアドレス</p><input class="css-in" type="email" placeholder="example@wantedly.com" value=""></div>
      <div class="css-a1"><p class="css-t1">生年月日</p><input class="css-in" type="date" value=""></div>
      <div class="css-a1"><p class="css-t1">今の職業・学校</p><input class="css-in" placeholder="例）〇〇大学" value=""></div>
      <div class="css-a1"><p class="css-t1">自己紹介</p><textarea class="css-ta" placeholder="あなたについて教えてください"></textarea></div>
      <div class="css-a1"><p class="css-t1">話を聞きに行きたい理由</p><textarea class="css-ta"></textarea></div>
    </form>`,
    expect: {
      '[placeholder="姓"]': '山田',
      '[placeholder="名"]': '太郎',
      'input[type=email]': 'taro@example.com',
      'input[type=date]': '1999-04-01',
      'textarea[placeholder]': '',
      'textarea:not([placeholder])': '',
    },
  },

  // ---------------------------------------------------------------------------------------------
  // Google フォーム：name のない入力欄（値は hidden の entry.xxxx に写す）、aria-labelledby の見出し、
  // ネイティブのラジオがない role="radio"、ネイティブの select がない role="listbox"
  (() => {
    let q = 0;
    const question = (title: string, inner: (h: string) => string, desc = '', required = true) => {
      const h = `gq${++q}`;
      return `<div role="listitem" class="Qr7Oae"><div jscontroller="sWGJ4b" class="geS5n"><div class="z12JJ"><div class="M4DNQ"><div id="${h}h" class="HoXoMd D1wxyf RjsPE" role="heading" aria-level="3"><span class="M7eMe">${title}</span>${required ? `<span class="vnumgf" id="${h}r" aria-label="必須の質問"> *</span>` : ''}</div>${desc ? `<div class="gubaDc OIC90c RjsPE" id="${h}d">${desc}</div>` : ''}</div></div>${inner(h)}<div jsname="o6bZLc"><input type="hidden" name="entry.${1000 + q}" value=""></div></div></div>`;
    };
    const short = (type = 'text') => (h: string) =>
      `<div class="AgroKb"><div class="rFrNMe k3kHxc RdH0ib yqQS1 zKHdkd"><div class="aCsJod oJeWuf"><div class="aXBtI Wic03c"><div class="Xb9hP"><input type="${type}" class="whsOnd zHQkBf" jsname="YPqjbf" autocomplete="off" tabindex="0" aria-labelledby="${h}h ${h}r" aria-describedby="${h}d ${h}e" dir="auto" data-initial-value=""><div jsname="LwH6nd" class="ndJi5d snByac" aria-hidden="true">回答を入力</div></div><div class="cXrdqd"></div></div></div><div class="LXRPh"><div jsname="B34EJ" class="dEOOab RxsGPe" aria-live="assertive" id="${h}e" role="alert"></div></div></div></div>`;
    const para = (h: string) => `<div class="AgroKb"><div class="RpC4Ne oJeWuf"><textarea class="KHxj8b tL9Q4c" jsname="YPqjbf" tabindex="0" aria-labelledby="${h}h ${h}r" dir="auto" rows="1"></textarea></div></div>`;
    const radios = (items: string[]) => (h: string) =>
      `<div class="oyXaNc"><div role="radiogroup" aria-labelledby="${h}h" class="lLfZXe fnxRtf" jsname="wCJL8" data-hidden="entry.${1000 + q}"><span class="H2Gmcc tyNBNd">${items
        .map(
          (t, i) =>
            `<div class="nWQGrd zwllIb"><label class="docssharedWizToggleLabeledContainer ajBQVb"><div class="bzfPab wFGF8"><div class="d7L4fc bJNwt FXLARc aomaEc ECvBRb"><div class="Od2TWd hYsg7c" data-value="${t}" aria-label="${t}" tabindex="0" role="radio" aria-checked="false" aria-posinset="${i + 1}" aria-setsize="${items.length}" style="display:inline-block;width:16px;height:16px;border:2px solid #555;border-radius:50%"></div></div><div class="YEVVod"><div class="ulDsOb"><span dir="auto" class="aDTYNe snByac OvPDhc OIC90c">${t}</span></div></div></div></label></div>`,
        )
        .join('')}</span></div></div>`;
    const dropdown = (items: string[]) => (h: string) =>
      `<div class="vQES8d"><div class="MocG8c gfListbox" role="listbox" aria-expanded="false" aria-labelledby="${h}h ${h}r" tabindex="0" data-hidden="entry.${1000 + q}" style="display:inline-block;border:1px solid #888;padding:4px 8px;min-width:120px"><div class="ry3kXd" role="presentation">${['', ...items]
        .map((t, i) => `<div class="MocG8c HZ3kWc" data-value="${t}" aria-selected="${i === 0}" role="option" tabindex="${i ? -1 : 0}" style="display:${i === 0 ? 'block' : 'none'}"><span class="vRMGwf oJeWuf">${t || '選択'}</span></div>`)
        .join('')}</div></div></div>`;
    return {
      name: 'P-Google フォーム：name のない欄（aria-labelledby）・role="radio" の性別・role="listbox" の都道府県・説明文で「ハイフンなし」・日付・段落',
      html: `<form action="https://docs.google.com/forms/u/0/d/e/xxx/formResponse" method="POST"><div class="RH5hzf RLS9Fe"><div class="lrKTG"><div class="o3Dpx" role="list">
        <div role="listitem" class="Qr7Oae"><div class="geS5n"><div class="z12JJ"><div class="M4DNQ"><div id="gmailh" role="heading" aria-level="3"><span class="M7eMe">メール</span><span class="vnumgf"> *</span></div></div></div><div class="AgroKb"><div class="Xb9hP"><input type="email" class="whsOnd zHQkBf" jsname="YPqjbf" autocomplete="email" aria-label="メールアドレス" id="gmail"></div></div><input type="hidden" name="emailAddress" value=""></div></div>
        ${question('氏名（漢字）', short(), '例：山田 太郎')}
        ${question('氏名（フリガナ）', short(), '全角カタカナでご記入ください')}
        ${question('生年月日', short('date'))}
        ${question('性別', radios(['男性', '女性', '回答しない']))}
        ${question('大学名', short())}
        ${question('学部・学科', short())}
        ${question('お住まいの都道府県', dropdown(PREFECTURES))}
        ${question('電話番号', short('tel'), 'ハイフンなしでご記入ください')}
        ${question('郵便番号', short(), '半角数字7桁（ハイフンなし）')}
        ${question('志望動機を教えてください', para)}
        ${question('当説明会を知ったきっかけ', radios(['大学の掲示', 'SNS', '友人', 'その他']), '', false)}
      </div></div></div></form>`,
      setup(root) {
        const hiddenOf = (el: Element) => root.querySelector<HTMLInputElement>(`input[name="${el.getAttribute('data-hidden')}"]`);
        // 文字の欄は、入力のたびに hidden の entry.xxxx に値を写す（Google フォームの jsname="YPqjbf"）
        root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[jsname="YPqjbf"]').forEach((el) => {
          const hidden = el.closest('.geS5n')?.querySelector<HTMLInputElement>('input[type=hidden]');
          el.addEventListener('input', () => hidden && (hidden.value = el.value));
        });
        // role="radio"：クリックで aria-checked を切り替え、hidden に写す
        root.querySelectorAll<HTMLElement>('[role=radiogroup]').forEach((group) => {
          const items = Array.from(group.querySelectorAll<HTMLElement>('[role=radio]'));
          group.querySelectorAll('label').forEach((label, i) =>
            label.addEventListener('click', () => {
              items.forEach((r, j) => {
                r.setAttribute('aria-checked', String(i === j));
                r.style.background = i === j ? '#673ab7' : '';
              });
              const hidden = hiddenOf(group);
              if (hidden) hidden.value = items[i]!.dataset.value ?? '';
            }),
          );
        });
        // role="listbox"：クリックで選択肢の一覧（role="option" の複製）を開く
        root.querySelectorAll<HTMLElement>('.gfListbox').forEach((box) => {
          const options = Array.from(box.querySelectorAll<HTMLElement>('[role=option]'));
          let popup: HTMLElement | null = null;
          const closePopup = () => {
            popup?.remove();
            popup = null;
            box.setAttribute('aria-expanded', 'false');
          };
          const choose = (i: number) => {
            options.forEach((o, j) => {
              o.setAttribute('aria-selected', String(i === j));
              o.style.display = i === j ? 'block' : 'none';
            });
            const hidden = hiddenOf(box);
            if (hidden) hidden.value = options[i]!.dataset.value ?? '';
            closePopup();
          };
          box.addEventListener('click', () => {
            if (popup) return closePopup();
            popup = document.createElement('div');
            popup.className = 'OA0qNb ncFHed gf-popup';
            popup.setAttribute('role', 'presentation');
            popup.style.cssText = 'position:absolute;background:#fff;border:1px solid #ccc;max-height:200px;overflow:auto;z-index:10';
            options.forEach((o, i) => {
              const c = o.cloneNode(true) as HTMLElement;
              c.style.display = 'block';
              c.addEventListener('click', (e) => {
                e.stopPropagation();
                choose(i);
              });
              popup!.append(c);
            });
            box.append(popup);
            box.setAttribute('aria-expanded', 'true');
          });
        });
      },
      expect: {
        '#gmail': 'taro@example.com',
        '[aria-labelledby="gq1h gq1r"]': '山田 太郎',
        '[aria-labelledby="gq2h gq2r"]': 'ヤマダ　タロウ',
        '[aria-labelledby="gq3h gq3r"]': '1999-04-01',
        '[name="entry.1004"]': '男性',
        '[aria-labelledby="gq5h gq5r"]': 'サンプル大学',
        // 「学部・学科」の1欄は学科を入れる（snar.jp（SCREEN）のケースと同じ）
        '[aria-labelledby="gq6h gq6r"]': '経済学科',
        '[name="entry.1007"]': '東京都',
        '[aria-labelledby="gq8h gq8r"]': '09012345678',
        '[aria-labelledby="gq9h gq9r"]': '1500041',
        'textarea[aria-labelledby="gq10h gq10r"]': '',
        '[name="entry.1011"]': '',
      },
    } satisfies Case;
  })(),

  // Google フォームの役割だけの部品（ネイティブの欄がない）を切り出したもの
  {
    name: 'P-Google フォーム（切り出し）：role="radio" だけの性別（女性）',
    profile: { gender: 'female' },
    html: `<form><div role="listitem"><div id="gr1h" role="heading" aria-level="3"><span>性別</span><span> *</span></div>
      <div role="radiogroup" aria-labelledby="gr1h">${['男性', '女性']
        .map((t) => `<label><div role="radio" aria-checked="false" data-value="${t}" aria-label="${t}" tabindex="0" style="display:inline-block;width:16px;height:16px;border:2px solid #555"></div><span>${t}</span></label>`)
        .join('')}</div><input type="hidden" name="entry.1" value=""></div></form>`,
    setup(root) {
      const items = Array.from(root.querySelectorAll<HTMLElement>('[role=radio]'));
      items.forEach((r) =>
        r.closest('label')!.addEventListener('click', () => {
          items.forEach((x) => x.setAttribute('aria-checked', String(x === r)));
          root.querySelector<HTMLInputElement>('[name="entry.1"]')!.value = r.dataset.value!;
        }),
      );
    },
    expect: { '[name="entry.1"]': '女性' },
  },

  // ---------------------------------------------------------------------------------------------
  // Microsoft Forms：office-form-question、見出しは aria-labelledby、「回答を入力してください」の placeholder、
  // ネイティブのラジオ（ラベルの中の span）、番号つきの見出し
  {
    name: 'P-Microsoft Forms：番号つきの見出し（aria-labelledby）・「回答を入力してください」・ネイティブのラジオ・学年のラジオには触らない',
    html: `<form><div class="office-form-body">${(
      [
        ['r1', '氏名（漢字）', 'text'],
        ['r2', 'フリガナ（全角カタカナ）', 'text'],
        ['r3', 'メールアドレス', 'text'],
        ['r4', '電話番号（ハイフンなし）', 'text'],
        ['r5', '性別', ['男性', '女性', '回答しない']],
        ['r6', '大学名', 'text'],
        ['r7', '学年', ['学部3年', '学部4年', '修士1年', '修士2年']],
        ['r8', '卒業予定年月（例：2026年3月）', 'text'],
        ['r9', 'インターンシップに参加したい理由', 'textarea'],
      ] as const
    )
      .map(([id, title, kind], i) => {
        const head = `<div class="office-form-question-title" id="QuestionId_${id}"><span class="ordinal-number">${i + 1}.</span><span class="text-format-content">${title}</span><span class="office-form-question-required" aria-label="必須">*</span></div>`;
        const body =
          kind === 'text'
            ? `<div class="office-form-textfield"><input class="office-form-question-textbox office-form-textfield-input form-control" data-automation-id="textInput" aria-labelledby="QuestionId_${id} QuestionInfo_${id}" placeholder="回答を入力してください" maxlength="4000" id="mf_${id}"></div>`
            : kind === 'textarea'
              ? `<textarea class="office-form-question-textbox office-form-textfield-input form-control" aria-labelledby="QuestionId_${id}" placeholder="回答を入力してください" maxlength="4000" id="mf_${id}"></textarea>`
              : `<div role="radiogroup" aria-labelledby="QuestionId_${id}">${kind
                  .map((t) => `<div class="office-form-question-choice"><div class="choice-item"><label><input type="radio" class="office-form-question-choice-input" name="${id}_choice" value="${t}"><span class="office-form-question-choice-text-span">${t}</span></label></div></div>`)
                  .join('')}</div>`;
        return `<div class="office-form-question-content" data-automation-id="questionItem">${head}<div id="QuestionInfo_${id}" class="office-form-question-subtitle"></div><div class="office-form-question-element">${body}</div></div>`;
      })
      .join('')}</div><button type="button" class="office-form-bottom-button">送信</button></form>`,
    expect: {
      '#mf_r1': '山田　太郎',
      '#mf_r2': 'ヤマダ　タロウ',
      '#mf_r3': 'taro@example.com',
      '#mf_r4': '09012345678',
      'radio:r5_choice': '男性',
      '#mf_r6': 'サンプル大学',
      'radio:r7_choice': '',
      '#mf_r8': '2026年3月',
      '#mf_r9': '',
    },
  },
  {
    // Fluent UI の DatePicker（allowTextInput）。文字欄に role="combobox" aria-haspopup="dialog" が付き、開くとカレンダー（選択肢なし）。
    // 欄を離れると、入力した日付をサイトの書式（yyyy/M/d）に整え直す
    name: 'P-Microsoft Forms（切り出し）：role="combobox" の日付の文字欄（カレンダーが開き、離れると yyyy/M/d に整え直す）',
    html: `<form><div class="office-form-question-content"><div class="office-form-question-title" id="QuestionId_d1"><span class="text-format-content">生年月日</span></div>
      <div class="ms-DatePicker"><div class="ms-TextField"><input type="text" id="mf_date" role="combobox" aria-haspopup="dialog" aria-expanded="false" aria-labelledby="QuestionId_d1" placeholder="日付を入力してください (yyyy/M/d)" class="ms-TextField-field"></div></div></div></form>`,
    setup(root) {
      const input = root.querySelector<HTMLInputElement>('#mf_date')!;
      let cal: HTMLElement | null = null;
      input.addEventListener('click', () => {
        if (cal) return;
        cal = document.createElement('div');
        cal.setAttribute('role', 'dialog');
        cal.className = 'ms-DatePicker-callout';
        cal.innerHTML = `<table role="grid"><tr>${range(1, 7).map((d) => `<td><button type="button">${d}</button></td>`).join('')}</tr></table>`;
        input.parentElement!.append(cal);
        input.setAttribute('aria-expanded', 'true');
      });
      const closeCal = () => {
        cal?.remove();
        cal = null;
        input.setAttribute('aria-expanded', 'false');
      };
      input.addEventListener('keydown', (e) => e.key === 'Escape' && closeCal());
      input.addEventListener('blur', () => {
        closeCal();
        const m = /^(\d{4})[/\-年](\d{1,2})[/\-月](\d{1,2})/.exec(input.value);
        if (m) input.value = `${m[1]}/${Number(m[2])}/${Number(m[3])}`;
      });
    },
    expect: { '#mf_date': '1999/4/1' },
  },

  // ---------------------------------------------------------------------------------------------
  // formrun（埋め込みコード）：name が日本語の項目名、for のない label、data-formrun-show-if-error のエラー文（非表示）、_formrun_gotcha のハニーポット
  {
    name: 'P-formrun（埋め込みコード）：日本語の name、for のない label、非表示のエラー文、_formrun_gotcha、同意チェック',
    html: `<form class="formrun" action="https://form.run/api/v1/r/xxxxxxxx" method="post">
      ${(
        [
          ['お名前 [必須]', '<input name="お名前" type="text" data-formrun-required>', 'お名前を入力してください'],
          ['フリガナ [必須]', '<input name="フリガナ" type="text" data-formrun-required>', 'フリガナを入力してください'],
          ['メールアドレス [必須]', '<input name="メールアドレス" type="text" data-formrun-type="email" data-formrun-required>', 'メールアドレスを正しく入力してください'],
          ['電話番号', '<input name="電話番号" type="text" data-formrun-type="tel">', '電話番号を正しく入力してください'],
          ['生年月日', '<input name="生年月日" type="date">', ''],
          ['在籍校（大学名）', '<input name="大学名" type="text">', ''],
          ['卒業予定年', `<select name="卒業予定年">${opts(['2026年卒', '2027年卒', '2028年卒'], '選択してください')}</select>`, ''],
          ['希望職種', `<select name="希望職種">${opts(['エンジニア', '営業', 'デザイナー'], '選択してください')}</select>`, ''],
          ['ご質問など', '<textarea name="ご質問など" data-formrun-textarea-limit="1000"></textarea>', ''],
        ] as const
      )
        .map(
          ([label, input, err]) =>
            `<div><label>${label}</label>${input}${err ? `<div data-formrun-show-if-error="${label.replace(/ \[必須\]/, '')}" style="display:none">${err}</div>` : ''}</div>`,
        )
        .join('\n')}
      <div><label><input type="checkbox" name="個人情報利用同意" data-formrun-required> 個人情報利用に同意する</label></div>
      <div class="_formrun_gotcha"><style media="screen">._formrun_gotcha {position:absolute!important;height:1px!important;width:1px!important;overflow:hidden!important;}</style><label for="_formrun_gotcha">If you are a human, ignore this field</label><input type="text" name="_formrun_gotcha" id="_formrun_gotcha" tabindex="-1"></div>
      <button type="submit" data-formrun-error-text="未入力の項目があります" data-formrun-submitting-text="送信中...">送信</button>
    </form>`,
    expect: {
      '[name="お名前"]': '山田　太郎',
      '[name="フリガナ"]': 'ヤマダ　タロウ',
      '[name="メールアドレス"]': 'taro@example.com',
      '[name="電話番号"]': '090-1234-5678',
      '[name="生年月日"]': '1999-04-01',
      '[name="大学名"]': 'サンプル大学',
      '[name="卒業予定年"]': '2026年卒',
      '[name="希望職種"]': '',
      '[name="ご質問など"]': '',
      '[name="個人情報利用同意"]': false,
      '[name=_formrun_gotcha]': '',
    },
  },

  // ---------------------------------------------------------------------------------------------
  // Tayori 風：form-item のラベル div と入力欄の div、姓・名／セイ・メイが「姓」「名」のサブラベル、住所が郵便番号＋1欄
  {
    name: 'P-Tayori 風：form-item のラベル div、サブラベルつきの姓・名／セイ・メイ、郵便番号＋住所1欄、ラジオの希望日程',
    html: `<form class="tayori-form"><div class="form-items">
      ${(
        [
          ['お名前', '<div class="form-name"><div class="form-name__item"><span class="sub-label">姓</span><input type="text" name="contents[1][last_name]"></div><div class="form-name__item"><span class="sub-label">名</span><input type="text" name="contents[1][first_name]"></div></div>'],
          ['フリガナ', '<div class="form-name"><div class="form-name__item"><span class="sub-label">セイ</span><input type="text" name="contents[2][last_name]"></div><div class="form-name__item"><span class="sub-label">メイ</span><input type="text" name="contents[2][first_name]"></div></div>'],
          ['メールアドレス', '<input type="email" name="contents[3]"><div class="sub-input"><span class="sub-label">確認用</span><input type="email" name="contents[3][confirm]"></div>'],
          ['電話番号', '<input type="tel" name="contents[4]" placeholder="例：03-1234-5678">'],
          ['住所', '<div class="form-address"><div class="form-address__zip"><span class="sub-label">〒</span><input type="text" name="contents[5][zip]" placeholder="1000001"></div><div class="form-address__body"><input type="text" name="contents[5][address]" placeholder="都道府県・市区町村・番地・建物名"></div></div>'],
          ['参加希望日程', ['10月1日（水）', '10月8日（水）', '10月15日（水）'].map((t, i) => `<label class="form-radio"><input type="radio" name="contents[6]" value="${i}"><span>${t}</span></label>`).join('')],
          ['お問い合わせ内容', '<textarea name="contents[7]"></textarea>'],
        ] as const
      )
        .map(([label, body]) => `<div class="form-item"><div class="form-item-label">${label}<span class="form-item-required">必須</span></div><div class="form-item-input">${body}</div></div>`)
        .join('')}
    </div><button type="submit" class="tayori-submit">確認画面へ</button></form>`,
    expect: {
      '[name="contents[1][last_name]"]': '山田',
      '[name="contents[1][first_name]"]': '太郎',
      '[name="contents[2][last_name]"]': 'ヤマダ',
      '[name="contents[2][first_name]"]': 'タロウ',
      '[name="contents[3]"]': 'taro@example.com',
      '[name="contents[3][confirm]"]': 'taro@example.com',
      '[name="contents[4]"]': '090-1234-5678',
      '[name="contents[5][zip]"]': '1500041',
      '[name="contents[5][address]"]': '東京都渋谷区神南1-2-3　サンプルマンション101',
      '[name="contents[6]"][value="0"]': false,
      '[name="contents[7]"]': '',
    },
  },

  // ---------------------------------------------------------------------------------------------
  // kintone（フォームブリッジ風）：フィールドコードが name（日本語・記号入り）、label for あり、ラジオは kintone の control-gaia 風
  {
    name: 'P-kintone（フォームブリッジ風）：フィールドコードの name、label for、ラジオ（文理）、日付、ドロップダウン（学校区分）、複数行',
    html: `<form class="fb-form">${(
      [
        ['氏名', '<input type="text" id="fb1" name="氏名_漢字" class="fb-input">'],
        ['氏名（カナ）', '<input type="text" id="fb2" name="氏名_カナ" class="fb-input">'],
        ['生年月日', '<input type="date" id="fb3" name="生年月日" class="fb-input">'],
        ['メールアドレス', '<input type="email" id="fb4" name="メール" class="fb-input">'],
        ['携帯電話', '<input type="tel" id="fb5" name="携帯" class="fb-input">'],
        ['学校区分', `<select id="fb6" name="学校区分" class="fb-select">${opts(['大学院', '大学', '短大', '高専', '専門学校'], '-----')}</select>`],
        ['学校名', '<input type="text" id="fb7" name="学校名" class="fb-input">'],
        ['文理', `<div class="fb-radio" role="radiogroup" aria-labelledby="fb8l">${['文系', '理系'].map((t, i) => `<span class="control-gaia-radio"><input type="radio" id="fb8_${i}" name="文理" value="${t}"><label for="fb8_${i}">${t}</label></span>`).join('')}</div>`],
        ['卒業予定日', '<input type="date" id="fb9" name="卒業予定日" class="fb-input">'],
        ['質問・要望', '<textarea id="fb10" name="質問" class="fb-textarea"></textarea>'],
      ] as const
    )
      .map(([label, input], i) => `<div class="fb-field"><label class="fb-label" id="fb${i + 1}l" for="fb${i + 1}">${label}</label>${input}</div>`)
      .join('')}<button type="button" class="fb-submit">送信</button></form>`,
    expect: {
      '#fb1': '山田　太郎',
      '#fb2': 'ヤマダ　タロウ',
      '#fb3': '1999-04-01',
      '#fb4': 'taro@example.com',
      '#fb5': '090-1234-5678',
      '#fb6': '大学',
      '#fb7': 'サンプル大学',
      '#fb8_0': true,
      '#fb9': '2026-03-01',
      '#fb10': '',
    },
  },

  // ---------------------------------------------------------------------------------------------
  // Contact Form 7：p > label > br > span.wpcf7-form-control-wrap、your-name などの name、表の中の採用フォーム、同意（acceptance）
  {
    name: 'P-Contact Form 7（採用フォーム・表）：your-name／your-kana などの name、span.wpcf7-form-control-wrap、ラジオの既定チェック、acceptance、メッセージ本文',
    html: `<div class="wpcf7 js" id="wpcf7-f123-p45-o1" lang="ja" dir="ltr"><form action="/recruit/#wpcf7-f123-p45-o1" method="post" class="wpcf7-form init" aria-label="コンタクトフォーム" novalidate data-status="init">
      <div style="display: none;"><input type="hidden" name="_wpcf7" value="123"><input type="hidden" name="_wpcf7_version" value="5.9.3"><input type="hidden" name="_wpcf7_locale" value="ja"><input type="hidden" name="_wpcf7_unit_tag" value="wpcf7-f123-p45-o1"></div>
      <table class="recruit-form"><tbody>
        <tr><th>お名前<span class="required">必須</span></th><td><span class="wpcf7-form-control-wrap" data-name="your-name"><input size="40" maxlength="400" class="wpcf7-form-control wpcf7-text wpcf7-validates-as-required" aria-required="true" aria-invalid="false" placeholder="例）山田 太郎" value="" type="text" name="your-name"></span></td></tr>
        <tr><th>フリガナ<span class="required">必須</span></th><td><span class="wpcf7-form-control-wrap" data-name="your-kana"><input size="40" maxlength="400" class="wpcf7-form-control wpcf7-text wpcf7-validates-as-required" aria-required="true" placeholder="例）ヤマダ タロウ" value="" type="text" name="your-kana"></span></td></tr>
        <tr><th>生年月日</th><td><span class="wpcf7-form-control-wrap" data-name="your-birth"><input class="wpcf7-form-control wpcf7-date" aria-invalid="false" value="" type="date" name="your-birth"></span></td></tr>
        <tr><th>性別</th><td><span class="wpcf7-form-control-wrap" data-name="your-gender"><span class="wpcf7-form-control wpcf7-radio"><span class="wpcf7-list-item first"><label><input type="radio" name="your-gender" value="男性" checked="checked"><span class="wpcf7-list-item-label">男性</span></label></span><span class="wpcf7-list-item last"><label><input type="radio" name="your-gender" value="女性"><span class="wpcf7-list-item-label">女性</span></label></span></span></span></td></tr>
        <tr><th>メールアドレス<span class="required">必須</span></th><td><span class="wpcf7-form-control-wrap" data-name="your-email"><input size="40" maxlength="400" class="wpcf7-form-control wpcf7-email wpcf7-validates-as-required wpcf7-text wpcf7-validates-as-email" aria-required="true" value="" type="email" name="your-email"></span></td></tr>
        <tr><th>電話番号<span class="required">必須</span></th><td><span class="wpcf7-form-control-wrap" data-name="your-tel"><input size="40" maxlength="400" class="wpcf7-form-control wpcf7-tel wpcf7-validates-as-required wpcf7-text wpcf7-validates-as-tel" aria-required="true" value="" type="tel" name="your-tel"></span></td></tr>
        <tr><th>郵便番号</th><td><span class="wpcf7-form-control-wrap" data-name="zip"><input size="10" maxlength="8" class="wpcf7-form-control wpcf7-text" value="" type="text" name="zip" onkeyup="AjaxZip3.zip2addr(this,'','pref','addr');"></span></td></tr>
        <tr><th>都道府県</th><td><span class="wpcf7-form-control-wrap" data-name="pref"><select class="wpcf7-form-control wpcf7-select" aria-invalid="false" name="pref"><option value="">&#8212;選択してください&#8212;</option>${PREFECTURES.map((p) => `<option value="${p}">${p}</option>`).join('')}</select></span></td></tr>
        <tr><th>ご住所</th><td><span class="wpcf7-form-control-wrap" data-name="addr"><input size="40" maxlength="400" class="wpcf7-form-control wpcf7-text" value="" type="text" name="addr"></span></td></tr>
        <tr><th>学校名</th><td><span class="wpcf7-form-control-wrap" data-name="school"><input size="40" maxlength="400" class="wpcf7-form-control wpcf7-text" value="" type="text" name="school"></span></td></tr>
        <tr><th>ご希望の職種</th><td><span class="wpcf7-form-control-wrap" data-name="job"><select class="wpcf7-form-control wpcf7-select" name="job"><option value="">&#8212;選択してください&#8212;</option><option value="総合職">総合職</option><option value="技術職">技術職</option></select></span></td></tr>
        <tr><th>志望動機</th><td><span class="wpcf7-form-control-wrap" data-name="your-message"><textarea cols="40" rows="10" maxlength="2000" class="wpcf7-form-control wpcf7-textarea" aria-invalid="false" name="your-message"></textarea></span></td></tr>
      </tbody></table>
      <p><span class="wpcf7-form-control-wrap" data-name="your-consent"><span class="wpcf7-form-control wpcf7-acceptance"><span class="wpcf7-list-item"><label><input type="checkbox" name="your-consent" value="1" aria-invalid="false"><span class="wpcf7-list-item-label">個人情報の取り扱いに同意する</span></label></span></span></span></p>
      <p><input class="wpcf7-form-control wpcf7-submit has-spinner" type="submit" value="送信"><span class="wpcf7-spinner"></span></p>
      <div class="wpcf7-response-output" aria-hidden="true"></div>
    </form></div>`,
    profile: { gender: 'female' },
    setup(root) {
      // AjaxZip3：郵便番号の keyup で、少し遅れて都道府県と「市区町村＋町域」を書き込む（番地は消える）
      (window as unknown as { AjaxZip3: unknown }).AjaxZip3 = {
        zip2addr(zip: HTMLInputElement, _b: string, pref: string, addr: string) {
          if (zip.value.replace(/\D/g, '') !== '1500041') return;
          setTimeout(() => {
            const form = zip.form ?? root;
            (form.querySelector(`[name="${pref}"]`) as HTMLSelectElement).value = '東京都';
            (form.querySelector(`[name="${addr}"]`) as HTMLInputElement).value = '渋谷区神南';
          }, 100);
        },
      };
    },
    expect: {
      '[name=your-name]': '山田 太郎',
      '[name=your-kana]': 'ヤマダ タロウ',
      '[name=your-birth]': '1999-04-01',
      'radio:your-gender': '女性',
      '[name=your-email]': 'taro@example.com',
      '[name=your-tel]': '090-1234-5678',
      '[name=zip]': '150-0041',
      '[name=pref]': '東京都',
      '[name=addr]': '渋谷区神南1-2-3　サンプルマンション101',
      '[name=school]': 'サンプル大学',
      '[name=job]': '',
      '[name=your-message]': '',
      '[name=your-consent]': false,
    },
  },
  {
    // CF7 の既定のテンプレート（<label> 項目名 [radio …] </label>）をそのまま使うと、ラジオの選択肢の <label> が外側の <label> の中に入れ子になる
    name: 'P-Contact Form 7（既定のテンプレート）：外側の <label> の中に入れ子になったラジオの選択肢（女性）と、label > br > span の氏名',
    html: `<form class="wpcf7-form init" novalidate>
      <p><label> 氏名<br><span class="wpcf7-form-control-wrap" data-name="your-name"><input size="40" maxlength="400" class="wpcf7-form-control wpcf7-text wpcf7-validates-as-required" autocomplete="name" aria-required="true" value="" type="text" name="your-name"></span> </label></p>
      <p><label> 性別<br><span class="wpcf7-form-control-wrap" data-name="gender"><span class="wpcf7-form-control wpcf7-radio"><span class="wpcf7-list-item first"><label><input type="radio" name="gender" value="男性"><span class="wpcf7-list-item-label">男性</span></label></span><span class="wpcf7-list-item last"><label><input type="radio" name="gender" value="女性"><span class="wpcf7-list-item-label">女性</span></label></span></span></span> </label></p>
      <p><label> 学年<br><span class="wpcf7-form-control-wrap" data-name="grade"><span class="wpcf7-form-control wpcf7-radio"><span class="wpcf7-list-item first"><label><input type="radio" name="grade" value="3年"><span class="wpcf7-list-item-label">3年</span></label></span><span class="wpcf7-list-item last"><label><input type="radio" name="grade" value="4年"><span class="wpcf7-list-item-label">4年</span></label></span></span></span> </label></p>
    </form>`,
    profile: { gender: 'female' },
    expect: { '[name=your-name]': '山田　太郎', '[name=gender][value="女性"]': true, '[name=gender][value="男性"]': false, 'radio:grade': '' },
  },

  // ---------------------------------------------------------------------------------------------
  // MW WP Form：[mwform_zip]・[mwform_tel] の分割（name="zip[data][0]"）と hidden の separator、〒 の前置き、horizontal-item のラジオ、datepicker
  {
    name: 'P-MW WP Form：zip[data][0]／tel[data][0..2] の分割と hidden の separator、〒、horizontal-item のラジオ、datepicker の文字欄',
    html: `<div class="mw_wp_form mw_wp_form_input"><form method="post" action="" enctype="multipart/form-data"><table class="form-table"><tbody>
      <tr><th>お名前<span class="hissu">*</span></th><td><input type="text" name="name" size="60" value=""></td></tr>
      <tr><th>ふりがな<span class="hissu">*</span></th><td><input type="text" name="kana" size="60" value=""></td></tr>
      <tr><th>生年月日</th><td><input type="text" name="birthday" size="30" value="" class="hasDatepicker" id="mwform_datepicker-1"></td></tr>
      <tr><th>性別</th><td><span class="mwform-radio-field horizontal-item"><label for="gender-1"><input type="radio" name="gender" value="男性" id="gender-1" class=""><span class="mwform-radio-field-text">男性</span></label></span><span class="mwform-radio-field horizontal-item"><label for="gender-2"><input type="radio" name="gender" value="女性" id="gender-2" class=""><span class="mwform-radio-field-text">女性</span></label></span><input type="hidden" name="__children[gender][]" value='{"男性":"男性","女性":"女性"}'></td></tr>
      <tr><th>郵便番号</th><td><span class="mwform-zip-field">〒<input type="text" name="zip[data][0]" size="4" maxlength="3" value="">-<input type="text" name="zip[data][1]" size="5" maxlength="4" value=""></span><input type="hidden" name="zip[separator]" value="-"></td></tr>
      <tr><th>都道府県</th><td><select name="pref">${opts(PREFECTURES, '選択してください')}</select></td></tr>
      <tr><th>市区町村・番地</th><td><input type="text" name="address1" size="60" value=""></td></tr>
      <tr><th>建物名</th><td><input type="text" name="address2" size="60" value=""></td></tr>
      <tr><th>電話番号<span class="hissu">*</span></th><td><span class="mwform-tel-field"><input type="text" name="tel[data][0]" size="6" maxlength="5" value=""> - <input type="text" name="tel[data][1]" size="5" maxlength="4" value=""> - <input type="text" name="tel[data][2]" size="5" maxlength="4" value=""></span><input type="hidden" name="tel[separator]" value="-"></td></tr>
      <tr><th>メールアドレス<span class="hissu">*</span></th><td><input type="email" name="email" size="60" value=""></td></tr>
      <tr><th>メールアドレス（確認用）<span class="hissu">*</span></th><td><input type="email" name="email-confirm" size="60" value=""></td></tr>
      <tr><th>最終学歴</th><td><input type="text" name="gakureki" size="60" value=""></td></tr>
      <tr><th>自己PR</th><td><textarea name="pr" cols="50" rows="5"></textarea></td></tr>
      <tr><th>個人情報の取り扱い</th><td><span class="mwform-checkbox-field horizontal-item"><label for="agree-1"><input type="checkbox" name="agree[data][]" value="同意する" id="agree-1"><span class="mwform-checkbox-field-text">同意する</span></label></span><input type="hidden" name="agree[separator]" value=","></td></tr>
    </tbody></table><input type="submit" name="submitConfirm" value="確認画面へ" class="mwform-submit-confirm"><input type="hidden" id="mw_wp_form_token" name="mw_wp_form_token" value="abc"></form></div>`,
    expect: {
      '[name=name]': '山田　太郎',
      '[name=kana]': 'やまだ　たろう',
      '[name=birthday]': '1999/04/01',
      '#gender-1': true,
      '[name="zip[data][0]"]': '150',
      '[name="zip[data][1]"]': '0041',
      '[name=pref]': '東京都',
      '[name=address1]': '渋谷区神南1-2-3',
      '[name=address2]': 'サンプルマンション101',
      '[name="tel[data][0]"]': '090',
      '[name="tel[data][1]"]': '1234',
      '[name="tel[data][2]"]': '5678',
      '[name=email]': 'taro@example.com',
      '[name=email-confirm]': 'taro@example.com',
      '[name=gakureki]': 'サンプル大学',
      '[name=pr]': '',
      '#agree-1': false,
    },
  },

  // ---------------------------------------------------------------------------------------------
  // Typeform 風：1 問ずつのブロック、h1 の質問文（番号と矢印つき）を aria-labelledby、placeholder「ここに回答を入力してください...」、
  // 生年月日は 年／月／日 の 3 つの欄（placeholder だけ）
  {
    name: 'P-Typeform 風：1 問ずつのブロック、「1→」つきの質問文、共通の placeholder、placeholder だけの年／月／日、長文の回答',
    html: `<form class="tf-form"><div class="tf-blocks">
      ${(
        [
          ['お名前（漢字）を教えてください', '<input type="text" class="tf-input" id="tf1" aria-labelledby="tfq1" placeholder="ここに回答を入力してください...">'],
          ['お名前のフリガナを教えてください', '<input type="text" class="tf-input" id="tf2" aria-labelledby="tfq2" placeholder="ここに回答を入力してください...">'],
          ['メールアドレスを教えてください', '<input type="email" class="tf-input" id="tf3" aria-labelledby="tfq3" placeholder="name@example.com">'],
          ['電話番号を教えてください', '<div class="tf-phone"><button type="button" class="tf-country" aria-label="国 Japan">🇯🇵 +81</button><input type="tel" class="tf-input" id="tf4" aria-labelledby="tfq4" placeholder="090-1234-5678"></div>'],
          ['生年月日を教えてください', '<div class="tf-date"><input type="text" class="tf-input" id="tf5y" aria-labelledby="tfq5" placeholder="YYYY" maxlength="4"><span>/</span><input type="text" class="tf-input" id="tf5m" aria-labelledby="tfq5" placeholder="MM" maxlength="2"><span>/</span><input type="text" class="tf-input" id="tf5d" aria-labelledby="tfq5" placeholder="DD" maxlength="2"></div>'],
          ['この会社で挑戦したいことは何ですか？', '<textarea class="tf-input" id="tf6" aria-labelledby="tfq6" placeholder="ここに回答を入力してください..."></textarea>'],
        ] as const
      )
        .map(([q, input], i) => `<div class="tf-block" data-qa="question-wrapper"><h1 class="tf-question" id="tfq${i + 1}"><span class="tf-num">${i + 1}<span aria-hidden="true">→</span></span> ${q} <span class="tf-req">*</span></h1>${input}<button type="button" class="tf-ok">OK ✓</button></div>`)
        .join('')}
    </div></form>`,
    expect: {
      '#tf1': '山田　太郎',
      '#tf2': 'ヤマダ　タロウ',
      '#tf3': 'taro@example.com',
      '#tf4': '090-1234-5678',
      '#tf5y': '1999',
      '#tf5m': '04',
      '#tf5d': '01',
      '#tf6': '',
    },
  },

  // ---------------------------------------------------------------------------------------------
  // 小さな切り出し：休暇中連絡先を「現住所と同じ／異なる」のラジオで聞く形（i-web・MIWS などで見る）
  {
    name: 'P-休暇中連絡先：「現住所と同じ」「現住所と異なる」のラジオ（同じなら「同じ」を選び、下の欄は空のまま）',
    html: `<form><table class="formTable">
      <tr><th>現住所</th><td><input name="addr" size="40"></td></tr>
      <tr><th>休暇中連絡先</th><td><label><input type="radio" name="vac" value="1">現住所と同じ</label><label><input type="radio" name="vac" value="2">現住所と異なる</label></td></tr>
      <tr><th>休暇中住所</th><td><input name="vaddr" size="40"></td></tr>
    </table></form>`,
    expect: { '[name=addr]': '東京都渋谷区神南1-2-3　サンプルマンション101', 'radio:vac': '現住所と同じ', '[name=vaddr]': '' },
  },
  {
    name: 'P-帰省先：「帰省先住所（現住所と異なる場合のみ）」の見出しで、帰省先が現住所と同じなら入れない（チェックボックスなし）',
    html: `<form><dl>
      <dt>現住所</dt><dd><input name="addr" size="40"></dd>
      <dt>帰省先住所<span class="note">（現住所と異なる場合のみ入力）</span></dt><dd><input name="kaddr" size="40"></dd>
      <dt>帰省先電話番号<span class="note">（現住所と異なる場合のみ入力）</span></dt><dd><input name="ktel"></dd>
    </dl></form>`,
    expect: { '[name=addr]': '東京都渋谷区神南1-2-3　サンプルマンション101', '[name=kaddr]': '', '[name=ktel]': '' },
  },
  {
    // マイナビ・リクナビの会員登録画面の「パスワード」は1つだけのことがある。応募フォームでない（ログイン）ときと違い、
    // 氏名・メール・生年月日などがあるので会員登録として入れる。パスワードには入れない
    name: 'P-ナビサイトの会員登録：パスワード1つ＋氏名・メール・生年月日・大学（パスワードには入れない）',
    html: `<form><table>
      <tr><th>メールアドレス（ログインID）</th><td><input name="loginId" type="email"></td></tr>
      <tr><th>パスワード</th><td><input name="pw" type="password"><p>半角英数字8〜20文字</p></td></tr>
      <tr><th>氏名</th><td>姓 <input name="sei"> 名 <input name="mei"></td></tr>
      <tr><th>生年月日</th><td><input name="birth" placeholder="例：20000101" maxlength="8"></td></tr>
      <tr><th>大学名</th><td><input name="univ"></td></tr>
    </table><button>登録する</button></form>`,
    expect: { '[name=loginId]': 'taro@example.com', '[name=pw]': '', '[name=sei]': '山田', '[name=mei]': '太郎', '[name=birth]': '19990401', '[name=univ]': 'サンプル大学' },
  },

  {
    // ナビサイト・ATS でよく見る「〇〇卒」の卒業年度。選択肢の数字は年ではない（26 = 2026 年 3 月卒業）
    name: 'P-ナビサイトの卒業年度：「2026年卒」「27卒」の選択肢',
    html: `<form><table>
      <tr><th>卒業予定年</th><td><select name="a">${opts(['2026年卒', '2027年卒', '2028年卒'])}</select></td></tr>
      <tr><th>卒業年度</th><td><select name="b">${opts(['26卒', '27卒', '28卒', '既卒'])}</select></td></tr>
    </table></form>`,
    expect: { '[name=a]': '2026年卒', '[name=b]': '26卒' },
  },
  {
    // WordPress のフォーム（MW WP Form・CF7）で多い name="birthday" の1欄。name の「day」で日の欄と取り違えない
    name: 'P-WordPress フォームの name="birthday"／name="birth_day" の生年月日1欄',
    html: `<form><table>
      <tr><th>生年月日</th><td><input type="text" name="birthday" size="30"></td></tr>
      <tr><th>生年月日（例：1999/01/01）</th><td><input type="text" name="birth_day" size="30"></td></tr>
    </table></form>`,
    expect: { '[name=birthday]': '1999/04/01', '[name="birth_day"]': '1999/04/01' },
  },
  {
    // 欄の行見出しの列（c-formSection__group__col1 のように class に「Section」を含む div）を、区切りの見出しと取り違えない
    name: 'P-BEM の div グリッド：行見出しの列の class が「…Section__…」でも、区切りの見出し（h2 の帰省先）を使う',
    profile: { kiseiSame: false, kiseiPostalCode: '976-0053', kiseiPrefecture: '福島県', kiseiCity: '相馬市', kiseiAddressLine: '小野字金谷1', kiseiPhone: '0244-12-3456' },
    html: `<form>
      <section class="c-formSection"><h2 class="c-formSection__ttl">現住所</h2>
        <div class="c-formSection__group"><div class="c-formSection__group__col1"><p>住所</p></div><div class="c-formSection__group__col2"><input name="addr" size="40"></div></div>
        <div class="c-formSection__group"><div class="c-formSection__group__col1"><p>電話番号</p></div><div class="c-formSection__group__col2"><input type="tel" name="tel"></div></div>
      </section>
      <section class="c-formSection"><h2 class="c-formSection__ttl">帰省先</h2>
        <div class="c-formSection__group"><div class="c-formSection__group__col1"><p>住所</p></div><div class="c-formSection__group__col2"><input name="kaddr" size="40"></div></div>
        <div class="c-formSection__group"><div class="c-formSection__group__col1"><p>電話番号</p></div><div class="c-formSection__group__col2"><input type="tel" name="ktel"></div></div>
      </section>
    </form>`,
    expect: { '[name=addr]': '東京都渋谷区神南1-2-3　サンプルマンション101', '[name=tel]': '090-1234-5678', '[name=kaddr]': '福島県相馬市小野字金谷1', '[name=ktel]': '0244-12-3456' },
  },
];
