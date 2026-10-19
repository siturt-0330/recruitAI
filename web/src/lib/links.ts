/**
 * 会社のページの URL。Web 版は HTML を書き出して配信するので、会社ごとのページは作れない。
 * 一覧のページ（/companies）に ID を渡して開く。full を付けると、PC でも1ページ全体で開く
 */
export const companyHref = (id: string, full = false) => `/companies?id=${encodeURIComponent(id)}${full ? '&full=1' : ''}`;
