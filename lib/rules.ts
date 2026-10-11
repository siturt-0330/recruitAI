import type { FieldDescriptor } from './extract';
import type { FieldKey } from './fieldKeys';
import type { Hints } from './types';
import { hasFullDigit, hasHalfKana, hasHiragana, norm } from './japanese';

export interface Classification {
  key: FieldKey | null;
  confidence: number;
  source: 'rule' | 'ai';
}

type Category =
  | 'emailConfirm' | 'email' | 'kana' | 'roman' | 'birth' | 'gender' | 'postal' | 'phone'
  | 'prefecture' | 'city' | 'building' | 'address' | 'graduation' | 'department' | 'faculty'
  | 'school' | 'name';

const CONF = { autocomplete: 0.98, near: 0.95, context: 0.9, position: 0.9, attr: 0.8 } as const;

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
};

/** 表示テキスト用。上から順に評価するので、より具体的なものを先に置く */
const TEXT_RULES: [Category, RegExp][] = [
  ['emailConfirm', /(メール|e-?mail|mail).*(確認|再入力|もう一度|confirm)|(確認|confirm).*(メール|e-?mail)/],
  ['email', /メール|e-?mail|mail/],
  ['kana', /フリガナ|ふりがな|カナ|かな|kana|furigana|^セイ|^メイ/],
  ['roman', /ローマ字|英字|アルファベット|roman|english name/],
  ['birth', /生年月日|誕生日|birth|bday|date of birth/],
  ['gender', /性別|gender|^sex/],
  ['postal', /郵便番号|〒|postal|zip/],
  ['phone', /電話|携帯|^tel|phone|mobile/],
  ['prefecture', /都道府県|prefecture/],
  ['city', /市区町村|市町村|^city/],
  ['building', /建物|マンション|アパート|building|apartment/],
  ['address', /住所|番地|address/],
  ['graduation', /卒業|修了|graduat/],
  ['department', /学科|専攻|コース|department|major/],
  ['faculty', /学部|研究科|faculty/],
  ['school', /学校名|大学名|大学|学校|school|university|college/],
  ['name', /氏名|名前|姓名|姓|^名|full ?name|last ?name|first ?name|family ?name|given ?name|^name$|^your name/],
];

/** name / id 属性用 */
const ATTR_RULES: [Category, RegExp][] = [
  ['emailConfirm', /mail.*(conf|check|again|re\b)|re_?mail|confirm.*mail/],
  ['email', /mail/],
  ['kana', /kana|furi|yomi/],
  ['roman', /roma|alpha|eng/],
  ['birth', /birth|bday|dob|seinen/],
  ['gender', /gender|\bsex\b|seibetsu/],
  ['postal', /zip|postal|yubin|post_?code|postcode/],
  ['phone', /tel|phone|mobile|keitai/],
  ['prefecture', /pref|todofuken/],
  ['city', /city|shiku|municipal/],
  ['building', /build|bldg|apart|mansion|address_?2|addr_?2|address_?line_?2/],
  ['address', /addr|address|banchi|street/],
  ['graduation', /grad|sotsugyo/],
  ['department', /dept|department|gakka|major/],
  ['faculty', /faculty|gakubu/],
  ['school', /school|univ|college|gakko|daigaku/],
  ['name', /(^|[^a-z])(name|sei|mei|shimei|namae)([^a-z]|$)|lastname|firstname|familyname|givenname|lname|fname/],
];

function firstMatch(rules: [Category, RegExp][], text: string): Category | null {
  if (!text) return null;
  for (const [cat, re] of rules) if (re.test(text)) return cat;
  return null;
}

export function classify(d: FieldDescriptor): Classification {
  const ac = d.autocomplete.toLowerCase().split(/\s+/).pop() ?? '';
  if (AUTOCOMPLETE[ac]) return { key: AUTOCOMPLETE[ac], confidence: CONF.autocomplete, source: 'rule' };

  const nearRaw = [d.label, d.prefix, d.placeholder].join(' ');
  const near = norm(nearRaw);
  const ctx = norm(d.context);
  const attrs = norm(`${d.name} ${d.htmlId}`);

  let cat: Category | null = null;
  let conf = 0;
  for (const [text, c, rules] of [
    [near, CONF.near, TEXT_RULES],
    [ctx, CONF.context, TEXT_RULES],
    [attrs, CONF.attr, ATTR_RULES],
  ] as const) {
    cat = firstMatch(rules, text);
    if (cat) {
      conf = c;
      break;
    }
  }
  if (!cat && d.kind === 'email') [cat, conf] = ['email', CONF.near];
  if (!cat && d.kind === 'tel') [cat, conf] = ['phone', CONF.near];
  if (!cat) return { key: null, confidence: 0, source: 'rule' };

  const result = (key: FieldKey, c = conf): Classification => ({ key, confidence: c, source: 'rule' });
  const byPosition = Math.min(conf, CONF.position);

  switch (cat) {
    case 'name':
    case 'kana':
    case 'roman': {
      const keys = {
        name: ['fullName', 'lastName', 'firstName'],
        kana: ['fullNameKana', 'lastNameKana', 'firstNameKana'],
        roman: ['fullNameRoman', 'lastNameRoman', 'firstNameRoman'],
      }[cat] as [FieldKey, FieldKey, FieldKey];
      const part = namePart(nearRaw, attrs);
      if (part) return result(part === 'last' ? keys[1] : keys[2]);
      if (d.groupSize === 2) return result(d.groupIndex === 0 ? keys[1] : keys[2], byPosition);
      return result(keys[0]);
    }
    case 'birth':
    case 'graduation': {
      const [full, y, m, dd] = (
        cat === 'birth'
          ? ['birthDate', 'birthYear', 'birthMonth', 'birthDay']
          : ['graduation', 'graduationYear', 'graduationMonth', null]
      ) as [FieldKey, FieldKey, FieldKey, FieldKey | null];
      if (d.kind === 'date' || d.kind === 'month') return result(full);
      const part = datePart(d, attrs);
      if (part === 'year') return result(y);
      if (part === 'month') return result(m);
      if (part === 'day' && dd) return result(dd);
      if (d.groupSize === 3 && dd) return result([y, m, dd][d.groupIndex]!, byPosition);
      if (d.groupSize === 2 && !dd) return result([y, m][d.groupIndex]!, byPosition);
      return result(full);
    }
    case 'phone':
      if (d.groupSize === 3) return result((['phone1', 'phone2', 'phone3'] as const)[d.groupIndex]!, byPosition);
      return result('phone');
    case 'postal':
      if (d.groupSize === 2) return result(d.groupIndex === 0 ? 'postalCode1' : 'postalCode2', byPosition);
      return result('postalCode');
    case 'address':
      if (/番地|町名|丁目|住所\s*1|address ?(line ?)?1/.test(near || ctx)) return result('addressLine');
      if (/住所\s*2|address ?(line ?)?2/.test(near || ctx)) return result('building');
      return result('fullAddress');
    default:
      return result(cat);
  }
}

