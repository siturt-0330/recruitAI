import { browser, defineBackground } from '#imports';
import { classifyWithOpenAI } from '@/lib/openai';
import { getSettings } from '@/lib/store';
import { activeTabId, runInTab } from '@/lib/tab';
import type { RemoteQuestion } from '@/lib/types';

interface ClassifyMessage {
  type: 'classify';
  formText: string;
  questions: RemoteQuestion[];
}

export default defineBackground(() => {
  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== 'fill-page') return;
    const tabId = tab?.id ?? (await activeTabId());
    if (tabId == null) return;
    try {
      await runInTab(tabId, 'fill');
    } catch (e) {
      console.warn('[RecruitAI] このページには入力できません', e);
    }
  });

  // API キーをページ側に出さないよう、AI への問い合わせはバックグラウンドで行う
  browser.runtime.onMessage.addListener((msg: ClassifyMessage, _sender, sendResponse) => {
    if (msg?.type !== 'classify') return;
    (async () => {
      const { openaiApiKey } = await getSettings();
      if (!openaiApiKey) throw new Error('OpenAI の API キーが設定されていません');
      return classifyWithOpenAI(openaiApiKey, msg.formText, msg.questions);
    })().then(
      (answers) => sendResponse({ answers }),
      (e: unknown) => sendResponse({ error: e instanceof Error ? e.message : String(e) }),
    );
    return true;
  });
});
