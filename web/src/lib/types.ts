import type { Profile } from '@ext/types';

export type { Profile };

/** 選考の段階。ボードでは列ごとにまとめて表示する */
export type Stage =
  | 'entry'
  | 'esSubmitted'
  | 'interview1'
  | 'interview2'
  | 'final'
  | 'offer'
  | 'closed';

export interface Company {
  id: string;
  name: string;
  /** 採用ページ・公式サイト */
  url: string;
  /** サイトから取得したロゴ（data URL）。なければ頭文字で表示 */
  logo: string;
  industry: string;
  stage: Stage;
  /** 締切（YYYY-MM-DD） */
  deadline: string;
  /** 締切の中身（「ES」「適性検査」など） */
  deadlineLabel: string;
  /** 次の予定（YYYY-MM-DDTHH:mm）とその中身 */
  nextAt: string;
  nextLabel: string;
  mypageUrl: string;
  loginId: string;
  memo: string;
  /** 拡張機能の「ボードに記録」で応募フォームを出した日時（ISO）。なければ空 */
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  answer: string;
  /** 答えに詰まった */
  stuck: boolean;
  episodeId: string;
}

export interface SophonReview {
  good: string;
  improve: string;
  notes: string[];
  createdAt: string;
  /** AI を使ったか、ルールで作ったか */
  by: 'ai' | 'rules';
}

export interface Interview {
  id: string;
  companyId: string;
  /** 「一次面接」「二次面接」など */
  round: string;
  /** YYYY-MM-DDTHH:mm */
  at: string;
  format: '対面' | 'Web' | '電話';
  interviewers: string;
  /** 手応え 1〜5。未記入は 0 */
  rating: number;
  questions: InterviewQuestion[];
  reverseQuestions: string;
  improvements: string;
  /** 音声メモなどから貼り付けた、まとまっていないメモ */
  rawNotes: string;
  review: SophonReview | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: 'sophon' | 'me';
  text: string;
}

export interface Episode {
  id: string;
  title: string;
  /** 「大学1年」など */
  period: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  strengths: string[];
  chat: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

/** 自己分析のテンプレート（質問に答えていく形式） */
export type SheetId = 'history' | 'strengths' | 'values' | 'gakuchika';

export interface EsAnswer {
  id: string;
  category: '志望動機' | '自己PR' | 'ガクチカ' | '長所・短所' | 'その他';
  title: string;
  text: string;
  /** 字数制限（0 は指定なし） */
  charLimit: number;
  companyIds: string[];
  episodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  companies: Company[];
  interviews: Interview[];
  episodes: Episode[];
  sheets: Record<SheetId, Record<string, string>>;
  esAnswers: EsAnswer[];
  /** 自分で追加した業界（プルダウンの選択肢） */
  industries: string[];
  /** 応募フォーム用のプロフィール。拡張機能と同じもの */
  profile: Profile | null;
  /** 完了にした「今日やること」の ID（日付ごと） */
  doneTasks: Record<string, string[]>;
  /** サンプルデータを表示中か */
  sample: boolean;
}
