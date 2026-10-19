'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { nowIso } from './dates';
import { emptyProfile, normalizeProfile } from '@ext/profile';
import type { LinkMypage, LinkRecord } from '@ext/sophon-link';
import { emptyCompany, sampleData } from './seed';
import { stageOrder } from './stages';
import type { AppData, Company, Profile } from './types';

/**
 * アプリのデータ。今はこのブラウザの localStorage にだけ保存する。
 * 読み書きはこのストアに集めてあるので、あとで Supabase などに差し替えられる。
 */
interface Actions {
  upsertCompany(c: Company): void;
  patchCompany(id: string, patch: Partial<Company>): void;
  removeCompany(id: string): void;
  toggleTask(date: string, taskId: string): void;
  addIndustry(name: string): void;
  /** 画面で編集したプロフィール（更新日時を付ける） */
  patchProfile(patch: Partial<Profile>): void;
  /** 拡張機能から届いたプロフィール（そのまま置き換える） */
  replaceProfile(p: Profile): void;
  /** 拡張機能の「ボードに記録」を反映する */
  applyRecords(records: LinkRecord[]): void;
  /** 拡張機能で保存したマイページを反映する。新しく入った・変わった会社名を返す */
  applyMypages(list: LinkMypage[]): { changed: string[]; forget: string[] };
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
    (set, get) => ({
      ...sampleData(),
      boardView: 'board',
      setBoardView: (boardView) => set({ boardView }),

      upsertCompany: (c) => set((s) => ({ companies: upsert(s.companies, c) })),
      patchCompany: (id, p) => set((s) => ({ companies: patch(s.companies, id, p) })),
      removeCompany: (id) =>
        set((s) => ({ companies: s.companies.filter((c) => c.id !== id), removedIds: [...s.removedIds.filter((x) => x !== id), id] })),

      toggleTask: (date, taskId) =>
        set((s) => {
          const done = s.doneTasks[date] ?? [];
          const next = done.includes(taskId) ? done.filter((x) => x !== taskId) : [...done, taskId];
          // 古い日付の記録はためない
          return { doneTasks: { [date]: next } };
        }),

      addIndustry: (name) => set((s) => (s.industries.includes(name) ? {} : { industries: [...s.industries, name] })),

      patchProfile: (p) =>
        set((s) => ({ profile: { ...(s.profile ?? emptyProfile('メイン')), ...p, updatedAt: nowIso() } })),
      replaceProfile: (p) => set({ profile: normalizeProfile(p) }),
      applyRecords: (records) =>
        set((s) => {
          const submitted = stageOrder('esSubmitted');
          let { companies } = s;
          for (const r of records) {
            companies = companies.map((c) =>
              c.id === r.companyId
                ? touch({ ...c, submittedAt: r.at, stage: stageOrder(c.stage) < submitted ? 'esSubmitted' : c.stage })
                : c,
            );
          }
          return { companies };
        }),

      applyMypages: (list) => {
        const changed: string[] = [];
        const removed = new Set(get().removedIds);
        // 消した会社のログイン情報は、取り込まずに拡張機能から消してもらう
        const forget = list.filter((m) => removed.has(m.companyId)).map((m) => m.companyId);
        let companies = get().companies;
        for (const m of list) {
          if (removed.has(m.companyId)) continue;
          const fields = { name: m.companyName, mypageUrl: m.url, loginId: m.loginId, hasPassword: m.hasPassword };
          const c = companies.find((x) => x.id === m.companyId);
          if (!c) {
            companies = [...companies, { ...emptyCompany(m.companyName), ...fields, id: m.companyId }];
            changed.push(m.companyName);
          } else if (c.updatedAt < m.updatedAt && (Object.keys(fields) as (keyof typeof fields)[]).some((k) => c[k] !== fields[k])) {
            companies = companies.map((x) => (x.id === c.id ? touch({ ...x, ...fields }) : x));
            changed.push(m.companyName);
          } else if (c.hasPassword !== m.hasPassword) {
            companies = companies.map((x) => (x.id === c.id ? { ...x, hasPassword: m.hasPassword } : x));
          }
        }
        if (companies !== get().companies) set({ companies });
        // 拡張機能にもう残っていない ID は、覚えておかなくてよい
        const still = new Set(list.map((m) => m.companyId));
        if (get().removedIds.some((id) => !still.has(id))) set({ removedIds: get().removedIds.filter((id) => still.has(id)) });
        return { changed, forget };
      },

      clearSample: () =>
        set((s) => ({
          removedIds: [...s.removedIds, ...s.companies.map((c) => c.id)],
          companies: [],
          doneTasks: {},
          sample: false,
        })),
      // サンプルを入れ直しても、消した会社の記録は残す
      loadSample: () => set((s) => ({ ...sampleData(), removedIds: s.removedIds })),
    }),
    {
      name: 'sophon-data',
      version: 7,
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
        // v4: 自己分析・ES・面接ログをやめ、企業と予定の管理に絞った
        if (version < 4) {
          const old = s as AppData & Record<string, unknown>;
          delete old.interviews;
          delete old.episodes;
          delete old.sheets;
          delete old.esAnswers;
        }
        // v5: マイページのパスワードを拡張機能に保存したか
        if (version < 5) s.companies = s.companies.map((c) => ({ ...c, hasPassword: c.hasPassword ?? false }));
        // v6: メモを Notion のようなブロックにし、自分で追加できるプロパティを持つ
        if (version < 6) {
          s.companies = s.companies.map((c) => ({
            ...c,
            props: c.props ?? [],
            blocks:
              c.blocks ??
              (c.memo ?? '')
                .split('\n')
                .filter((t) => t.trim())
                .map((text) => ({ id: crypto.randomUUID(), type: 'text' as const, text })),
          }));
        }
        // v7: 消した会社の記録（拡張機能のログイン情報から戻ってこないように）
        if (version < 7) s.removedIds = s.removedIds ?? [];
        return s as Store;
      },
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
