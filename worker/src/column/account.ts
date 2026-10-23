// プロフィールの設定・退会・招待コードで書き手になる
import { canWrite, hasProfile, type User } from './auth';
import { page } from './layout';
import { esc, hostCookie, htmlResponse, now, readForm, redirect, safeNext, sameOrigin } from './util';

/** アイコンの色（写真を出さない人のための丸）。ここにない色は保存しない */
export const ICON_COLORS = ['#c4a68d', '#9c8873', '#d1b06b', '#7d8a7b', '#a7b29a', '#6f7a86', '#8e9fb5', '#b39a9f'];
/** URL の名前に使えない言葉（コラムの URL とぶつかるもの・紛らわしいもの） */
const RESERVED = new Set(['admin', 'api', 'auth', 'column', 'join', 'settings', 'terms', 'write', 'img', 'new', 'edit', 'rakuraku', 'official', 'support']);

const loginUrl = (next: string) => `/column/auth/google?next=${encodeURIComponent(next)}`;

interface ProfileInput {
  pen_name: string;
  handle: string;
  status_line: string;
  bio: string;
  icon_color: string;
}

function profileForm(user: User, v: ProfileInput, first: boolean, next: string, error = ''): string {
  return `<form method="post" action="/column/settings">
<input type="hidden" name="next" value="${esc(next)}">
<div class="sheet-head"><a href="${first ? '/column' : esc(next)}">${first ? 'あとで' : 'キャンセル'}</a><span>${first ? 'はじめまして' : 'プロフィール'}</span><button type="submit">${first ? '始める' : '保存'}</button></div>
${first ? '<p class="group-note">顔写真や本名は出しません。ペンネームと立場だけが、記事に表示されます。</p>' : ''}
${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
<p class="group-label">表示</p>
<div class="group">
<div class="row"><label for="pen_name">ペンネーム</label><input type="text" id="pen_name" name="pen_name" value="${esc(v.pen_name)}" maxlength="20" required placeholder="みお" autocomplete="off"></div>
<div class="row"><label for="status_line">立場</label><input type="text" id="status_line" name="status_line" value="${esc(v.status_line)}" maxlength="24" placeholder="27卒・文系" autocomplete="off"></div>
<div class="row stack"><label for="bio">ひと言</label><textarea id="bio" name="bio" maxlength="160" placeholder="金融と IT を中心にエントリー中">${esc(v.bio)}</textarea></div>
</div>
<p class="group-label">アイコンの色</p>
<div class="group"><div class="row"><div class="swatches" role="radiogroup" aria-label="アイコンの色">
${ICON_COLORS.map((c, i) => `<input type="radio" id="c${i}" name="icon_color" value="${c}"${c === v.icon_color ? ' checked' : ''}><label for="c${i}" style="background:${c}" aria-label="色 ${i + 1}"></label>`).join('')}
</div></div></div>
<p class="group-label">URL</p>
<div class="group"><div class="row"><span class="k">rakuraku-entry.com/column/u/</span><input type="text" name="handle" value="${esc(v.handle)}" maxlength="20" required pattern="[a-z0-9_]{3,20}" placeholder="mio_27" autocomplete="off" aria-label="URL の名前"></div></div>
<p class="group-note">半角の小文字・数字・_ で 3〜20 文字。</p>
</form>
${first ? '' : `<p class="group-label">アカウント</p>
<div class="group">
<div class="row"><span class="k">ログイン中</span><span class="v">${esc(user.email)}</span></div>
<form class="row" method="post" action="/column/auth/logout"><button class="link-btn" type="submit">ログアウト</button></form>
<div class="row"><a href="/column/settings/delete" style="color:var(--danger)">退会する</a></div>
</div>
<p class="group-note">メールアドレスは、ほかの人には見えません。</p>`}`;
}

/** プロフィールの入力を確かめる（だめなら理由の文） */
async function checkProfile(env: Env, user: User, v: ProfileInput): Promise<string> {
  if (!v.pen_name || v.pen_name.length > 20) return 'ペンネームを 20 文字以内で入れてください';
  if (!/^[a-z0-9_]{3,20}$/.test(v.handle)) return 'URL の名前は、半角の小文字・数字・_ で 3〜20 文字にしてください';
  if (RESERVED.has(v.handle)) return 'その URL の名前は使えません';
  if (v.status_line.length > 24) return '立場は 24 文字以内にしてください';
  if (v.bio.length > 160) return 'ひと言は 160 文字以内にしてください';
  if (!ICON_COLORS.includes(v.icon_color)) return 'アイコンの色を選んでください';
  const taken = await env.COLUMN_DB.prepare('SELECT 1 FROM users WHERE handle = ? AND id <> ?').bind(v.handle, user.id).first();
  if (taken) return 'その URL の名前は、もう使われています';
  return '';
}

