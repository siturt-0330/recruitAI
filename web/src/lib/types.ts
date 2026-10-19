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

/** 会社ページのメモ欄の1行（Notion のブロック） */
export type BlockType = 'text' | 'heading' | 'bullet' | 'todo';

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  /** やること（todo）のチェック */
  checked?: boolean;
}

/** 自分で追加したプロパティ（「本社」「年収」など） */
export interface CustomProp {
  id: string;
  name: string;
  value: string;
}

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
  /** 拡張機能にパスワードを保存してあるか（パスワード自体は拡張機能にしかない） */
  hasPassword: boolean;
  /** メモ欄の文字だけをつなげたもの（検索や CSV 用。blocks を直すと作り直す） */
  memo: string;
  blocks: Block[];
  props: CustomProp[];
  /** 拡張機能の「ボードに記録」で応募フォームを出した日時（ISO）。なければ空 */
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  companies: Company[];
  /** 自分で追加した業界（プルダウンの選択肢） */
  industries: string[];
  /** 応募フォーム用のプロフィール。拡張機能と同じもの */
  profile: Profile | null;
  /** 完了にした「今日やること」の ID（日付ごと） */
  doneTasks: Record<string, string[]>;
  /** サンプルデータを表示中か */
  sample: boolean;
  /** 消した会社の ID。拡張機能につながっていないときに消すと、拡張機能に残ったログイン情報から会社が戻ってきてしまうので、次につながったときに拡張機能からも消してもらう */
  removedIds: string[];
}
