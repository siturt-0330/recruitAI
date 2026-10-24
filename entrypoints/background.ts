import { browser, defineBackground } from '#imports';
import { classifyViaApi } from '@/lib/api';
import { originPattern } from '@/lib/mypages';
import { SOPHON_MATCHES } from '@/lib/sophon-link';
import { getInstallId, mypagesItem, settingsItem } from '@/lib/store';
import { activeTabId, runInTab } from '@/lib/tab';
import type { RemoteQuestion } from '@/lib/types';

const SOPHON_ORIGINS = SOPHON_MATCHES.map((m) => m.replace(/\/\*$/, ''));

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
  browser.runtime.onMessage.addListener((msg: { type?: string; companyId?: string }, sender) => {
    if (msg?.type !== 'openMypage' || !msg.companyId) return;
    // 受け付けるのは Sophon のページの中継スクリプトからだけ
    if (!SOPHON_ORIGINS.some((o) => sender.url?.startsWith(o + '/'))) return;
    void openMypage(msg.companyId);
  });

  // 許可の画面で「許可して入力」を押したとき：開いておいたマイページに入れる
  browser.runtime.onMessage.addListener((msg: { type?: string; companyId?: string; tabId?: number }, sender) => {
    if (msg?.type !== 'fillMypage' || !msg.companyId || msg.tabId == null) return;
    // 受け付けるのは拡張機能の許可の画面からだけ
    if (!sender.url?.startsWith(browser.runtime.getURL('/grant.html'))) return;
    void (async () => {
      const m = (await mypagesItem.getValue()).find((x) => x.companyId === msg.companyId);
      if (m) await fillMypage(msg.tabId!, m);
    })();
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
  // このサイトへの許可がまだなければ、拡張機能の小さな画面で許可をお願いする（許可を求められるのは拡張機能の画面からだけ）
  const pattern = originPattern(m.url);
  if (!pattern) return;
  if (!(await browser.permissions.contains({ origins: [pattern] }))) {
    await browser.windows.create({
      url: browser.runtime.getURL(`/grant.html?company=${encodeURIComponent(companyId)}&tab=${tab.id}`),
      type: 'popup',
      width: 420,
      height: 300,
    });
    return;
  }
  await fillMypage(tab.id, m);
}

/** 開いたマイページに ID とパスワードを入れる */
async function fillMypage(tabId: number, m: { url: string; loginId: string; password: string; companyName: string }) {
  // 開いたあとに別のサイトへ移っていたら入れない（パスワードを別のサイトに入れないため）
  const tab = await browser.tabs.get(tabId).catch(() => null);
  if (!tab?.url || new URL(tab.url).origin !== new URL(m.url).origin) return;
  // 読み込みが終わってから画面を組み立てるログイン画面もあるので、欄が出てくるまで少し待ちながら試す
  for (let i = 0; i < 10; i++) {
    try {
      const res = await runInTab(tabId, 'fillLogin', { loginId: m.loginId, password: m.password, company: m.companyName, origin: new URL(m.url).origin });
      if (res.some((f) => f.result.login?.found)) return;
    } catch (e) {
      console.warn('[らくらくエントリー] ログイン情報を入力できませんでした', e);
      return;
    }
    await new Promise((r) => setTimeout(r, 600));
  }
}
