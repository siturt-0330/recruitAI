'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { isNewer, type AppMessage, type ExtMessage, type LinkData } from '@ext/sophon-link';
import { stageInfo } from './stages';
import { useStore } from './store';
import type { AppData } from './types';

/** 拡張機能とつながっているか（保存しない） */
export const useExtension = create<{ connected: boolean; version: string }>(() => ({ connected: false, version: '' }));

const post = (msg: AppMessage) => window.postMessage(msg, location.origin);

/** 拡張機能に渡すのは、応募フォームで使う分だけ（ロゴやメモは渡さない） */
function linkData(s: AppData): LinkData {
  return {
    companies: s.companies.map((c) => ({
      id: c.id,
      name: c.name,
      url: c.url,
      mypageUrl: c.mypageUrl,
      stageLabel: stageInfo(c.stage).label,
      deadline: c.deadline,
      deadlineLabel: c.deadlineLabel,
      nextAt: c.nextAt,
      nextLabel: c.nextLabel,
    })),
    esAnswers: s.esAnswers.map((a) => ({ id: a.id, category: a.category, title: a.title, text: a.text, charLimit: a.charLimit, companyIds: a.companyIds })),
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
      }
    };
    window.addEventListener('message', onMessage);

    // 企業・ES・プロフィールが変わったら送り直す（つながっているときだけ）
    const unsubscribe = useStore.subscribe((s, prev) => {
      if (!useExtension.getState().connected) return;
      if (s.companies !== prev.companies || s.esAnswers !== prev.esAnswers || s.profile !== prev.profile) scheduleSync();
    });

    post({ source: 'sophon-app', type: 'ping' });
    return () => {
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener('message', onMessage);
    };
  }, []);
}
