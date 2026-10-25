import { storage } from '#imports';
import { DEFAULT_SETTINGS, type Profile, type Settings } from './types';
import { emptyProfile, normalizeProfile } from './profile';
import type { Mypage } from './mypages';
import type { LinkData, LinkRecord } from './sophon-link';

export { emptyProfile, normalizeProfile };

export const profilesItem = storage.defineItem<Profile[]>('local:profiles', { fallback: [] });
export const activeProfileIdItem = storage.defineItem<string>('local:activeProfileId', { fallback: '' });
export const settingsItem = storage.defineItem<Settings>('local:settings', { fallback: DEFAULT_SETTINGS });

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await settingsItem.getValue()) };
}

/** 古いバージョンで保存したプロフィールにも新しい項目の初期値を補う */
export async function getProfiles(): Promise<Profile[]> {
  return (await profilesItem.getValue()).map(normalizeProfile);
}

export async function getActiveProfile(): Promise<Profile | undefined> {
  const [profiles, activeId] = await Promise.all([getProfiles(), activeProfileIdItem.getValue()]);
  return profiles.find((p) => p.id === activeId) ?? profiles[0];
}

/** Sophon（Web アプリ）から受け取った企業と ES。Sophon を一度も開いていなければ null */
export const sophonDataItem = storage.defineItem<LinkData | null>('local:sophonData', { fallback: null });
/** Sophon にまだ届けていない「ボードに記録」 */
export const sophonOutboxItem = storage.defineItem<LinkRecord[]>('local:sophonOutbox', { fallback: [] });

/** インストールごとのランダムな ID。中継 API の回数制限に使う（個人を特定する情報は含まない） */
export const installIdItem = storage.defineItem<string>('local:installId', { fallback: '' });

let installId: Promise<string> | undefined;

/** 初めて使うときに複数のフレームから同時に呼ばれても、ID を 1 つだけ作る */
export function getInstallId(): Promise<string> {
  installId ??= readOrCreateInstallId();
  return installId;
}

async function readOrCreateInstallId(): Promise<string> {
  let id = await installIdItem.getValue();
  if (!id) {
    id = crypto.randomUUID();
    await installIdItem.setValue(id);
  }
  return id;
}

/** スポンサー枠の中身（半日だけ覚えておき、毎回は取りに行かない） */
export const sponsorCacheItem = storage.defineItem<{ at: number; sponsor: import('./api').Sponsor | null } | null>('local:sponsorCache', { fallback: null });

/** マイページのログイン情報（パスワードを含む）。この PC の中だけに保存し、外には送らない */
export const mypagesItem = storage.defineItem<Mypage[]>('local:mypages', { fallback: [] });
