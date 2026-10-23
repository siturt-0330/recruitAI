// プロフィール：最初の登録（/column/welcome）・設定（/column/settings）・退会
import { hasProfile, type User } from './auth';
import { avatar, page } from './layout';
import { esc, hostCookie, htmlResponse, now, readForm, redirect, safeNext, sameOrigin } from './util';

/** アイコンの色（写真を出さない人のための丸）。ここにない色は保存しない */
export const ICON_COLORS = ['#c4a68d', '#9c8873', '#d1b06b', '#7d8a7b', '#a7b29a', '#6f7a86', '#8e9fb5', '#b39a9f'];
/** URL の名前に使えない言葉（コラムの URL とぶつかるもの・紛らわしいもの） */
const RESERVED = new Set(['admin', 'api', 'auth', 'column', 'join', 'settings', 'terms', 'write', 'welcome', 'img', 'new', 'edit', 'rakuraku', 'official', 'support']);
/** 立場をすぐ入れられるように出す候補 */
const YEARS = ['26卒', '27卒', '28卒', '29卒'];
const KINDS = ['文系', '理系'];

const loginUrl = (next: string) => `/column/auth/google?next=${encodeURIComponent(next)}`;

interface ProfileInput {
  pen_name: string;
  handle: string;
  status_line: string;
  bio: string;
  icon_color: string;
}

function readProfile(f: URLSearchParams): ProfileInput {
  return {
    pen_name: (f.get('pen_name') ?? '').trim(),
    handle: (f.get('handle') ?? '').trim().toLowerCase(),
    status_line: (f.get('status_line') ?? '').trim(),
    bio: (f.get('bio') ?? '').trim(),
    icon_color: f.get('icon_color') ?? '',
  };
}

/** 入力を確かめる（だめなら理由の文） */
async function checkProfile(env: Env, user: User, v: ProfileInput): Promise<string> {
  if (!v.pen_name) return 'ペンネームを入れてください';
  if (v.pen_name.length > 20) return 'ペンネームは 20 文字以内にしてください';
  if (!/^[a-z0-9_]{3,20}$/.test(v.handle)) return 'URL の名前は、半角の小文字・数字・_ で 3〜20 文字にしてください';
  if (RESERVED.has(v.handle)) return 'その URL の名前は使えません';
  if (v.status_line.length > 24) return '立場は 24 文字以内にしてください';
  if (v.bio.length > 160) return 'ひと言は 160 文字以内にしてください';
  if (!ICON_COLORS.includes(v.icon_color)) return 'アイコンの色を選んでください';
  const taken = await env.COLUMN_DB.prepare('SELECT 1 FROM users WHERE handle = ? AND id <> ?').bind(v.handle, user.id).first();
  if (taken) return 'その URL の名前は、もう使われています';
  return '';
}

/** 空いている URL の名前を自動で作る（あとで設定で変えられる） */
async function freeHandle(env: Env): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const r = crypto.getRandomValues(new Uint8Array(7));
    const h = `u${Array.from(r, (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('')}`;
    if (!(await env.COLUMN_DB.prepare('SELECT 1 FROM users WHERE handle = ?').bind(h).first())) return h;
  }
  throw new Error('no free handle');
}

/** 自分がどう表示されるかの見本（打つとすぐ変わる。onboard.js） */
function preview(v: ProfileInput): string {
  return `<div class="pv" aria-hidden="true" data-preview>
${avatar({ icon_key: null, icon_color: v.icon_color }, 56).replace('class="av"', 'class="av" data-pv-av')}
<span class="pv-main"><b data-pv-name data-empty="ペンネーム">${esc(v.pen_name || 'ペンネーム')}</b><span data-pv-status data-empty="立場">${esc(v.status_line || '立場')}</span></span>
</div>`;
}

/** 立場の入力欄と、押すだけで入る候補 */
function statusField(value: string): string {
  const chip = (group: string, label: string) => `<button type="button" class="pick" data-${group}="${label}" aria-pressed="${value.includes(label)}">${label}</button>`;
  return `<div class="field">
<label for="status_line">立場</label>
<div class="picks" data-picks>${YEARS.map((y) => chip('year', y)).join('')}<span class="picks-gap"></span>${KINDS.map((k) => chip('kind', k)).join('')}</div>
<input type="text" id="status_line" name="status_line" value="${esc(value)}" maxlength="24" placeholder="27卒・文系" autocomplete="off">
</div>`;
}

