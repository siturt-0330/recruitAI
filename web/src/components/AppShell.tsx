'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useExtensionBridge } from '@/lib/extension';
import { useStore } from '@/lib/store';
import { Sidebar, TabBar } from './Sidebar';

/**
 * データは localStorage にあるので、読み込みが終わってから画面を描く
 * （サーバーで描いた HTML と食い違わないように）。
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.resolve(useStore.persist.rehydrate()).then(() => setReady(true));
    // ほかのタブで保存したら読み込み直す（古いデータのまま保存して、ほかのタブの変更を消さないように）
    const onStorage = (e: StorageEvent) => {
      if (e.key === useStore.persist.getOptions().name) void useStore.persist.rehydrate();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-[1440px] md:grid md:grid-cols-[72px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)]">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main className="min-w-0 pb-[72px] md:border-l md:border-line md:pb-0">
        {ready ? (
          <>
            <ExtensionBridge />
            {children}
          </>
        ) : (
          <div className="flex h-screen items-center justify-center">
            <span className="orb live h-10 w-10" />
          </div>
        )}
      </main>
      <TabBar />
    </div>
  );
}

/** 拡張機能との同期。データを読み込んでから始める */
function ExtensionBridge() {
  useExtensionBridge();
  return null;
}
