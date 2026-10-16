export type Gender = '' | 'male' | 'female' | 'other';
export type GraduationStatus = '' | 'expected' | 'graduated';
export type DriverLicense = '' | 'none' | 'regular' | 'regularAT';

export interface Qualification {
  name: string;
  /** YYYY-MM */
  date: string;
}

/** 日付は date が YYYY-MM-DD、年月は YYYY-MM で持つ */
export interface Profile {
  id: string;
  /** プロフィール自体の名前（例: 新卒用） */
  label: string;
  /** 最後に編集した日時（ISO）。Sophon との同期で新しいほうを残すのに使う */
  updatedAt?: string;

  // 基本情報
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  lastNameRoman: string;
  firstNameRoman: string;
  birthDate: string;
  gender: Gender;
  nationality: string;
  /** 顔写真（縮小済みの JPEG data URL） */
  photo: string;

  // 連絡先・住所
  email: string;
  emailSub: string;
  /** 携帯電話 */
  phone: string;
  /** 自宅・固定電話 */
  landline: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine: string;
  building: string;
  cityKana: string;
  addressLineKana: string;
  buildingKana: string;
  nearestLine: string;
  nearestStation: string;
  /** 帰省先が現住所と同じ */
  kiseiSame: boolean;
  kiseiPostalCode: string;
  kiseiPrefecture: string;
  kiseiCity: string;
  kiseiAddressLine: string;
  kiseiBuilding: string;
  kiseiPhone: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;

  // 学歴
  schoolType: string;
  bunri: string;
  school: string;
  /** 学校名の読み（学校選択の「頭文字」で使う） */
  schoolKana: string;
  /** 学校の所在地（都道府県） */
  schoolPrefecture: string;
  /** 設置区分（国立・公立・私立・海外） */
  schoolOwnership: string;
  faculty: string;
  department: string;
  fieldCategory: string;
  degree: string;
  admission: string;
  /** 卒業・卒業見込み年月 */
  graduation: string;
  graduationStatus: GraduationStatus;
  lab: string;
  advisor: string;
  researchTheme: string;
  highSchool: string;
  highSchoolAdmission: string;
  highSchoolGraduation: string;
  highSchoolPrefecture: string;

  // 資格・スキル
  driverLicense: DriverLicense;
  driverLicenseDate: string;
  toeic: string;
  toeicDate: string;
  toefl: string;
  eiken: string;
  otherLanguage: string;
  qualifications: Qualification[];
  pcSkills: string;

  // 経験・自己PR
  club: string;
  clubRole: string;
  studyAbroad: string;
  partTime: string;
  hobbies: string;
  specialSkills: string;
  portfolioUrl: string;
  githubUrl: string;

  // 希望条件
  desiredLocations: string[];
  desiredJob: string;
  personalRequest: string;

  // 職歴（中途）
  currentCompany: string;
  currentJobType: string;
  employmentType: string;
  currentSalary: string;
  desiredSalary: string;
  availableDate: string;
  workHistory: string;
}

export type Engine = 'rules' | 'openai';

export interface Settings {
  engine: Engine;
  /** この確信度以上なら確認なしで入力済み扱いにする */
  threshold: number;
}

export const DEFAULT_SETTINGS: Settings = {
  engine: 'openai',
  threshold: 0.9,
};

/** 欄の書式に関するヒント。値の変換に使う */
export interface Hints {
  kana: 'kata' | 'hira' | 'half';
  width: 'full' | 'half' | null;
  era: 'wareki' | 'seireki' | null;
  hyphen: boolean | null;
  dateFormat: 'slash' | 'hyphen' | 'kanji' | 'compact' | null;
  /** 氏名の姓と名の間のスペース（placeholder の例に合わせる） */
  nameSpace: 'full' | 'half' | 'none' | null;
  /** 1文字だけ入れる欄で濁点を残すか（「濁点含む」「清音で」などの指定） */
  dakuten: boolean | null;
}

export type FieldStatus = 'ok' | 'warn' | 'empty' | 'skip';

export interface ReviewItem {
  id: string;
  label: string;
  keyLabel: string;
  confidence: number;
  source: 'rule' | 'ai';
  current: string;
  alternatives: string[];
}

export interface FrameStatus {
  /** プロフィール項目だと判定できた欄の数 */
  detected: number;
  filled: number;
  warn: number;
  reviews: ReviewItem[];
  /** 欄はあったがプロフィールが未登録だった項目 */
  missing?: { key: string; label: string }[];
  error?: 'no-profile';
  /** 診断情報（diagnose のときだけ） */
  report?: string;
  aiError?: string;
}

export interface RemoteQuestion {
  name: string;
  instructions: string;
}

export interface RemoteAnswer {
  name: string;
  choice: string;
  confidence: number;
}
