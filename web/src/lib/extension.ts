'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { isNewer, type AppMessage, type ExtMessage, type LinkData } from '@ext/sophon-link';
import { stageInfo } from './stages';
import { useStore } from './store';
import type { AppData } from './types';

/** 拡張機能とつながっているか（保存しない） */
export const useExtension = create<{ connected: boolean; version: string; /** 拡張機能でマイページが保存されたときのお知らせ */ notice: string }>(() => ({
  connected: false,
  version: '',
  notice: '',
}));

const post = (msg: AppMessage) => window.postMessage(msg, location.origin);

/** マイページを開いて、拡張機能に保存した ID とパスワードを入れてもらう */
export const openMypage = (companyId: string) => post({ source: 'sophon-app', type: 'openMypage', companyId });
/** 会社を消したとき、拡張機能に保存したログイン情報も消す */
export const forgetMypage = (companyId: string) => post({ source: 'sophon-app', type: 'forgetMypage', companyId });

/** 拡張機能に渡すのは、応募フォームで使う分だけ（ロゴやメモは渡さない） */
function linkData(s: AppData): LinkData {
  return {
    companies: s.companies.map((c) => ({
      id: c.id,
      name: c.name,
      url: c.url,
      mypageUrl: c.mypageUrl,
      loginId: c.loginId,
      updatedAt: c.updatedAt,
      stageLabel: stageInfo(c.stage).label,
      deadline: c.deadline,
      deadlineLabel: c.deadlineLabel,
      nextAt: c.nextAt,
      nextLabel: c.nextLabel,
    })),
    // ES の管理はやめたので、拡張機能に渡す回答はない
    esAnswers: [],
    syncedAt: new Date().toISOString(),
  };
}

/**
 * 拡張機能（RecruitAI）との同期。拡張機能はこのページでだけ動く中継スクリプトを持っていて、
 * window.postMessage でやり取りする。拡張機能が入っていなければ何も起きない。
 */
export function useExtensionBridge() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      const s = useStore.getState();
      post({ source: 'sophon-app', type: 'sync', data: linkData(s), profile: s.profile });
    };
    const scheduleSync = () => {
      clearTimeout(timer);
      timer = setTimeout(sync, 400);
    };

    const onMessage = (e: MessageEvent<ExtMessage>) => {
      if (e.source !== window || e.origin !== location.origin || e.data?.source !== 'sophon-ext') return;
      const msg = e.data;
      const store = useStore.getState();
      if (msg.type === 'hello') {
        useExtension.setState({ connected: true, version: msg.version });
        sync();
      } else if (msg.type === 'profile') {
        if (!store.profile || isNewer(msg.profile, store.profile)) store.replaceProfile(msg.profile);
      } else if (msg.type === 'records') {
        store.applyRecords(msg.records);
        post({ source: 'sophon-app', type: 'ack', ids: msg.records.map((r) => r.id) });
      } else if (msg.type === 'mypages') {
        const { changed, forget } = store.applyMypages(msg.mypages);
        forget.forEach(forgetMypage);
        if (changed.length) useExtension.setState({ notice: `${changed.join('、')} のマイページを保存しました` });
      }
    };
    window.addEventListener('message', onMessage);

    // 企業・プロフィールが変わったら送り直す（つながっているときだけ）
    const unsubscribe = useStore.subscribe((s, prev) => {
      if (!useExtension.getState().connected) return;
      if (s.companies !== prev.companies || s.profile !== prev.profile) scheduleSync();
    });

    post({ source: 'sophon-app', type: 'ping' });
    return () => {
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener('message', onMessage);
    };
  }, []);
}
