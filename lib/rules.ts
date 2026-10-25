import { isSameAsCurrent, type FieldDescriptor, type ScannedField } from './extract';
import type { FieldKey } from './fieldKeys';
import type { Hints } from './types';
import { hasFullDigit, hasHalfKana, hasHiragana, norm } from './japanese';
import { yesNoOptions } from './values';

export interface Classification {
  key: FieldKey | null;
  confidence: number;
  source: 'rule' | 'ai';
}

type Category =
  | 'emailConfirm' | 'emailSub' | 'email' | 'relation' | 'station' | 'age' | 'nationality'
  | 'schoolType' | 'schoolInitial' | 'schoolOwnership' | 'bunri' | 'graduationStatus' | 'fieldCategory' | 'degree' | 'researchTheme' | 'lab'
  | 'highSchool' | 'admission' | 'educationHistory'
  | 'license' | 'toeic' | 'toefl' | 'eiken' | 'otherLanguage' | 'qualifications' | 'pcSkills'
  | 'club' | 'studyAbroad' | 'partTime' | 'hobbies' | 'specialSkills' | 'github' | 'portfolio'
  | 'desiredLocation' | 'desiredJob' | 'personalRequest'
  | 'desiredSalary' | 'currentSalary' | 'availableDate' | 'employmentType' | 'workHistory' | 'currentJobType' | 'currentCompany'
  | 'roman' | 'birth' | 'gender' | 'postal' | 'phone' | 'prefecture' | 'city' | 'building' | 'address'
  | 'graduation' | 'department' | 'faculty' | 'school' | 'name';

const CONF = { autocomplete: 0.98, near: 0.95, context: 0.9, position: 0.9, section: 0.85, attr: 0.8 } as const;

const PREFECTURE_RE = /^(北海道|(東京)都|(京都|大阪)府|.{2,3}県)$/;

