const HALF_FULL = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンァィゥェォッャュョー・';
const HALF_HALF = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝｧｨｩｪｫｯｬｭｮｰ･';

const HALF_KANA: Record<string, string> = {};
Array.from(HALF_FULL).forEach((c, i) => (HALF_KANA[c] = HALF_HALF[i] ?? c));
for (const c of 'ガギグゲゴザジズゼゾダヂヅデドバビブベボ') {
  HALF_KANA[c] = HALF_KANA[String.fromCharCode(c.charCodeAt(0) - 1)] + 'ﾞ';
}
for (const c of 'パピプペポ') {
  HALF_KANA[c] = HALF_KANA[String.fromCharCode(c.charCodeAt(0) - 2)] + 'ﾟ';
}
HALF_KANA['ヴ'] = 'ｳﾞ';
HALF_KANA['　'] = ' ';

/** 半角カナだけを全角に戻す（NFKC を全体にかけると全角スペースまで半角になるため） */
const widenHalfKana = (s: string) => s.replace(/[｡-ﾟ]+/g, (m) => m.normalize('NFKC'));

export const toKatakana = (s: string) =>
  widenHalfKana(s).replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

export const toHiragana = (s: string) =>
  widenHalfKana(s).replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

export const toHalfKana = (s: string) =>
  Array.from(toKatakana(s))
    .map((c) => HALF_KANA[c] ?? c)
    .join('');

export const toFullWidth = (s: string) =>
  s.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).replace(/ /g, '　');

export const toHalfWidthAscii = (s: string) =>
  s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');

export const hasHiragana = (s: string) => /[ぁ-ゖ]/.test(s);
export const hasHalfKana = (s: string) => /[ｦ-ﾟ]/.test(s);
export const hasFullDigit = (s: string) => /[０-９]/.test(s);

/** 比較用の正規化（全角半角・大小文字・空白を揃える） */
export const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

const ERAS = [
  { name: '令和', abbr: 'R', start: 20190501 },
  { name: '平成', abbr: 'H', start: 19890108 },
  { name: '昭和', abbr: 'S', start: 19261225 },
  { name: '大正', abbr: 'T', start: 19120730 },
];

export function toWareki(y: number, m: number, d: number) {
  const n = y * 10000 + m * 100 + d;
  const era = ERAS.find((e) => n >= e.start);
  if (!era) return null;
  return { era: era.name, abbr: era.abbr, year: y - Math.floor(era.start / 10000) + 1 };
}