function colorField(selected: string): string {
  return `<div class="field"><span class="field-label">アイコン</span>
<div class="swatches" role="radiogroup" aria-label="アイコンの色">
${ICON_COLORS.map((c, i) => `<input type="radio" id="c${i}" name="icon_color" value="${c}"${c === selected ? ' checked' : ''}><label for="c${i}" style="background:${c}" aria-label="色 ${i + 1}"></label>`).join('')}
</div></div>`;
}

const errorBox = (error: string) => (error ? `<p class="form-error" role="alert">${esc(error)}</p>` : '');

/** 最初の登録。ペンネーム・立場・アイコンの色と、利用規約への同意だけ。URL の名前は自動で決める */
export async function welcome(request: Request, env: Env, url: URL, user: User | null): Promise<Response> {
  if (!user) return redirect(loginUrl('/column/welcome'));
  const next = safeNext(url.searchParams.get('next'));
  if (hasProfile(user) && request.method === 'GET') return redirect(next);

  let v: ProfileInput = {
    pen_name: user.pen_name ?? '',
    handle: user.handle ?? '',
    status_line: user.status_line,
    bio: user.bio,
    icon_color: user.icon_color,
  };
  let error = '';
  let agreed = false;
  if (request.method === 'POST') {
    if (!sameOrigin(request, url)) return htmlResponse('', 403);
    const f = await readForm(request);
    if (!f) return htmlResponse('', 413);
    v = { ...readProfile(f), bio: user.bio, handle: user.handle ?? (await freeHandle(env)) };
    agreed = f.get('terms') === 'on';
    error = await checkProfile(env, user, v);
    if (!error && !agreed) error = '利用規約に同意してください';
    if (!error) {
      await env.COLUMN_DB.prepare('UPDATE users SET pen_name = ?, handle = ?, status_line = ?, icon_color = ?, terms_at = COALESCE(terms_at, ?) WHERE id = ?')
        .bind(v.pen_name, v.handle, v.status_line, v.icon_color, now(), user.id)
        .run();
      return redirect(safeNext(f.get('next')));
    }
  }

  const body = `<div class="form-page">
${preview(v)}
<h1 class="form-title">はじめまして</h1>
<p class="form-lead">本名・顔写真は出ません。</p>
${errorBox(error)}
<form method="post" action="/column/welcome?next=${encodeURIComponent(next)}" class="form" novalidate>
<input type="hidden" name="next" value="${esc(next)}">
<div class="field">
<label for="pen_name">ペンネーム</label>
<input type="text" id="pen_name" name="pen_name" value="${esc(v.pen_name)}" maxlength="20" required placeholder="みお" autocomplete="nickname" autofocus>
</div>
${statusField(v.status_line)}
${colorField(v.icon_color)}
<label class="agree"><input type="checkbox" name="terms"${agreed ? ' checked' : ''}><span><a href="/column/terms" target="_blank">利用規約</a>に同意する</span></label>
<button class="btn btn-block" type="submit">はじめる</button>
</form>
</div>`;
  return htmlResponse(page({ title: 'ようこそ', noindex: true, width: 'narrow', scripts: ['onboard.js'] }, body, user, env, url.pathname), error ? 400 : 200);
}

