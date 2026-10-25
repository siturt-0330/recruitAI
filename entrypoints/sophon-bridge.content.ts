import { browser, defineContentScript } from '#imports';
import { normalizeProfile } from '@/lib/profile';
import { summarize } from '@/lib/mypages';
import { SOPHON_MATCHES, isNewer, type AppMessage, type ExtMessage, type LinkCompany } from '@/lib/sophon-link';
import { activeProfileIdItem, getActiveProfile, getProfiles, mypagesItem, profilesItem, sophonDataItem, sophonOutboxItem } from '@/lib/store';
import type { Profile } from '@/lib/types';

const sameOrigin = (a: string, b: string) => {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
};

/**
 * Sophon（Web アプリ）のページでだけ動く中継役。
 * ページとは window.postMessage で、拡張機能とは storage でやり取りする。データは外部に送らない。
 */
export default defineContentScript({
  matches: SOPHON_MATCHES,
  runAt: 'document_idle',
  main() {
    /** Sophon 側で編集しているプロフィールの ID（最初の同期で決まる） */
    let linkedId = '';

    const post = (msg: ExtMessage) => window.postMessage(msg, location.origin);

    const sendRecords = async () => {
      const records = await sophonOutboxItem.getValue();
      if (records.length) post({ source: 'sophon-ext', type: 'records', records });
    };

    /** Sophon から届いたプロフィールと、拡張機能のプロフィールを合わせる */
    const mergeProfile = async (incoming: Profile | null) => {
      const profiles = await getProfiles();
      if (!incoming) {
        // Sophon にまだプロフィールがなければ、拡張機能で使っているものを渡す
        const active = await getActiveProfile();
        if (active) {
          linkedId = active.id;
          post({ source: 'sophon-ext', type: 'profile', profile: active });
        }
        return;
      }
      linkedId = incoming.id;
      const mine = profiles.find((p) => p.id === incoming.id);
      if (!mine) {
        await profilesItem.setValue([...profiles, normalizeProfile(incoming)]);
        if (!profiles.length) await activeProfileIdItem.setValue(incoming.id);
      } else if (isNewer(incoming, mine)) {
        await profilesItem.setValue(profiles.map((p) => (p.id === incoming.id ? normalizeProfile(incoming) : p)));
      } else if (isNewer(mine, incoming)) {
        post({ source: 'sophon-ext', type: 'profile', profile: mine });
      }
    };

    window.addEventListener('message', async (e: MessageEvent<AppMessage>) => {
      if (e.source !== window || e.origin !== location.origin || e.data?.source !== 'sophon-app') return;
      const msg = e.data;
      if (msg.type === 'ping') {
        hello();
      } else if (msg.type === 'sync') {
        await sophonDataItem.setValue(msg.data);
        await mergeProfile(msg.profile);
        await applyCompanyEdits(msg.data.companies);
        await sendRecords();
        await sendMypages();
      } else if (msg.type === 'ack') {
        const done = new Set(msg.ids);
        await sophonOutboxItem.setValue((await sophonOutboxItem.getValue()).filter((r) => !done.has(r.id)));
      } else if (msg.type === 'openMypage') {
        // マイページを開いて入力するのはバックグラウンド（新しいタブへの入力は、ここからはできない）
        await browser.runtime.sendMessage({ type: 'openMypage', companyId: msg.companyId });
      } else if (msg.type === 'setPassword') {
        await savePassword(msg);
      } else if (msg.type === 'forgetMypage') {
        const list = await mypagesItem.getValue();
        if (list.some((m) => m.companyId === msg.companyId)) await mypagesItem.setValue(list.filter((m) => m.companyId !== msg.companyId));
      }
    });

    /** Web 版で打ったパスワードを、その会社のログイン情報として保存する */
    const savePassword = async (msg: Extract<AppMessage, { type: 'setPassword' }>) => {
      if (!msg.url || !msg.password) return;
      const list = await mypagesItem.getValue();
      const old = list.find((m) => m.companyId === msg.companyId);
      const item = {
        id: old?.id ?? crypto.randomUUID(),
        companyId: msg.companyId,
        companyName: msg.companyName,
        url: msg.url,
        loginId: msg.loginId,
        password: msg.password,
        updatedAt: new Date().toISOString(),
      };
      await mypagesItem.setValue([...list.filter((m) => m.companyId !== msg.companyId), item]);
    };

    /** 保存したログイン情報の見出し（パスワードは渡さない） */
    const sendMypages = async () => {
      post({ source: 'sophon-ext', type: 'mypages', mypages: (await mypagesItem.getValue()).map(summarize) });
    };

    /** Sophon の画面で会社名・マイページの URL・ID を直したら、保存したログイン情報にも反映する */
    const applyCompanyEdits = async (companies: LinkCompany[]) => {
      const list = await mypagesItem.getValue();
      let changed = false;
      const next = list.map((m) => {
        const c = companies.find((x) => x.id === m.companyId);
        // Sophon 側の変更のほうが新しいときだけ反映する（拡張機能で保存した直後の古い同期で戻さないため）
        if (!c || (c.updatedAt ?? '') <= m.updatedAt) return m;
        const patch = { companyName: c.name, url: c.mypageUrl || m.url, loginId: c.loginId ?? m.loginId };
        if (patch.companyName === m.companyName && patch.url === m.url && patch.loginId === m.loginId) return m;
        changed = true;
        // URL が別のサイトに変わったら、パスワードは引き継がない（ページ側から URL を書きかえて、パスワードを別のサイトに入れさせないため）
        const password = sameOrigin(patch.url, m.url) ? m.password : '';
        // 更新日時は Sophon で直した時刻のままにする（今の時刻にすると、打っている途中の古い値で Sophon 側を上書きしてしまう）
        return { ...m, ...patch, password, updatedAt: c.updatedAt ?? m.updatedAt };
      });
      if (changed) await mypagesItem.setValue(next);
    };
    mypagesItem.watch(() => void sendMypages());

    // 拡張機能の設定画面でプロフィールを直したら、Sophon にも伝える
    profilesItem.watch(async (profiles) => {
      const p = profiles?.find((x) => x.id === linkedId);
      if (p) post({ source: 'sophon-ext', type: 'profile', profile: normalizeProfile(p) });
    });
    // 応募フォームで「ボードに記録」されたら、すぐ届ける
    sophonOutboxItem.watch(() => sendRecords());

    // ページの準備ができる前に送ると届かないので、ページからの ping にも答える
    const hello = () => post({ source: 'sophon-ext', type: 'hello', version: browser.runtime.getManifest().version });
    hello();
  },
});
