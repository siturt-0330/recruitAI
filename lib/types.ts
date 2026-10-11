export type Gender = '' | 'male' | 'female' | 'other';

export interface Profile {
  id: string;
  /** プロフィール自体の名前（例: 新卒用） */
  label: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  lastNameRoman: string;
  firstNameRoman: string;
  /** YYYY-MM-DD */
  birthDate: string;
  gender: Gender;
  email: string;
  phone: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine: string;
  building: string;
  school: string;
  faculty: string;
  department: string;
  /** YYYY-MM（卒業・卒業見込み） */
  graduation: string;
}

export type Engine = 'rules' | 'openai';

export interface Settings {
  engine: Engine;
  /** この確信度以上なら確認なしで入力済み扱いにする */
  threshold: number;
  openaiApiKey: string;
}

export const DEFAULT_SETTINGS: Settings = {
  engine: 'rules',
  threshold: 0.9,
  openaiApiKey: '',
};

/** 欄の書式に関するヒント。値の変換に使う */
export interface Hints {
  kana: 'kata' | 'hira' | 'half';
  width: 'full' | 'half' | null;
  era: 'wareki' | 'seireki' | null;
  hyphen: boolean | null;
  dateFormat: 'slash' | 'hyphen' | 'kanji' | 'compact' | null;
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
  error?: 'no-profile';
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
