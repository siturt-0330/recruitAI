'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { nowIso } from './dates';
import { EMPTY_SHEETS, sampleData } from './seed';
import { emptyProfile, normalizeProfile } from '@ext/profile';
import type { LinkRecord } from '@ext/sophon-link';
import { stageOrder } from './stages';
import type { AppData, Company, EsAnswer, Episode, Interview, Profile, SheetId } from './types';

/**
 * アプリのデータ。今はこのブラウザの localStorage にだけ保存する。
 * 読み書きはこのストアに集めてあるので、あとで Supabase などに差し替えられる。
 */
interface Actions {
  upsertCompany(c: Company): void;
  patchCompany(id: string, patch: Partial<Company>): void;
  removeCompany(id: string): void;
  upsertInterview(i: Interview): void;
  patchInterview(id: string, patch: Partial<Interview>): void;
  removeInterview(id: string): void;
  upsertEpisode(e: Episode): void;
  patchEpisode(id: string, patch: Partial<Episode>): void;
  removeEpisode(id: string): void;
  setSheetAnswer(sheet: SheetId, questionId: string, value: string): void;
  upsertEsAnswer(a: EsAnswer): void;
  patchEsAnswer(id: string, patch: Partial<EsAnswer>): void;
  removeEsAnswer(id: string): void;
  toggleTask(date: string, taskId: string): void;
  addIndustry(name: string): void;
  /** 画面で編集したプロフィール（更新日時を付ける） */
  patchProfile(patch: Partial<Profile>): void;
  /** 拡張機能から届いたプロフィール（そのまま置き換える） */
  replaceProfile(p: Profile): void;
  /** 拡張機能の「ボードに記録」を反映する */
  applyRecords(records: LinkRecord[]): void;
  clearSample(): void;
  loadSample(): void;
}

type Store = AppData & Actions & { boardView: 'board' | 'table'; setBoardView(v: 'board' | 'table'): void };

const touch = <T extends { updatedAt: string }>(x: T): T => ({ ...x, updatedAt: nowIso() });
const upsert = <T extends { id: string; updatedAt: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? touch(item) : x)) : [...list, touch(item)];
const patch = <T extends { id: string; updatedAt: string }>(list: T[], id: string, p: Partial<T>) =>
  list.map((x) => (x.id === id ? touch({ ...x, ...p }) : x));

export const useStore = create<Store>()(
  persist(
    (set) => ({
      ...sampleData(),
      boardView: 'board',
      setBoardView: (boardView) => set({ boardView }),

      upsertCompany: (c) => set((s) => ({ companies: upsert(s.companies, c) })),
      patchCompany: (id, p) => set((s) => ({ companies: patch(s.companies, id, p) })),
      removeCompany: (id) =>
        set((s) => ({
          companies: s.companies.filter((c) => c.id !== id),
          interviews: s.interviews.filter((i) => i.companyId !== id),
          esAnswers: s.esAnswers.map((a) => ({ ...a, companyIds: a.companyIds.filter((x) => x !== id) })),
        })),

      upsertInterview: (i) => set((s) => ({ interviews: upsert(s.interviews, i) })),
      patchInterview: (id, p) => set((s) => ({ interviews: patch(s.interviews, id, p) })),
      removeInterview: (id) => set((s) => ({ interviews: s.interviews.filter((i) => i.id !== id) })),

      upsertEpisode: (e) => set((s) => ({ episodes: upsert(s.episodes, e) })),
      patchEpisode: (id, p) => set((s) => ({ episodes: patch(s.episodes, id, p) })),
      removeEpisode: (id) => set((s) => ({ episodes: s.episodes.filter((e) => e.id !== id) })),

      setSheetAnswer: (sheet, q, v) => set((s) => ({ sheets: { ...s.sheets, [sheet]: { ...s.sheets[sheet], [q]: v } } })),

      upsertEsAnswer: (a) => set((s) => ({ esAnswers: upsert(s.esAnswers, a) })),
      patchEsAnswer: (id, p) => set((s) => ({ esAnswers: patch(s.esAnswers, id, p) })),
      removeEsAnswer: (id) => set((s) => ({ esAnswers: s.esAnswers.filter((a) => a.id !== id) })),

      toggleTask: (date, taskId) =>
        set((s) => {
          const done = s.doneTasks[date] ?? [];
          const next = done.includes(taskId) ? done.filter((x) => x !== taskId) : [...done, taskId];
          // 古い日付の記録はためない
          return { doneTasks: { [date]: next } };
        }),

      addIndustry: (name) => set((s) => (s.industries.includes(name) ? {} : { industries: [...s.industries, name] })),

      patchProfile: (p) =>
        set((s) => ({ profile: { ...(s.profile ?? emptyProfile('Sophon')), ...p, updatedAt: nowIso() } })),
      replaceProfile: (p) => set({ profile: normalizeProfile(p) }),
      applyRecords: (records) =>
        set((s) => {
          const submitted = stageOrder('esSubmitted');
          let { companies, esAnswers } = s;
          for (const r of records) {
            companies = companies.map((c) =>
              c.id === r.companyId
                ? touch({ ...c, submittedAt: r.at, stage: stageOrder(c.stage) < submitted ? 'esSubmitted' : c.stage })
                : c,
            );
            esAnswers = esAnswers.map((a) =>
              r.esAnswerIds.includes(a.id) && !a.companyIds.includes(r.companyId) ? touch({ ...a, companyIds: [...a.companyIds, r.companyId] }) : a,
            );
          }
          return { companies, esAnswers };
        }),

      clearSample: () =>
        set({ companies: [], interviews: [], episodes: [], esAnswers: [], sheets: EMPTY_SHEETS, doneTasks: {}, sample: false }),
      loadSample: () => set({ ...sampleData() }),
    }),
    {
      name: 'sophon-data',
      version: 3,
      // v2: 「気になる」をなくし、業界の選択肢を持つようにした
      migrate: (state, version) => {
        const s = state as AppData;
        if (version < 2) {
          s.companies = (s.companies ?? []).map((c) => ((c.stage as string) === 'interested' ? { ...c, stage: 'entry' } : c));
          s.industries = s.industries ?? [];
        }
        // v3: 拡張機能との統合（プロフィール・応募の記録）
        if (version < 3) {
          s.profile = s.profile ?? null;
          s.companies = s.companies.map((c) => ({ ...c, submittedAt: c.submittedAt ?? '' }));
        }
        return s as Store;
      },
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
