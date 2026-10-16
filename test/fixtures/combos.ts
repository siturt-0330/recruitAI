/**
 * 回帰テスト用の独自デザインのプルダウン。主なライブラリの「開き方・選び方」をまねている。
 * 選んだ値は hidden の input（name 付き）にも入れるので、ふつうの欄と同じように期待値を書ける。
 */
export type ComboStyle =
  | 'mui' // div[role=combobox]、mousedown で開き、選択肢の click で選ぶ。一覧は body 直下（ポータル）
  | 'reactSelect' // input[role=combobox]（文字で絞り込める）、外側の mousedown で開く。選択肢は role なしでクラス名 *__option
  | 'antVirtual' // readonly の input[role=combobox]。一覧は仮想リストで、スクロールしないと先の選択肢が作られない
  | 'autocomplete' // 自由入力の input[role=combobox]。文字を入れると候補が出る
  | 'headless' // button[aria-haspopup=listbox]、click でだけ開く
  | 'radix'; // button[role=combobox]、pointerdown で開き、選択肢の pointerup で選ぶ（開いた位置から動かないと選ばない）

export interface ComboOptions {
  style: ComboStyle;
  name: string;
  label: string;
  options: string[] | (() => string[]);
  placeholder?: string;
  /** 初めから選ばれている値 */
  value?: string;
  /** 「クリア」ボタンを付ける（元に戻すで使う） */
  clearable?: boolean;
  onChange?(value: string): void;
}

let seq = 0;