function namePart(nearRaw: string, attrs: string): 'last' | 'first' | null {
  const t = nearRaw.replace(/氏名|姓名|お名前|名前|フリガナ|ふりがな|ローマ字/g, '');
  if (/姓|せい|セイ|ｾｲ|苗字|名字|last|family|surname/i.test(t)) return 'last';
  if (/名|めい|メイ|ﾒｲ|first|given/i.test(t)) return 'first';
  if (/last|family|(^|[^a-z])sei([^a-z]|$)|lname/.test(attrs)) return 'last';
  if (/first|given|(^|[^a-z])mei([^a-z]|$)|fname/.test(attrs)) return 'first';
  return null;
}

function datePart(d: FieldDescriptor, attrs: string): 'year' | 'month' | 'day' | null {
  const unit = (s: string) => {
    const t = s.replace(/生年月日|誕生日|卒業予定年月|卒業年月日?|年月日|年月/g, '');
    if (/年|year|yyyy/i.test(t)) return 'year';
    if (/月|month/i.test(t)) return 'month';
    if (/日|day/i.test(t)) return 'day';
    return null;
  };
  // 直前のテキストは前の欄の単位（「年」の後ろに月の欄…）なので見ない
  const fromSuffix = unit(d.suffix);
  if (fromSuffix) return fromSuffix;

  if (d.options.length) {
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

export function computeHints(d: FieldDescriptor): Hints {
  const text = [d.label, d.prefix, d.suffix, d.context, d.placeholder].join(' ');
  const options = d.options.join(' ');

  let kana: Hints['kana'] = 'kata';
  if ((/半角/.test(text) && /カナ|ｶﾅ|ﾌﾘｶﾞﾅ/.test(text)) || hasHalfKana(d.placeholder)) kana = 'half';
  else if (/ふりがな|ひらがな/.test(text) || hasHiragana(d.placeholder)) kana = 'hira';

  let width: Hints['width'] = null;
  if (/全角/.test(text) && !/全角カナ/.test(text)) width = 'full';
  else if (/半角/.test(text)) width = 'half';
  else if (hasFullDigit(d.placeholder)) width = 'full';

  let era: Hints['era'] = null;
  const hasWareki = /平成|昭和|令和/.test(options);
  const hasSeireki = /(19|20)\d\d/.test(options);
  if ((hasWareki && !hasSeireki) || /和暦/.test(text)) era = 'wareki';
  else if ((hasSeireki && !hasWareki) || /西暦/.test(text)) era = 'seireki';

  let hyphen: Hints['hyphen'] = null;
  if (/ハイフン(なし|無し|不要|を除|は不要|抜き|を入れず)|ハイフンを?入れないで|[-ー]なし/.test(text)) hyphen = false;
  else if (/ハイフン(あり|有り|を含|付き|を入れて)/.test(text)) hyphen = true;
  else if (/\d[-‐ー－]\d/.test(d.placeholder)) hyphen = true;
  else if (/^\d{7,11}$/.test(norm(d.placeholder).replace(/^例[:：)）]?\s*/, ''))) hyphen = false;
  else if (d.maxLength === 7 || d.maxLength === 10 || d.maxLength === 11) hyphen = false;

  let dateFormat: Hints['dateFormat'] = null;
  const ph = norm(d.placeholder);
  if (/\d{8}|yyyymmdd|8桁/.test(ph + text) || d.maxLength === 8) dateFormat = 'compact';
  else if (/年/.test(ph)) dateFormat = 'kanji';
  else if (/\d{4}-\d|yyyy-/.test(ph)) dateFormat = 'hyphen';
  else if (/\d{4}\/\d|yyyy\//.test(ph)) dateFormat = 'slash';

  return { kana, width, era, hyphen, dateFormat };
}
