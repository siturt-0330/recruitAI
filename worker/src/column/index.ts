// コラム（/column 以下）の振り分け。読むページはここで HTML を組み立てて返す（検索に載るように）。
import { admin, deleteAccount, join, settings } from './account';
import { canWrite, currentUser, devLogin, googleCallback, logout, startGoogle, type User } from './auth';
import { page } from './layout';
import { htmlResponse } from './util';

function notFound(user: User | null, env: Env, path: string): Response {
  const body = `<h1 class="title">ページが見つかりません</h1><p class="sub">消されたか、URL がまちがっているかもしれません。</p><p><a href="/column">コラムのトップへ</a></p>`;
  return htmlResponse(page({ title: 'ページが見つかりません', noindex: true }, body, user, env, path), 404);
}

/** コラムのトップ（一覧は「読むページ」で作る。いまは枠だけ） */
function home(user: User | null, env: Env, path: string): Response {
  const body = `<h1 class="title">コラム</h1>
<p class="sub">就活生が、就活の体験やコツを書き合う場所です。</p>
<p class="empty">まだ記事がありません${canWrite(user, env) ? '<br><a href="/column/write">最初の記事を書く</a>' : ''}</p>`;
  return htmlResponse(page({ title: 'コラム', canonical: '/column' }, body, user, env, path));
}

/** 利用規約と投稿のルール（中身は「運営と仕上げ」で書く） */
function terms(user: User | null, env: Env, path: string): Response {
  const body = `<h1 class="title">利用規約と投稿のルール</h1><p class="sub">準備中です。</p>`;
  return htmlResponse(page({ title: '利用規約と投稿のルール', canonical: '/column/terms' }, body, user, env, path));
}

export async function handleColumn(request: Request, env: Env, _ctx: ExecutionContext, url: URL): Promise<Response> {
  const path = url.pathname;
  // 末尾の / は付けない形にそろえる（静的なページと同じ）
  if (path.length > 1 && path.endsWith('/')) return Response.redirect(`${url.origin}${path.replace(/\/+$/, '')}${url.search}`, 301);

  // ログインまわりは、ログインしているかを調べる前に処理する
  if (path === '/column/auth/google') return startGoogle(env, url);
  if (path === '/column/auth/callback') return googleCallback(request, env, url);
  if (path === '/column/auth/logout') return logout(request, env, url);
  if (path === '/column/auth/dev') return (await devLogin(env, url)) ?? notFound(null, env, path);

  const user = await currentUser(request, env);
  if (path === '/column') return home(user, env, path);
  if (path === '/column/settings') return settings(request, env, url, user);
  if (path === '/column/settings/delete') return deleteAccount(request, env, url, user);
  if (path === '/column/join') return join(request, env, url, user);
  if (path === '/column/terms') return terms(user, env, path);
  if (path === '/column/admin' || path.startsWith('/column/admin/')) return (await admin(request, env, url, user)) ?? notFound(user, env, path);
  return notFound(user, env, path);
}