export async function settings(request: Request, env: Env, url: URL, user: User | null): Promise<Response> {
  if (!user) return redirect(loginUrl('/column/settings'));
  const first = !hasProfile(user) || url.searchParams.get('first') === '1';
  if (request.method === 'POST') {
    if (!sameOrigin(request, url)) return htmlResponse('', 403);
    const f = await readForm(request);
    if (!f) return htmlResponse('', 413);
    const v: ProfileInput = {
      pen_name: (f.get('pen_name') ?? '').trim(),
      handle: (f.get('handle') ?? '').trim().toLowerCase(),
      status_line: (f.get('status_line') ?? '').trim(),
      bio: (f.get('bio') ?? '').trim(),
      icon_color: f.get('icon_color') ?? '',
    };
    const next = safeNext(f.get('next'));
    const error = await checkProfile(env, user, v);
    if (error) {
      const body = profileForm(user, v, !hasProfile(user), next, error);
      return htmlResponse(page({ title: 'プロフィール', noindex: true, width: 'narrow', grouped: true }, body, user, env, url.pathname), 400);
    }
    await env.COLUMN_DB.prepare('UPDATE users SET pen_name = ?, handle = ?, status_line = ?, bio = ?, icon_color = ? WHERE id = ?')
      .bind(v.pen_name, v.handle, v.status_line, v.bio, v.icon_color, user.id)
      .run();
    return redirect(next);
  }
  const v: ProfileInput = {
    pen_name: user.pen_name ?? '',
    handle: user.handle ?? '',
    status_line: user.status_line,
    bio: user.bio,
    icon_color: user.icon_color,
  };
  const body = profileForm(user, v, first, safeNext(url.searchParams.get('next')));
  return htmlResponse(page({ title: 'プロフィール', noindex: true, width: 'narrow', grouped: true }, body, user, env, url.pathname));
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
  const body = `<form method="post" action="/column/settings/delete">
<div class="sheet-head"><a href="/column/settings">キャンセル</a><span>退会</span><span></span></div>
<p class="group-note">書いた記事・コメント・スキ・フォロー・画像は、すべて消えて元に戻せません。</p>
${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
<p class="group-label">確認のため「退会する」と入れてください</p>
<div class="group"><div class="row"><input type="text" name="confirm" autocomplete="off" aria-label="確認" style="text-align:left"></div></div>
<p style="margin:24px 16px"><button class="btn btn-danger" type="submit">退会する</button></p>
</form>`;
  return htmlResponse(page({ title: '退会', noindex: true, width: 'narrow', grouped: true }, body, user, env, url.pathname), error ? 400 : 200);
}

/** 招待コードを入れて書き手になる */
export async function join(request: Request, env: Env, url: URL, user: User | null): Promise<Response> {
  const render = (inner: string, status = 200) =>
    htmlResponse(page({ title: '書き手になる', noindex: true, width: 'narrow', grouped: true }, inner, user, env, url.pathname), status);
  if (!user) {
    return render(`<h1 class="title">書き手になる</h1><p class="sub">いまは、招待コードを持っている人だけが記事を書けます。まず Google でログインしてください。</p>
<p><a class="btn" href="${loginUrl('/column/join')}">Google でログイン</a></p>`);
  }
  if (!hasProfile(user)) return redirect(`/column/settings?first=1&next=${encodeURIComponent('/column/join')}`);
  if (canWrite(user, env)) {
    return render(`<h1 class="title">書き手になっています</h1><p class="sub">さっそく書いてみましょう。</p><p><a class="btn" href="/column/write">書く</a></p>`);
  }
  let error = '';
  let code = '';
  if (request.method === 'POST') {
    if (!sameOrigin(request, url)) return htmlResponse('', 403);
    const f = await readForm(request);
    code = (f?.get('code') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (f?.get('terms') !== 'on') error = '利用規約と投稿のルールに同意してください';
    else if (!code) error = '招待コードを入れてください';
    else {
      const t = now();
      const used = await env.COLUMN_DB.prepare(
        'UPDATE invites SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL AND (expires_at IS NULL OR expires_at > ?)',
      )
        .bind(user.id, t, code, t)
        .run();
      if (used.meta.changes === 1) {
        await env.COLUMN_DB.prepare("UPDATE users SET role = 'writer', terms_at = ? WHERE id = ?").bind(t, user.id).run();
        return redirect('/column/write');
      }
      error = 'この招待コードは使えません（まちがい・使用済み・期限切れ）';
    }
  }
  return render(
    `<form method="post" action="/column/join">
<div class="sheet-head"><a href="/column">キャンセル</a><span>書き手になる</span><button type="submit">次へ</button></div>
${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
<p class="group-label">招待コード</p>
<div class="group"><div class="row"><input type="text" name="code" value="${esc(code)}" maxlength="20" autocomplete="off" autocapitalize="characters" aria-label="招待コード" placeholder="ABCD2345" class="mono" style="text-align:left"></div></div>
<div class="group" style="margin-top:24px"><label class="check"><input type="checkbox" name="terms"><span><a href="/column/terms" target="_blank">利用規約と投稿のルール</a>を読んで、同意します。</span></label></div>
</form>`,
    error ? 400 : 200,
  );
}
