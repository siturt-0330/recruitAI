/**
 * 判定先のプロフィール項目。`ai` は Decisions API の choice の description に使う。
 */
export const FIELD_KEYS = {
  fullName: { label: '氏名', ai: '氏名（漢字）。姓と名を1つの欄にまとめて入力する' },
  lastName: { label: '姓', ai: '姓・苗字（漢字）だけを入力する欄' },
  firstName: { label: '名', ai: '名・下の名前（漢字）だけを入力する欄' },
  fullNameKana: { label: 'フリガナ', ai: '氏名の読み仮名。姓と名を1つの欄にまとめて入力する' },
  lastNameKana: { label: 'セイ', ai: '姓の読み仮名（セイ）だけを入力する欄' },
  firstNameKana: { label: 'メイ', ai: '名の読み仮名（メイ）だけを入力する欄' },
  fullNameRoman: { label: '氏名（ローマ字）', ai: '氏名のローマ字・英字表記。1つの欄にまとめて入力する' },
  lastNameRoman: { label: '姓（ローマ字）', ai: '姓のローマ字・英字表記だけを入力する欄' },
  firstNameRoman: { label: '名（ローマ字）', ai: '名のローマ字・英字表記だけを入力する欄' },
  birthDate: { label: '生年月日', ai: '生年月日。年月日すべてを1つの欄に入力する' },
  birthYear: { label: '生年月日（年）', ai: '生年月日の「年」だけを入力・選択する欄' },
  birthMonth: { label: '生年月日（月）', ai: '生年月日の「月」だけを入力・選択する欄' },
  birthDay: { label: '生年月日（日）', ai: '生年月日の「日」だけを入力・選択する欄' },
  gender: { label: '性別', ai: '性別' },
  email: { label: 'メールアドレス', ai: 'メールアドレス' },
  emailConfirm: { label: 'メールアドレス（確認）', ai: '確認のためにメールアドレスをもう一度入力する欄' },
  phone: { label: '電話番号', ai: '電話番号（携帯含む）を1つの欄にまとめて入力する' },
  phone1: { label: '電話番号（1）', ai: '3分割された電話番号の1つ目（市外局番・090など）' },
  phone2: { label: '電話番号（2）', ai: '3分割された電話番号の2つ目（真ん中）' },
  phone3: { label: '電話番号（3）', ai: '3分割された電話番号の3つ目（末尾4桁）' },
  postalCode: { label: '郵便番号', ai: '郵便番号を1つの欄にまとめて入力する' },
  postalCode1: { label: '郵便番号（前半）', ai: '2分割された郵便番号の前半3桁' },
  postalCode2: { label: '郵便番号（後半）', ai: '2分割された郵便番号の後半4桁' },
  prefecture: { label: '都道府県', ai: '住所の都道府県' },
  city: { label: '市区町村', ai: '住所の市区町村' },
  addressLine: { label: '番地', ai: '住所の町名・番地' },
  building: { label: '建物名', ai: '住所の建物名・部屋番号' },
  fullAddress: { label: '住所', ai: '都道府県から建物名までの住所全体を1つの欄に入力する' },
  school: { label: '学校名', ai: '在籍・出身の学校名・大学名' },
  faculty: { label: '学部', ai: '学部・研究科' },
  department: { label: '学科', ai: '学科・専攻・コース' },
  graduation: { label: '卒業年月', ai: '卒業（見込み）年月を1つの欄に入力する' },
  graduationYear: { label: '卒業年', ai: '卒業（見込み）年月の「年」だけの欄' },
  graduationMonth: { label: '卒業月', ai: '卒業（見込み）年月の「月」だけの欄' },
} as const satisfies Record<string, { label: string; ai: string }>;

export type FieldKey = keyof typeof FIELD_KEYS;

export function isFieldKey(v: string): v is FieldKey {
  return Object.hasOwn(FIELD_KEYS, v);
}
