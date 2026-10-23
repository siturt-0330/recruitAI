import { browser } from '#imports';
import { originPattern } from '@/lib/mypages';
import { mypagesItem } from '@/lib/store';
import '@/assets/theme.css';
import './style.css';

/**
 * Web 版からマイページを開いたとき、そのサイトへの許可がまだなければ出す小さな画面。
 * Chrome の許可は拡張機能の画面でボタンを押した直後にしか求められないので、ここで押してもらう
 */
const params = new URLSearchParams(location.search);
const companyId = params.get('company') ?? '';
const tabId = Number(params.get('tab'));
const $ = (id: string) => document.getElementById(id)!;

const mypage = (await mypagesItem.getValue()).find((m) => m.companyId === companyId);
const pattern = mypage ? originPattern(mypage.url) : null;

if (!mypage || !pattern) {
  window.close();
} else {
  $('title').textContent = `${mypage.companyName} のログイン情報を入力`;
  $('site').textContent = new URL(mypage.url).host;

  $('allow').addEventListener('click', () => {
    // await より前に request を呼ぶ（ボタンを押した直後でないと許可の画面が出ない）
    browser.permissions.request({ origins: [pattern] }).then(
      async (granted) => {
        if (!granted) return;
        await browser.runtime.sendMessage({ type: 'fillMypage', companyId, tabId });
        await browser.tabs.update(tabId, { active: true }).catch(() => undefined);
        window.close();
      },
      () => {
        $('error').textContent = '許可できませんでした';
        $('error').hidden = false;
      },
    );
  });
  $('cancel').addEventListener('click', () => window.close());
}
