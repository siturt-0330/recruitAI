// 型（選ぶと見出しが入った状態で書きはじめられる）。モックアップ「note ベース改良案」と同じ 5 つ
import { uid, type Block } from './api';

export interface Template {
  id: string;
  name: string;
  headings: string[];
  /** 公開設定で出すハッシュタグの候補 */
  tags: string[];
}

export const TEMPLATES: Template[] = [
  { id: 'fail', name: '失敗談', headings: ['何があったか', 'なぜそうなったか', 'どうしたか', '次の人へ'], tags: ['失敗談'] },
  { id: 'exp', name: '選考の体験記', headings: ['応募したきっかけ', 'ES', '面接', '振り返り'], tags: ['選考体験記', '面接'] },
  { id: 'es', name: 'ES のこの欄どう書く？', headings: ['迷った欄', '調べたこと', '結論'], tags: ['ES'] },
  { id: 'tips', name: 'コツをまとめる', headings: ['結論', 'コツ'], tags: ['コツ'] },
  { id: 'free', name: '白紙から', headings: [], tags: [] },
];

export const COMMON_TAGS = ['27卒', '28卒', 'インターン', 'ES', '面接', 'マイページ', 'SPI'];

export function templateBlocks(id: string): Block[] {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t || !t.headings.length) return [{ id: uid(), type: 'text', text: '' }];
  return t.headings.flatMap((h) => [
    { id: uid(), type: 'heading' as const, text: h },
    { id: uid(), type: 'text' as const, text: '' },
  ]);
}
