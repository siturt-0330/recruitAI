export const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

const PREFECTURE_KANA_LIST = [
  'ホッカイドウ', 'アオモリケン', 'イワテケン', 'ミヤギケン', 'アキタケン', 'ヤマガタケン', 'フクシマケン',
  'イバラキケン', 'トチギケン', 'グンマケン', 'サイタマケン', 'チバケン', 'トウキョウト', 'カナガワケン',
  'ニイガタケン', 'トヤマケン', 'イシカワケン', 'フクイケン', 'ヤマナシケン', 'ナガノケン', 'ギフケン',
  'シズオカケン', 'アイチケン', 'ミエケン', 'シガケン', 'キョウトフ', 'オオサカフ', 'ヒョウゴケン',
  'ナラケン', 'ワカヤマケン', 'トットリケン', 'シマネケン', 'オカヤマケン', 'ヒロシマケン', 'ヤマグチケン',
  'トクシマケン', 'カガワケン', 'エヒメケン', 'コウチケン', 'フクオカケン', 'サガケン', 'ナガサキケン',
  'クマモトケン', 'オオイタケン', 'ミヤザキケン', 'カゴシマケン', 'オキナワケン',
];

/** 都道府県の英語名（英語のフォームの選択肢「Tokyo」用） */
const PREFECTURE_EN_LIST = [
  'Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima',
  'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa',
  'Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu',
  'Shizuoka', 'Aichi', 'Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo',
  'Nara', 'Wakayama', 'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi',
  'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga', 'Nagasaki',
  'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa',
];

export const PREFECTURE_EN: Record<string, string> = Object.fromEntries(PREFECTURES.map((p, i) => [p, PREFECTURE_EN_LIST[i] ?? '']));

/** 都道府県名 → カタカナの読み（入力不要で自動生成するため） */
export const PREFECTURE_KANA: Record<string, string> = Object.fromEntries(
  PREFECTURES.map((p, i) => [p, PREFECTURE_KANA_LIST[i] ?? '']),
);

export const SCHOOL_TYPES = ['大学', '大学院（修士）', '大学院（博士）', '短期大学', '高等専門学校', '専門学校', '海外の学校', '高校'];
export const BUNRI = ['文系', '理系', 'その他'];
export const DEGREES = ['学士', '修士', '博士', '専門職学位', '短期大学士', '準学士'];
export const FIELD_CATEGORIES = [
  '人文科学系', '社会科学系（法・政治）', '社会科学系（経済・経営・商）', '社会科学系（社会・その他）',
  '理学系', '工学系', '農学・水産系', '医療・保健系', '教育系', '芸術・体育系', '家政・生活系', '総合・学際系', 'その他',
];
