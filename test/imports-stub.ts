// UI プレビュー用の `#imports` の代用品。拡張機能の API を localStorage とダミーの結果で置き換える
import type { FrameStatus } from '../lib/types';

type Listener<T> = (v: T) => void;

export const storage = {
  defineItem<T>(key: string, opts: { fallback: T }) {
    const k = `stub:${key}`;
    return {
      async getValue(): Promise<T> {
        const raw = localStorage.getItem(k);
        return raw ? (JSON.parse(raw) as T) : opts.fallback;
      },
      async setValue(v: T) {
        localStorage.setItem(k, JSON.stringify(v));
      },
      watch(_cb: Listener<T>) {
        return () => {};
      },
    };
  },
};

let filled = localStorage.getItem('stub:filled') === '1';
const status = (action: string): FrameStatus => {
  if (action === 'fill') filled = true;
  if (action === 'undo') filled = false;
  if (action === 'resolve') return { detected: 12, filled: 12, warn: 0, reviews: [] };
  // マイページのログイン画面の確認用：localStorage の stub:login を 1 にする
  if (action === 'readLogin' || action === 'fillLogin') {
    const found = localStorage.getItem('stub:login') === '1';
    return { detected: 0, filled: 0, warn: 0, reviews: [], login: { found, loginId: found ? 'taro@example.com' : '', password: found ? 'secret' : '' } };
  }
  // 別のサイトのフォーム枠がある表示の確認用：localStorage の stub:iframe に origin を入れる
  const frame = localStorage.getItem('stub:iframe');
  const iframeOrigins = frame ? [frame] : undefined;
  if (!filled) return { detected: 12, filled: 0, warn: 0, reviews: [], iframeOrigins };
  return {
    iframeOrigins,
    detected: 12,
    filled: 11,
    warn: 1,
    missing: [
      { key: 'cityKana', label: '市区町村（フリガナ）' },
      { key: 'toeic', label: 'TOEIC スコア' },
      { key: 'photo', label: '顔写真' },
    ],
    reviews: [
      {
        id: 'f3',
        label: '生年月日',
        keyLabel: '生年月日（年）',
        confidence: 0.78,
        source: 'ai',
        current: '平成16',
        alternatives: ['2004'],
      },
    ],
  };
};

export const browser = {
  tabs: {
    // Sophon 連携の確認用に、開いているページの URL を localStorage の stub:tabUrl で変えられる
    query: async () => [{ id: 1, url: localStorage.getItem('stub:tabUrl') ?? 'https://example.com/' }],
    create: async ({ url }: { url: string }) => window.open(url.replace('/options.html', '/test/options.html'), '_blank'),
  },
  permissions: {
    contains: async () => localStorage.getItem('stub:iframeGranted') === '1',
    request: async () => {
      localStorage.setItem('stub:iframeGranted', '1');
      return true;
    },
  },
  commands: { getAll: async () => [{ name: 'fill-page', shortcut: 'Alt+Shift+F' }] },
  runtime: {
    openOptionsPage: async () => window.open('/test/options.html', '_blank'),
    getURL: (path: string) => path,
    getManifest: () => ({ version: '0.0.0' }),
    sendMessage: async () => ({ error: 'stub' }),
  },
  scripting: {
    executeScript: async (opts: { files?: string[]; args?: [string, unknown] }) => {
      if (opts.files) return [];
      await new Promise((r) => setTimeout(r, 400));
      return [{ frameId: 0, result: status(opts.args?.[0] ?? 'status') }];
    },
  },
};

/** コンテンツスクリプトの定義をそのまま返す（テストページから main() を呼ぶ） */
export function defineContentScript<T>(def: T): T {
  return def;
}
