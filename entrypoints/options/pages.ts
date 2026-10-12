import type { LucideIcon } from 'lucide-react';
import { Award, Briefcase, GraduationCap, MapPin, Sparkles, Target, User } from 'lucide-react';
import type { ProfilePage } from '@/lib/fieldKeys';
import { BUNRI, DEGREES, FIELD_CATEGORIES, PREFECTURES, SCHOOL_TYPES } from '@/lib/prefectures';
import type { Profile } from '@/lib/types';

type StringKey = { [K in keyof Profile]: Profile[K] extends string ? K : never }[keyof Profile];

export type FieldDef =
  | {
      key: StringKey;
      label: string;
      type?: 'text' | 'email' | 'tel' | 'date' | 'month' | 'url' | 'textarea';
      placeholder?: string;
      hint?: string;
      wide?: boolean;
    }
  | {
      key: StringKey;
      label: string;
      type: 'select';
      options: (string | [value: string, label: string])[];
      hint?: string;
      wide?: boolean;
    }
  | { key: 'custom'; render: 'kisei' | 'qualifications' | 'locations' | 'photo'; label: string; wide: true };

export interface SectionDef {
  title: string;
  fields: FieldDef[];
  /** 「詳細を入力」を開くと出てくる項目 */
  detail?: FieldDef[];
  detailLabel?: string;
}

export interface PageDef {
  id: ProfilePage;
  label: string;
  icon: LucideIcon;
  description: string;
  sections: SectionDef[];
}

