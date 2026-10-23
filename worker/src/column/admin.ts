// 運営の画面（/column/admin）。通報の確認・非表示と戻し。運営（COLUMN_ADMIN_EMAILS）だけが開ける
import { isAdmin, type User } from './auth';
import { page } from './layout';
import { ago } from './read';
import { esc, htmlResponse, now, readForm, redirect, sameOrigin } from './util';

type Target = 'article' | 'comment' | 'user';

interface ReportRow {
  id: string;
  target_type: Target;
  target_id: string;
  reason: string;
  created_at: number;
  reporter: string | null;
}

/** 通報された相手の見出し（何が通報されたか・いま非表示か・見に行くリンク） */
async function describe(db: D1Database, type: Target, id: string): Promise<{ label: string; href: string; hidden: boolean } | null> {
  if (type === 'article') {
    const a = await db.prepare('SELECT id, title, hidden FROM articles WHERE id = ?').bind(id).first<{ id: string; title: string; hidden: number }>();
    return a ? { label: `記事「${a.title || '無題'}」`, href: `/column/p/${a.id}`, hidden: !!a.hidden } : null;
  }
  if (type === 'comment') {
    const c = await db.prepare('SELECT id, article_id, body, hidden FROM comments WHERE id = ?').bind(id).first<{ id: string; article_id: string; body: string; hidden: number }>();
    return c ? { label: `コメント「${c.body.slice(0, 40)}」`, href: `/column/p/${c.article_id}#c-${c.id}`, hidden: !!c.hidden } : null;
  }
  const u = await db.prepare('SELECT handle, pen_name, hidden FROM users WHERE id = ?').bind(id).first<{ handle: string; pen_name: string; hidden: number }>();
  return u ? { label: `書き手「${u.pen_name ?? '（未設定）'}」`, href: `/column/u/${u.handle}`, hidden: !!u.hidden } : null;
}

/** 非表示にする・戻す。コメントの数は数え直す */
async function setHidden(db: D1Database, type: Target, id: string, hidden: boolean): Promise<void> {
  const v = hidden ? 1 : 0;
  if (type === 'article') await db.prepare('UPDATE articles SET hidden = ? WHERE id = ?').bind(v, id).run();
  else if (type === 'user') {
    // 非表示にした人はログインも切る（書きこめなくする）
    await db.batch([
      db.prepare('UPDATE users SET hidden = ? WHERE id = ?').bind(v, id),
      ...(hidden ? [db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id)] : []),
    ]);
  } else {
    const c = await db.prepare('SELECT article_id FROM comments WHERE id = ?').bind(id).first<{ article_id: string }>();
    await db.batch([
      db.prepare('UPDATE comments SET hidden = ? WHERE id = ?').bind(v, id),
      ...(c ? [db.prepare('UPDATE articles SET comment_count = (SELECT COUNT(*) FROM comments WHERE article_id = ?1 AND hidden = 0) WHERE id = ?1').bind(c.article_id)] : []),
    ]);
  }
  console.log(JSON.stringify({ message: 'column moderation', type, hidden }));
}

export async function admin(request: Request, env: Env, url: URL, user: User | null): Promise<Response | null> {
  if (!isAdmin(user, env)) return null;
  const db = env.COLUMN_DB;
  const p = url.pathname;

  if (request.method === 'POST') {
    if (!sameOrigin(request, url)) return htmlResponse('', 403);
    const f = await readForm(request);
    if (!f) return htmlResponse('', 413);
    if (p === '/column/admin/moderate') {
      const type = f.get('type') as Target;
      const id = f.get('id') ?? '';
      if (!['article', 'comment', 'user'].includes(type) || !id) return htmlResponse('', 400);
      if (f.get('action') === 'hide' || f.get('action') === 'show') await setHidden(db, type, id, f.get('action') === 'hide');
      // 同じ相手への通報は、まとめて対応済みにする
      if (f.get('resolve') === '1' || f.get('action') === 'hide') {
        await db.prepare('UPDATE reports SET resolved_at = ? WHERE target_type = ? AND target_id = ? AND resolved_at IS NULL').bind(now(), type, id).run();
      }
      return redirect('/column/admin');
    }
    return htmlResponse('', 404);
  }

  const reports = await db
    .prepare(
      `SELECT r.id, r.target_type, r.target_id, r.reason, r.created_at, u.pen_name AS reporter
       FROM reports r LEFT JOIN users u ON u.id = r.reporter_id WHERE r.resolved_at IS NULL ORDER BY r.created_at DESC LIMIT 100`,
    )
    .all<ReportRow>();
  const reportRows = await Promise.all(
    reports.results.map(async (r) => {
      const d = await describe(db, r.target_type, r.target_id);
      const form = (action: string, label: string, extra = '') =>
        `<form method="post" action="/column/admin/moderate" style="display:inline"><input type="hidden" name="type" value="${esc(r.target_type)}"><input type="hidden" name="id" value="${esc(r.target_id)}"><input type="hidden" name="action" value="${action}">${extra}<button class="link-btn small-inline" type="submit">${label}</button></form>`;
      return `<tr><td>${ago(r.created_at)}</td><td>${d ? `<a href="${esc(d.href)}" target="_blank">${esc(d.label)}</a>${d.hidden ? ' <span class="badge">非表示中</span>' : ''}` : '（消えています）'}</td><td>${esc(r.reason)}<br><span style="color:var(--mute);font-size:13px">${esc(r.reporter ?? '（退会）')}</span></td>
<td>${d && !d.hidden ? form('hide', '非表示にする') : ''} ${form('none', '問題なし', '<input type="hidden" name="resolve" value="1">')}</td></tr>`;
    }),
  );

  // 非表示にしているもの（戻すため）
  const hidden = await db
    .prepare(
      `SELECT 'article' AS type, id, title AS label FROM articles WHERE hidden = 1
       UNION ALL SELECT 'comment', id, substr(body, 1, 40) FROM comments WHERE hidden = 1
       UNION ALL SELECT 'user', id, COALESCE(pen_name, '（未設定）') FROM users WHERE hidden = 1 LIMIT 100`,
    )
    .all<{ type: Target; id: string; label: string }>();

  const typeName = { article: '記事', comment: 'コメント', user: '書き手' };
  const body = `<h1 class="title">運営</h1>
<p class="group-label">通報（未対応 ${reportRows.length} 件）</p>
${reportRows.length ? `<table class="table"><thead><tr><th>いつ</th><th>対象</th><th>理由・通報した人</th><th></th></tr></thead><tbody>${reportRows.join('')}</tbody></table>` : '<p class="group-note">未対応の通報はありません</p>'}

<p class="group-label">非表示にしているもの</p>
${
  hidden.results.length
    ? `<table class="table"><tbody>${hidden.results
        .map(
          (h) =>
            `<tr><td>${typeName[h.type]}</td><td>${esc(h.label)}</td><td><form method="post" action="/column/admin/moderate"><input type="hidden" name="type" value="${h.type}"><input type="hidden" name="id" value="${esc(h.id)}"><input type="hidden" name="action" value="show"><button class="link-btn small-inline" type="submit">表示に戻す</button></form></td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p class="group-note">ありません</p>'
}`;
  return htmlResponse(page({ title: '運営', noindex: true, grouped: true }, body, user, env, url.pathname));
}
