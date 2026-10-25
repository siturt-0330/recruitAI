'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui';

/** 画面の途中でエラーが起きたときに出す。サイドバーとタブバーは残し、中身だけを出し直せるようにする */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-5 py-24 text-center">
      <h2 className="text-lg font-extrabold">画面を表示できませんでした</h2>
      <p className="text-sm text-sub">もう一度読み込んでも直らないときは、ページを再読み込みしてください。</p>
      <Button variant="primary" onClick={() => retry()} className="mt-2">
        もう一度読み込む
      </Button>
    </div>
  );
}
