import { browser, defineBackground } from '#imports';
import { classifyViaApi } from '@/lib/api';
import { originPattern } from '@/lib/mypages';
import { getInstallId, mypagesItem, settingsItem } from '@/lib/store';
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

  // Sophon で会社を押したとき：マイページを開き、許可があれば ID とパスワードを入れる
  browser.runtime.onMessage.addListener((msg: { type?: string; companyId?: string }) => {
    if (msg?.type !== 'openMypage' || !msg.companyId) return;
    void openMypage(msg.companyId);
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

/** タブの読み込みが終わるまで待つ（長くても 20 秒） */
function waitForLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      browser.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      resolve();
    };
    const onUpdated = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === 'complete') done();
    };
    const timer = setTimeout(done, 20_000);
    browser.tabs.onUpdated.addListener(onUpdated);
  });
}

async function openMypage(companyId: string) {
  const m = (await mypagesItem.getValue()).find((x) => x.companyId === companyId);
  if (!m) return;
  const tab = await browser.tabs.create({ url: m.url });
  if (tab.id == null) return;
  await waitForLoad(tab.id);
  // 保存したときにこのサイトへの許可をもらっていなければ、開くだけ（アイコンを押せば入力できる）
  const pattern = originPattern(m.url);
  if (!pattern || !(await browser.permissions.contains({ origins: [pattern] }))) return;
  // 読み込みが終わってから画面を組み立てるログイン画面もあるので、欄が出てくるまで少し待ちながら試す
  for (let i = 0; i < 10; i++) {
    try {
      const res = await runInTab(tab.id, 'fillLogin', { loginId: m.loginId, password: m.password, company: m.companyName });
      if (res.some((f) => f.result.login?.found)) return;
    } catch (e) {
      console.warn('[らくらくエントリー] ログイン情報を入力できませんでした', e);
      return;
    }
    await new Promise((r) => setTimeout(r, 600));
  }
}
