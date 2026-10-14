import { browser, defineContentScript } from '#imports';
import { normalizeProfile } from '@/lib/profile';
import { SOPHON_MATCHES, isNewer, type AppMessage, type ExtMessage } from '@/lib/sophon-link';
import { activeProfileIdItem, getActiveProfile, getProfiles, profilesItem, sophonDataItem, sophonOutboxItem } from '@/lib/store';
import type { Profile } from '@/lib/types';

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
        await sendRecords();
      } else if (msg.type === 'ack') {
        const done = new Set(msg.ids);
        await sophonOutboxItem.setValue((await sophonOutboxItem.getValue()).filter((r) => !done.has(r.id)));
      }
    });

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
