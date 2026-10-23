// 書きはじめる画面（モックアップ X3）。型を選ぶと見出しが入った状態で始まる。下に自分の記事の一覧
import { useEffect, useState } from 'react';
import { api, ApiError, type ArticleSummary } from './api';
import { templateBlocks, TEMPLATES } from './templates';

function ago(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 3600_000) return `${Math.max(1, Math.floor(diff / 60_000))}分前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}時間前`;
  const d = new Date(ms);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function NewArticle({ toast }: { toast(text: string): void }) {
  const [tpl, setTpl] = useState('fail');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<ArticleSummary[] | null>(null);
  const cur = TEMPLATES.find((t) => t.id === tpl)!;

  useEffect(() => {
    api
      .mine()
      .then((r) => setMine(r.articles))
      .catch(() => setMine([]));
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      const { id } = await api.create(tpl, templateBlocks(tpl));
      location.href = `/column/write/${id}`;
    } catch (e) {
      toast((e as ApiError).message);
      setBusy(false);
    }
  };

  return (
    <div className="grouped-page">
      <main className="narrow">
        <div className="sheet-head">
          <a href="/column">キャンセル</a>
          <span>新しい記事</span>
          <button type="button" onClick={() => void start()} disabled={busy}>
            次へ
          </button>
        </div>

        <p className="group-label">型</p>
        <div className="group" role="radiogroup" aria-label="型">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={t.id === tpl} className="row row-btn" onClick={() => setTpl(t.id)} onDoubleClick={() => void start()}>
              {t.name}
              {t.id === tpl && (
                <svg className="tick" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="#0071e3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <p className="group-label">入る見出し</p>
        <div className="group">
          {(cur.headings.length ? cur.headings : ['なし']).map((h) => (
            <div key={h} className={`row${cur.headings.length ? '' : ' muted'}`}>
              {h}
            </div>
          ))}
        </div>

        <p className="group-label">自分の記事</p>
        {mine === null ? (
          <p className="group-note">読みこみ中…</p>
        ) : mine.length === 0 ? (
          <p className="group-note">まだありません</p>
        ) : (
          <div className="group">
            {mine.map((a) => (
              <a key={a.id} className="row row-btn mine" href={`/column/write/${a.id}`}>
                <span className="mine-title">{a.title || '無題'}</span>
                <span className="v">
                  {a.hidden ? '非表示' : a.status === 'published' ? (a.visibility === 'unlisted' ? 'リンクのみ' : '公開中') : '下書き'} · {ago(a.updated_at)}
                </span>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
