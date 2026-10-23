// 記事のエディタ（モックアップ X4）。書いたそばから自動で保存し、「公開」で公開設定（X5）を開く
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, ApiError, countChars, imageUrl, type Article, type Block, type Me } from './api';
import { Blocks } from './Blocks';
import { pickImage, uploadImage } from './image';
import { Publish } from './Publish';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
const SAVE_AFTER = 1200;

export function Editor({ id, me, toast }: { id: string; me: Me; toast(text: string): void }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [loadError, setLoadError] = useState('');
  const [save, setSave] = useState<SaveState>('saved');
  const [publishOpen, setPublishOpen] = useState(false);
  const [focusFirst, setFocusFirst] = useState(0);
  const [coverBusy, setCoverBusy] = useState(false);
  const latest = useRef<Article | null>(null);
  latest.current = article;
  const timer = useRef<number | undefined>(undefined);
  const saving = useRef<Promise<void> | null>(null);

  useEffect(() => {
    api
      .get(id)
      .then(({ article: a }) => setArticle({ ...a, body: a.body.length ? a.body : [{ id: 'first', type: 'text', text: '' }] }))
      .catch((e: ApiError) => setLoadError(e.status === 404 ? 'この記事は見つかりません' : e.message));
  }, [id]);

  /** いまの内容を保存する（保存中なら、終わってからもう一度） */
  const saveNow = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (saving.current) await saving.current;
    const a = latest.current;
    if (!a) return;
    setSave('saving');
    const run = api
      .save(a)
      .then(() => setSave((s) => (latest.current === a ? 'saved' : s === 'saving' ? 'dirty' : s)))
      .catch((e: ApiError) => {
        setSave('error');
        if (e.code !== 'network') toast(e.message);
      })
      .finally(() => (saving.current = null));
    saving.current = run;
    await run;
  }, [toast]);

  const change = (patch: Partial<Article>) => {
    setArticle((a) => (a ? { ...a, ...patch } : a));
    setSave('dirty');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void saveNow(), SAVE_AFTER);
  };

  // ⌘S / Ctrl+S ですぐ保存。保存していないまま閉じようとしたら止める
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void saveNow();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (save !== 'saved') e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [save, saveNow]);

  const chooseCover = async () => {
    const file = await pickImage();
    if (!file) return;
    setCoverBusy(true);
    try {
      change({ coverKey: await uploadImage(file) });
    } catch (e) {
      toast(e instanceof Error ? e.message : '画像をアップロードできませんでした');
    } finally {
      setCoverBusy(false);
    }
  };

  if (loadError) {
    return (
      <main className="narrow">
        <h1 className="title">{loadError}</h1>
        <p>
          <a href="/column/write">自分の記事へ</a>
        </p>
      </main>
    );
  }
  if (!article) return <p className="loading">読みこみ中…</p>;

  const chars = countChars(article.body);
  const stateText = { saved: '保存済み', dirty: '編集中', saving: '保存中…', error: '保存できませんでした' }[save];
  const published = article.status === 'published';

  return (
    <>
      <div className="w-bar">
        <div className="w-bar-in">
          <a className="w-back" href="/column/write" onClick={() => void saveNow()}>
            <svg width="11" height="18" viewBox="0 0 11 18" aria-hidden="true">
              <path d="M9 2L2 9l7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            戻る
          </a>
          <span className="w-state" aria-live="polite">
            {published ? '公開中' : '下書き'} · {chars.toLocaleString()}字 ·{' '}
            {save === 'error' ? (
              <button type="button" className="w-retry" onClick={() => void saveNow()}>
                {stateText}（もう一度）
              </button>
            ) : (
              stateText
            )}
          </span>
          {published && (
            <a className="w-view" href={`/column/p/${article.id}`} onClick={() => void saveNow()}>
              見る
            </a>
          )}
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              await saveNow();
              setPublishOpen(true);
            }}
          >
            {published ? '更新' : '公開'}
          </button>
        </div>
      </div>

      <main className="w-main">
        {article.hidden && <p className="notice">運営が非表示にしています</p>}
        {article.coverKey ? (
          <div className="w-cover">
            <img src={imageUrl(article.coverKey)} alt="" />
            <div className="w-cover-tools">
              <button type="button" onClick={() => void chooseCover()}>
                変更
              </button>
              <button type="button" onClick={() => change({ coverKey: null })}>
                外す
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="w-add-cover" onClick={() => void chooseCover()} disabled={coverBusy}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <circle cx="9" cy="10" r="1.6" fill="currentColor" />
              <path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
            {coverBusy ? 'アップロード中…' : '見出し画像を追加'}
          </button>
        )}
        <Title
          value={article.title}
          onChange={(title) => change({ title })}
          onEnter={() => setFocusFirst((n) => n + 1)}
        />
        <Blocks
          blocks={article.body}
          onChange={(body: Block[]) => change({ body })}
          onImage={uploadImage}
          onPickImage={pickImage}
          onError={toast}
          focusFirst={focusFirst}
        />
      </main>

      {publishOpen && (
        <Publish
          article={article}
          me={me}
          chars={chars}
          onChange={(patch) => change(patch)}
          onChooseCover={chooseCover}
          onClose={() => setPublishOpen(false)}
          saveNow={saveNow}
          toast={toast}
        />
      )}
    </>
  );
}

/** タイトル（折り返して高さが伸びる。Enter で本文へ） */
function Title({ value, onChange, onEnter }: { value: string; onChange(v: string): void; onEnter(): void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="w-title"
      rows={1}
      maxLength={80}
      value={value}
      placeholder="タイトル"
      aria-label="タイトル"
      autoFocus={!value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ''))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
          e.preventDefault();
          onEnter();
        }
      }}
    />
  );
}
