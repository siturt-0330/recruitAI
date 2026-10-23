// コラムの読むページの動き（スキ・フォロー・コメント・通報・共有・文字の大きさ）。
// 押したらすぐ見た目を変え、サーバーの返事で整える（ページは読み直さない）。利用者の文字は textContent で入れる。

const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

async function post(name, body) {
  try {
    const res = await fetch(`/column/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...data };
  } catch {
    return { ok: false, status: 0, error: 'network' };
  }
}

let toastTimer;
function toast(text) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2400);
}

/** ログインが要るときは、ログインの画面へ（戻り先はこのページ） */
function needLogin(res, el) {
  if (res.status !== 401) return false;
  // ログインはしているが、最初の登録（ペンネーム）がまだ
  if (res.error === 'welcome') location.href = `/column/welcome?next=${encodeURIComponent(location.pathname)}`;
  else location.href = el?.dataset.login || `/column/auth/google?next=${encodeURIComponent(location.pathname)}`;
  return true;
}

const failText = (res) =>
  res.error === 'quota' ? '今日はこれ以上できません。また明日どうぞ' : res.error === 'network' ? 'つながりませんでした' : 'うまくいきませんでした';

// ---- 文字の大きさ（ブラウザに覚える） ----
const prose = document.querySelector('[data-prose]');
function applySize(i) {
  if (prose) prose.dataset.size = String(i);
  $$('.sizes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === String(i))));
  try {
    localStorage.setItem('column:size', String(i));
  } catch {}
}
try {
  applySize(localStorage.getItem('column:size') ?? '1');
} catch {
  applySize('1');
}
$$('.sizes button').forEach((b) => b.addEventListener('click', () => applySize(b.dataset.size)));

// ---- スキ ----
function setLike(btn, on, count) {
  btn.setAttribute('aria-pressed', String(on));
  btn.querySelector('path')?.setAttribute('fill', on ? 'currentColor' : 'none');
  btn.querySelector('[data-like-count]').textContent = String(count);
}
$$('[data-like]').forEach((btn) =>
  btn.addEventListener('click', async () => {
    if (btn.dataset.busy) return;
    btn.dataset.busy = '1';
    const on = btn.getAttribute('aria-pressed') !== 'true';
    const before = Number(btn.querySelector('[data-like-count]').textContent) || 0;
    setLike(btn, on, Math.max(0, before + (on ? 1 : -1)));
    const res = await post('like', { article: btn.dataset.like });
    delete btn.dataset.busy;
    if (needLogin(res, btn)) return;
    if (!res.ok) {
      setLike(btn, !on, before);
      toast(failText(res));
      return;
    }
    setLike(btn, res.liked, res.count);
  }),
);

// ---- フォロー ----
$$('[data-follow]').forEach((btn) =>
  btn.addEventListener('click', async () => {
    if (btn.dataset.busy) return;
    btn.dataset.busy = '1';
    const on = btn.getAttribute('aria-pressed') !== 'true';
    const set = (v) => {
      btn.setAttribute('aria-pressed', String(v));
      btn.textContent = v ? 'フォロー中' : 'フォロー';
    };
    set(on);
    const res = await post('follow', { user: btn.dataset.follow });
    delete btn.dataset.busy;
    if (needLogin(res, btn)) return;
    if (!res.ok) {
      set(!on);
      toast(failText(res));
      return;
    }
    set(res.following);
    const n = document.querySelector('[data-followers]');
    if (n) n.textContent = String(res.followers);
  }),
);

// ---- コメント ----
function avatarEl(c, size) {
  const el = document.createElement(c.icon_key ? 'img' : 'span');
  el.className = 'av';
  el.style.width = el.style.height = `${size}px`;
  if (c.icon_key) {
    el.src = `/column/img/${encodeURIComponent(c.icon_key)}`;
    el.alt = '';
  } else {
    el.style.background = c.icon_color;
    el.setAttribute('aria-hidden', 'true');
  }
  return el;
}

function setCommentCount(delta) {
  const link = document.querySelector('.actions a[href="#comments"]');
  if (link) link.lastChild.textContent = String(Math.max(0, (Number(link.lastChild.textContent) || 0) + delta));
  const h = document.querySelector('.comments h2');
  if (h) {
    const n = Math.max(0, (Number(h.textContent.replace(/\D/g, '')) || 0) + delta);
    h.textContent = n ? `コメント ${n}` : 'コメント';
  }
}

$$('[data-comment-form]').forEach((form) =>
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ta = form.querySelector('textarea');
    const button = form.querySelector('button');
    const text = ta.value.trim();
    if (!text || button.disabled) return;
    button.disabled = true;
    const res = await post('comment', { article: form.dataset.article, body: text });
    button.disabled = false;
    if (needLogin(res)) return;
    if (!res.ok) return toast(failText(res));
    const c = res.comment;
    const li = document.createElement('li');
    li.className = 'comment';
    li.id = `c-${c.id}`;
    const who = document.createElement('a');
    who.href = `/column/u/${c.handle}`;
    who.append(avatarEl(c, 32));
    const main = document.createElement('div');
    main.className = 'comment-main';
    const head = document.createElement('p');
    head.className = 'comment-head';
    const name = document.createElement('a');
    name.href = `/column/u/${c.handle}`;
    name.textContent = c.pen_name;
    const when = document.createElement('span');
    when.textContent = 'たった今';
    head.append(name, when);
    const body = document.createElement('p');
    body.className = 'comment-body';
    body.textContent = c.body;
    const tools = document.createElement('p');
    tools.className = 'comment-tools';
    const del = document.createElement('button');
    del.type = 'button';
    del.dataset.deleteComment = c.id;
    del.textContent = '削除';
    tools.append(del);
    main.append(head, body, tools);
    li.append(who, main);
    document.querySelector('[data-comment-list]').append(li);
    ta.value = '';
    setCommentCount(1);
  }),
);

document.addEventListener('click', async (e) => {
  const del = e.target.closest('[data-delete-comment]');
  if (del) {
    if (!confirm('このコメントを削除しますか？')) return;
    const res = await post('comment-delete', { id: del.dataset.deleteComment });
    if (!res.ok) return toast(failText(res));
    del.closest('.comment')?.remove();
    setCommentCount(-1);
    return;
  }
  const rep = e.target.closest('[data-report]');
  if (rep) openReport(rep.dataset.report, rep.dataset.id);
  const share = e.target.closest('[data-share]');
  if (share) shareThis(share.dataset.title);
});

// ---- 通報 ----
const REASONS = ['個人を特定できる情報が書かれている', '誹謗中傷・いやがらせ', '宣伝・スパム', '選考で口外しないよう言われた内容', 'その他'];
function openReport(type, id) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet';
  dlg.innerHTML = `<form method="dialog">
<div class="sheet-head"><button type="button" data-cancel>キャンセル</button><span>通報</span><button type="submit">送信</button></div>
<div class="group">${REASONS.map((r, i) => `<label class="row"><input type="radio" name="reason" value="${i}"${i === 0 ? ' checked' : ''}> <span></span></label>`).join('')}</div>
<textarea name="detail" rows="3" maxlength="250" placeholder="くわしく（任意）"></textarea>
</form>`;
  // 理由の文は textContent で入れる
  $$('label.row span', dlg).forEach((s, i) => (s.textContent = REASONS[i]));
  document.body.append(dlg);
  dlg.querySelector('[data-cancel]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => dlg.remove());
  dlg.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const reason = `${REASONS[Number(f.reason.value)]}${f.detail.value.trim() ? `：${f.detail.value.trim()}` : ''}`;
    const res = await post('report', { type, id, reason });
    dlg.close();
    toast(res.ok ? '通報しました。運営が確認します' : failText(res));
  });
  dlg.showModal();
}

// ---- 共有 ----
async function shareThis(title) {
  const url = location.href.split('#')[0];
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch {}
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('リンクをコピーしました');
  } catch {
    prompt('このリンクをコピーしてください', url);
  }
}
