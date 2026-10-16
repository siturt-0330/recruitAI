import { browser, defineBackground } from '#imports';
import { classifyViaApi } from '@/lib/api';
import { getInstallId, settingsItem } from '@/lib/store';
import { activeTabId, runInTab } from '@/lib/tab';
import type { RemoteQuestion } from '@/lib/types';

interface ClassifyMessage {
  type: 'classify';
  formText: string;
  questions: RemoteQuestion[];
}

export default defineBackground(() => {
  // 以前は自分の OpenAI API キーを保存していた。中継 API に切り替えたので、残っていれば消す
  browser.runtime.onInstalled.addListener(async () => {
    const s = (await settingsItem.getValue()) as unknown as Record<string, unknown>;
    if (s && 'openaiApiKey' in s) {
      const { openaiApiKey: _, ...rest } = s;
      await settingsItem.setValue(rest as never);
    }
  });

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== 'fill-page') return;
    const tabId = tab?.id ?? (await activeTabId());
    if (tabId == null) return;
    try {
      await runInTab(tabId, 'fill');
    } catch (e) {
      console.warn('[らくらくエントリー] このページには入力できません', e);
    }
  });

  // AI への問い合わせは、ページ側からではなくバックグラウンドから中継 API に送る
  browser.runtime.onMessage.addListener((msg: ClassifyMessage, _sender, sendResponse) => {
    if (msg?.type !== 'classify') return;
    (async () => classifyViaApi(await getInstallId(), msg.formText, msg.questions))().then(
      (answers) => sendResponse({ answers }),
      (e: unknown) => sendResponse({ error: e instanceof Error ? e.message : String(e) }),
    );
    return true;
  });
});
