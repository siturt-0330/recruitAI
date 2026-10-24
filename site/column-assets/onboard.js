// 登録・プロフィールの画面の動き。上の見本を打ったそばから変え、アイコンの写真を選ぶとその場でアップロードする
const $ = (sel) => document.querySelector(sel);

const name = $('#pen_name');
const pvName = $('[data-pv-name]');
const pvAv = $('[data-pv-av]');
const iconKey = $('input[name="icon_key"]');
const photoBtn = $('[data-photo]');
const removeBtn = $('[data-photo-remove]');

function show(el, value) {
  if (!el) return;
  el.textContent = value || el.dataset.empty;
  el.classList.toggle('is-empty', !value);
}

name?.addEventListener('input', () => show(pvName, name.value.trim()));
show(pvName, name?.value.trim());

/** 見本のアイコンを写真にする（key が空なら色の丸に戻す） */
function setPhoto(key) {
  if (iconKey) iconKey.value = key;
  if (pvAv) pvAv.style.backgroundImage = key ? `url(/column/img/${encodeURIComponent(key)})` : 'none';
  if (removeBtn) removeBtn.hidden = !key;
}

// アイコンの色。選び直したら写真は外す
document.querySelectorAll('input[name="icon_color"]').forEach((r) =>
  r.addEventListener('change', () => {
    if (!r.checked) return;
    if (pvAv) pvAv.style.backgroundColor = r.value;
    setPhoto('');
  }),
);

removeBtn?.addEventListener('click', () => setPhoto(''));

/** 写真を真ん中で正方形に切り抜き、400px に縮める（WebP。できなければ JPEG） */
async function squareImage(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const side = Math.min(bmp.width, bmp.height);
  const size = Math.min(400, side);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  const blob = (t, q) => new Promise((r) => canvas.toBlob(r, t, q));
  const webp = await blob('image/webp', 0.85);
  return webp && webp.type === 'image/webp' ? webp : blob('image/jpeg', 0.85);
}

photoBtn?.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp,image/heic';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const label = photoBtn.textContent;
    photoBtn.disabled = true;
    photoBtn.textContent = 'アップロード中…';
    try {
      const body = await squareImage(file);
      const res = await fetch('/column/api/icon', { method: 'POST', headers: { 'Content-Type': body.type }, body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.key) throw new Error(data.message || '');
      setPhoto(data.key);
    } catch (e) {
      alert(e.message || '写真をアップロードできませんでした');
    } finally {
      photoBtn.disabled = false;
      photoBtn.textContent = label;
    }
  };
  input.click();
});