/** プロフィールの設定（ひと言と URL の名前もここで変える） */
export async function settings(request: Request, env: Env, url: URL, user: User | null): Promise<Response> {
  if (!user) return redirect(loginUrl('/column/settings'));
  if (!hasProfile(user)) return redirect(`/column/welcome?next=${encodeURIComponent('/column/settings')}`);
  let v: ProfileInput = {
    pen_name: user.pen_name ?? '',
    handle: user.handle ?? '',
    status_line: user.status_line,
    bio: user.bio,
    icon_color: user.icon_color,
  };
  let error = '';
  let saved = url.searchParams.get('saved') === '1';
  if (request.method === 'POST') {
    if (!sameOrigin(request, url)) return htmlResponse('', 403);
    const f = await readForm(request);
    if (!f) return htmlResponse('', 413);
    v = readProfile(f);
    error = await checkProfile(env, user, v);
    if (!error) {
      await env.COLUMN_DB.prepare('UPDATE users SET pen_name = ?, handle = ?, status_line = ?, bio = ?, icon_color = ? WHERE id = ?')
        .bind(v.pen_name, v.handle, v.status_line, v.bio, v.icon_color, user.id)
        .run();
      return redirect('/column/settings?saved=1');
    }
    saved = false;
  }

  const body = `<div class="form-page">
${preview(v)}
<h1 class="form-title">プロフィール</h1>
${saved ? '<p class="form-ok" role="status">保存しました</p>' : ''}
${errorBox(error)}
<form method="post" action="/column/settings" class="form" novalidate>
<div class="field">
<label for="pen_name">ペンネーム</label>
<input type="text" id="pen_name" name="pen_name" value="${esc(v.pen_name)}" maxlength="20" required placeholder="みお" autocomplete="nickname">
</div>
${statusField(v.status_line)}
<div class="field">
<label for="bio">ひと言</label>
<textarea id="bio" name="bio" maxlength="160" rows="3" placeholder="金融と IT を中心にエントリー中">${esc(v.bio)}</textarea>
</div>
${colorField(v.icon_color)}
<div class="field">
<label for="handle">URL の名前</label>
<div class="prefixed"><span>rakuraku-entry.com/column/u/</span><input type="text" id="handle" name="handle" value="${esc(v.handle)}" maxlength="20" required pattern="[a-z0-9_]{3,20}" autocomplete="off" autocapitalize="none" spellcheck="false"></div>
<p class="field-hint">半角英小文字・数字・_（3〜20 文字）</p>
</div>
<button class="btn btn-block" type="submit">保存</button>
</form>

<div class="account-box">
<p class="field-label">アカウント</p>
<p class="account-mail">${esc(user.email)}</p>
<div class="account-actions">
<a href="/column/u/${esc(v.handle)}">自分のページ</a>
<form method="post" action="/column/auth/logout"><button class="link-btn" type="submit">ログアウト</button></form>
<a class="danger-link" href="/column/settings/delete">退会する</a>
</div>
</div>
</div>`;
  return htmlResponse(page({ title: 'プロフィール', noindex: true, width: 'narrow', scripts: ['onboard.js'] }, body, user, env, url.pathname), error ? 400 : 200);
}

/** 退会。記事・コメント・スキ・フォロー・画像をすべて消す */
export async function deleteAccount(request: Request, env: Env, url: URL, user: User | null): Promise<Response> {
  if (!user) return redirect(loginUrl('/column/settings'));
  let error = '';
  if (request.method === 'POST') {
    if (!sameOrigin(request, url)) return htmlResponse('', 403);
    const f = await readForm(request);
    if (f?.get('confirm') === '退会する') {
      const imgs = await env.COLUMN_DB.prepare('SELECT key FROM images WHERE user_id = ?').bind(user.id).all<{ key: string }>();
      const keys = imgs.results.map((r) => r.key);
      for (let i = 0; i < keys.length; i += 1000) await env.COLUMN_IMAGES.delete(keys.slice(i, i + 1000));
      // 表は ON DELETE CASCADE で、記事・コメント・スキ・フォロー・セッション・画像の記録もまとめて消える
      await env.COLUMN_DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();
      console.log(JSON.stringify({ message: 'column account deleted', images: keys.length }));
      return redirect('/column', { 'Set-Cookie': hostCookie('col_sid', '', 0) });
    }
    error = '「退会する」と入れてください';
  }
  const body = `<div class="form-page">
<h1 class="form-title">退会</h1>
<p class="form-lead">記事・コメントなどはすべて消え、元に戻せません。</p>
${errorBox(error)}
<form method="post" action="/column/settings/delete" class="form">
<div class="field">
<label for="confirm">「退会する」と入力</label>
<input type="text" id="confirm" name="confirm" autocomplete="off">
</div>
<button class="btn btn-block btn-danger" type="submit">退会する</button>
<p class="form-cancel"><a href="/column/settings">やめる</a></p>
</form>
</div>`;
  return htmlResponse(page({ title: '退会', noindex: true, width: 'narrow' }, body, user, env, url.pathname), error ? 400 : 200);
}
