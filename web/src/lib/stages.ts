import type { Stage } from './types';

export const STAGES: { id: Stage; label: string; bg: string; fg: string }[] = [
  { id: 'entry', label: 'ES提出前', bg: '#FEE8EA', fg: '#C41320' },
  { id: 'esSubmitted', label: 'ES提出済', bg: '#EEF0FB', fg: '#4A4F8C' },
  { id: 'interview1', label: '一次面接', bg: '#EEEDFE', fg: '#534AB7' },
  { id: 'interview2', label: '二次面接', bg: '#EEEDFE', fg: '#534AB7' },
  { id: 'final', label: '最終面接', bg: '#E1F5EE', fg: '#0F6E56' },
  { id: 'offer', label: '内定', bg: '#FFF5DB', fg: '#8A5A00' },
  { id: 'closed', label: '終了', bg: '#F1F1F0', fg: '#8B98A5' },
];

export const stageInfo = (s: Stage) => STAGES.find((x) => x.id === s) ?? STAGES[0]!;
export const stageOrder = (s: Stage) => STAGES.findIndex((x) => x.id === s);

/** ボードの列。複数の段階を1列にまとめる */
export const COLUMNS: { id: string; label: string; stages: Stage[]; dropTo: Stage }[] = [
  { id: 'entry', label: 'ES・エントリー', stages: ['entry', 'esSubmitted'], dropTo: 'entry' },
  { id: 'interview', label: '面接中', stages: ['interview1', 'interview2', 'final'], dropTo: 'interview1' },
  { id: 'offer', label: '内定', stages: ['offer'], dropTo: 'offer' },
];
