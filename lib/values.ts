import type { FieldKind } from './extract';
import type { FieldKey } from './fieldKeys';
import type { Hints, Profile } from './types';
import { toFullWidth, toHalfKana, toHalfWidthAscii, toHiragana, toKatakana, toWareki } from './japanese';

const pad2 = (n: number) => String(n).padStart(2, '0');
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];

function parseYmd(s: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 1)] : null;
}

function kanaForms(s: string, hint: Hints['kana']): string[] {
  if (!s) return [];
  const forms = { kata: toKatakana(s), hira: toHiragana(s), half: toHalfKana(s) };
  return uniq([forms[hint], forms.kata, forms.hira]);
}

export function splitPhone(phone: string): string[] {
  const t = phone.normalize('NFKC').trim();
  const parts = t.split(/[-‐−ー―\s]+/).filter(Boolean);
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) return parts;
  const digits = t.replace(/\D/g, '');
  const cut = (...lens: number[]) => {
    let i = 0;
    return lens.map((l) => digits.slice(i, (i += l)));
  };
  if (digits.length === 11) return cut(3, 4, 4);
  if (digits.length === 10) return /^0[36]/.test(digits) ? cut(2, 4, 4) : cut(3, 3, 4);
  return digits ? [digits] : [];
}

function yearForms(y: number, m: number, d: number, era: Hints['era']): string[] {
  const w = toWareki(y, m, d);
  const wareki = w ? [`${w.era}${w.year}`, w.year === 1 ? `${w.era}元` : '', `${w.abbr}${w.year}`] : [];
  const seireki = [String(y)];
  return era === 'wareki' ? [...wareki, ...seireki] : [...seireki, ...wareki];
}

function dateForms([y, m, d]: [number, number, number], h: Hints): string[] {
  const w = toWareki(y, m, d);
  const forms: Record<NonNullable<Hints['dateFormat']>, string> = {
    slash: `${y}/${pad2(m)}/${pad2(d)}`,
    hyphen: `${y}-${pad2(m)}-${pad2(d)}`,
    kanji: `${y}年${m}月${d}日`,
    compact: `${y}${pad2(m)}${pad2(d)}`,
  };
  const wareki = w ? `${w.era}${w.year === 1 ? '元' : w.year}年${m}月${d}日` : '';
  const first = h.era === 'wareki' ? wareki : forms[h.dateFormat ?? 'slash'];
  return uniq([first, forms.slash, forms.kanji, forms.hyphen, wareki]);
}

const GENDER: Record<string, string[]> = {
  male: ['男性', '男', 'male', 'man', 'm'],
  female: ['女性', '女', 'female', 'woman', 'f'],
  other: ['その他', '回答しない', '無回答', 'other'],
};

function rawVariants(key: FieldKey, p: Profile, h: Hints, kind: FieldKind): string[] {
  const birth = parseYmd(p.birthDate);
  const grad = parseYmd(p.graduation);
  const phone = splitPhone(p.phone);
  const postal = p.postalCode.normalize('NFKC').replace(/\D/g, '');
  const withHyphen = h.hyphen !== false;
  const join = (a: string, b: string, seps: string[]) => (a && b ? seps.map((s) => `${a}${s}${b}`) : [a || b]);

  switch (key) {
    case 'fullName':
      return join(p.lastName, p.firstName, ['　', ' ', '']);
    case 'lastName':
      return [p.lastName];
    case 'firstName':
      return [p.firstName];
    case 'fullNameKana':
      return join(p.lastNameKana, p.firstNameKana, ['　', ' ', '']).flatMap((s) => kanaForms(s, h.kana));
    case 'lastNameKana':
      return kanaForms(p.lastNameKana, h.kana);
    case 'firstNameKana':
      return kanaForms(p.firstNameKana, h.kana);
    case 'fullNameRoman':
      return [...join(p.lastNameRoman, p.firstNameRoman, [' ']), ...join(p.firstNameRoman, p.lastNameRoman, [' '])];
    case 'lastNameRoman':
      return [p.lastNameRoman];
    case 'firstNameRoman':
      return [p.firstNameRoman];
    case 'birthDate':
      if (!birth) return [];
      if (kind === 'date') return [p.birthDate];
      if (kind === 'month') return [`${birth[0]}-${pad2(birth[1])}`];
      return dateForms(birth, h);
    case 'birthYear':
      return birth ? yearForms(...birth, h.era) : [];
    case 'birthMonth':
      return birth ? [String(birth[1]), pad2(birth[1])] : [];
    case 'birthDay':
      return birth ? [String(birth[2]), pad2(birth[2])] : [];
    case 'gender':
      return GENDER[p.gender] ?? [];
    case 'email':
    case 'emailConfirm':
      return [p.email];
    case 'phone': {
      if (!phone.length) return [];
      const [a, b] = [phone.join('-'), phone.join('')];
      return withHyphen ? [a, b] : [b, a];
    }
    case 'phone1':
    case 'phone2':
    case 'phone3':
      return phone.length === 3 ? [phone[Number(key.slice(-1)) - 1] ?? ''] : [];
    case 'postalCode': {
      if (postal.length !== 7) return p.postalCode ? [p.postalCode] : [];
      const [a, b] = [`${postal.slice(0, 3)}-${postal.slice(3)}`, postal];
      return withHyphen ? [a, b] : [b, a];
    }
    case 'postalCode1':
      return postal.length === 7 ? [postal.slice(0, 3)] : [];
    case 'postalCode2':
      return postal.length === 7 ? [postal.slice(3)] : [];
    case 'prefecture':
      return [p.prefecture, p.prefecture === '北海道' ? '' : p.prefecture.replace(/[都府県]$/, '')];
    case 'city':
      return [p.city];
    case 'addressLine':
      return [p.addressLine];
    case 'building':
      return [p.building];
    case 'fullAddress': {
      const base = `${p.prefecture}${p.city}${p.addressLine}`;
      return base ? [p.building ? `${base}　${p.building}` : base] : [];
    }
    case 'school':
      return [p.school];
    case 'faculty':
      return [p.faculty];
    case 'department':
      return [p.department];
    case 'graduation':
      if (!grad) return [];
      if (kind === 'month' || kind === 'date') return [p.graduation.slice(0, 7)];
      return [`${grad[0]}年${grad[1]}月`, `${grad[0]}/${pad2(grad[1])}`];
    case 'graduationYear':
      return grad ? yearForms(...grad, h.era) : [];
    case 'graduationMonth':
      return grad ? [String(grad[1]), pad2(grad[1])] : [];
  }
}

/** 欄に入れる値の候補を優先度順に返す。先頭が第一候補 */
export function valueVariants(key: FieldKey, p: Profile, h: Hints, kind: FieldKind): string[] {
  const values = uniq(rawVariants(key, p, h, kind).map((v) => v.trim()));
  if (kind === 'select' || kind === 'radio' || kind === 'date' || kind === 'month' || kind === 'email') return values;
  if (h.width === 'full' && key !== 'email' && key !== 'emailConfirm') return uniq(values.map(toFullWidth));
  if (h.width === 'half') return uniq(values.map(toHalfWidthAscii));
  return values;
}
