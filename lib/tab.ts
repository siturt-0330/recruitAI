import { browser } from '#imports';
import type { FrameStatus } from './types';

export type Action = 'status' | 'fill' | 'undo' | 'resolve' | 'diagnose';

export interface FrameResult {
  frameId: number;
  result: FrameStatus;
}

/**
 * タブ（全フレーム）にコンテンツスクリプトを注入してアクションを実行する。
 * 常駐させず、ポップアップやショートカットで呼ばれたときだけ activeTab 権限で注入する。
 */
export async function runInTab(
  tabId: number,
  action: Action,
  payload?: unknown,
  frameIds?: number[],
): Promise<FrameResult[]> {
  const target = frameIds ? { tabId, frameIds } : { tabId, allFrames: true };
  await browser.scripting.executeScript({ target, files: ['/content-scripts/content.js'] });
  const results = await browser.scripting.executeScript({
    target,
    func: (a: string, p: unknown) =>
      (globalThis as unknown as { __recruitAI?: { run(a: string, p: unknown): Promise<unknown> } }).__recruitAI?.run(a, p),
    args: [action, payload ?? null],
  });
  return results
    .filter((r) => r.result != null)
    .map((r) => ({ frameId: r.frameId, result: r.result as FrameStatus }));
}

export async function activeTabId(): Promise<number | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}
