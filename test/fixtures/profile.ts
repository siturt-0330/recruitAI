import { normalizeProfile } from '../../lib/profile';
import type { Profile } from '../../lib/types';

/** テストで使う架空のプロフィール */
export function testProfile(overrides: Partial<Profile> = {}): Profile {
  return normalizeProfile({
    id: 'test',
    label: '新卒用',
    lastName: '山田',
    firstName: '太郎',
    lastNameKana: 'ヤマダ',
    firstNameKana: 'タロウ',
    lastNameRoman: 'Yamada',
    firstNameRoman: 'Taro',
    birthDate: '1999-04-01',
    gender: 'male',
    nationality: '日本',
    email: 'taro@example.com',
    phone: '090-1234-5678',
    landline: '03-1234-5678',
    postalCode: '150-0041',
    prefecture: '東京都',
    city: '渋谷区',
    addressLine: '神南1-2-3',
    building: 'サンプルマンション101',
    cityKana: 'シブヤク',
    addressLineKana: 'ジンナン1-2-3',
    schoolType: '大学',
    bunri: '文系',
    school: 'サンプル大学',
    schoolKana: 'サンプルダイガク',
    schoolPrefecture: '東京都',
    faculty: '経済学部',
    department: '経済学科',
    admission: '2022-04',
    graduation: '2026-03',
    graduationStatus: 'expected',
    kiseiSame: true,
    ...overrides,
  });
}
