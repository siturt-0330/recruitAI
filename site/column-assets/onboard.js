// 登録・プロフィールの画面の動き。上の見本を打ったそばから変え、立場の候補を押すと入力欄に入れる
const $ = (sel) => document.querySelector(sel);

const name = $('#pen_name');
const status = $('#status_line');
const pvName = $('[data-pv-name]');
const pvStatus = $('[data-pv-status]');
const pvAv = $('[data-pv-av]');

function show(el, value) {
  if (!el) return;
  el.textContent = value || el.dataset.empty;
  el.classList.toggle('is-empty', !value);
}

name?.addEventListener('input', () => show(pvName, name.value.trim()));
show(pvName, name?.value.trim());

// 立場：年（26卒など）と文系・理系を押すと「27卒・文系」の形で入る。手で打てば候補の選択は外れる
const picks = [...document.querySelectorAll('[data-picks] .pick')];
const picked = (kind) => picks.find((b) => b.dataset[kind] && b.getAttribute('aria-pressed') === 'true')?.dataset[kind] ?? '';
function syncPicks() {
  const v = status?.value ?? '';
  picks.forEach((b) => b.setAttribute('aria-pressed', String(v.split('・').includes(b.dataset.year || b.dataset.kind))));
}
picks.forEach((b) =>
  b.addEventListener('click', () => {
    const kind = b.dataset.year ? 'year' : 'kind';
    const on = b.getAttribute('aria-pressed') !== 'true';
    picks.filter((x) => x.dataset[kind]).forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', String(on));
    status.value = [picked('year'), picked('kind')].filter(Boolean).join('・');
    show(pvStatus, status.value);
  }),
);
status?.addEventListener('input', () => {
  syncPicks();
  show(pvStatus, status.value.trim());
});
syncPicks();
show(pvStatus, status?.value.trim());

// アイコンの色
document.querySelectorAll('input[name="icon_color"]').forEach((r) =>
  r.addEventListener('change', () => {
    if (pvAv && r.checked) pvAv.style.background = r.value;
  }),
);
