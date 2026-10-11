import { storage } from '#imports';
import { DEFAULT_SETTINGS, type Profile, type Settings } from './types';
import { emptyProfile, normalizeProfile } from './profile';

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
