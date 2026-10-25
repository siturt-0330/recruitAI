import type { Profile } from '@/lib/types';

/** 顔写真（なければ姓の1文字目）を、プロフィール完成度のリングで囲んだアイコン */
export function ProfileAvatar({ profile, size, progress }: { profile?: Profile; size: number; progress: number }) {
  const initial = [...(profile?.lastName || profile?.label || '?')][0];
  return (
    <span
      className="ring"
      style={{ ['--p' as string]: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
      title={`プロフィール ${Math.round(progress * 100)}% 完成`}
    >
      <span className="ring-inner">
        <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
          {profile?.photo ? <img src={profile.photo} alt="" /> : initial}
        </span>
      </span>
    </span>
  );
}
