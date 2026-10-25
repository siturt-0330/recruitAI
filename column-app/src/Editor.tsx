// 記事のエディタ（モックアップ X4）。書いたそばから自動で保存し、「公開」で公開設定（X5）を開く。
// /column/write は白紙から始まり、何か書いたとき（か「公開」を押したとき）にはじめて下書きを作る。
// 広い画面では、本文を紙のカードに乗せ、左に目次、右に「この記事」と「書き方」を出す
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, ApiError, countChars, imageUrl, readMinutes, type Article, type Block, type Me } from './api';
import { Blocks } from './Blocks';
import { pickImage, uploadImage } from './image';
import { Publish } from './Publish';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
const SAVE_AFTER = 1200;

/** 「書き方」のカードに出す近道（保存のキーは Mac とそれ以外で変える） */
const MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);
const KEYS: [string[], string][] = [
  [['#'], '見出し'],
  [['-'], '箇条書き'],
  [['>'], '引用'],
  [['---'], '区切り線'],
  [['/'], 'メニュー'],
  [MAC ? ['⌘', 'S'] : ['Ctrl', 'S'], '保存'],
];

/** 白紙の記事（まだ下書きを作っていないので id は空） */
const blank = (): Article => ({
  id: '',
  title: '',
  body: [{ id: 'first', type: 'text', text: '' }],
  coverKey: null,
  template: 'free',
  visibility: 'public',
  status: 'draft',
  hidden: false,
  tags: [],
  updatedAt: Date.now(),
});

export function Editor({ id, me, toast }: { id?: string; me: Me; toast(text: string): void }) {
  const [article, setArticle] = useState<Article | null>(() => (id ? null : blank()));
  const [loadError, setLoadError] = useState('');
  const [save, setSave] = useState<SaveState>('saved');
  const [publishOpen, setPublishOpen] = useState(false);
  const [focusFirst, setFocusFirst] = useState(0);
  const [coverBusy, setCoverBusy] = useState(false);
  const [jump, setJump] = useState<{ id: string } | null>(null);
  const latest = useRef<Article | null>(null);
  latest.current = article;
  const timer = useRef<number | undefined>(undefined);
  const saving = useRef<Promise<void> | null>(null);
  /** 下書きの id（白紙から始めたときは、作るまで空） */
  const idRef = useRef(id ?? '');
  /** 書きかえた回数（保存のあいだに書きかえたかを見る。0 なら、まだ何も書いていない） */
  const edits = useRef(0);
  const mine = `/column/u/${me.handle}`;

  useEffect(() => {
    if (!id) return;
    api
      .get(id)
      .then(({ article: a }) => setArticle({ ...a, body: a.body.length ? a.body : [{ id: 'first', type: 'text', text: '' }] }))
      .catch((e: ApiError) => setLoadError(e.status === 404 ? 'この記事は見つかりません' : e.message));
  }, [id]);

  /**
   * いまの内容を保存する（保存中なら、終わってからもう一度）。
   * まだ下書きがなければ、ここで作る。白紙のまま何も書いていなければ作らない（create なら作る）
   */
  const saveNow = useCallback(async (create = false) => {
    window.clearTimeout(timer.current);
    // 前の保存が終わるまで待つ（待つあいだに別の保存が始まったら、それも待つ。下書きを 2 つ作らないため）
    while (saving.current) await saving.current;
    const a = latest.current;
    if (!a || (!idRef.current && !edits.current && !create)) return;
    const n = edits.current;
    setSave('saving');
    const run = (async () => {
      if (!idRef.current) {
        const { id: created } = await api.create('free', []);
        idRef.current = created;
        setArticle((cur) => (cur ? { ...cur, id: created } : cur));
        history.replaceState(null, '', `/column/write/${created}`);
      }
      await api.save({ ...a, id: idRef.current });
    })()
      .then(() => setSave((s) => (edits.current === n ? 'saved' : s === 'saving' ? 'dirty' : s)))
      .catch((e: ApiError) => {
        setSave('error');
        if (e.code !== 'network') toast(e.message);
      })
      .finally(() => (saving.current = null));
    saving.current = run;
    await run;
  }, [toast]);

  /** 保存が終わってからページを移る（保存の前に移ると、最後に書いた分が消えることがある） */
  const leave = (href: string) => async (e: { preventDefault(): void }) => {
    e.preventDefault();
    await saveNow();
    location.href = href;
  };

  const change = (patch: Partial<Article>) => {
    edits.current += 1;
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
          <a href={mine}>自分の記事へ</a>
        </p>
      </main>
    );
  }
  if (!article) return <p className="loading">読みこみ中…</p>;

  const chars = countChars(article.body);
  const stateText = { saved: '保存済み', dirty: '編集中', saving: '保存中…', error: '保存できませんでした' }[save];
  const published = article.status === 'published';
  // 下書きを作るまでは、保存の状態を出さない
  const showState = article.id !== '' || save !== 'saved';
  const headings = article.body.filter((b) => b.type === 'heading' && (b.text ?? '').trim());

  return (
    <>
      <div className="w-bar">
        <div className="w-bar-in">
          <a className="w-back" href={mine} onClick={(e) => void leave(mine)(e)}>
            <svg width="11" height="18" viewBox="0 0 11 18" aria-hidden="true">
              <path d="M9 2L2 9l7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            戻る
          </a>
          <span className="w-state" aria-live="polite">
            {published ? '公開中' : '下書き'} · {chars.toLocaleString()}字
            {showState && ' · '}
            {showState &&
              (save === 'error' ? (
                <button type="button" className="w-retry" onClick={() => void saveNow()}>
                  {stateText}（もう一度）
                </button>
              ) : (
                stateText
              ))}
          </span>
          {published && (
            <a className="w-view" href={`/column/p/${article.id}`} onClick={(e) => void leave(`/column/p/${article.id}`)(e)}>
              見る
            </a>
          )}
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              // まだ下書きがなければ、何も書いていなくても作ってから開く
              await saveNow(true);
              if (idRef.current) setPublishOpen(true);
            }}
          >
            {published ? '更新' : '公開'}
          </button>
        </div>
      </div>

      <div className="w-desk">
        <nav className="w-side w-toc" aria-label="目次">
          <p className="w-side-title">目次</p>
          {headings.length ? (
            <ol>
              {headings.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => setJump({ id: h.id })}>
                    {h.text}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="w-toc-empty">見出しを入れると、ここに並びます</p>
          )}
        </nav>

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
            jumpTo={jump}
          />
        </main>

        <aside className="w-side w-info" aria-label="この記事と書き方">
          <section className="w-card">
            <h2>この記事</h2>
            <dl>
              <div>
                <dt>文字数</dt>
                <dd>{chars.toLocaleString()}字</dd>
              </div>
              <div>
                <dt>読む時間</dt>
                <dd>約{readMinutes(chars)}分</dd>
              </div>
              <div>
                <dt>保存</dt>
                <dd className={save === 'error' ? 'w-info-error' : undefined}>{showState ? stateText : '—'}</dd>
              </div>
            </dl>
          </section>
          <section className="w-card">
            <h2>書き方</h2>
            <ul className="w-keys">
              {KEYS.map(([keys, label]) => (
                <li key={label}>
                  <span className="w-keys-k">
                    {keys.map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <p className="w-card-note">
              記号は行の頭で打ち、# - &gt; のあとに空白を入れます（日本語入力のままでも使えます）。何行かまとめて貼りつけると、行ごとに分かれます。画像は貼りつけ・ドラッグでも入ります。
            </p>
          </section>
        </aside>
      </div>

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
