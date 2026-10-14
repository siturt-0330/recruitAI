const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** ローカル時刻の YYYY-MM-DD */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function today(): string {
  return ymd(new Date());
}

export function addDays(base: string, n: number): string {
  const [y, m, d] = base.split('-').map(Number);
  return ymd(new Date(y!, m! - 1, d! + n));
}

/** base から target までの日数（target が過去なら負） */
export function daysUntil(target: string, base = today()): number {
  const [y1, m1, d1] = base.split('-').map(Number);
  const [y2, m2, d2] = target.slice(0, 10).split('-').map(Number);
  return Math.round((new Date(y2!, m2! - 1, d2!).getTime() - new Date(y1!, m1! - 1, d1!).getTime()) / 864e5);
}

export function weekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WEEK[new Date(y!, m! - 1, d!).getDay()]!;
}

/** 「10/16（木）」 */
export function md(date: string, withWeekday = false): string {
  if (!date) return '';
  const [, m, d] = date.slice(0, 10).split('-').map(Number);
  return `${m}/${d}${withWeekday ? `（${weekday(date.slice(0, 10))}）` : ''}`;
}

/** 「10/16 14:00」 */
export function mdTime(dt: string): string {
  if (!dt) return '';
  return `${md(dt)}${dt.length > 10 ? ` ${dt.slice(11, 16)}` : ''}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** 締切までの残りに応じた表示（3日以内だけ） */
export function dueBadge(deadline: string): { label: string; tone: 'red' | 'amber' } | null {
  if (!deadline) return null;
  const n = daysUntil(deadline);
  if (n < 0) return null;
  if (n <= 1) return { label: n === 0 ? '今日まで' : 'あと1日', tone: 'red' };
  if (n <= 3) return { label: `あと${n}日`, tone: 'amber' };
  return null;
}
