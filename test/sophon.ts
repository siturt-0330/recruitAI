// Sophon 連携（企業の判定・ボードに記録・ES の候補）を、拡張機能を読み込まずに試すページ
import content from '../entrypoints/content';
import type { LinkData } from '../lib/sophon-link';
import { testProfile } from './fixtures/profile';

const set = (key: string, v: unknown) => localStorage.setItem(`stub:local:${key}`, JSON.stringify(v));
const get = (key: string) => JSON.parse(localStorage.getItem(`stub:local:${key}`) ?? 'null');

const profile = testProfile();
set('profiles', [profile]);
set('activeProfileId', profile.id);
const data: LinkData = {
  companies: [
    { id: 'c-b', name: 'B商事', url: `${location.origin}/`, mypageUrl: '', stageLabel: '二次面接', deadline: '2026-10-18', deadlineLabel: 'ES', nextAt: '', nextLabel: '' },
    { id: 'c-a', name: 'A自動車', url: 'https://recruit.example-auto.jp/', mypageUrl: '', stageLabel: 'ES提出前', deadline: '', deadlineLabel: '', nextAt: '', nextLabel: '' },
  ],
  esAnswers: [
    { id: 'es-1', category: '志望動機', title: 'B商事 志望動機', text: 'あ'.repeat(398), charLimit: 400, companyIds: ['c-b'] },
    { id: 'es-2', category: '志望動機', title: '志望動機（汎用）', text: 'い'.repeat(520), charLimit: 0, companyIds: [] },
    { id: 'es-3', category: '自己PR', title: '自己PR（巻き込む力）', text: 'う'.repeat(280), charLimit: 300, companyIds: [] },
  ],
  syncedAt: new Date().toISOString(),
};
set('sophonData', data);
set('sophonOutbox', []);

content.main({} as never);
const g = globalThis as unknown as { __recruitAI: { run(a: string, p: unknown): Promise<unknown> } };
document.getElementById('fill')!.onclick = async () => {
  await g.__recruitAI.run('fill', null);
  document.getElementById('out')!.textContent = '入力しました';
};
(window as unknown as { outbox: () => unknown }).outbox = () => get('sophonOutbox');
