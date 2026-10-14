import { daysUntil, md, mdTime, today } from './dates';
import type { AppData, Company } from './types';

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

export interface CalendarEvent {
  date: string;
  time: string;
  label: string;
  company: Company;
  kind: 'deadline' | 'interview' | 'event';
}

const isReviewed = (i: AppData['interviews'][number]) => i.rating > 0 || i.questions.length > 0 || !!i.review;

/**
 * 「今日やること」を、締切・面接の予定・未記入の振り返りから優先順に作る。
 * Sophon（AI）を使わずにルールで作るので、キーがなくても動く。
 */
export function todayTasks(data: AppData): Task[] {
  const t = today();
  const tasks: Task[] = [];
  const byId = new Map(data.companies.map((c) => [c.id, c]));

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
          href: `/companies/${c.id}`,
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
          detail: `${n === 0 ? '今日' : n === 1 ? '明日' : md(c.nextAt, true)} ${c.nextAt.slice(11, 16)} · これまでの面接ログを見直す`,
          href: `/companies/${c.id}`,
          action: '見る',
          priority: n + 0.5,
        });
      }
    }
  }

  // 終わった面接で、振り返りがまだのもの
  for (const i of data.interviews) {
    const n = daysUntil(i.at, t);
    if (n > 0 || n < -14 || isReviewed(i)) continue;
    const c = byId.get(i.companyId);
    if (!c) continue;
    tasks.push({
      id: `review:${i.id}`,
      title: `${c.name}の${i.round}を振り返る`,
      detail: '記憶が新しいうちに · 3分で終わります',
      href: `/companies/${c.id}?interview=${i.id}`,
      action: '書く',
      priority: 0.8 - n * 0.01,
    });
  }

  return tasks.sort((a, b) => a.priority - b.priority);
}

/** 期間内の予定（締切・面接・説明会など） */
export function eventsBetween(data: AppData, from: string, to: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const byId = new Map(data.companies.map((c) => [c.id, c]));
  const within = (d: string) => d >= from && d <= to;
  for (const c of data.companies) {
    if (c.deadline && within(c.deadline)) {
      events.push({ date: c.deadline, time: '', label: `${c.deadlineLabel || '締切'} 締切`, company: c, kind: 'deadline' });
    }
    if (c.nextAt && within(c.nextAt.slice(0, 10))) {
      events.push({
        date: c.nextAt.slice(0, 10),
        time: c.nextAt.slice(11, 16),
        label: c.nextLabel || '予定',
        company: c,
        kind: /面接/.test(c.nextLabel) ? 'interview' : 'event',
      });
    }
  }
  for (const i of data.interviews) {
    const d = i.at.slice(0, 10);
    const c = byId.get(i.companyId);
    // 企業の「次の予定」と同じ面接は二重に出さない
    if (!c || !within(d) || (c.nextAt && c.nextAt.slice(0, 10) === d)) continue;
    events.push({ date: d, time: i.at.slice(11, 16), label: i.round, company: c, kind: 'interview' });
  }
  return events.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

export function nextEventText(c: Company): string {
  if (c.nextAt) return `${mdTime(c.nextAt)} ${c.nextLabel}`.trim();
  return c.nextLabel;
}
