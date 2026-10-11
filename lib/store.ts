import { storage } from '#imports';
import { DEFAULT_SETTINGS, type Profile, type Settings } from './types';

export const profilesItem = storage.defineItem<Profile[]>('local:profiles', { fallback: [] });
export const activeProfileIdItem = storage.defineItem<string>('local:activeProfileId', { fallback: '' });
export const settingsItem = storage.defineItem<Settings>('local:settings', { fallback: DEFAULT_SETTINGS });

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await settingsItem.getValue()) };
}

export async function getActiveProfile(): Promise<Profile | undefined> {
  const [profiles, activeId] = await Promise.all([profilesItem.getValue(), activeProfileIdItem.getValue()]);
  return profiles.find((p) => p.id === activeId) ?? profiles[0];
}

export function emptyProfile(label = '新しいプロフィール'): Profile {
  return {
    id: crypto.randomUUID(),
    label,
    lastName: '',
    firstName: '',
    lastNameKana: '',
    firstNameKana: '',
    lastNameRoman: '',
    firstNameRoman: '',
    birthDate: '',
    gender: '',
    email: '',
    phone: '',
    postalCode: '',
    prefecture: '',
    city: '',
    addressLine: '',
    building: '',
    school: '',
    faculty: '',
    department: '',
    graduation: '',
  };
}
