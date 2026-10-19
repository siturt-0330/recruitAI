'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { stageInfo } from '@/lib/stages';
import type { Company, Stage } from '@/lib/types';

export function Button({
  variant = 'outline',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-ind text-white hover:bg-ind-hover border-ind',
    outline: 'border-box hover:bg-fill',
    ghost: 'border-transparent text-sub hover:bg-fill',
    danger: 'border-transparent text-danger hover:bg-dangerbg',
  }[variant];
  return (
    <button
      className={`inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-bold transition-colors disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Chip({ on, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button
      className={`h-8 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
        on ? 'border-ind bg-ind text-white' : 'border-box hover:bg-fill'
      } ${className}`}
      {...props}
    />
  );
}

export function Field({ label, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`fl ${className}`}>
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

export function TextArea({ label, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className={`fl ${className}`}>
      <span>{label}</span>
      <textarea {...props} />
    </label>
  );
}

export function Select({ label, className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={`fl ${className}`}>
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}

export function StagePill({ stage, className = '' }: { stage: Stage; className?: string }) {
  const s = stageInfo(stage);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${className}`} style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

export function DueBadge({ badge }: { badge: { label: string; tone: 'red' | 'amber' } | null | undefined }) {
  if (!badge) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] ${badge.tone === 'red' ? 'bg-dangerbg text-danger' : 'bg-warnbg text-warn'}`}>
      {badge.label}
    </span>
  );
}

const LOGO_COLORS = [
  ['#E8F0FE', '#1A56C4'],
  ['#EEEDFE', '#534AB7'],
  ['#E1F5EE', '#0F6E56'],
  ['#FDECEC', '#B4231D'],
  ['#FFF5DB', '#8A5A00'],
  ['#EAF3DE', '#3B6D11'],
];

/** 企業のロゴ。取得できていなければ頭文字を色付きの四角で出す */
export function CompanyLogo({ company, size = 32 }: { company: Pick<Company, 'name' | 'logo'>; size?: number }) {
  const radius = Math.round(size * 0.27);
  if (company.logo) {
    return (
      <img
        src={company.logo}
        alt=""
        width={size}
        height={size}
        className="shrink-0 border border-line bg-white object-contain"
        style={{ width: size, height: size, borderRadius: radius, padding: Math.round(size * 0.08) }}
      />
    );
  }
  const [bg, fg] = LOGO_COLORS[[...company.name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % LOGO_COLORS.length]!;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center font-extrabold"
      style={{ width: size, height: size, borderRadius: radius, background: bg, color: fg, fontSize: Math.round(size * 0.42) }}
    >
      {[...company.name][0] ?? '?'}
    </span>
  );
}

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-white/85 px-6 py-3 backdrop-blur">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-extrabold">{title}</h1>
        {sub && <p className="truncate text-[13px] text-sub">{sub}</p>}
      </div>
      {actions}
    </header>
  );
}

export function SophonCard({ title, sub, children, className = '' }: { title: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-indline bg-indbg p-4 ${className}`}>
      <div className="mb-2 flex items-center gap-2.5">
        <span className="orb h-8 w-8" />
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold text-indtext">{title}</div>
          {sub && <div className="text-xs text-[#536471]">{sub}</div>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-16 text-center">
      <span className="orb h-12 w-12" />
      <h2 className="mt-2 text-lg font-extrabold">{title}</h2>
      {body && <p className="text-sm text-sub">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
