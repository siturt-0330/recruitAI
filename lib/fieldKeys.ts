export type ProfilePage = 'basic' | 'contact' | 'education' | 'skills' | 'experience' | 'preferences' | 'career';

type KeyDef = { label: string; ai: string; page: ProfilePage };

const k = (page: ProfilePage, label: string, ai: string): KeyDef => ({ label, ai, page });

/**
 * 判定先のプロフィール項目。`ai` は Decisions API の choice の description、
 * `page` は未登録だったときに開く設定画面のページ。
 */
export const FIELD_KEYS = {
  // 基本情報
  fullName: k('basic', '氏名', '氏名（漢字）。姓と名を1つの欄にまとめて入力する'),
  lastName: k('basic', '姓', '姓・苗字（漢字）だけを入力する欄'),
  firstName: k('basic', '名', '名・下の名前（漢字）だけを入力する欄'),
  fullNameKana: k('basic', 'フリガナ', '氏名の読み仮名。姓と名を1つの欄にまとめて入力する'),
  lastNameKana: k('basic', 'セイ', '姓の読み仮名（セイ）だけを入力する欄'),
  firstNameKana: k('basic', 'メイ', '名の読み仮名（メイ）だけを入力する欄'),
  fullNameRoman: k('basic', '氏名（ローマ字）', '氏名のローマ字・英字表記。1つの欄にまとめて入力する'),
  lastNameRoman: k('basic', '姓（ローマ字）', '姓のローマ字・英字表記だけを入力する欄'),
  firstNameRoman: k('basic', '名（ローマ字）', '名のローマ字・英字表記だけを入力する欄'),
  birthDate: k('basic', '生年月日', '生年月日。年月日すべてを1つの欄に入力する'),
  birthEra: k('basic', '生年月日（元号）', '生年月日の元号（昭和・平成・令和）だけを選択する欄'),
  birthYear: k('basic', '生年月日（年）', '生年月日の「年」だけを入力・選択する欄'),
  birthEraYear: k('basic', '生年月日（和暦の年）', '元号の欄の隣にある、和暦の年の数字だけを入れる欄'),
  birthMonth: k('basic', '生年月日（月）', '生年月日の「月」だけを入力・選択する欄'),
  birthDay: k('basic', '生年月日（日）', '生年月日の「日」だけを入力・選択する欄'),
  age: k('basic', '年齢', '現在の満年齢'),
  gender: k('basic', '性別', '性別'),
  nationality: k('basic', '国籍', '国籍'),
  photo: k('basic', '顔写真', '証明写真・顔写真の画像ファイルをアップロードする欄'),

  // 連絡先・住所
  email: k('contact', 'メールアドレス', 'メインのメールアドレス'),
  emailConfirm: k('contact', 'メールアドレス（確認）', '確認のためにメールアドレスをもう一度入力する欄'),
  emailSub: k('contact', '予備のメールアドレス', '2つ目・予備・携帯用のメールアドレス'),
  emailSubLocal: k('contact', '予備のメールアドレス（@より前）', '@ で2つに分かれた予備・携帯メールアドレスの前半'),
  emailSubDomain: k('contact', '予備のメールアドレス（@より後）', '@ で2つに分かれた予備・携帯メールアドレスの後半'),
  emailLocal: k('contact', 'メールアドレス（@より前）', '@ で2つに分かれたメールアドレスの前半（ユーザー名）'),
  emailDomain: k('contact', 'メールアドレス（@より後）', '@ で2つに分かれたメールアドレスの後半（ドメイン）'),
  phone: k('contact', '携帯電話番号', '携帯電話番号、または連絡のつく電話番号を1つの欄にまとめて入力する'),
  phone1: k('contact', '電話番号（1）', '3分割された電話番号の1つ目（市外局番・090など）'),
  phone2: k('contact', '電話番号（2）', '3分割された電話番号の2つ目（真ん中）'),
  phone3: k('contact', '電話番号（3）', '3分割された電話番号の3つ目（末尾4桁）'),
  landline: k('contact', '自宅電話番号', '自宅・固定電話の番号'),
  landline1: k('contact', '自宅電話番号（1）', '3分割された自宅・固定電話番号の1つ目（市外局番）'),
  landline2: k('contact', '自宅電話番号（2）', '3分割された自宅・固定電話番号の2つ目'),
  landline3: k('contact', '自宅電話番号（3）', '3分割された自宅・固定電話番号の3つ目'),
  postalCode: k('contact', '郵便番号', '現住所の郵便番号を1つの欄にまとめて入力する'),
  postalCode1: k('contact', '郵便番号（前半）', '2分割された現住所の郵便番号の前半3桁'),
  postalCode2: k('contact', '郵便番号（後半）', '2分割された現住所の郵便番号の後半4桁'),
  prefecture: k('contact', '都道府県', '現住所の都道府県'),
  city: k('contact', '市区町村', '現住所の市区町村'),
  addressLine: k('contact', '番地', '現住所の町名・番地'),
  cityAddressLineBuilding: k('contact', '市区町村から建物名まで', '現住所の市区町村から建物名までを1つの欄に入力する（都道府県は含まない）'),
  fullAddressNoBuilding: k('contact', '都道府県から番地まで', '現住所の都道府県から番地までを1つの欄に入力する（建物名は含まない）'),
  addressLineBuilding: k('contact', '番地・建物名', '現住所の町名・番地と建物名を1つの欄に入力する'),
  cityAddressLine: k('contact', '市区町村・番地', '現住所の市区町村から番地までを1つの欄に入力する（都道府県と建物名は含まない）'),
  building: k('contact', '建物名', '現住所の建物名・部屋番号'),
  fullAddress: k('contact', '住所', '都道府県から建物名までの現住所全体を1つの欄に入力する'),
  fullAddressKana: k('contact', '住所（フリガナ）', '現住所全体の読み仮名'),
  prefectureKana: k('contact', '都道府県（フリガナ）', '都道府県の読み仮名'),
  cityKana: k('contact', '市区町村（フリガナ）', '市区町村の読み仮名'),
  addressLineKana: k('contact', '番地（フリガナ）', '町名・番地の読み仮名'),
  buildingKana: k('contact', '建物名（フリガナ）', '建物名の読み仮名'),
  nearestLine: k('contact', '最寄り路線', '自宅の最寄り駅の路線名'),
  nearestStation: k('contact', '最寄り駅', '自宅の最寄り駅名'),
  kiseiSameCheck: k('contact', '帰省先は現住所と同じ', '「帰省先・休暇中の連絡先が現住所と同じ」ことを示すチェックボックス'),
  kiseiPostalCode: k('contact', '帰省先の郵便番号', '帰省先・休暇中の連絡先の郵便番号'),
  kiseiPostalCode1: k('contact', '帰省先の郵便番号（前半）', '2分割された帰省先の郵便番号の前半3桁'),
  kiseiPostalCode2: k('contact', '帰省先の郵便番号（後半）', '2分割された帰省先の郵便番号の後半4桁'),
  kiseiPrefecture: k('contact', '帰省先の都道府県', '帰省先・休暇中の連絡先の都道府県'),
  kiseiCity: k('contact', '帰省先の市区町村', '帰省先・休暇中の連絡先の市区町村'),
  kiseiAddressLine: k('contact', '帰省先の番地', '帰省先・休暇中の連絡先の町名・番地'),
  kiseiBuilding: k('contact', '帰省先の建物名', '帰省先・休暇中の連絡先の建物名'),
  kiseiFullAddress: k('contact', '帰省先の住所', '帰省先・休暇中の連絡先の住所全体を1つの欄に入力する'),
  kiseiPhone: k('contact', '帰省先の電話番号', '帰省先・休暇中の連絡先の電話番号'),
  kiseiPhone1: k('contact', '帰省先の電話番号（1）', '3分割された帰省先の電話番号の1つ目'),
  kiseiPhone2: k('contact', '帰省先の電話番号（2）', '3分割された帰省先の電話番号の2つ目'),
  kiseiPhone3: k('contact', '帰省先の電話番号（3）', '3分割された帰省先の電話番号の3つ目'),
  kiseiCityAddressLine: k('contact', '帰省先の市区町村・番地', '帰省先の市区町村から番地までを1つの欄に入力する'),
  emergencyName: k('contact', '緊急連絡先の氏名', '緊急連絡先の人の氏名'),
  emergencyRelation: k('contact', '緊急連絡先の続柄', '緊急連絡先の人との続柄・関係'),
  emergencyPhone: k('contact', '緊急連絡先の電話番号', '緊急連絡先の電話番号'),

  // 学歴
  schoolType: k('education', '学校区分', '在籍している学校の区分（大学・大学院・短大・高専・専門学校など）'),
  bunri: k('education', '文理区分', '文系・理系の区分'),
  school: k('education', '学校名', '在籍・出身の学校名・大学名'),
  schoolKana: k('education', '学校名（フリガナ）', '学校名の読み仮名'),
  schoolInitial: k('education', '学校名の頭文字', '学校名の読みの最初の1文字（あ・か・さ…）を選ぶ欄'),
  schoolPrefecture: k('education', '学校の所在地', '在籍している学校の所在地の都道府県'),
  faculty: k('education', '学部', '学部・研究科'),
  department: k('education', '学科', '学科・専攻・コース'),
  fieldCategory: k('education', '学科系統', '学科・専攻の系統・分野'),
  degree: k('education', '学位・課程', '取得（予定）の学位、または課程'),
  admission: k('education', '入学年月', '現在の学校の入学年月を1つの欄に入力する'),
  admissionYear: k('education', '入学年', '入学年月の「年」だけの欄'),
  admissionMonth: k('education', '入学月', '入学年月の「月」だけの欄'),
  graduation: k('education', '卒業年月', '卒業（見込み）年月を1つの欄に入力する'),
  graduationYear: k('education', '卒業年', '卒業（見込み）年月の「年」だけの欄'),
  graduationMonth: k('education', '卒業月', '卒業（見込み）年月の「月」だけの欄'),
  graduationStatus: k('education', '卒業区分', '卒業見込みか卒業済みか（新卒・既卒）の区分'),
  lab: k('education', '研究室・ゼミ', '所属している研究室・ゼミの名前'),
  advisor: k('education', '指導教員', '研究室・ゼミの指導教員の名前'),
  researchTheme: k('education', '研究テーマ', '研究テーマ・卒業論文のテーマ'),
  highSchool: k('education', '高校名', '出身高校の名前'),
  highSchoolAdmission: k('education', '高校入学年月', '高校の入学年月'),
  highSchoolGraduation: k('education', '高校卒業年月', '高校の卒業年月'),
  highSchoolGraduationYear: k('education', '高校卒業年', '高校の卒業年月の「年」だけの欄'),
  highSchoolGraduationMonth: k('education', '高校卒業月', '高校の卒業年月の「月」だけの欄'),
  highSchoolGraduated: k('education', '高校を卒業しているか', '高校を卒業しているかを「はい／いいえ」で答える欄'),
  highSchoolPrefecture: k('education', '高校の所在地', '出身高校の所在地の都道府県'),
  educationHistory: k('education', '学歴（文章）', '学歴を年月とともに複数行で書く欄'),

  // 資格・スキル
  driverLicense: k('skills', '運転免許', '自動車運転免許の有無・種類'),
  driverLicenseDate: k('skills', '運転免許の取得年月', '自動車運転免許の取得年月'),
  toeic: k('skills', 'TOEIC スコア', 'TOEIC のスコア'),
  toeicDate: k('skills', 'TOEIC 受験年月', 'TOEIC の受験・取得年月'),
  toefl: k('skills', 'TOEFL スコア', 'TOEFL のスコア'),
  eiken: k('skills', '英検', '実用英語技能検定（英検）の級'),
  otherLanguage: k('skills', 'その他の語学', '英語以外も含む語学力・語学資格'),
  qualifications: k('skills', '資格・免許', '保有している資格・免許の一覧'),
  pcSkills: k('skills', 'PC スキル', 'パソコン・IT・プログラミングのスキル'),

  // 経験・自己PR
  club: k('experience', '部活・サークル', '所属している部活動・サークル・課外活動の名前'),
  clubRole: k('experience', '部活・サークルの役職', '部活動・サークルでの役職・役割'),
  studyAbroad: k('experience', '留学経験', '留学経験（国・期間・学校）'),
  partTime: k('experience', 'アルバイト経験', 'アルバイトの経験'),
  hobbies: k('experience', '趣味', '趣味'),
  specialSkills: k('experience', '特技', '特技'),
  hobbiesAndSkills: k('experience', '趣味・特技', '趣味と特技をまとめて書く欄'),
  portfolioUrl: k('experience', 'ポートフォリオ URL', 'ポートフォリオ・作品・個人サイト・SNS の URL'),
  githubUrl: k('experience', 'GitHub URL', 'GitHub アカウントの URL'),

  // 希望条件
  desiredLocation1: k('preferences', '希望勤務地（第1）', '第1希望の勤務地'),
  desiredLocation2: k('preferences', '希望勤務地（第2）', '第2希望の勤務地'),
  desiredLocation3: k('preferences', '希望勤務地（第3）', '第3希望の勤務地'),
  desiredJob: k('preferences', '希望職種', '希望する職種・部署'),
  personalRequest: k('preferences', '本人希望欄', '本人希望記入欄・その他の希望'),

  // 職歴（中途）
  currentCompany: k('career', '現在の勤務先', '現在または直近の勤務先の会社名'),
  currentJobType: k('career', '現在の職種', '現在または直近の職種'),
  employmentType: k('career', '雇用形態', '現在の雇用形態（正社員・契約社員など）'),
  currentSalary: k('career', '現在の年収', '現在の年収'),
  desiredSalary: k('career', '希望年収', '希望する年収'),
  availableDate: k('career', '入社可能時期', '入社できる時期・日付'),
  workHistory: k('career', '職務経歴', '職歴・職務経歴を複数行で書く欄'),
} as const satisfies Record<string, KeyDef>;

export type FieldKey = keyof typeof FIELD_KEYS;

export function isFieldKey(v: string): v is FieldKey {
  return Object.hasOwn(FIELD_KEYS, v);
}
