// コラム（/column 以下）の振り分け。読むページはここで HTML を組み立てて返す（検索に載るように）。
import { deleteAccount, settings, welcome } from './account';
import { admin } from './admin';
import { handleApi } from './api';
import { currentUser, devLogin, googleCallback, logout, startGoogle, type User } from './auth';
import { page } from './layout';
import { article, home, image, profile, sitemap } from './read';
import { terms } from './terms';
import { htmlResponse } from './util';
import { handleWriteApi, writeShell } from './write';

function notFound(user: User | null, env: Env, path: string): Response {
  const body = `<h1 class="title">ページが見つかりません</h1><p><a href="/column">コラムへ</a></p>`;
  return htmlResponse(page({ title: 'ページが見つかりません', noindex: true }, body, user, env, path), 404);
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

  // 画像とサイトマップは、だれが見ても同じなのでログインを調べない
  if (path.startsWith('/column/img/')) return (await image(env, decodeURIComponent(path.slice('/column/img/'.length)))) ?? new Response('not found', { status: 404 });
  if (path === '/column/sitemap.xml') return sitemap(env);

  const user = await currentUser(request, env);
  if (path === '/column') return home(env, url, user);
  if (path.startsWith('/column/api/')) {
    return (await handleWriteApi(request, env, url, user)) ?? (await handleApi(request, env, url, user)) ?? new Response('not found', { status: 404 });
  }
  if (path === '/column/write' || /^\/column\/write\/[A-Za-z0-9_-]{1,40}$/.test(path)) return writeShell(url, user, env);
  let m = path.match(/^\/column\/p\/([A-Za-z0-9_-]{1,40})$/);
  if (m) return (await article(env, url, user, m[1]!)) ?? notFound(user, env, path);
  m = path.match(/^\/column\/u\/([a-z0-9_]{3,20})$/);
  if (m) return (await profile(env, url, user, m[1]!)) ?? notFound(user, env, path);
  if (path === '/column/settings') return settings(request, env, url, user);
  if (path === '/column/settings/delete') return deleteAccount(request, env, url, user);
  if (path === '/column/welcome') return welcome(request, env, url, user);
  // 招待制だったころの URL
  if (path === '/column/join') return Response.redirect(`${url.origin}/column/write`, 301);
  if (path === '/column/terms') return terms(user, env, path);
  if (path === '/column/admin' || path.startsWith('/column/admin/')) return (await admin(request, env, url, user)) ?? notFound(user, env, path);
  return notFound(user, env, path);
}