/** 選択肢の中身からカテゴリを決める */
function optionCategory(d: FieldDescriptor): Category | null {
  if (d.kind !== 'select' && d.kind !== 'radio') return null;
  const opts = d.options.map((o) => o.normalize('NFKC').replace(/\s/g, '')).filter(Boolean);
  if (opts.length < 2) return null;
  if (opts.filter((o) => PREFECTURE_RE.test(o)).length >= 7) return 'prefecture';
  // あ・か・さ… の五十音（学校名の頭文字など）
  if (opts.length >= 20 && opts.filter((o) => /^[ぁ-んァ-ン]$/.test(o)).length >= opts.length * 0.8) return 'schoolInitial';
  if (opts.some((o) => /^大学$|^大学\(|学部/.test(o)) && opts.some((o) => /大学院|短期大学|短大|高専|高等専門学校|専門学校/.test(o))) {
    return 'schoolType';
  }
  if (opts.some((o) => /文系/.test(o)) && opts.some((o) => /理系/.test(o))) return 'bunri';
  if (opts.some((o) => /^国立/.test(o)) && opts.some((o) => /^私立/.test(o))) return 'schoolOwnership';
  if (opts.some((o) => /^男(性)?$/.test(o)) && opts.some((o) => /^女(性)?$/.test(o))) return 'gender';
  return null;
}

const AUTOCOMPLETE: Record<string, FieldKey> = {
  name: 'fullName',
  'family-name': 'lastName',
  'given-name': 'firstName',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  'postal-code': 'postalCode',
  'address-level1': 'prefecture',
  'address-level2': 'city',
  'address-line1': 'addressLine',
  'address-line2': 'building',
  'street-address': 'fullAddress',
  bday: 'birthDate',
  'bday-year': 'birthYear',
  'bday-month': 'birthMonth',
  'bday-day': 'birthDay',
  sex: 'gender',
  organization: 'school',
  url: 'portfolioUrl',
};

/**
 * 表示テキスト用のカテゴリ。上から順に評価するので、より具体的なものを先に置く。
 * フリガナ・帰省先・緊急連絡先は「修飾」として別に判定するので、ここには入れない。
 */
const TEXT_RULES: [Category, RegExp][] = [
  ['emailConfirm', /(メール|e-?mail|mail).*(確認|再入力|もう一度|confirm)|(確認|confirm).*(メール|e-?mail)/],
  ['emailSub', /(予備|サブ|携帯|第2|2つ目|セカンド|個人).{0,4}(メール|mail)|(メール|mail).{0,6}(予備|サブ|2)|(携帯|モバイル|スマホ|サブ|予備).{0,3}アドレス/],
  ['email', /メール|e-?mail|mail/],
  ['relation', /続柄|間柄|ご関係/],
  ['station', /最寄|沿線|路線|駅/],
  ['age', /年齢|^age$/],
  ['nationality', /国籍|nationality/],
  ['schoolType', /学校区分|学校種別|学校の種類|学校種類|在籍区分|学歴区分|最終学歴/],
  ['bunri', /文理|文系.{0,3}理系/],
  ['graduationStatus', /卒業区分|卒業状況|見込.{0,2}区分|新卒.{0,3}既卒|卒業見込.{0,4}(区分|有無)/],
  ['fieldCategory', /学科系統|専攻分野|系統/],
  ['degree', /学位|課程/],
  ['researchTheme', /研究テーマ|研究内容|研究課題|卒業論文|卒論|卒業研究|修士論文|修論/],
  ['lab', /研究室|ゼミ|指導教員|指導教官|指導教授/],
  ['highSchool', /高校|高等学校/],
  ['admission', /入学/],
  ['educationHistory', /学歴/],
  ['license', /運転免許|自動車免許|普通免許|車の免許/],
  ['toeic', /toeic/],
  ['toefl', /toefl/],
  ['eiken', /英検|英語検定|実用英語技能/],
  ['otherLanguage', /語学|外国語|英語以外/],
  ['qualifications', /資格|免許/],
  ['pcSkills', /pcスキル|パソコン|itスキル|プログラミング|oaスキル|使用(可能|できる).{0,6}(ソフト|ツール|言語)/],
  ['club', /部活|クラブ|サークル|課外活動/],
  ['studyAbroad', /留学/],
  ['partTime', /アルバイト|バイト/],
  ['hobbies', /趣味/],
  ['specialSkills', /特技/],
  ['github', /github/],
  ['portfolio', /ポートフォリオ|作品|portfolio|^url|ホームページ|webサイト|ウェブサイト/],
  ['desiredLocation', /希望勤務地|勤務希望地|希望.{0,4}勤務地|勤務地.{0,4}希望/],
  ['desiredJob', /希望職種|志望職種|希望.{0,4}職種|職種.{0,4}希望|希望部署|希望部門|^職種/],
  ['personalRequest', /本人希望|希望記入|その他.{0,2}希望|ご希望/],
  ['desiredSalary', /希望年収|希望給与|希望収入/],
  ['currentSalary', /年収/],
  ['availableDate', /入社可能|就業可能|入社希望|入社予定|勤務開始可能|入社.{0,10}時期/],
  ['employmentType', /雇用形態/],
  ['workHistory', /職務経歴|職歴/],
  ['currentJobType', /現在の職種|現職.{0,3}職種/],
  ['currentCompany', /現在の勤務先|現勤務先|在籍企業|現職|勤務先|会社名/],
  ['roman', /ローマ字|英字|アルファベット|roman|english name/],
  ['birth', /生年月日|誕生日|生年|生まれ|birth|bday|date of birth|dob/],
  ['gender', /性別|gender|^sex/],
  ['postal', /郵便番号|〒|postal|zip/],
  ['phone', /電話|携帯|(^|[^a-z])tel([^a-z]|$)|phone|mobile/],
  ['prefecture', /都道府県|prefecture/],
  ['city', /市区町村|市町村|市区郡|市区|^city/],
  ['building', /建物|マンション|アパート|building|apartment/],
  ['address', /住所|番地|所在地|address/],
  ['graduation', /卒業|修了|graduat/],
  ['department', /学科|専攻|コース|department|major/],
  ['faculty', /学部|研究科|faculty/],
  ['schoolOwnership', /設置区分|設置者|国公私立|国・公・私立/],
  ['schoolInitial', /頭文字|最初の.?文字|1文字目|一文字目|イニシャル/],
  ['school', /学校名|大学名|大学|学校|school|university|college/],
  ['name', /氏名|名前|姓名|姓|^名|full ?name|last ?name|first ?name|family ?name|given ?name|^name$|^your name/],
];

/** name / id 属性用 */
const ATTR_RULES: [Category, RegExp][] = [
  ['emailConfirm', /mail.*(conf|check|again|re\b)|re_?mail|confirm.*mail/],
  ['emailSub', /(sub|mobile|keitai|second|2)_?mail|mail_?(sub|2)/],
  ['email', /mail/],
  ['station', /station|eki/],
  ['age', /(^|[^a-z])age([^a-z]|$)|nenrei/],
  ['nationality', /nationality|kokuseki/],
  ['schoolType', /school_?type|gakko_?kubun/],
  ['bunri', /bunri/],
  ['lab', /(^|[^a-z])(lab|zemi|seminar)/],
  ['highSchool', /high_?school|koko/],
  ['admission', /admission|enroll|nyugaku/],
  ['license', /license|menkyo/],
  ['toeic', /toeic/],
  ['toefl', /toefl/],
  ['eiken', /eiken/],
  ['qualifications', /qualif|certif|shikaku/],
  ['club', /club|circle|bukatsu/],
  ['hobbies', /hobby|hobbies|shumi/],
  ['github', /github/],
  ['portfolio', /portfolio|website|(^|[^a-z])url/],
  // strength・challenge の eng に当たらないように
  ['roman', /roma|alpha|(^|[^a-z])eng|english/],
  ['birth', /birth|bday|dob|seinen/],
  ['gender', /gender|\bsex\b|seibetsu/],
  ['postal', /zip|postal|yubin|post_?code|postcode/],
  ['phone', /tel|phone|mobile|keitai/],
  ['prefecture', /pref(?!er)|todofuken/],
  ['city', /city|shiku|municipal/],
  ['building', /build|bldg|apart|mansion|address_?2|addr_?2|address_?line_?2/],
  ['address', /addr|address|banchi|street/],
  // grade（学年）は卒業ではない
  ['graduation', /grad(?!e)|sotsugyo/],
  ['department', /dept|department|gakka|major/],
  ['faculty', /faculty|gakubu/],
  ['school', /school|univ|college|gakko|daigaku/],
  ['name', /(^|[^a-z])(name|sei|mei|shimei|namae)([^a-z]|$)|lastname|firstname|familyname|givenname|lname|fname/],
];

/** 本人以外の人を指す言葉（紹介者のお名前・保護者の電話番号など） */
const OTHER_PERSON = /紹介者|推薦者|保護者|担当者|代表者|上司|配偶者|父親|母親|ご両親|家族|保証人|面接官|社員|知人|友人/;
/** 区切りの見出し（h3「保護者連絡先」など）で本人以外とわかる言葉。「担当者からのお知らせ」のような見出しは含めない */
const OTHER_PERSON_SECTION = /紹介者|推薦者|保護者|配偶者|父親|母親|ご両親|家族|保証人/;
const PERSONAL_CATEGORIES = new Set<string>(['name', 'roman', 'phone', 'email', 'emailSub', 'emailConfirm', 'birth', 'address']);

const KANA_TEXT = /フリガナ|ふりがな|よみがな|ひらがな|平仮名|カナ|かな|kana|furigana/g;
const KANA_ATTR = /kana|furi|yomi/;
const KANA_WORD = /フリガナ|ふりがな|よみがな|ひらがな|平仮名|カナ|かな|kana|furigana|^セイ(?![ァ-ヶ])|^メイ(?![ァ-ヶ])/;
const KISEI = /帰省|休暇中|実家|kisei/;
const EMERGENCY = /緊急|emergency|kinkyu/;
const PHOTO = /写真|photo|画像|顔/;

function firstMatch(rules: [Category, RegExp][], text: string): Category | null {
  if (!text) return null;
  for (const [cat, re] of rules) if (re.test(text)) return cat;
  return null;
}

/** 修飾（フリガナ・帰省先・緊急連絡先）を除いたテキストでカテゴリを決める */
function stripModifiers(text: string) {
  return text
    .replace(/^\s*(セイ|メイ)(?![ァ-ヶ])/, (m) => (m.includes('セイ') ? '姓' : '名'))
    .replace(KANA_TEXT, ' ')
    .trim();
}

/** 文章の欄（textarea）に入れてよい項目。それ以外はラベルに直接書かれていないと入れない */
const TEXTAREA_KEYS = new Set<FieldKey>([
  'fullAddress', 'kiseiFullAddress', 'educationHistory', 'qualifications', 'pcSkills', 'otherLanguage',
  'researchTheme', 'studyAbroad', 'partTime', 'hobbies', 'specialSkills', 'hobbiesAndSkills',
  'personalRequest', 'workHistory', 'club', 'desiredJob',
]);

export function classify(d: FieldDescriptor): Classification {
  const c = classifyField(d);
  // 自己PR などの文章欄に、周りの見出しから推測した氏名などを入れてしまわないように
  if (d.kind === 'textarea' && c.key && !TEXTAREA_KEYS.has(c.key) && c.confidence < CONF.near) {
    return { key: null, confidence: 0, source: 'rule' };
  }
  return c;
}

function classifyField(d: FieldDescriptor): Classification {
  const nearRaw = [d.label, d.prefix, d.placeholder].join(' ');
  const near = norm(nearRaw);
  const ctx = norm(d.context);
  const section = norm(d.section);
  const attrs = norm(`${d.name} ${d.htmlId}`);
  const result = (key: FieldKey | null, c: number): Classification => ({ key, confidence: key ? c : 0, source: 'rule' });

  // autocomplete は本人の項目しか表せないので、フリガナ・帰省先・緊急連絡先・本人以外の欄ではラベルで判定する
  const ac = d.autocomplete.toLowerCase().split(/\s+/).pop() ?? '';
  if (AUTOCOMPLETE[ac] && d.kind !== 'file') {
    const scope = `${near} ${ctx} ${section} ${attrs}`;
    const kanaHere = KANA_WORD.test(near) || KANA_ATTR.test(attrs) || (!firstMatch(TEXT_RULES, stripModifiers(near)) && KANA_WORD.test(ctx));
    const modified =
      kanaHere || KISEI.test(scope) || EMERGENCY.test(scope) || OTHER_PERSON.test(`${near} ${ctx}`) || OTHER_PERSON_SECTION.test(section);
    if (!modified) return { key: AUTOCOMPLETE[ac], confidence: CONF.autocomplete, source: 'rule' };
  }

  if (d.kind === 'checkbox') {
    // 抽出の時点で「現住所と同じ」系のチェックボックスだけに絞っている
    return result('kiseiSameCheck', CONF.near);
  }
  // 「帰省先は現住所と同じですか ［はい］［いいえ］」もチェックボックスと同じ扱い
  if (isYesNo(d) && isSameAsCurrent(`${near} ${ctx}`)) return result('kiseiSameCheck', CONF.near);

  if (d.kind === 'file') {
    // 履歴書 PDF などのアップロード欄には入れない
    const all = `${near} ${ctx} ${attrs}`;
    if (/履歴書|resume|cv|pdf|書類|成績/.test(all)) return result(null, 0);
    if (PHOTO.test(all)) return result('photo', PHOTO.test(near) ? CONF.near : CONF.context);
    if (/image/.test(d.accept)) return result('photo', CONF.attr);
    return result(null, 0);
  }

  // フリガナは、カテゴリが見つかった段階かそれより手前（欄に近い側）で出てきたものだけを採用する
  // プルダウン・ラジオは、選択肢の中身（都道府県が47個並んでいる、など）がいちばん確かな手がかり
  let cat: Category | null = optionCategory(d);
  if (cat === 'prefecture') {
    // 都道府県が並んでいても、見出しが希望勤務地なら希望勤務地。出身地・本籍地はプロフィールにないので入れない
    if (/出身地|出生地|本籍/.test(`${near} ${ctx}`)) return result(null, 0);
    if ((firstMatch(TEXT_RULES, stripModifiers(near)) ?? firstMatch(TEXT_RULES, stripModifiers(ctx))) === 'desiredLocation') cat = 'desiredLocation';
  }
  let conf: number = cat ? CONF.context : 0;
  let kana = false;
  for (const [text, c, rules, isAttr] of [
    [near, CONF.near, TEXT_RULES, false],
    [ctx, CONF.context, TEXT_RULES, false],
    [section, CONF.section, TEXT_RULES, false],
    [attrs, CONF.attr, ATTR_RULES, true],
  ] as const) {
    if (cat) break;
    kana ||= isAttr ? KANA_ATTR.test(text) : KANA_WORD.test(text);
    cat = firstMatch(rules, isAttr ? text : stripModifiers(text));
    if (cat) {
      conf = c;
      break;
    }
  }
  if (!cat && d.kind === 'email') [cat, conf] = ['email', CONF.near];
  if (!cat && d.kind === 'tel') [cat, conf] = ['phone', CONF.near];
  if (!cat && kana) [cat, conf] = ['name', CONF.context];
  if (!cat) return result(null, 0);

  const scopeText = `${near} ${ctx} ${section} ${attrs}`;
  // 「帰省先住所（現住所と異なる場合のみ記入）」は帰省先なので、「現住所と異なる」のような言い回しは除いて見る
  const kisei = KISEI.test(scopeText) && !/現住所/.test(`${near} ${ctx}`.replace(/現住所と(異なる|違う|同じ|同一)/g, ''));
  const emergency = EMERGENCY.test(scopeText);
  const byPosition = Math.min(conf, CONF.position);
  const r = (key: FieldKey, c = conf) => result(key, c);
  const has = (re: RegExp) => re.test(near) || re.test(ctx);

  // 紹介者・保護者など、本人以外の人の欄には本人の情報を入れない
  if (!emergency && (OTHER_PERSON.test(`${near} ${ctx}`) || OTHER_PERSON_SECTION.test(section)) && PERSONAL_CATEGORIES.has(cat)) {
    return result(null, 0);
  }
  // 内線・FAX は電話番号ではない
  if (cat === 'phone' && (/内線|\bext\b/i.test(near) || /fax|ファックス|ファクス/i.test(`${near} ${ctx}`))) return result(null, 0);

  // 欄の前後に @ があれば、見出しが何であってもメールアドレス
  const atSign = /[@＠]$/.test(d.prefix.trim()) || /^[@＠]/.test(d.suffix.trim());
  if (atSign && cat !== 'email' && cat !== 'emailConfirm' && cat !== 'emailSub') {
    cat = has(/携帯|モバイル|スマホ|サブ|予備/) ? 'emailSub' : 'email';
  }
  // 緊急連絡先は氏名・続柄・電話番号しか登録していない。フリガナ・住所・メールなどに本人の情報を入れない
  if (emergency && !((cat === 'name' && !kana) || cat === 'relation' || (cat === 'phone' && d.groupSize !== 3))) return result(null, 0);
  // 「卒業学校名」「卒業学部」のように、卒業した学校の名前を聞いている文字の欄
  if (cat === 'graduation' && d.kind === 'text' && !isDateLike(d, near) && !/年|月|日|時期|date|year/.test(`${near} ${ctx}`)) {
    const again = firstMatch(TEXT_RULES, stripModifiers(`${near} ${ctx}`.replace(/卒業/g, '')));
    if (again === 'school' || again === 'faculty' || again === 'department') cat = again;
  }

  switch (cat) {
    case 'name':
    case 'roman': {
      if (emergency && !kana) return r('emergencyName');
      // 旧姓・通称はプロフィールにないので入れない
      if (has(/旧姓|旧氏|通称/)) return result(null, 0);
      // 「First name」「Last name」のように見出しが英語だけなら、ローマ字の名前を入れる（「Last Name (Kanji)」は漢字）
      const shownLabel = (nearRaw.trim() || d.context).trim();
      const englishOnly = !!shownLabel && /[a-z]/i.test(shownLabel) && !/[぀-ヿ㐀-鿿]/.test(shownLabel) && !/kanji/i.test(shownLabel);
      const keys = (
        cat === 'roman' || (englishOnly && !kana)
          ? ['fullNameRoman', 'lastNameRoman', 'firstNameRoman']
          : kana
            ? ['fullNameKana', 'lastNameKana', 'firstNameKana']
            : ['fullName', 'lastName', 'firstName']
      ) as [FieldKey, FieldKey, FieldKey];
      // 欄の横にラベルがなければ、行の見出し（「姓」「セイ」だけの th など）で姓・名を分ける
      const part = namePart(nearRaw.trim() ? nearRaw : d.context, attrs);
      if (part) return r(part === 'last' ? keys[1] : keys[2]);
      if (d.groupSize === 2) return r(d.groupIndex === 0 ? keys[1] : keys[2], byPosition);
      return r(keys[0]);
    }
    case 'birth':
      return dateKey(d, attrs, conf, ['birthDate', 'birthYear', 'birthMonth', 'birthDay']);
    case 'graduation':
      return dateKey(d, attrs, conf, ['graduation', 'graduationYear', 'graduationMonth', null]);
    case 'admission':
      return dateKey(d, attrs, conf, ['admission', 'admissionYear', 'admissionMonth', null]);
    case 'phone': {
      if (emergency) return r('emergencyPhone');
      if (kisei) {
        if (d.groupSize === 3) return r((['kiseiPhone1', 'kiseiPhone2', 'kiseiPhone3'] as const)[d.groupIndex]!, byPosition);
        return r('kiseiPhone');
      }
      const landline = has(/自宅|固定|家の電話|home/) && !has(/携帯|モバイル|mobile/);
      if (d.groupSize === 3) {
        const parts = landline ? (['landline1', 'landline2', 'landline3'] as const) : (['phone1', 'phone2', 'phone3'] as const);
        return r(parts[d.groupIndex]!, byPosition);
      }
      return r(landline ? 'landline' : 'phone');
    }
    case 'postal': {
      const [full, a, b] = (
        kisei ? ['kiseiPostalCode', 'kiseiPostalCode1', 'kiseiPostalCode2'] : ['postalCode', 'postalCode1', 'postalCode2']
      ) as [FieldKey, FieldKey, FieldKey];
      if (d.groupSize === 2) return r(d.groupIndex === 0 ? a : b, byPosition);
      return r(full);
    }
    case 'prefecture':
      if (has(/高校|高等学校/) && !has(/住所/)) return r('highSchoolPrefecture');
      if (has(/学校|大学|所在地/) && !has(/住所/)) return r('schoolPrefecture');
      return r(kana ? 'prefectureKana' : kisei ? 'kiseiPrefecture' : 'prefecture');
    case 'city':
      // 「市区郡・地名・番地」のように番地までまとめて入れる欄
      if (!kana && has(/番地|地名|町名|丁目/)) return r(kisei ? 'kiseiCityAddressLine' : 'cityAddressLine');
      return r(kana ? 'cityKana' : kisei ? 'kiseiCity' : 'city');
    case 'building':
      // 「番地・建物名」のように1つの欄にまとめる形
      if (!kana && !kisei && has(/番地|町名|丁目/)) return r('addressLineBuilding');
      return r(kana ? 'buildingKana' : kisei ? 'kiseiBuilding' : 'building');
    case 'address': {
      // 行見出しが「番地」で placeholder が入力例のこともあるので、両方を見る
      const line = /番地|町名|丁目|住所\s*1|address ?(line ?)?1/.test(`${near} ${ctx}`);
      const second = /住所\s*2|address ?(line ?)?2/.test(near || ctx);
      if (kana) return r(line ? 'addressLineKana' : second ? 'buildingKana' : 'fullAddressKana');
      if (kisei) return r(line ? 'kiseiAddressLine' : second ? 'kiseiBuilding' : 'kiseiFullAddress');
      return r(line ? 'addressLine' : second ? 'building' : 'fullAddress');
    }
    case 'email':
    case 'emailConfirm':
    case 'emailSub': {
      // ［taro］@［example.com］のように @ の前後で分かれた欄。
      // @ が CSS で描かれていて文字として取れないこともあるので、2つの欄が横に並んでいるかでも判断する。
      // 「入力」と「確認用」は縦に並ぶので分けない
      const [local, domain] = (cat === 'emailSub' ? ['emailSubLocal', 'emailSubDomain'] : ['emailLocal', 'emailDomain']) as [
        FieldKey,
        FieldKey,
      ];
      if (/[@＠]$/.test(d.prefix.trim())) return r(domain, byPosition);
      if (/^[@＠]/.test(d.suffix.trim())) return r(local, byPosition);
      // 「アドレス［　］ 確認用［　］」のように横に並ぶ形もあるので、確認用と書かれていたら分けない
      const confirmLabel = /確認|再入力|もう一度/.test(near);
      // それぞれの欄に専用のラベル（「メールアドレス2」「確認用」）があれば、横並びでも別々のアドレス欄
      if (d.groupSize >= 2 && d.lineSize === 2 && !confirmLabel && !d.label) return r(d.lineIndex === 0 ? local : domain, byPosition);
      return r(cat);
    }
    case 'relation':
      return r('emergencyRelation');
    case 'station':
      if (/線$/.test(d.suffix.trim()) || has(/路線|沿線|線名/)) return r('nearestLine');
      if (d.groupSize === 2 && !/駅$/.test(d.suffix.trim())) return r(d.groupIndex === 0 ? 'nearestLine' : 'nearestStation', byPosition);
      return r('nearestStation');
    case 'highSchool': {
      // 高卒認定試験は高校を卒業していない人向けの質問なので触らない
      if (has(/認定試験|高認|大検/)) return result(null, 0);
      if (isYesNo(d)) return r(has(/卒業/) ? 'highSchoolGraduated' : 'highSchool', has(/卒業/) ? conf : 0);
      const dateLike = isDateLike(d, near) || d.kind === 'select';
      // 「高校入学年月 [年▼]年 [月▼]月」のように、年と月が分かれた欄もある
      if (dateLike && has(/入学/)) {
        return dateKey(d, attrs, conf, ['highSchoolAdmission', 'highSchoolAdmissionYear', 'highSchoolAdmissionMonth', null]);
      }
      if (dateLike && has(/卒業/)) {
        return dateKey(d, attrs, conf, ['highSchoolGraduation', 'highSchoolGraduationYear', 'highSchoolGraduationMonth', null]);
      }
      return r('highSchool');
    }
    case 'educationHistory':
      if (d.kind === 'textarea') return r('educationHistory');
      if (d.kind === 'select' || d.kind === 'radio') return r('schoolType');
      // 履歴書形式の「学歴・職歴」の1行の欄には入れない（「最終学歴」「学校名」とはっきり書かれていれば学校名）
      return /学校名|最終学歴/.test(near) ? r('school', Math.min(conf, 0.85)) : result(null, 0);
    case 'lab':
      return r(has(/教員|教官|教授|先生/) ? 'advisor' : 'lab');
    case 'license':
      return r(isDateLike(d, near) ? 'driverLicenseDate' : 'driverLicense');
    case 'toeic':
      return r(isDateLike(d, near) ? 'toeicDate' : 'toeic');
    case 'club':
      return r(has(/役職|役割|ポジション/) ? 'clubRole' : 'club');
    case 'hobbies':
      return r(has(/特技/) ? 'hobbiesAndSkills' : 'hobbies');
    case 'github':
      return r('githubUrl');
    case 'portfolio':
      return r('portfolioUrl');
    case 'school':
      return r(kana ? 'schoolKana' : 'school');
    case 'faculty':
    case 'department':
      // 学部・学科の読み仮名はプロフィールにないので入れない
      return kana ? result(null, 0) : r(cat);
    case 'desiredLocation': {
      const m = /第\s*([1-3])/.exec(norm(`${near} ${d.prefix}`)) ?? /([1-3])$/.exec(attrs.trim());
      const n = m ? Number(m[1]) : d.groupSize > 1 ? d.groupIndex + 1 : 1;
      if (n > 3) return result(null, 0);
      return r(`desiredLocation${n}` as FieldKey, m ? conf : byPosition);
    }
    default:
      return r(cat);
  }
}

const EMAIL_KEYS = new Set<FieldKey>(['email', 'emailConfirm', 'emailSub', 'emailSubConfirm']);

const MOBILE =/携帯|モバイル|mobile|keitai|cell/;
const PHONE_TO_LANDLINE: Partial<Record<FieldKey, FieldKey>> = {
  phone: 'landline',
  phone1: 'landline1',
  phone2: 'landline2',
  phone3: 'landline3',
};

/** 現住所の欄と、それに当たる帰省先の欄 */
const ADDRESS_TO_KISEI: Partial<Record<FieldKey, FieldKey>> = {
  postalCode: 'kiseiPostalCode',
  postalCode1: 'kiseiPostalCode1',
  postalCode2: 'kiseiPostalCode2',
  prefecture: 'kiseiPrefecture',
  city: 'kiseiCity',
  addressLine: 'kiseiAddressLine',
  addressLineBuilding: 'kiseiAddressLine',
  building: 'kiseiBuilding',
  fullAddress: 'kiseiFullAddress',
  cityAddressLine: 'kiseiCityAddressLine',
  cityAddressLineBuilding: 'kiseiCityAddressLine',
};

/**
 * フォーム全体を見て判定を調整する。
 * 「電話番号」と「携帯電話番号」が両方あるときは、ただの「電話番号」を自宅の電話として扱う。
 */
export function adjustForForm(fields: ScannedField[], input: Classification[]): Classification[] {
  let classes = input;
  const isPhone = (c: Classification) => !!c.key && c.key in PHONE_TO_LANDLINE;
  // 入力例が 090・080・070 で始まる欄も携帯の欄（見出しが「電話番号」だけのことがある）
  const mentionsMobile = (d: FieldDescriptor) =>
    MOBILE.test(norm(`${d.label} ${d.prefix} ${d.context} ${d.name} ${d.htmlId}`)) || /(^|\D)0[789]0\D?\d{4}/.test(norm(d.placeholder));
  // 同じ <form> の中だけで比べる（form がなければページ全体）
  const formOf = (f: ScannedField) => (f.elements[0] as HTMLInputElement).form ?? null;
  const forms = new Map<HTMLFormElement | null, { mobile: boolean; plain: boolean }>();
  fields.forEach((f, i) => {
    if (!isPhone(classes[i]!)) return;
    const s = forms.get(formOf(f)) ?? { mobile: false, plain: false };
    if (mentionsMobile(f.desc)) s.mobile = true;
    else s.plain = true;
    forms.set(formOf(f), s);
  });
  // 「住所」の欄と別に都道府県・建物名の欄があるなら、住所の欄にはそれを重ねて入れない
  const addressParts = new Map<HTMLFormElement | null, Set<string>>();
  fields.forEach((f, i) => {
    const key = classes[i]!.key;
    if (!key) return;
    const set = addressParts.get(formOf(f)) ?? new Set<string>();
    set.add(key);
    addressParts.set(formOf(f), set);
  });
  const narrowAddress = (key: FieldKey, f: ScannedField): FieldKey => {
    const parts = addressParts.get(formOf(f)) ?? new Set<string>();
    const hasPref = parts.has('prefecture');
    const hasBuilding = parts.has('building');
    if (key === 'fullAddress') {
      if (hasPref && hasBuilding) return 'cityAddressLine';
      if (hasPref) return 'cityAddressLineBuilding';
      if (hasBuilding) return 'fullAddressNoBuilding';
    }
    if (key === 'kiseiFullAddress' && parts.has('kiseiPrefecture')) return 'kiseiCityAddressLine';
    if (key === 'cityAddressLineBuilding' && hasBuilding) return 'cityAddressLine';
    if (key === 'addressLineBuilding' && hasBuilding) return 'addressLine';
    return key;
  };
  classes = classes.map((c, i) => (c.key ? { ...c, key: narrowAddress(c.key, fields[i]!) } : c));

  // 「現住所と同じ／帰省先がない場合はチェック」のすぐ後ろに、現住所と同じ並びの住所の欄がもう一度あれば、それは帰省先の欄
  // （snar.jp は帰省先の見出しがチェックボックスの行にしかなく、欄ごとの見出しは「郵便番号」「都道府県」だけ）
  const seen = new Map<HTMLFormElement | null, Set<FieldKey>>();
  let kiseiBlock: HTMLFormElement | null | undefined;
  classes = classes.map((c, i) => {
    const form = formOf(fields[i]!);
    if (c.key === 'kiseiSameCheck') {
      kiseiBlock = form;
      return c;
    }
    const kiseiKey = c.key ? ADDRESS_TO_KISEI[c.key] : undefined;
    if (kiseiBlock !== undefined && kiseiBlock === form && kiseiKey && seen.get(form)?.has(c.key!)) return { ...c, key: kiseiKey };
    // 住所の欄でないものが出てきたら、帰省先の並びは終わり
    if (c.key) kiseiBlock = undefined;
    if (kiseiKey) seen.set(form, (seen.get(form) ?? new Set<FieldKey>()).add(c.key!));
    return c;
  });

  // 学校区分・頭文字と同じフォームにあり、住所の欄がない都道府県は「学校の所在地」
  const schoolForms = new Set<HTMLFormElement | null>();
  const addressForms = new Set<HTMLFormElement | null>();
  fields.forEach((f, i) => {
    const key = classes[i]!.key;
    if (key === 'schoolType' || key === 'schoolInitial') schoolForms.add(formOf(f));
    if (key && /^(postalCode|city|addressLine|fullAddress|cityAddressLine)/.test(key)) addressForms.add(formOf(f));
  });

  return classes.map((c, i) => {
    const f = fields[i]!;
    // 「確認用」「再入力」とラベルに書かれた欄は、見出しが何であっても直前のメール欄の確認用。
    // 「メールアドレス2」の確認用なら予備のアドレスを入れる
    // 行見出しが「再入力」だけの行（snar.jp）も、その欄専用のラベルとみなす
    const shortContext = f.desc.context.length <= 10 ? f.desc.context : '';
    const ownLabel = `${f.desc.label} ${f.desc.prefix} ${shortContext}`;
    const confirmLike = c.key === 'emailConfirm' || (/確認|再入力|もう一度|confirm/i.test(ownLabel) && f.desc.kind !== 'select');
    if (confirmLike && (!c.key || EMAIL_KEYS.has(c.key))) {
      for (let j = i - 1; j >= Math.max(0, i - 2); j--) {
        const prev = classes[j]?.key;
        if (prev === 'emailSub') return { key: 'emailSubConfirm', confidence: Math.max(c.confidence, CONF.context), source: c.source };
        if (prev === 'email') return { key: 'emailConfirm', confidence: Math.max(c.confidence, CONF.context), source: c.source };
      }
    }
    // ［平成▼］［  ］年 のように、元号の欄のすぐ後ろの年は和暦の数字
    if (c.key === 'birthYear' && classes[i - 1]?.key === 'birthEra' && f.desc.kind !== 'select') {
      return { ...c, key: 'birthEraYear' };
    }
    if (c.key === 'prefecture' && schoolForms.has(formOf(f)) && !addressForms.has(formOf(f))) {
      return { ...c, key: 'schoolPrefecture' };
    }
    const s = forms.get(formOf(f));
    if (!isPhone(c) || !s?.mobile || !s.plain || mentionsMobile(f.desc)) return c;
    return { ...c, key: PHONE_TO_LANDLINE[c.key!]! };
  });
}

function namePart(nearRaw: string, attrs: string): 'last' | 'first' | null {
  const t = nearRaw.replace(/氏名|姓名|お名前|名前|フリガナ|ふりがな|ローマ字|緊急連絡先/g, '');
  const last = /姓|せい|セイ|ｾｲ|苗字|名字|last|family|surname/i.test(t);
  const first = /名|めい|メイ|ﾒｲ|first|given/i.test(t.replace(/苗字|名字/g, ''));
  // 「フリガナ（セイ・メイ）」「氏名（姓・名）」は1つの欄に両方を入れる
  if (last && first) return null;
  if (last) return 'last';
  if (first) return 'first';
  if (/last|family|(^|[^a-z])sei([^a-z]|$)|lname/.test(attrs)) return 'last';
  if (/first|given|(^|[^a-z])mei([^a-z]|$)|fname/.test(attrs)) return 'first';
  return null;
}

const YES = /^(はい|あり|有り?|yes|ある|いる|している)$/i;
const NO = /^(いいえ|なし|無し?|no|ない|いない|していない)$/i;

/** 「はい／いいえ」「あり／なし」で答える欄か */
export function isYesNo(d: FieldDescriptor): boolean {
  if (d.kind !== 'radio' && d.kind !== 'select') return false;
  const opts = d.options.map((o) => o.normalize('NFKC').replace(/\s/g, '')).filter((o) => o && !/^[\-‐‑‒–—―−ー▼\s]*$|選択/.test(o));
  if (opts.length < 2 || opts.length > 3) return false;
  return (opts.some((o) => YES.test(o)) && opts.some((o) => NO.test(o))) || !!yesNoOptions(opts);
}

/** 「取得年月」「受験日」など、資格そのものではなく日付を聞いている欄か */
function isDateLike(d: FieldDescriptor, near: string): boolean {
  if (d.kind === 'date' || d.kind === 'month') return true;
  return /取得|受験|年月|時期|日付/.test(near) || d.options.some((o) => /^(19|20)\d\d/.test(o));
}

function dateKey(
  d: FieldDescriptor,
  attrs: string,
  conf: number,
  [full, y, m, dd]: [FieldKey, FieldKey, FieldKey, FieldKey | null],
): Classification {
  const r = (key: FieldKey, c = conf): Classification => ({ key, confidence: c, source: 'rule' });
  const byPosition = Math.min(conf, CONF.position);
  if (d.kind === 'date' || d.kind === 'month') return r(full);
  const part = datePart(d, attrs);
  if (part === 'era') return full === 'birthDate' ? r('birthEra') : { key: null, confidence: 0, source: 'rule' };
  if (part === 'year') return r(y);
  if (part === 'month') return r(m);
  if (part === 'day' && dd) return r(dd);
  if (d.groupSize === 3 && dd) return r([y, m, dd][d.groupIndex]!, byPosition);
  if (d.groupSize === 4 && full === 'birthDate') return r((['birthEra', y, m, dd!] as FieldKey[])[d.groupIndex]!, byPosition);
  if (d.groupSize === 2 && !dd) return r([y, m][d.groupIndex]!, byPosition);
  return r(full);
}

const MONTH_NAMES = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;

function datePart(d: FieldDescriptor, attrs: string): 'era' | 'year' | 'month' | 'day' | null {
  const unit = (s: string) => {
    const t = s.replace(/生年月日|誕生日|卒業予定年月|卒業年月日?|入学年月日?|年月日|年月/g, '');
    if (/年|year|yyyy/i.test(t)) return 'year';
    if (/月|month/i.test(t)) return 'month';
    if (/日|day/i.test(t)) return 'day';
    return null;
  };
  // 「YYYY/MM/DD」「例：1999/04/01」「例：2026年3月」「YYYY/MM」のように年月（日）をまとめて入れる欄
  const sample = norm(`${d.placeholder} ${d.label}`);
  if (/y{2,4}\s*[\/\-.年]?\s*m{1,2}|\d{4}\s*[\/\-.年]\s*\d{1,2}|\d{8}/.test(sample)) return null;

  // 直前のテキストは前の欄の単位（「年」の後ろに月の欄…）なので見ない
  const fromSuffix = unit(d.suffix);
  if (fromSuffix) return fromSuffix;

  if (d.options.length) {
    if (d.options.filter((o) => MONTH_NAMES.test(o)).length >= 6) return 'month';
    // 元号だけの選択肢（［昭和／平成／令和］）
    if (d.options.some((o) => /平成|昭和|令和/.test(o)) && !d.options.some((o) => /\d/.test(o.normalize('NFKC')))) return 'era';
    if (d.options.some((o) => /平成|昭和|令和/.test(o))) return 'year';
    const nums = d.options.map((o) => parseInt(norm(o).replace(/[^\d]/g, ''), 10)).filter(Number.isFinite);
    if (nums.filter((n) => n >= 1900).length >= 5) return 'year';
    const max = Math.max(...nums);
    if (max <= 12 && nums.length >= 10) return 'month';
    if (max <= 31 && nums.length >= 28) return 'day';
  }

  const fromLabel = unit(`${d.label} ${d.placeholder}`);
  if (fromLabel) return fromLabel;
  if (/year|(^|_)y($|_)|yyyy/.test(attrs)) return 'year';
  if (/month|(^|_)m($|_)|mm/.test(attrs)) return 'month';
  if (/day|(^|_)d($|_)|dd/.test(attrs)) return 'day';
  return null;
}

/** 「半角カナ不可」「全角文字は使用できません」「和暦不可」のように、使えない書式を書いた部分 */
const NEGATED = /(全角|半角|和暦|西暦)(?:(?!全角|半角|和暦|西暦)[^、。,，\s])*?(不可|禁止|ng|は使用できません|は使えません)/gi;

export function computeHints(d: FieldDescriptor): Hints {
  const text = [d.label, d.prefix, d.suffix, d.context, d.placeholder].join(' ').replace(NEGATED, ' ');
  const options = d.options.join(' ');
  // 「全角カタカナで入力してください」のような説明の placeholder は入力例ではない
  const sample = /入力|ください|して/.test(d.placeholder) ? '' : d.placeholder;

  let kana: Hints['kana'] = 'kata';
  if ((/半角/.test(text) && /カナ|ｶﾅ|ﾌﾘｶﾞﾅ/.test(text)) || hasHalfKana(sample)) kana = 'half';
  // 「カタカナ」「カナ」と書かれていれば、見出しが「ふりがな」でもカタカナ
  else if (/カタカナ|カナ/.test(text) && !/ひらがな|平仮名/.test(text)) kana = 'kata';
  else if (hasHiragana(sample)) kana = 'hira';
  // placeholder の例がカタカナなら、見出しが「ふりがな」でもカタカナ
  else if (/[ァ-ヶ]/.test(sample)) kana = 'kata';
  else if (/ふりがな|ひらがな|平仮名/.test(text)) kana = 'hira';

  let width: Hints['width'] = null;
  if (/全角/.test(text) && !/全角カナ/.test(text)) width = 'full';
  else if (/半角/.test(text)) width = 'half';
  else if (hasFullDigit(sample)) width = 'full';

  let era: Hints['era'] = null;
  const hasWareki = /平成|昭和|令和/.test(options);
  const hasSeireki = /(19|20)\d\d/.test(options);
  if ((hasWareki && !hasSeireki) || /和暦/.test(text)) era = 'wareki';
  else if ((hasSeireki && !hasWareki) || /西暦/.test(text)) era = 'seireki';

  let hyphen: Hints['hyphen'] = null;
  if (/ハイフン(なし|無し|不要|を除|は不要|抜き|を入れず)|ハイフンを?入れないで|[\-‐‑‒–—―−ー－ｰ]なし|数字のみ|\d+桁/.test(text)) hyphen = false;
  else if (/ハイフン(あり|有り|を含|付き|を入れて)/.test(text)) hyphen = true;
  else if (/\d[\-‐‑‒–—―−ー－ｰ]\d/.test(d.placeholder)) hyphen = true;
  else if (/^\d{7,11}$/.test(norm(d.placeholder).replace(/^例[:：)）]?\s*/, ''))) hyphen = false;
  else if (d.maxLength === 7 || d.maxLength === 10 || d.maxLength === 11) hyphen = false;

  let dateFormat: Hints['dateFormat'] = null;
  const ph = norm(d.placeholder);
  if (/\d{8}|yyyymmdd|8桁/.test(ph + text) || d.maxLength === 8) dateFormat = 'compact';
  else if (/年/.test(ph)) dateFormat = 'kanji';
  else if (/\d{4}-\d|yyyy-/.test(ph)) dateFormat = 'hyphen';
  else if (/\d{4}\/\d|yyyy\//.test(ph)) dateFormat = 'slash';

  // 「例）山田 太郎」「ヤマダタロウ」のような例から、姓と名の間のスペースを決める
  let nameSpace: Hints['nameSpace'] = null;
  const example = sample.replace(/^\s*(例|e\.?g\.?)\s*[:：)）]?\s*/i, '').trim();
  if (/[^\s　]　[^\s　]/.test(example)) nameSpace = 'full';
  else if (/[^\s　] [^\s　]/.test(example)) nameSpace = 'half';
  else if (/^[぀-ヿ㐀-鿿]{3,}$/.test(example)) nameSpace = 'none';
  else if (/スペースなし|スペース不要|空白なし|詰めて/.test(text)) nameSpace = 'none';

  let dakuten: Hints['dakuten'] = null;
  if (/清音|濁点[^含]{0,2}(なし|不要|除|外)|濁点を付けない/.test(text)) dakuten = false;
  else if (/濁点(を)?(含|あり|付)/.test(text)) dakuten = true;

  return { kana, width, era, hyphen, dateFormat, nameSpace, dakuten };
}
