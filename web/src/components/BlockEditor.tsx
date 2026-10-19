'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, Heading, List, SquareCheck, Type } from 'lucide-react';
import { uid } from '@/lib/seed';
import type { Block, BlockType } from '@/lib/types';

const MENU: { type: BlockType; label: string; keys: string; icon: typeof Type }[] = [
  { type: 'text', label: 'テキスト', keys: 'text tekisuto てきすと', icon: Type },
  { type: 'heading', label: '見出し', keys: 'heading h midashi みだし', icon: Heading },
  { type: 'bullet', label: '箇条書き', keys: 'bullet list kajougaki かじょうがき', icon: List },
  { type: 'todo', label: 'やること', keys: 'todo check yarukoto やること', icon: SquareCheck },
];

/** 行頭に打つと、その種類のブロックに変わる（Notion のマークダウン記法） */
const SHORTCUTS: [RegExp, BlockType][] = [
  [/^(-|\*|・) /, 'bullet'],
  [/^\[\] ?/, 'todo'],
  [/^# /, 'heading'],
];

/**
 * Notion のようなメモ欄。1行ずつがブロックで、「/」で種類を選び、Enter で次の行を作る。
 */
export function BlockEditor({ blocks, onChange }: { blocks: Block[]; onChange(blocks: Block[]): void }) {
  // 空のときも、書き始められる行を1つ出しておく
  const [first] = useState(() => ({ id: uid(), type: 'text' as const, text: '' }));
  const list = blocks.length ? blocks : [first];

  const refs = useRef(new Map<string, HTMLTextAreaElement>());
  const [focus, setFocus] = useState<{ id: string; caret: number } | null>(null);
  const [focused, setFocused] = useState('');
  const [menu, setMenu] = useState<{ id: string; index: number } | null>(null);

  useEffect(() => {
    if (!focus) return;
    const el = refs.current.get(focus.id);
    if (el) {
      el.focus();
      el.setSelectionRange(focus.caret, focus.caret);
    }
    setFocus(null);
  }, [focus]);

  const replace = (next: Block[]) => onChange(next);
  const update = (id: string, patch: Partial<Block>) => replace(list.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const menuItems = (b: Block) => {
    const q = b.text.slice(1).trim().toLowerCase();
    return MENU.filter((m) => !q || m.label.includes(q) || m.keys.includes(q));
  };

  const applyMenu = (b: Block, type: BlockType) => {
    update(b.id, { type, text: '' });
    setMenu(null);
    setFocus({ id: b.id, caret: 0 });
  };

  const onText = (b: Block, text: string) => {
    if (b.type === 'text') {
      const hit = SHORTCUTS.find(([re]) => re.test(text));
      if (hit) {
        update(b.id, { type: hit[1], text: text.replace(hit[0], '') });
        return;
      }
    }
    if (text.startsWith('/') && !b.text.startsWith('/')) setMenu({ id: b.id, index: 0 });
    if (!text.startsWith('/') && menu?.id === b.id) setMenu(null);
    update(b.id, { text });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>, b: Block, i: number) => {
    // 日本語入力の変換中の Enter などは、そのまま変換に使う
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;

    if (menu?.id === b.id) {
      const items = menuItems(b);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setMenu({ id: b.id, index: (menu.index + d + items.length) % Math.max(items.length, 1) });
        return;
      }
      if (e.key === 'Enter' && items[menu.index]) {
        e.preventDefault();
        applyMenu(b, items[menu.index]!.type);
        return;
      }
      if (e.key === 'Escape') {
        setMenu(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // 空の箇条書き・やることで Enter を押したら、ふつうの行に戻す
      if ((b.type === 'bullet' || b.type === 'todo') && !b.text) {
        update(b.id, { type: 'text' });
        return;
      }
      const caret = el.selectionStart;
      const next: Block = { id: uid(), type: b.type === 'heading' ? 'text' : b.type, text: b.text.slice(caret) };
      replace([...list.slice(0, i), { ...b, text: b.text.slice(0, caret) }, next, ...list.slice(i + 1)]);
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
        replace([...list.slice(0, i - 1), { ...prev, text: prev.text + b.text }, ...list.slice(i + 1)]);
        setFocus({ id: prev.id, caret: prev.text.length });
      }
      return;
    }

    if (e.key === 'ArrowUp' && atStart && i > 0) {
      e.preventDefault();
      setFocus({ id: list[i - 1]!.id, caret: list[i - 1]!.text.length });
    }
    if (e.key === 'ArrowDown' && el.selectionStart === b.text.length && i < list.length - 1) {
      e.preventDefault();
      setFocus({ id: list[i + 1]!.id, caret: 0 });
    }
  };

  /** 最後の行より下を押したら、そこに書けるようにする */
  const clickBelow = () => {
    const last = list[list.length - 1]!;
    if (last.text || last.type !== 'text') {
      const b: Block = { id: uid(), type: 'text', text: '' };
      replace([...list, b]);
      setFocus({ id: b.id, caret: 0 });
    } else {
      setFocus({ id: last.id, caret: 0 });
    }
  };

  return (
    <div>
      {list.map((b, i) => (
        <div key={b.id} className="group relative flex items-start gap-2 rounded-md px-1.5 hover:bg-fill/70">
          {b.type === 'bullet' && <span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-ink" />}
          {b.type === 'todo' && (
            <button
              aria-label={b.checked ? 'チェックを外す' : 'チェックする'}
              onClick={() => update(b.id, { checked: !b.checked })}
              className={`mt-[5px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] border ${
                b.checked ? 'border-link bg-link text-white' : 'border-box'
              }`}
            >
              {b.checked && <Check size={11} strokeWidth={3} />}
            </button>
          )}
          <BlockInput
            refCb={(el) => (el ? refs.current.set(b.id, el) : refs.current.delete(b.id))}
            value={b.text}
            className={
              b.type === 'heading'
                ? 'text-[19px] font-extrabold leading-[1.5] pt-2'
                : `text-[15px] leading-[1.65] ${b.type === 'todo' && b.checked ? 'text-mute line-through' : ''}`
            }
            placeholder={
              focused === b.id ? (b.type === 'heading' ? '見出し' : b.type === 'text' ? '「/」で見出し・やることを追加' : '') : list.length === 1 ? 'メモを書く' : ''
            }
            onFocus={() => setFocused(b.id)}
            onBlur={() => {
              setFocused('');
              if (menu?.id === b.id) setTimeout(() => setMenu(null), 150);
            }}
            onChange={(t) => onText(b, t)}
            onKeyDown={(e) => onKey(e, b, i)}
          />
          {menu?.id === b.id && (
            <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-xl border border-line bg-white p-1.5 shadow-xl">
              <div className="px-2 py-1 text-[11px] text-mute">ブロック</div>
              {menuItems(b).map((m, j) => (
                <button
                  key={m.type}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyMenu(b, m.type);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] ${j === menu.index ? 'bg-fill' : ''}`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line">
                    <m.icon size={15} />
                  </span>
                  {m.label}
                </button>
              ))}
              {!menuItems(b).length && <div className="px-2 py-1.5 text-[13px] text-mute">見つかりません</div>}
            </div>
          )}
        </div>
      ))}
      <div className="h-16 cursor-text" onClick={clickBelow} />
    </div>
  );
}

/** 文字数に合わせて高さが伸びる、枠のない入力欄 */
function BlockInput({
  value,
  className,
  placeholder,
  refCb,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
}: {
  value: string;
  className: string;
  placeholder: string;
  refCb(el: HTMLTextAreaElement | null): void;
  onChange(v: string): void;
  onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void;
  onFocus(): void;
  onBlur(): void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, className]);
  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        refCb(el);
      }}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-[3px] outline-none placeholder:text-mute ${className}`}
    />
  );
}