export function mountCombo(container: HTMLElement, o: ComboOptions) {
  const doc = container.ownerDocument;
  const id = `cb${++seq}`;
  const hidden = doc.createElement('input');
  hidden.type = 'hidden';
  hidden.name = o.name;
  hidden.value = o.value ?? '';
  const labelEl = doc.createElement('label');
  labelEl.id = `${id}-label`;
  labelEl.textContent = o.label;
  const wrap = doc.createElement('div');
  wrap.className = 'combo-wrap';
  wrap.append(labelEl);
  const list = () => (typeof o.options === 'function' ? o.options() : o.options);
  let popup: HTMLElement | null = null;
  let openPos: { x: number; y: number } | null = null;

  const isInput = o.style === 'reactSelect' || o.style === 'antVirtual' || o.style === 'autocomplete';
  const trigger: HTMLElement = doc.createElement(isInput ? 'input' : o.style === 'mui' ? 'div' : 'button');
  const display = doc.createElement('span');
  const control = doc.createElement('div');
  control.className = o.style === 'reactSelect' ? 'rs__control' : 'combo-control';
  control.style.cssText = 'display:inline-flex;gap:4px;border:1px solid #888;padding:2px 6px;min-width:140px';

  if (trigger instanceof HTMLButtonElement) trigger.type = 'button';
  if (o.style === 'headless') trigger.setAttribute('aria-haspopup', 'listbox');
  else trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-labelledby', `${id}-label`);
  trigger.setAttribute('aria-expanded', 'false');
  if (o.style === 'mui') trigger.tabIndex = 0;
  if (trigger instanceof HTMLInputElement) {
    trigger.autocomplete = 'off';
    if (o.style === 'antVirtual') trigger.readOnly = true;
    if (o.style === 'autocomplete') trigger.setAttribute('aria-autocomplete', 'list');
    trigger.style.width = '120px';
  }

  const render = () => {
    const v = hidden.value;
    if (trigger instanceof HTMLInputElement) {
      if (o.style === 'autocomplete') trigger.value = v;
      else {
        trigger.value = '';
        display.textContent = v || (o.placeholder ?? '');
        display.className = v ? 'rs__single-value' : 'rs__placeholder';
      }
    } else {
      display.textContent = v || (o.placeholder ?? '​');
      if (o.style === 'radix') v ? display.removeAttribute('data-placeholder') : display.setAttribute('data-placeholder', '');
    }
  };

  const choose = (v: string) => {
    hidden.value = v;
    render();
    close();
    o.onChange?.(v);
  };

  const close = () => {
    popup?.remove();
    popup = null;
    openPos = null;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-controls');
  };

  const open = (filter = '') => {
    close();
    const items = list().filter((x) => !filter || x.includes(filter));
    if (o.style === 'autocomplete' && !filter) return;
    popup = doc.createElement('div');
    popup.id = `${id}-list`;
    const roleOnOption = o.style !== 'reactSelect';
    if (roleOnOption && o.style !== 'antVirtual') popup.setAttribute('role', 'listbox');
    popup.className = o.style === 'reactSelect' ? 'rs__menu' : 'combo-popup';
    popup.style.cssText = 'position:absolute;background:#fff;border:1px solid #444;z-index:10;max-height:200px;overflow:auto;min-width:140px';
    const r = trigger.getBoundingClientRect();
    popup.style.left = `${r.left + scrollX}px`;
    popup.style.top = `${r.bottom + scrollY + 2}px`;
    const makeOption = (text: string) => {
      const el = doc.createElement('div');
      el.textContent = text;
      el.style.cssText = 'height:24px;line-height:24px;padding:0 6px;cursor:pointer';
      if (o.style === 'reactSelect') el.className = 'rs__option';
      else if (o.style === 'antVirtual') {
        el.className = 'ant-select-item ant-select-item-option';
        el.title = text;
      } else el.setAttribute('role', 'option');
      if (o.style === 'radix') {
        el.addEventListener('pointerup', (e) => {
          // Radix と同じく、開いた位置からほとんど動いていない pointerup では選ばない
          if (openPos && Math.abs(e.clientX - openPos.x) <= 10 && Math.abs(e.clientY - openPos.y) <= 10) return;
          choose(text);
        });
      } else {
        el.addEventListener('mousedown', (e) => e.preventDefault());
        el.addEventListener('click', () => choose(text));
      }
      return el;
    };
    if (o.style === 'antVirtual') {
      // 仮想リスト：見えている8件だけを作る
      const holder = doc.createElement('div');
      holder.className = 'rc-virtual-list-holder';
      holder.style.cssText = 'height:192px;overflow-y:auto;position:relative';
      const inner = doc.createElement('div');
      inner.style.cssText = `height:${items.length * 24}px;position:relative`;
      const a11y = doc.createElement('div');
      a11y.setAttribute('role', 'listbox');
      a11y.style.cssText = 'height:0;width:0;overflow:hidden';
      // 実物と同じく、見えない role=option を少しだけ置く
      items.slice(0, 2).forEach((t) => {
        const x = doc.createElement('div');
        x.setAttribute('role', 'option');
        x.textContent = t;
        a11y.append(x);
      });
      const draw = () => {
        inner.innerHTML = '';
        const start = Math.floor(holder.scrollTop / 24);
        items.slice(start, start + 8).forEach((t, k) => {
          const el = makeOption(t);
          el.style.position = 'absolute';
          el.style.top = `${(start + k) * 24}px`;
          el.style.left = '0';
          el.style.right = '0';
          inner.append(el);
        });
      };
      holder.addEventListener('scroll', draw);
      holder.append(inner);
      popup.append(a11y, holder);
      draw();
      trigger.setAttribute('aria-controls', a11y.id = `${id}-a11y`);
    } else {
      items.forEach((t) => popup!.append(makeOption(t)));
      trigger.setAttribute('aria-controls', popup.id);
    }
    doc.body.append(popup);
    trigger.setAttribute('aria-expanded', 'true');
  };

  // 開き方
  if (o.style === 'mui') {
    trigger.addEventListener('mousedown', (e) => {
      if (e.button === 0) open();
    });
  } else if (o.style === 'reactSelect' || o.style === 'antVirtual') {
    control.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      popup ? close() : open();
    });
    if (o.style === 'reactSelect') {
      trigger.addEventListener('input', () => open((trigger as HTMLInputElement).value));
      // react-select と同じく、欄を離れると入力中の文字を消す
      trigger.addEventListener('blur', () => setTimeout(() => {
        (trigger as HTMLInputElement).value = '';
        close();
      }, 50));
    }
  } else if (o.style === 'autocomplete') {
    trigger.addEventListener('input', () => {
      hidden.value = (trigger as HTMLInputElement).value;
      open((trigger as HTMLInputElement).value);
    });
  } else if (o.style === 'headless') {
    trigger.addEventListener('click', () => (popup ? close() : open()));
  } else if (o.style === 'radix') {
    trigger.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.pointerType !== 'mouse') return;
      e.preventDefault();
      open();
      openPos = { x: e.clientX, y: e.clientY };
    });
  }
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  if (isInput) {
    if (o.style !== 'autocomplete') control.append(display);
    control.append(trigger);
  } else {
    trigger.append(display);
    control.append(trigger);
  }
  if (o.clearable) {
    const clear = doc.createElement('span');
    clear.setAttribute('aria-label', 'Clear');
    clear.textContent = '×';
    clear.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      hidden.value = '';
      render();
      close();
      o.onChange?.('');
    });
    control.append(clear);
  }
  wrap.append(control, hidden);
  container.append(wrap);
  render();
  return { close, hidden, trigger };
}

/** テストの後片付け：ポータルの一覧を消す */
export function removeComboPopups(doc: Document) {
  doc.querySelectorAll('.combo-popup, .rs__menu').forEach((n) => n.remove());
}
