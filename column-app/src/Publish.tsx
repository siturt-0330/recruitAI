// 公開設定（モックアップ X5）。見出し画像・ハッシュタグ・公開範囲の 3 つだけ
import { useEffect, useState } from 'react';
import { api, ApiError, imageUrl, type Article, type Me } from './api';
import { COMMON_TAGS, TEMPLATES } from './templates';

interface Props {
  article: Article;
  me: Me;
  chars: number;
  onChange(patch: Partial<Article>): void;
  onChooseCover(): Promise<void>;
  onClose(): void;
  saveNow(): Promise<void>;
  toast(text: string): void;
}

const VIS: { id: Article['visibility']; label: string; note: string }[] = [
  { id: 'public', label: 'すべての人', note: '一覧と検索に出ます' },
  { id: 'unlisted', label: 'リンクを知っている人', note: '一覧と検索には出ません' },
];

export function Publish({ article, me, chars, onChange, onChooseCover, onClose, saveNow, toast }: Props) {
  // 開いているあいだは、うしろのエディタがスクロールしないようにする
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  const [tagInput, setTagInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const published = article.status === 'published';
  const tpl = TEMPLATES.find((t) => t.id === article.template);
  const suggest = [...(tpl?.tags ?? []), ...COMMON_TAGS].filter((t, i, a) => a.indexOf(t) === i && !article.tags.includes(t)).slice(0, 6);

  const addTag = (raw: string) => {
    const t = raw.replace(/^[#＃]+/, '').replace(/\s+/g, '').slice(0, 20);
    if (!t || article.tags.includes(t)) return;
    if (article.tags.length >= 5) return toast('ハッシュタグは 5 つまでです');
    onChange({ tags: [...article.tags, t] });
  };

  const publish = async (confirmed = false) => {
    setBusy(true);
    setError('');
    try {
      await saveNow();
      const { url } = await api.publish(article, confirmed);
      location.href = url;
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'confirm' && window.confirm(`${err.message}。\nこのまま公開しますか？`)) {
        await publish(true);
        return;
      }
      if (err.code !== 'confirm') setError(err.message);
      setBusy(false);
    }
  };

  const unpublish = async () => {
    if (!window.confirm('下書きに戻しますか？')) return;
    try {
      await api.unpublish(article.id);
      onChange({ status: 'draft' });
      onClose();
      toast('下書きに戻しました');
    } catch (e) {
      setError((e as ApiError).message);
    }
  };

  const remove = async () => {
    if (!window.confirm('この記事を削除しますか？元に戻せません。')) return;
    try {
      await api.remove(article.id);
      location.href = '/column/write';
    } catch (e) {
      setError((e as ApiError).message);
    }
  };

  return (
    <div className="sheet-page" role="dialog" aria-modal="true" aria-label="公開設定">
      <div className="narrow">
        <div className="sheet-head">
          <button type="button" className="plain" onClick={onClose}>
            戻る
          </button>
          <span>公開設定</span>
          <button type="button" onClick={() => void publish()} disabled={busy}>
            {busy ? '公開中…' : published ? '更新' : '公開'}
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="group preview">
          {article.coverKey ? <img src={imageUrl(article.coverKey)} alt="" /> : <span className="preview-blank" aria-hidden="true" />}
          <span className="preview-main">
            <b>{article.title || '無題'}</b>
            <span>
              {me.penName} · {chars.toLocaleString()}字
            </span>
          </span>
        </div>

        <p className="group-label">記事</p>
        <div className="group">
          <button type="button" className="row row-btn" onClick={() => void onChooseCover()}>
            見出し画像<span className="v">{article.coverKey ? 'あり' : 'なし'}</span>
            <svg width="8" height="13" viewBox="0 0 9 15" aria-hidden="true">
              <path d="M1.5 1.5l6 6-6 6" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="row tag-row">
            <span className="k">ハッシュタグ</span>
            <span className="tag-list">
              {article.tags.map((t) => (
                <button key={t} type="button" className="tag" onClick={() => onChange({ tags: article.tags.filter((x) => x !== t) })} aria-label={`#${t} を外す`}>
                  #{t} ×
                </button>
              ))}
              {article.tags.length < 5 && (
                <input
                  value={tagInput}
                  placeholder="#を足す"
                  aria-label="ハッシュタグを足す"
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ',' || e.key === '、') && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      addTag(tagInput);
                      setTagInput('');
                    }
                  }}
                  onBlur={() => {
                    if (tagInput) {
                      addTag(tagInput);
                      setTagInput('');
                    }
                  }}
                />
              )}
            </span>
          </div>
        </div>
        {suggest.length > 0 && article.tags.length < 5 && (
          <p className="suggest">
            {suggest.map((t) => (
              <button key={t} type="button" onClick={() => addTag(t)}>
                ＋#{t}
              </button>
            ))}
          </p>
        )}

        <p className="group-label">公開範囲</p>
        <div className="group" role="radiogroup" aria-label="公開範囲">
          {VIS.map((v) => (
            <button key={v.id} type="button" role="radio" aria-checked={article.visibility === v.id} className="row row-btn" onClick={() => onChange({ visibility: v.id })}>
              {v.label}
              {article.visibility === v.id && (
                <svg className="tick" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="#0071e3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
        <p className="group-note">{VIS.find((v) => v.id === article.visibility)?.note}</p>

        {published && (
          <>
            <p className="group-label">ほか</p>
            <div className="group">
              <button type="button" className="row row-btn" onClick={() => void unpublish()}>
                下書きに戻す
              </button>
              <button type="button" className="row row-btn danger" onClick={() => void remove()}>
                記事を削除
              </button>
            </div>
          </>
        )}
        {!published && (
          <div className="group" style={{ marginTop: 32 }}>
            <button type="button" className="row row-btn danger" onClick={() => void remove()}>
              下書きを削除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