export const PAGES: PageDef[] = [
  {
    id: 'basic',
    label: '基本情報',
    icon: User,
    description: '氏名と生年月日は、ほぼすべてのフォームで使います。',
    sections: [
      {
        title: '氏名・生年月日',
        fields: [
          { key: 'lastName', label: '姓', placeholder: '山田' },
          { key: 'firstName', label: '名', placeholder: '太郎' },
          { key: 'lastNameKana', label: 'セイ', placeholder: 'ヤマダ' },
          { key: 'firstNameKana', label: 'メイ', placeholder: 'タロウ' },
          { key: 'birthDate', label: '生年月日', type: 'date', hint: '年齢と和暦は自動で計算します' },
          {
            key: 'gender',
            label: '性別',
            type: 'select',
            options: [['', '未設定'], ['male', '男性'], ['female', '女性'], ['other', 'その他・回答しない']],
            hint: '任意の項目です。未設定なら入力しません',
          },
        ],
        detailLabel: 'ローマ字・国籍・顔写真',
        detail: [
          { key: 'lastNameRoman', label: '姓（ローマ字）', placeholder: 'Yamada' },
          { key: 'firstNameRoman', label: '名（ローマ字）', placeholder: 'Taro' },
          { key: 'nationality', label: '国籍', placeholder: '日本' },
          { key: 'custom', render: 'photo', label: '顔写真', wide: true },
        ],
      },
    ],
  },
  {
    id: 'contact',
    label: '連絡先・住所',
    icon: MapPin,
    description: '現住所と連絡先です。帰省先や緊急連絡先は、聞かれたときだけ入力すれば大丈夫です。',
    sections: [
      {
        title: '連絡先',
        fields: [
          { key: 'email', label: 'メールアドレス', type: 'email', placeholder: 'taro@example.com' },
          { key: 'phone', label: '携帯電話番号', type: 'tel', placeholder: '090-1234-5678', hint: 'ハイフンありで入力すると、3分割の欄にも入ります' },
        ],
        detailLabel: '予備のメール・自宅電話',
        detail: [
          { key: 'emailSub', label: '予備のメールアドレス', type: 'email', placeholder: 'taro.sub@example.com' },
          { key: 'landline', label: '自宅電話番号', type: 'tel', placeholder: '03-1234-5678' },
        ],
      },
      {
        title: '現住所',
        fields: [
          { key: 'postalCode', label: '郵便番号', placeholder: '150-0041' },
          { key: 'prefecture', label: '都道府県', type: 'select', options: [['', '選択してください'], ...PREFECTURES] },
          { key: 'city', label: '市区町村', placeholder: '渋谷区' },
          { key: 'addressLine', label: '町名・番地', placeholder: '神南1-2-3' },
          { key: 'building', label: '建物名・部屋番号', placeholder: 'サンプルマンション101', wide: true },
        ],
        detailLabel: '住所のフリガナ・最寄り駅',
        detail: [
          { key: 'cityKana', label: '市区町村（フリガナ）', placeholder: 'シブヤク', hint: '都道府県のフリガナは自動で入ります' },
          { key: 'addressLineKana', label: '町名・番地（フリガナ）', placeholder: 'ジンナン1-2-3' },
          { key: 'buildingKana', label: '建物名（フリガナ）', placeholder: 'サンプルマンション101', wide: true },
          { key: 'nearestLine', label: '最寄りの路線', placeholder: 'JR山手線' },
          { key: 'nearestStation', label: '最寄り駅', placeholder: '渋谷' },
        ],
      },
      {
        title: '帰省先・緊急連絡先',
        fields: [{ key: 'custom', render: 'kisei', label: '帰省先', wide: true }],
        detailLabel: '緊急連絡先',
        detail: [
          { key: 'emergencyName', label: '氏名', placeholder: '山田 花子' },
          { key: 'emergencyRelation', label: '続柄', placeholder: '母' },
          { key: 'emergencyPhone', label: '電話番号', type: 'tel', placeholder: '090-0000-0000' },
        ],
      },
    ],
  },
  {
    id: 'education',
    label: '学歴',
    icon: GraduationCap,
    description: '学校区分・文理区分は就活サイトの登録でよく聞かれます。',
    sections: [
      {
        title: '在籍している学校',
        fields: [
          { key: 'schoolType', label: '学校区分', type: 'select', options: [['', '選択してください'], ...SCHOOL_TYPES] },
          { key: 'bunri', label: '文理区分', type: 'select', options: [['', '選択してください'], ...BUNRI] },
          { key: 'school', label: '学校名', placeholder: '〇〇大学' },
          {
            key: 'schoolKana',
            label: '学校名（フリガナ）',
            placeholder: 'マルマルダイガク',
            hint: '学校選択の「頭文字」で使います',
          },
          { key: 'faculty', label: '学部・研究科', placeholder: '経済学部' },
          { key: 'department', label: '学科・専攻', placeholder: '経済学科' },
          { key: 'admission', label: '入学年月', type: 'month' },
          { key: 'graduation', label: '卒業（見込み）年月', type: 'month' },
          {
            key: 'graduationStatus',
            label: '卒業区分',
            type: 'select',
            options: [['expected', '卒業見込み'], ['graduated', '卒業済み（既卒）']],
          },
        ],
        detailLabel: '設置区分・所在地・学科系統・学位・研究室',
        detail: [
          {
            key: 'schoolOwnership',
            label: '設置区分',
            type: 'select',
            options: [['', '未設定'], '国立', '公立', '私立', ['海外', '日本国外']],
          },
          {
            key: 'schoolPrefecture',
            label: '学校の所在地',
            type: 'select',
            options: [['', '選択してください'], ...PREFECTURES],
          },
          { key: 'fieldCategory', label: '学科系統', type: 'select', options: [['', '選択してください'], ...FIELD_CATEGORIES] },
          { key: 'degree', label: '学位', type: 'select', options: [['', '選択してください'], ...DEGREES] },
          { key: 'lab', label: '研究室・ゼミ', placeholder: '山本ゼミ' },
          { key: 'advisor', label: '指導教員', placeholder: '山本 一郎' },
          { key: 'researchTheme', label: '研究テーマ', type: 'textarea', wide: true },
        ],
      },
      {
        title: '高校',
        fields: [],
        detailLabel: '高校の情報（履歴書形式の学歴欄で使います）',
        detail: [
          { key: 'highSchool', label: '高校名', placeholder: '県立〇〇高等学校', wide: true },
          { key: 'highSchoolAdmission', label: '入学年月', type: 'month' },
          { key: 'highSchoolGraduation', label: '卒業年月', type: 'month' },
          {
            key: 'highSchoolPrefecture',
            label: '高校の所在地',
            type: 'select',
            options: [['', '選択してください'], ...PREFECTURES],
          },
        ],
      },
    ],
  },
  {
    id: 'skills',
    label: '資格・スキル',
    icon: Award,
    description: '運転免許と TOEIC は独立した欄で聞かれることが多い項目です。',
    sections: [
      {
        title: '免許・語学',
        fields: [
          {
            key: 'driverLicense',
            label: '自動車運転免許',
            type: 'select',
            options: [['', '未設定'], ['regular', '普通自動車第一種'], ['regularAT', '普通自動車第一種（AT限定）'], ['none', '持っていない']],
          },
          { key: 'driverLicenseDate', label: '免許の取得年月', type: 'month' },
          { key: 'toeic', label: 'TOEIC スコア', placeholder: '780' },
          { key: 'toeicDate', label: 'TOEIC 受験年月', type: 'month' },
        ],
        detailLabel: 'その他の語学・資格・PC スキル',
        detail: [
          { key: 'toefl', label: 'TOEFL iBT スコア', placeholder: '85' },
          { key: 'eiken', label: '英検', placeholder: '準1級' },
          { key: 'otherLanguage', label: 'その他の語学', placeholder: '中国語（日常会話レベル）', wide: true },
          { key: 'custom', render: 'qualifications', label: 'その他の資格', wide: true },
          { key: 'pcSkills', label: 'PC スキル', type: 'textarea', placeholder: 'Word・Excel（関数・ピボット）、Python', wide: true },
        ],
      },
    ],
  },
  {
    id: 'experience',
    label: '経験・自己PR',
    icon: Sparkles,
    description: '短い文章の欄に使います。志望動機などの長い文章は、今後の ES 機能で扱う予定です。',
    sections: [
      {
        title: '活動',
        fields: [
          { key: 'club', label: '部活・サークル', placeholder: 'テニスサークル' },
          { key: 'clubRole', label: '役職', placeholder: '副部長' },
          { key: 'hobbies', label: '趣味', placeholder: '写真、旅行' },
          { key: 'specialSkills', label: '特技', placeholder: 'ピアノ' },
        ],
        detailLabel: '留学・アルバイト・URL',
        detail: [
          { key: 'studyAbroad', label: '留学経験', type: 'textarea', placeholder: '2024年9月〜2025年3月 カナダ・〇〇大学', wide: true },
          { key: 'partTime', label: 'アルバイト経験', type: 'textarea', placeholder: '飲食店ホールスタッフ（3年）', wide: true },
          { key: 'portfolioUrl', label: 'ポートフォリオ・SNS の URL', type: 'url', placeholder: 'https://' },
          { key: 'githubUrl', label: 'GitHub の URL', type: 'url', placeholder: 'https://github.com/' },
        ],
      },
    ],
  },
  {
    id: 'preferences',
    label: '希望条件',
    icon: Target,
    description: '企業ごとに選択肢が違うので、近いものを選んで入力します。',
    sections: [
      {
        title: '希望',
        fields: [
          { key: 'custom', render: 'locations', label: '希望勤務地', wide: true },
          { key: 'desiredJob', label: '希望職種', placeholder: '営業', wide: true },
          {
            key: 'personalRequest',
            label: '本人希望欄',
            type: 'textarea',
            placeholder: '貴社の規定に従います。',
            hint: '特に希望がなければ「貴社の規定に従います。」が一般的です',
            wide: true,
          },
        ],
      },
    ],
  },
  {
    id: 'career',
    label: '職歴（中途）',
    icon: Briefcase,
    description: '転職活動で使う項目です。新卒の方は入力不要です。',
    sections: [
      {
        title: '現在の仕事',
        fields: [
          { key: 'currentCompany', label: '勤務先', placeholder: '株式会社〇〇' },
          { key: 'currentJobType', label: '職種', placeholder: '法人営業' },
          { key: 'employmentType', label: '雇用形態', type: 'select', options: [['', '選択してください'], '正社員', '契約社員', '派遣社員', 'アルバイト・パート', '業務委託'] },
          { key: 'availableDate', label: '入社可能時期', placeholder: '2027年4月' },
        ],
        detailLabel: '年収・職務経歴',
        detail: [
          { key: 'currentSalary', label: '現在の年収', placeholder: '450万円' },
          { key: 'desiredSalary', label: '希望年収', placeholder: '500万円' },
          { key: 'workHistory', label: '職務経歴', type: 'textarea', wide: true },
        ],
      },
    ],
  },
];

export { ESSENTIALS } from '@/lib/essentials';

/** そのページの項目のうち、入力済みの数（カスタム欄は1項目として数える） */
export function pageProgress(page: PageDef, p: Profile): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  for (const s of page.sections) {
    for (const f of [...s.fields, ...(s.detail ?? [])]) {
      total++;
      if (isFilled(f, p)) filled++;
    }
  }
  return { filled, total };
}

export function isFilled(f: FieldDef, p: Profile): boolean {
  if (f.key !== 'custom') return !!p[f.key];
  switch (f.render) {
    case 'kisei':
      return p.kiseiSame || !!p.kiseiPrefecture;
    case 'qualifications':
      return p.qualifications.some((q) => q.name);
    case 'locations':
      return p.desiredLocations.some(Boolean);
    case 'photo':
      return !!p.photo;
  }
}
