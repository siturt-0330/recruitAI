import type { FieldKind } from './extract';
import type { FieldKey } from './fieldKeys';
import type { Hints, Profile } from './types';
import { toFullWidth, toHalfKana, toHalfWidthAscii, toHiragana, toKatakana, toWareki } from './japanese';
import { PREFECTURE_KANA } from './prefectures';

const pad2 = (n: number) => String(n).padStart(2, '0');
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];

function parseYmd(s: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 1)] : null;
}

/** YYYY-MM を「2026年3月」に。空なら空文字 */
export function formatYm(s: string): string {
  const d = parseYmd(s);
  return d ? `${d[0]}年${d[1]}月` : '';
}

export function ageOn(birthDate: string, today = new Date()): number | null {
  const b = parseYmd(birthDate);
  if (!b) return null;
  const [y, m, d] = b;
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

/** 姓と名の間のスペースの候補。placeholder の例に合わせたものを先頭にする */
function spaces(h: Hints): string[] {
  const order = { full: ['　', ' ', ''], half: [' ', '　', ''], none: ['', '　', ' '] } as const;
  return [...order[h.nameSpace ?? 'full']];
}

function kanaForms(s: string, hint: Hints['kana']): string[] {
  if (!s) return [];
  const forms = { kata: toKatakana(s), hira: toHiragana(s), half: toHalfKana(s) };
  return uniq([forms[hint], forms.kata, forms.hira]);
}

export function splitPhone(phone: string): string[] {
  const t = phone.normalize('NFKC').trim();
  const parts = t.split(/[\-‐‑‒–—―−ー\s]+/).filter(Boolean);
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

function phoneForms(phone: string, h: Hints): string[] {
  const parts = splitPhone(phone);
  if (!parts.length) return [];
  const [a, b] = [parts.join('-'), parts.join('')];
  return h.hyphen === false ? [b, a] : [a, b];
}

function postalForms(code: string, h: Hints): string[] {
  const digits = code.normalize('NFKC').replace(/\D/g, '');
  if (digits.length !== 7) return code ? [code] : [];
  const [a, b] = [`${digits.slice(0, 3)}-${digits.slice(3)}`, digits];
  return h.hyphen === false ? [b, a] : [a, b];
}

function yearForms(y: number, m: number, d: number, era: Hints['era']): string[] {
  const w = toWareki(y, m, d);
  const wareki = w ? [`${w.era}${w.year}`, w.year === 1 ? `${w.era}元` : '', `${w.abbr}${w.year}`] : [];
  // 「1999(H11)」のように西暦に和暦を添えた選択肢
  const seireki = w ? [String(y), `${y}(${w.abbr}${w.year})`, `${y}(${w.era}${w.year})`] : [String(y)];
  // 元号が別のプルダウンになっている「［平成▼］［17▼］年」用に、数字だけの和暦年を最後の候補にする
  const eraNumber = w ? [w.year === 1 ? '元' : '', String(w.year)] : [];
  return era === 'wareki' ? [...wareki, ...eraNumber, ...seireki] : [...seireki, ...wareki, ...eraNumber];
}

function dateForms([y, m, d]: [number, number, number], h: Hints): string[] {
  const w = toWareki(y, m, d);
  const forms: Record<NonNullable<Hints['dateFormat']>, string> = {
    slash: `${y}/${pad2(m)}/${pad2(d)}`,
    hyphen: `${y}-${pad2(m)}-${pad2(d)}`,
    kanji: `${y}年${m}月${d}日`,
    compact: `${y}${pad2(m)}${pad2(d)}`,
    dot: `${y}.${pad2(m)}.${pad2(d)}`,
    eraDot: w ? `${w.era === '令和' ? 'R' : w.era === '平成' ? 'H' : w.era === '昭和' ? 'S' : ''}${pad2(w.year)}.${pad2(m)}.${pad2(d)}` : '',
    mdy: `${pad2(m)}/${pad2(d)}/${y}`,
    dmy: `${pad2(d)}/${pad2(m)}/${y}`,
  };
  const wareki = w ? `${w.era}${w.year === 1 ? '元' : w.year}年${m}月${d}日` : '';
  const first = h.era === 'wareki' ? wareki : forms[h.dateFormat ?? 'slash'];
  return uniq([first, forms.slash, forms.kanji, forms.hyphen, wareki]);
}

/** 年月（YYYY-MM）の欄。month 型ならそのまま、テキストなら「2026年3月」など */
function ymForms(s: string, h: Hints, kind: FieldKind): string[] {
  const d = parseYmd(s);
  if (!d) return [];
  if (kind === 'month') return [s.slice(0, 7)];
  if (kind === 'date') return [`${s.slice(0, 7)}-01`];
  const [y, m] = d;
  const w = toWareki(y, m, 1);
  const wareki = w ? `${w.era}${w.year === 1 ? '元' : w.year}年${m}月` : '';
  const kanji = `${y}年${m}月`;
  const slash = `${y}/${pad2(m)}`;
  const compact = `${y}${pad2(m)}`;
  const dot = `${y}.${pad2(m)}`;
  const first =
    h.era === 'wareki' ? wareki : h.dateFormat === 'compact' ? compact : h.dateFormat === 'dot' ? dot : h.dateFormat === 'slash' || h.dateFormat === 'hyphen' ? slash : kanji;
  return uniq([first, kanji, slash, dot, wareki]);
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 月の候補。英語のフォーム用に「April」「Apr」も入れる（数字の欄では先頭の数字が使われる） */
function monthForms(m: number): string[] {
  const en = MONTHS_EN[m - 1] ?? '';
  return [String(m), pad2(m), en, en.slice(0, 3)];
}

function ymPart(s: string, part: 'year' | 'month', h: Hints): string[] {
  const d = parseYmd(s);
  if (!d) return [];
  return part === 'year' ? yearForms(d[0], d[1], 1, h.era) : monthForms(d[1]);
}

const GENDER: Record<string, string[]> = {
  male: ['男性', '男', '男子', 'male', 'man', 'm'],
  female: ['女性', '女', '女子', 'female', 'woman', 'f'],
  other: ['その他', '回答しない', '無回答', 'other'],
};

const SCHOOL_TYPE_VARIANTS: Record<string, string[]> = {
  大学: ['大学', '大学（学部）', '大学（4年制）', '4年制大学', '四年制大学', '学部', '学部生', '大学生', '学士'],
  '大学院（修士）': ['大学院（修士）', '大学院修士', '修士', '大学院（修士課程）', '大学院'],
  '大学院（博士）': ['大学院（博士）', '大学院博士', '博士', '大学院（博士課程）', '大学院'],
  短期大学: ['短期大学', '短大', '短期大学士'],
  高等専門学校: ['高等専門学校', '高専', '準学士'],
  専門学校: ['専門学校', '専修学校'],
  海外の学校: ['海外の学校', '海外大学', '外国大学', '海外'],
  高校: ['高校', '高等学校'],
};

const BUNRI_VARIANTS: Record<string, string[]> = {
  文系: ['文系', '文科系', '文'],
  理系: ['理系', '理科系', '理'],
  その他: ['その他', 'どちらでもない'],
};

const LICENSE_NAME: Record<string, string> = {
  regular: '普通自動車第一種運転免許',
  regularAT: '普通自動車第一種運転免許（AT限定）',
};

function licenseForms(p: Profile, kind: FieldKind): string[] {
  if (!p.driverLicense) return [];
  if (p.driverLicense === 'none') return ['なし', '無', '無し', '持っていない', '未取得'];
  const yes = ['あり', '有', '有り', '取得済み', '取得済', '保有'];
  const names = p.driverLicense === 'regularAT'
    ? [LICENSE_NAME.regularAT!, 'AT限定', 'オートマ限定', '普通自動車免許（AT限定）', '普通（AT限定）']
    : [LICENSE_NAME.regular!, '普通自動車免許', '普通自動車', '普通'];
  return kind === 'select' || kind === 'radio' ? [...names, ...yes] : names;
}

/** 資格の一覧。textarea なら改行区切り、1行の欄なら「、」区切り */
export function qualificationLines(p: Profile): { date: string; text: string }[] {
  const out: { date: string; text: string }[] = [];
  if (LICENSE_NAME[p.driverLicense]) out.push({ date: p.driverLicenseDate, text: `${LICENSE_NAME[p.driverLicense]} 取得` });
  if (p.toeic) out.push({ date: p.toeicDate, text: `TOEIC L&R ${p.toeic}点 取得` });
  if (p.toefl) out.push({ date: '', text: `TOEFL iBT ${p.toefl}点 取得` });
  if (p.eiken) out.push({ date: '', text: `実用英語技能検定 ${p.eiken} 合格` });
  for (const q of p.qualifications) if (q.name.trim()) out.push({ date: q.date, text: q.name.trim() });
  return out;
}

/** 学歴を履歴書の形式で並べる */
export function educationLines(p: Profile): string[] {
  const lines: string[] = [];
  if (p.highSchool) {
    if (p.highSchoolAdmission) lines.push(`${formatYm(p.highSchoolAdmission)} ${p.highSchool} 入学`);
    if (p.highSchoolGraduation) lines.push(`${formatYm(p.highSchoolGraduation)} ${p.highSchool} 卒業`);
  }
  const school = [p.school, p.faculty, p.department].filter(Boolean).join(' ');
  if (school) {
    if (p.admission) lines.push(`${formatYm(p.admission)} ${school} 入学`);
    if (p.graduation) {
      lines.push(`${formatYm(p.graduation)} ${school} ${p.graduationStatus === 'graduated' ? '卒業' : '卒業見込み'}`);
    }
  }
  return lines;
}

/** 住所を比べるための形（全角・半角、空白、ハイフンの種類の違いをなくす） */
const sameForm = (s: string) => s.normalize('NFKC').replace(/\s/g, '').replace(/[-‐‑‒–—―−ー]/g, '-');

/**
 * 帰省先が現住所と同じか。「同じ」にしていなくても、帰省先に現住所と同じ住所を入れていれば同じとみなす
 * （「現住所と同じ場合はチェック」の欄にチェックを入れ、帰省先の欄に同じ住所を入れ直さないため）
 */
export function kiseiIsSame(p: Profile): boolean {
  if (p.kiseiSame) return true;
  if (!p.kiseiPrefecture || !p.kiseiAddressLine) return false;
  const digits = (s: string) => s.normalize('NFKC').replace(/\D/g, '');
  return (
    p.kiseiPrefecture === p.prefecture &&
    sameForm(`${p.kiseiCity}${p.kiseiAddressLine}`) === sameForm(`${p.city}${p.addressLine}`) &&
    sameForm(p.kiseiBuilding) === sameForm(p.building) &&
    (!p.kiseiPostalCode || digits(p.kiseiPostalCode) === digits(p.postalCode))
  );
}

function kiseiOf(p: Profile) {
  return kiseiIsSame(p)
    ? { postal: p.postalCode, pref: p.prefecture, city: p.city, line: p.addressLine, building: p.building, phone: p.landline || p.phone }
    : { postal: p.kiseiPostalCode, pref: p.kiseiPrefecture, city: p.kiseiCity, line: p.kiseiAddressLine, building: p.kiseiBuilding, phone: p.kiseiPhone };
}

function fullAddress(pref: string, city: string, line: string, building: string): string[] {
  const base = `${pref}${city}${line}`;
  return base ? [building ? `${base}　${building}` : base, `${base}${building}`] : [];
}

function rawVariants(key: FieldKey, p: Profile, h: Hints, kind: FieldKind): string[] {
  const birth = parseYmd(p.birthDate);
  const join = (a: string, b: string, seps: string[]) => (a && b ? seps.map((s) => `${a}${s}${b}`) : [a || b]);
  const kisei = kiseiOf(p);
  const multiline = kind === 'textarea';

  switch (key) {
    // 基本情報
    case 'fullName':
      return join(p.lastName, p.firstName, spaces(h));
    case 'lastName':
      return [p.lastName];
    case 'firstName':
      return [p.firstName];
    case 'fullNameKana':
      return join(p.lastNameKana, p.firstNameKana, spaces(h)).flatMap((s) => kanaForms(s, h.kana));
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
    case 'birthEra': {
      const w = birth ? toWareki(...birth) : null;
      return w ? [w.era, w.abbr, `${w.era}（${w.abbr}）`] : [];
    }
    case 'birthYear':
      return birth ? yearForms(...birth, h.era) : [];
    case 'birthEraYear': {
      const w = birth ? toWareki(...birth) : null;
      return w ? (w.year === 1 ? ['元', '1'] : [String(w.year)]) : [];
    }
    case 'birthMonth':
      return birth ? monthForms(birth[1]) : [];
    case 'birthDay':
      return birth ? [String(birth[2]), pad2(birth[2])] : [];
    case 'age': {
      const age = ageOn(p.birthDate);
      return age == null ? [] : [String(age), `${age}歳`];
    }
    case 'gender':
      return GENDER[p.gender] ?? [];
    case 'nationality':
      return p.nationality === '日本' ? ['日本', '日本国籍', 'Japan'] : [p.nationality];
    case 'photo':
      return [p.photo];

    // 連絡先・住所
    case 'email':
    case 'emailConfirm':
      return [p.email];
    case 'emailSub':
    case 'emailSubConfirm':
      return [p.emailSub];
    case 'emailLocal':
    case 'emailDomain':
    case 'emailSubLocal':
    case 'emailSubDomain': {
      const address = key.startsWith('emailSub') ? p.emailSub : p.email;
      const at = address.lastIndexOf('@');
      if (at < 0) return [];
      return [key.endsWith('Local') ? address.slice(0, at) : address.slice(at + 1)];
    }
    case 'phone':
      return phoneForms(p.phone, h);
    case 'phone1':
    case 'phone2':
    case 'phone3': {
      const parts = splitPhone(p.phone);
      return parts.length === 3 ? [parts[Number(key.slice(-1)) - 1] ?? ''] : [];
    }
    case 'landline':
      return phoneForms(p.landline, h);
    case 'landline1':
    case 'landline2':
    case 'landline3': {
      const parts = splitPhone(p.landline);
      return parts.length === 3 ? [parts[Number(key.slice(-1)) - 1] ?? ''] : [];
    }
    case 'cityAddressLine':
      return p.city || p.addressLine ? [`${p.city}${p.addressLine}`] : [];
    case 'cityAddressLineBuilding':
      return p.city || p.addressLine ? [`${p.city}${p.addressLine}${p.building ? `　${p.building}` : ''}`, `${p.city}${p.addressLine}${p.building}`] : [];
    case 'fullAddressNoBuilding':
      return p.prefecture || p.city ? [`${p.prefecture}${p.city}${p.addressLine}`] : [];
    case 'addressLineBuilding':
      return p.addressLine ? [p.building ? `${p.addressLine}　${p.building}` : p.addressLine, `${p.addressLine}${p.building}`] : [];
    case 'postalCode':
      return postalForms(p.postalCode, h);
    case 'postalCode1':
    case 'postalCode2':
    case 'kiseiPostalCode1':
    case 'kiseiPostalCode2': {
      const code = (key.startsWith('kisei') ? kisei.postal : p.postalCode).normalize('NFKC').replace(/\D/g, '');
      if (code.length !== 7) return [];
      return [key.endsWith('1') ? code.slice(0, 3) : code.slice(3)];
    }
    case 'prefecture':
      return [p.prefecture, p.prefecture === '北海道' ? '' : p.prefecture.replace(/[都府県]$/, '')];
    case 'city':
      return [p.city];
    case 'addressLine':
      return [p.addressLine];
    case 'building':
      return [p.building];
    case 'fullAddress':
      return fullAddress(p.prefecture, p.city, p.addressLine, p.building);
    case 'prefectureKana':
      return kanaForms(PREFECTURE_KANA[p.prefecture] ?? '', h.kana);
    case 'cityKana':
      return kanaForms(p.cityKana, h.kana);
    case 'addressLineKana':
      return kanaForms(p.addressLineKana, h.kana);
    case 'buildingKana':
      return kanaForms(p.buildingKana, h.kana);
    case 'fullAddressKana': {
      const pref = PREFECTURE_KANA[p.prefecture] ?? '';
      if (!pref || !p.cityKana) return [];
      return kanaForms(`${pref}${p.cityKana}${p.addressLineKana}${p.buildingKana ? `　${p.buildingKana}` : ''}`, h.kana);
    }
    case 'nearestLine':
      return [p.nearestLine, p.nearestLine.replace(/線$/, '')];
    case 'nearestStation':
      return [p.nearestStation.replace(/駅$/, ''), p.nearestStation.endsWith('駅') ? p.nearestStation : `${p.nearestStation}駅`].filter(
        () => !!p.nearestStation,
      );
    case 'kiseiSameCheck':
      return [kiseiIsSame(p) ? 'checked' : 'unchecked'];
    case 'kiseiPostalCode':
      return postalForms(kisei.postal, h);
    case 'kiseiPrefecture':
      return [kisei.pref, kisei.pref === '北海道' ? '' : kisei.pref.replace(/[都府県]$/, '')];
    case 'kiseiCity':
      return [kisei.city];
    case 'kiseiAddressLine':
      return [kisei.line];
    case 'kiseiBuilding':
      return [kisei.building];
    case 'kiseiFullAddress':
      return fullAddress(kisei.pref, kisei.city, kisei.line, kisei.building);
    case 'kiseiPhone':
      return phoneForms(kisei.phone, h);
    case 'kiseiPhone1':
    case 'kiseiPhone2':
    case 'kiseiPhone3': {
      const parts = splitPhone(kisei.phone);
      return parts.length === 3 ? [parts[Number(key.slice(-1)) - 1] ?? ''] : [];
    }
    case 'kiseiCityAddressLine':
      return kisei.city || kisei.line ? [`${kisei.city}${kisei.line}`] : [];
    case 'emergencyName':
      return [p.emergencyName];
    case 'emergencyRelation':
      return [p.emergencyRelation];
    case 'emergencyPhone':
      return phoneForms(p.emergencyPhone, h);

    // 学歴
    case 'schoolType':
      return SCHOOL_TYPE_VARIANTS[p.schoolType] ?? [p.schoolType];
    case 'bunri':
      return BUNRI_VARIANTS[p.bunri] ?? [p.bunri];
    case 'school':
      return [p.school];
    case 'schoolKana':
      return kanaForms(p.schoolKana, h.kana);
    case 'schoolInitial': {
      const kana = p.schoolKana.trim();
      if (!kana) return [];
      // 五十音表の文字（「が」→「か」、「ぁ」→「あ」）と、濁点を残した文字（「ガ」）の両方を用意する
      const plain = toHiragana(kana).normalize('NFD').charAt(0);
      const base = ({ ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', っ: 'つ', ゎ: 'わ' } as Record<string, string>)[plain] ?? plain;
      const voiced = toHiragana(kana).charAt(0);
      if (kind === 'radio' || kind === 'select') return [base, toKatakana(base), voiced, toKatakana(voiced)];
      // 文字の欄：「全角カタカナ1文字＜濁点含む＞」のような指定に合わせる（指定がなければ濁点を残す）
      const toForm = (s: string) => (h.kana === 'hira' ? s : h.kana === 'half' ? toHalfKana(s) : toKatakana(s));
      return h.dakuten === false ? [toForm(base), toForm(voiced)] : [toForm(voiced), toForm(base)];
    }
    case 'schoolOwnership':
      return (
        ({ 国立: ['国立', '国立大学'], 公立: ['公立', '公立大学', '県立', '市立'], 私立: ['私立', '私立大学'], 海外: ['日本国外', '海外', '外国'] } as Record<
          string,
          string[]
        >)[p.schoolOwnership] ?? (p.schoolOwnership ? [p.schoolOwnership] : [])
      );
    case 'schoolPrefecture':
      return [p.schoolPrefecture, p.schoolPrefecture === '北海道' ? '' : p.schoolPrefecture.replace(/[都府県]$/, '')];
    case 'faculty':
      return [p.faculty];
    case 'department':
      return [p.department];
    case 'fieldCategory':
      return [p.fieldCategory, p.fieldCategory.replace(/（.*）/, '')];
    case 'degree':
      return [p.degree];
    case 'admission':
      return ymForms(p.admission, h, kind);
    case 'admissionYear':
      return ymPart(p.admission, 'year', h);
    case 'admissionMonth':
      return ymPart(p.admission, 'month', h);
    case 'graduation':
      return ymForms(p.graduation, h, kind);
    case 'graduationYear': {
      // 「26卒」「2026年卒」のような卒業年度の選択肢も候補にする
      const y = p.graduation.slice(0, 4);
      return [...ymPart(p.graduation, 'year', h), ...(y ? [`${y.slice(2)}卒`, `${y}年卒`, `${y}卒`] : [])];
    }
    case 'graduationMonth':
      return ymPart(p.graduation, 'month', h);
    case 'graduationStatus':
      if (p.graduationStatus === 'expected') return ['卒業見込み', '卒業見込', '見込み', '見込', '卒業予定', '新卒', '予定'];
      if (p.graduationStatus === 'graduated') return ['卒業', '既卒', '卒業済み'];
      return [];
    case 'lab':
      return [p.lab];
    case 'advisor':
      return [p.advisor];
    case 'researchTheme':
      return [p.researchTheme];
    case 'highSchool':
      return [p.highSchool];
    case 'highSchoolAdmission':
      return ymForms(p.highSchoolAdmission, h, kind);
    case 'highSchoolAdmissionYear':
      return ymPart(p.highSchoolAdmission, 'year', h);
    case 'highSchoolAdmissionMonth':
      return ymPart(p.highSchoolAdmission, 'month', h);
    case 'highSchoolGraduation':
      return ymForms(p.highSchoolGraduation, h, kind);
    case 'highSchoolGraduationYear':
      return ymPart(p.highSchoolGraduation, 'year', h);
    case 'highSchoolGraduationMonth':
      return ymPart(p.highSchoolGraduation, 'month', h);
    case 'highSchoolGraduated':
      return p.highSchool || p.highSchoolGraduation ? ['はい', '卒業', '卒業している', 'yes'] : [];
    case 'highSchoolPrefecture':
      return [p.highSchoolPrefecture, p.highSchoolPrefecture === '北海道' ? '' : p.highSchoolPrefecture.replace(/[都府県]$/, '')];
    case 'educationHistory': {
      const lines = educationLines(p);
      return lines.length ? [lines.join(multiline ? '\n' : '、')] : [];
    }

    // 資格・スキル
    case 'driverLicense':
      return licenseForms(p, kind);
    case 'driverLicenseDate':
      return ymForms(p.driverLicenseDate, h, kind);
    case 'toeic':
      return p.toeic ? [p.toeic, `${p.toeic}点`] : [];
    case 'toeicDate':
      return ymForms(p.toeicDate, h, kind);
    case 'toefl':
      return p.toefl ? [p.toefl, `${p.toefl}点`] : [];
    case 'eiken':
      return p.eiken ? [p.eiken, `英検${p.eiken}`, p.eiken.replace(/級$/, '')] : [];
    case 'otherLanguage':
      return [p.otherLanguage];
    case 'qualifications': {
      const items = qualificationLines(p);
      if (!items.length) return [];
      return multiline
        ? [items.map((q) => (q.date ? `${formatYm(q.date)} ${q.text}` : q.text)).join('\n')]
        : [items.map((q) => q.text.replace(/ (取得|合格)$/, '')).join('、')];
    }
    case 'pcSkills':
      return [p.pcSkills];

    // 経験・自己PR
    case 'club':
      return [p.club];
    case 'clubRole':
      return [p.clubRole];
    case 'studyAbroad':
      return [p.studyAbroad];
    case 'partTime':
      return [p.partTime];
    case 'hobbies':
      return [p.hobbies];
    case 'specialSkills':
      return [p.specialSkills];
    case 'hobbiesAndSkills': {
      if (!p.hobbies && !p.specialSkills) return [];
      const parts = [p.hobbies && `趣味：${p.hobbies}`, p.specialSkills && `特技：${p.specialSkills}`].filter(Boolean);
      return [parts.join(multiline ? '\n' : '　')];
    }
    case 'portfolioUrl':
      return [p.portfolioUrl];
    case 'githubUrl':
      return [p.githubUrl];

    // 希望条件
    case 'desiredLocation1':
    case 'desiredLocation2':
    case 'desiredLocation3': {
      const v = p.desiredLocations[Number(key.slice(-1)) - 1] ?? '';
      return [v, v.replace(/[都府県]$/, '')];
    }
    case 'desiredJob':
      return [p.desiredJob];
    case 'personalRequest':
      return [p.personalRequest];

    // 職歴（中途）
    case 'currentCompany':
      return [p.currentCompany];
    case 'currentJobType':
      return [p.currentJobType];
    case 'employmentType':
      return [p.employmentType];
    case 'currentSalary':
      return [p.currentSalary, p.currentSalary.replace(/[^\d]/g, '')];
    case 'desiredSalary':
      return [p.desiredSalary, p.desiredSalary.replace(/[^\d]/g, '')];
    case 'availableDate': {
      if (p.availableDate) return [p.availableDate];
      // 新卒は「卒業の翌月」（3月卒業なら4月入社）
      const grad = parseYmd(p.graduation);
      if (!grad || p.graduationStatus === 'graduated') return [];
      const [y, m] = grad[1] === 12 ? [grad[0] + 1, 1] : [grad[0], grad[1] + 1];
      return ymForms(`${y}-${pad2(m)}`, h, kind);
    }
    case 'workHistory':
      return [p.workHistory];
  }
}

const NO_WIDTH_KEYS = new Set<FieldKey>([
  'email', 'emailConfirm', 'emailSub', 'emailSubConfirm', 'emailLocal', 'emailDomain', 'emailSubLocal', 'emailSubDomain',
  'portfolioUrl', 'githubUrl', 'photo',
]);

const YES_WORDS = ['はい', 'あり', '有', '有り', 'ある', 'yes'];
const NO_WORDS = ['いいえ', 'なし', '無', '無し', 'ない', 'no'];
/**
 * 有無を聞く選択肢の「ある」側と「ない」側。
 * 「あり／なし」のほか、「持っている／持っていない」「決まっている／決まっていない」のような対の形も見る
 */
export function yesNoOptions(options: string[]): { yes: string; no: string } | null {
  const opts = options.map((o) => o.normalize('NFKC').replace(/\s/g, '').toLowerCase());
  const yes = opts.findIndex((o) => YES_WORDS.includes(o));
  const no = opts.findIndex((o) => NO_WORDS.includes(o));
  if (yes >= 0 && no >= 0) return { yes: options[yes]!, no: options[no]! };
  for (const [i, o] of opts.entries()) {
    const positive = o.replace(/ていない$/, 'ている').replace(/しない$/, 'する');
    const j = positive !== o ? opts.indexOf(positive) : -1;
    if (j >= 0) return { yes: options[j]!, no: options[i]! };
  }
  return null;
}
/** 「なし」「特になし」のように、ないことを書いた値 */
export const SAYS_NONE = /^(特に)?(なし|無し|無|ない|ありません|no|none)$/i;

/** 欄に入れる値の候補を優先度順に返す。先頭が第一候補 */
export function valueVariants(key: FieldKey, p: Profile, h: Hints, kind: FieldKind, options: string[] = []): string[] {
  const values = uniq(rawVariants(key, p, h, kind).map((v) => v.trim()));
  // 「留学経験 ［あり］［なし］」のように、項目の中身ではなく有無を聞いている欄
  const yesNo = kind === 'radio' || kind === 'select' ? yesNoOptions(options) : null;
  // 「帰省先は現住所と同じですか」は、同じなら「はい」、違うなら「いいえ」
  if (yesNo && key === 'kiseiSameCheck') return kiseiIsSame(p) ? [yesNo.yes, ...YES_WORDS] : [yesNo.no, ...NO_WORDS];
  if (yesNo && values.length && !YES_WORDS.includes(values[0]!)) {
    return SAYS_NONE.test(values[0]!.normalize('NFKC')) ? [yesNo.no, ...NO_WORDS] : [yesNo.yes, ...YES_WORDS];
  }
  if (kind !== 'text' && kind !== 'textarea' && kind !== 'tel' && kind !== 'number') return values;
  if (NO_WIDTH_KEYS.has(key)) return values;
  if (h.width === 'full') return uniq(values.map(toFullWidth));
  if (h.width === 'half') return uniq(values.map(toHalfWidthAscii));
  return values;
}
