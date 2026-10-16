// 拡張機能を実際に読み込んだ E2E 確認用の React 製フォーム（制御コンポーネント）
import { createElement as h, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const PREFS = ['北海道', '東京都', '大阪府'];
const CITIES: Record<string, string[]> = { 東京都: ['千代田区', '新宿区', '渋谷区'], 大阪府: ['大阪市北区'] };

function App() {
  const [s, set] = useState<Record<string, string>>({});
  const [cities, setCities] = useState<string[]>([]);
  const on = (k: string) => (e: { target: { value: string } }) => set((p) => ({ ...p, [k]: e.target.value }));
  useEffect(() => {
    // 都道府県を選ぶと市区町村を「取得」する
    setCities([]);
    const t = setTimeout(() => setCities(CITIES[s.pref ?? ''] ?? []), 300);
    return () => clearTimeout(t);
  }, [s.pref]);
  useEffect(() => {
    (document.getElementById('state') as HTMLElement).textContent = JSON.stringify(s);
  }, [s]);
  const days = range(1, new Date(Number(s.by) || 2000, Number(s.bm) || 1, 0).getDate());
  const row = (label: string, el: ReturnType<typeof h>) => h('tr', null, h('th', null, label), h('td', null, el));
  const sel = (k: string, items: string[], ph = '選択してください') =>
    h('select', { name: k, value: s[k] ?? '', onChange: on(k) }, h('option', { value: '' }, ph), ...items.map((o) => h('option', { key: o, value: o }, o)));
  const txt = (k: string, extra = {}) => h('input', { name: k, value: s[k] ?? '', onChange: on(k), ...extra });
  return h('form', null, h('table', null, h('tbody', null,
    row('姓', txt('sei')), row('名', txt('mei')), row('セイ', txt('seiKana')), row('メイ', txt('meiKana')),
    row('メールアドレス', txt('mail', { type: 'email' })),
    row('電話番号', txt('tel', { type: 'tel' })),
    row('生年月日', h('span', null, sel('by', range(1980, 2008).map(String), '年'), sel('bm', range(1, 12).map(String), '月'), sel('bd', days.map(String), '日'))),
    row('性別', h('span', null, ...['男性', '女性'].map((g) => h('label', { key: g }, h('input', { type: 'radio', name: 'gender', value: g, checked: s.gender === g, onChange: on('gender') }), g)))),
    row('郵便番号', txt('zip')),
    row('都道府県', sel('pref', PREFS)),
    row('市区町村', sel('city', cities)),
    row('番地', txt('addr')),
    row('大学名', txt('school')),
  )));
}
createRoot(document.getElementById('root')!).render(h(App));
