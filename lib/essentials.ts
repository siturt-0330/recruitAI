import type { Profile } from './types';

/** 最初に埋めてほしい項目（多くの応募フォームで使うもの） */
export const ESSENTIALS = [
  'lastName',
  'firstName',
  'lastNameKana',
  'firstNameKana',
  'birthDate',
  'email',
  'phone',
  'postalCode',
  'prefecture',
  'city',
  'addressLine',
  'schoolType',
  'school',
  'faculty',
  'department',
  'graduation',
] as const satisfies readonly (keyof Profile)[];

export function essentialProgress(p: Profile): { done: number; total: number; ratio: number } {
  const done = ESSENTIALS.filter((k) => !!p[k]).length;
  return { done, total: ESSENTIALS.length, ratio: done / ESSENTIALS.length };
}
