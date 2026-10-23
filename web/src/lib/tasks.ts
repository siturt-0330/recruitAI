import { mdTime } from './dates';
import type { Company } from './types';

export function nextEventText(c: Company): string {
  if (c.nextAt) return `${mdTime(c.nextAt)} ${c.nextLabel}`.trim();
  return c.nextLabel;
}
