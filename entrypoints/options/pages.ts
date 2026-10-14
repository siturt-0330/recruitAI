import type { LucideIcon } from 'lucide-react';
import { Award, Briefcase, GraduationCap, MapPin, Sparkles, Target, User } from 'lucide-react';
import type { ProfilePage } from '@/lib/fieldKeys';
import { PROFILE_PAGES, type PageDef as BasePageDef } from '@/lib/profile-fields';

export { ESSENTIALS, isFilled, pageProgress, type FieldDef, type SectionDef } from '@/lib/profile-fields';

const ICONS: Record<ProfilePage, LucideIcon> = {
  basic: User,
  contact: MapPin,
  education: GraduationCap,
  skills: Award,
  experience: Sparkles,
  preferences: Target,
  career: Briefcase,
};

export interface PageDef extends BasePageDef {
  icon: LucideIcon;
}

export const PAGES: PageDef[] = PROFILE_PAGES.map((p) => ({ ...p, icon: ICONS[p.id] }));
