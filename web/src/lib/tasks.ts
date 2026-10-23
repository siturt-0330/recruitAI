import { daysUntil, md, mdTime, today } from './dates';
import type { AppData, Company } from './types';
import { companyHref } from './links';

export interface Task {
  id: string;
  title: string;
  detail: string;
  /** 締切までの残りなどの強調 */
  badge?: { label: string; tone: 'red' | 'amber' };
  href: string;
  action: string;
  /** 小さいほど先に表示 */
  priority: number;
}

/**
 * 「今日やること」を、締切と面接の予定から優先順に作る。
 * Sophon（AI）を使わずにルールで作るので、キーがなくても動く。
 */
export function todayTasks(data: AppData): Task[] {
  const t = today();
  const tasks: Task[] = [];
  for (const c of data.companies) {
    if (c.stage === 'closed') continue;
    if (c.deadline) {
      const n = daysUntil(c.deadline, t);
      if (n >= 0 && n <= 3) {
        tasks.push({
          id: `deadline:${c.id}:${c.deadline}`,
          title: `${c.name}の${c.deadlineLabel || '締切'}${/ES|エントリー/.test(c.deadlineLabel) ? 'を提出' : ''}`,
          detail: `締切 ${n === 0 ? '今日' : n === 1 ? '明日' : md(c.deadline, true)}`,
          badge: n <= 1 ? { label: n === 0 ? '今日まで' : 'あと1日', tone: 'red' } : { label: `あと${n}日`, tone: 'amber' },
          href: companyHref(c.id),
          action: '開く',
          priority: n,
        });
      }
    }
    if (c.nextAt) {
      const n = daysUntil(c.nextAt, t);
      if (n >= 0 && n <= 2 && /面接/.test(c.nextLabel)) {
        tasks.push({
          id: `prepare:${c.id}:${c.nextAt}`,
          title: `${c.name}の${c.nextLabel.replace(/（.*）/, '')}の準備`,
          detail: `${n === 0 ? '今日' : n === 1 ? '明日' : md(c.nextAt, true)} ${c.nextAt.slice(11, 16)}`,
          href: companyHref(c.id),
          action: '見る',
          priority: n + 0.5,
        });
      }
    }
  }

  return tasks.sort((a, b) => a.priority - b.priority);
}

export function nextEventText(c: Company): string {
  if (c.nextAt) return `${mdTime(c.nextAt)} ${c.nextLabel}`.trim();
  return c.nextLabel;
}
