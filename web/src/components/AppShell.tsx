'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useExtensionBridge } from '@/lib/extension';
import { useStore } from '@/lib/store';
import { Sidebar } from './Sidebar';

/**
 * データは localStorage にあるので、読み込みが終わってから画面を描く
 * （サーバーで描いた HTML と食い違わないように）。
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.resolve(useStore.persist.rehydrate()).then(() => setReady(true));
  }, []);

  return (
    <div className="mx-auto grid min-h-screen max-w-[1280px] grid-cols-[72px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)]">
      <Sidebar />
      <main className="min-w-0 border-l border-line">
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
    </div>
  );
}

/** 拡張機能との同期。データを読み込んでから始める */
function ExtensionBridge() {
  useExtensionBridge();
  return null;
}
