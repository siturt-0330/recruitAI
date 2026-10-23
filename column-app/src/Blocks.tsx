// 本文のエディタ。1 行ずつがブロックで、空の行の左の「＋」か「/」で見出し・画像などを足す。
// 行頭に「# 」「- 」「> 」と打つと見出し・箇条書き・引用に、「---」で区切り線になる（web/src/components/BlockEditor.tsx を土台にした）。
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { imageUrl, uid, type Block, type BlockType } from './api';

const MENU: { type: BlockType; label: string; keys: string; icon: string }[] = [
  { type: 'heading', label: '見出し', keys: 'heading midashi みだし', icon: 'M6 4v16M18 4v16M6 12h12' },
  { type: 'image', label: '画像', keys: 'image gazou がぞう', icon: 'M3 5h18v14H3zM4 17l5-4.5 4 3.5 3-2.5 4 3.5' },
  { type: 'bullet', label: '箇条書き', keys: 'bullet list kajougaki かじょうがき', icon: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01' },
  { type: 'quote', label: '引用', keys: 'quote inyou いんよう', icon: 'M5 6h14M5 12h14M5 18h9' },
  { type: 'divider', label: '区切り線', keys: 'divider line kugiri くぎり', icon: 'M4 12h16' },
];

/** 行頭に打つと、その種類のブロックに変わる */
const SHORTCUTS: [RegExp, BlockType][] = [
  [/^(-|\*|・) /, 'bullet'],
  [/^#{1,3} /, 'heading'],
  [/^(>|＞) /, 'quote'],
];

const TEXTUAL: BlockType[] = ['text', 'heading', 'bullet', 'quote'];
const isTextual = (b: Block) => TEXTUAL.includes(b.type);

interface Props {
  blocks: Block[];
  onChange(blocks: Block[]): void;
  /** 画像を受け取って、アップロードしたら key を返す */
  onImage(file: File): Promise<string>;
  /** 画像を選ぶ画面を開く */
  onPickImage(): Promise<File | null>;
  onError(message: string): void;
  /** 本文の外から、最初の行に入る（タイトルで Enter を押したとき） */
  focusFirst: number;
}

export function Blocks({ blocks, onChange, onImage, onPickImage, onError, focusFirst }: Props) {
  const list = blocks.length ? blocks : [{ id: 'first', type: 'text' as const, text: '' }];
  const refs = useRef(new Map<string, HTMLTextAreaElement | HTMLDivElement>());
  const [focus, setFocus] = useState<{ id: string; caret: number } | null>(null);
  const [focused, setFocused] = useState('');
  const [menu, setMenu] = useState<{ id: string; index: number; slash: boolean } | null>(null);
  const latest = useRef(list);
  latest.current = list;

  useEffect(() => {
    if (!focus) return;
    const el = refs.current.get(focus.id);
    if (el) {
      el.focus();
      if (el instanceof HTMLTextAreaElement) el.setSelectionRange(focus.caret, focus.caret);
    }
    setFocus(null);
  }, [focus]);

  // タイトルで Enter を押したら、書きはじめる行（型の最初の見出しの下の空いた行）へ
  useEffect(() => {
    if (!focusFirst || !list[0]) return;
    const empty = list.slice(0, 3).find((b) => b.type === 'text' && !b.text);
    setFocus(empty ? { id: empty.id, caret: 0 } : { id: list[0].id, caret: (list[0].text ?? '').length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusFirst]);

  const replace = (next: Block[]) => onChange(next);
  const update = (id: string, patch: Partial<Block>) => replace(latest.current.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const menuItems = (b: Block, slash: boolean) => {
    const q = slash ? (b.text ?? '').slice(1).trim().toLowerCase() : '';
    return MENU.filter((m) => !q || m.label.includes(q) || m.keys.includes(q));
  };

  /** 画像を i 番目のブロックのあとに入れる（空の行なら、その行を画像にする） */
  const insertImage = async (file: File, at: Block) => {
    const preview = URL.createObjectURL(file);
    const img: Block = { id: uid(), type: 'image', key: '', caption: '', preview };
    const cur = latest.current;
    const i = cur.findIndex((b) => b.id === at.id);
    const emptyText = at.type === 'text' && !(at.text ?? '').trim();
    const after: Block = { id: uid(), type: 'text', text: '' };
    const next = emptyText ? [...cur.slice(0, i), img, after, ...cur.slice(i + 1)] : [...cur.slice(0, i + 1), img, after, ...cur.slice(i + 1)];
    replace(next);
    setFocus({ id: after.id, caret: 0 });
    try {
      const key = await onImage(file);
      replace(latest.current.map((b) => (b.id === img.id ? { ...b, key, preview } : b)));
    } catch (e) {
      replace(latest.current.filter((b) => b.id !== img.id));
      onError(e instanceof Error ? e.message : '画像をアップロードできませんでした');
    }
  };

  const applyMenu = async (b: Block, type: BlockType) => {
    setMenu(null);
    if (type === 'image') {
      update(b.id, { text: '' });
      const file = await onPickImage();
      if (file) await insertImage(file, { ...b, text: '' });
      else setFocus({ id: b.id, caret: 0 });
      return;
    }
    if (type === 'divider') {
      const cur = latest.current;
      const i = cur.findIndex((x) => x.id === b.id);
      const after: Block = { id: uid(), type: 'text', text: '' };
      replace([...cur.slice(0, i), { id: b.id, type: 'divider' }, after, ...cur.slice(i + 1)]);
      setFocus({ id: after.id, caret: 0 });
      return;
    }
    update(b.id, { type, text: '' });
    setFocus({ id: b.id, caret: 0 });
  };

  const onText = (b: Block, text: string) => {
    if (b.type === 'text') {
      const hit = SHORTCUTS.find(([re]) => re.test(text));
      if (hit) {
        update(b.id, { type: hit[1], text: text.replace(hit[0], '') });
        return;
      }
      if (text === '---' || text === 'ーーー') {
        void applyMenu(b, 'divider');
        return;
      }
    }
    if (text.startsWith('/') && !(b.text ?? '').startsWith('/') && b.type === 'text') setMenu({ id: b.id, index: 0, slash: true });
    if (!text.startsWith('/') && menu?.slash && menu.id === b.id) setMenu(null);
    update(b.id, { text });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>, b: Block, i: number) => {
    // 日本語入力の変換中の Enter などは、そのまま変換に使う
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const el = e.currentTarget;
    const text = b.text ?? '';
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;

    if (menu?.id === b.id) {
      const items = menuItems(b, menu.slash);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setMenu({ ...menu, index: (menu.index + d + items.length) % Math.max(items.length, 1) });
        return;
      }
      if (e.key === 'Enter' && items[menu.index]) {
        e.preventDefault();
        void applyMenu(b, items[menu.index]!.type);
        return;
      }
      if (e.key === 'Escape') {
        setMenu(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // 空の箇条書き・引用で Enter を押したら、ふつうの行に戻す
      if ((b.type === 'bullet' || b.type === 'quote') && !text) {
        update(b.id, { type: 'text' });
        return;
      }
      const caret = el.selectionStart;
      const next: Block = { id: uid(), type: b.type === 'heading' ? 'text' : b.type, text: text.slice(caret) };
      replace([...list.slice(0, i), { ...b, text: text.slice(0, caret) }, next, ...list.slice(i + 1)]);
      setFocus({ id: next.id, caret: 0 });
      return;
    }

    if (e.key === 'Backspace' && atStart) {
      if (b.type !== 'text') {
        e.preventDefault();
        update(b.id, { type: 'text' });
        return;
      }
      if (i > 0) {
        e.preventDefault();
        const prev = list[i - 1]!;
        if (!isTextual(prev)) {
          // 前が画像や区切り線なら、それを消す（空の行のとき）か、そこに移る
          if (!text) replace([...list.slice(0, i - 1), ...list.slice(i)]);
          else setFocus({ id: prev.id, caret: 0 });
          return;
        }
        const prevText = prev.text ?? '';
        replace([...list.slice(0, i - 1), { ...prev, text: prevText + text }, ...list.slice(i + 1)]);
        setFocus({ id: prev.id, caret: prevText.length });
      }
      return;
    }

    if (e.key === 'ArrowUp' && atStart && i > 0) {
      e.preventDefault();
      const prev = list[i - 1]!;
      setFocus({ id: prev.id, caret: (prev.text ?? '').length });
    }
    if (e.key === 'ArrowDown' && el.selectionStart === text.length && i < list.length - 1) {
      e.preventDefault();
      setFocus({ id: list[i + 1]!.id, caret: 0 });
    }
  };

  /** 画像・区切り線を選んだときのキー（消す・次の行へ） */
  const onObjectKey = (e: KeyboardEvent<HTMLDivElement>, b: Block, i: number) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      const rest = [...list.slice(0, i), ...list.slice(i + 1)];
      replace(rest.length ? rest : [{ id: uid(), type: 'text', text: '' }]);
      const to = list[i - 1] ?? list[i + 1];
      if (to) setFocus({ id: to.id, caret: (to.text ?? '').length });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const after: Block = { id: uid(), type: 'text', text: '' };
      replace([...list.slice(0, i + 1), after, ...list.slice(i + 1)]);
      setFocus({ id: after.id, caret: 0 });
    } else if (e.key === 'ArrowUp' && i > 0) {
      e.preventDefault();
      setFocus({ id: list[i - 1]!.id, caret: 0 });
    } else if (e.key === 'ArrowDown' && i < list.length - 1) {
      e.preventDefault();
      setFocus({ id: list[i + 1]!.id, caret: 0 });
    }
  };

  /** 画像を貼りつけたら、そのまま入れる */
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>, b: Block) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    void insertImage(file, b);
  };

  /** 最後の行より下を押したら、そこに書けるようにする */
  const clickBelow = () => {
    const last = list[list.length - 1]!;
    if ((last.text ?? '') || last.type !== 'text') {
      const b: Block = { id: uid(), type: 'text', text: '' };
      replace([...list, b]);
      setFocus({ id: b.id, caret: 0 });
    } else {
      setFocus({ id: last.id, caret: 0 });
    }
  };

  return (
    <div
      className="blocks"
      onDragOver={(e) => {
        if ([...e.dataTransfer.items].some((x) => x.type.startsWith('image/'))) e.preventDefault();
      }}
      onDrop={(e) => {
        const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
        if (!file) return;
        e.preventDefault();
        const at = latest.current.find((b) => b.id === focused) ?? latest.current[latest.current.length - 1]!;
        void insertImage(file, at);
      }}
    >
      {list.map((b, i) => {
        const setRef = (el: HTMLTextAreaElement | HTMLDivElement | null) => {
          if (el) refs.current.set(b.id, el);
          else refs.current.delete(b.id);
        };
        if (b.type === 'divider') {
          return (
            <div key={b.id} ref={setRef} className="blk blk-divider" tabIndex={0} role="separator" aria-label="区切り線（Delete で消す）" onKeyDown={(e) => onObjectKey(e, b, i)}>
              <hr />
            </div>
          );
        }
        if (b.type === 'image') {
          return (
            <div key={b.id} ref={setRef} className="blk blk-image" tabIndex={0} aria-label="画像（Delete で消す）" onKeyDown={(e) => onObjectKey(e, b, i)}>
              <figure>
                <img src={b.key ? imageUrl(b.key) : b.preview} alt={b.caption ?? ''} className={b.key ? '' : 'uploading'} />
                {!b.key && <span className="uploading-label">アップロード中…</span>}
                <input
                  className="caption"
                  value={b.caption ?? ''}
                  maxLength={200}
                  placeholder="画像の説明"
                  onChange={(e) => update(b.id, { caption: e.target.value })}
                />
              </figure>
              <button type="button" className="blk-remove" aria-label="画像を消す" onClick={() => replace(list.filter((x) => x.id !== b.id))}>
                ×
              </button>
            </div>
          );
        }
        const empty = !(b.text ?? '');
        const showPlus = b.type === 'text' && empty && focused === b.id;
        const items = menu?.id === b.id ? menuItems(b, menu.slash) : [];
        return (
          <div key={b.id} className={`blk blk-${b.type}`}>
            {showPlus && (
              <button
                type="button"
                className="plus"
                aria-label="見出し・画像などを足す"
                aria-expanded={menu?.id === b.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setMenu(menu?.id === b.id ? null : { id: b.id, index: 0, slash: false });
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </button>
            )}
            {b.type === 'bullet' && <span className="dot" aria-hidden="true" />}
            <AutoText
              refCb={setRef}
              value={b.text ?? ''}
              placeholder={
                focused === b.id
                  ? b.type === 'heading'
                    ? '見出し'
                    : b.type === 'quote'
                      ? '引用'
                      : b.type === 'bullet'
                        ? '箇条書き'
                        : '本文'
                  : list.length === 1
                    ? '本文'
                    : ''
              }
              onFocus={() => setFocused(b.id)}
              onBlur={() => {
                setFocused((f) => (f === b.id ? '' : f));
                if (menu?.id === b.id) setTimeout(() => setMenu((m) => (m?.id === b.id ? null : m)), 150);
              }}
              onChange={(t) => onText(b, t)}
              onKeyDown={(e) => onKey(e, b, i)}
              onPaste={(e) => onPaste(e, b)}
            />
            {menu?.id === b.id && (
              <div className="menu" role="menu" aria-label="足す">
                {items.map((m, j) => (
                  <button
                    key={m.type}
                    type="button"
                    role="menuitem"
                    className={j === menu.index ? 'on' : ''}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      void applyMenu(b, m.type);
                    }}
                  >
                    <span>{m.label}</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={m.icon} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ))}
                {!items.length && <p className="menu-empty">見つかりません</p>}
              </div>
            )}
          </div>
        );
      })}
      <div className="below" onClick={clickBelow} />
    </div>
  );
}

/** 文字数に合わせて高さが伸びる、枠のない入力欄 */
function AutoText(props: {
  value: string;
  placeholder: string;
  refCb(el: HTMLTextAreaElement | null): void;
  onChange(v: string): void;
  onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void;
  onPaste(e: ClipboardEvent<HTMLTextAreaElement>): void;
  onFocus(): void;
  onBlur(): void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        props.refCb(el);
      }}
      rows={1}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={props.onKeyDown}
      onPaste={props.onPaste}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
    />
  );
}
