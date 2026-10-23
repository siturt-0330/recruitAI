// 画像をブラウザで縮めてからアップロードする（長辺 1600px の WebP。WebP にできないブラウザは JPEG）
import { api } from './api';

const MAX_SIDE = 1600;
const MAX_BYTES = 4.5 * 1024 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function shrink(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('JPEG・PNG・WebP の画像を選んでください');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const draw = (fill: boolean) => {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // JPEG は透明にできないので、白で塗ってから描く
    if (fill) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  };
  draw(false);
  for (const q of [0.85, 0.7, 0.55]) {
    const webp = await toBlob(canvas, 'image/webp', q);
    if (webp && webp.type === 'image/webp' && webp.size <= MAX_BYTES) return webp;
    if (webp && webp.type === 'image/webp') continue;
    break;
  }
  draw(true);
  for (const q of [0.85, 0.7, 0.55]) {
    const jpeg = await toBlob(canvas, 'image/jpeg', q);
    if (jpeg && jpeg.size <= MAX_BYTES) return jpeg;
  }
  throw new Error('画像が大きすぎます');
}

/** 画像を縮めてアップロードし、R2 の key を返す */
export async function uploadImage(file: File): Promise<string> {
  if (!/^image\//.test(file.type)) throw new Error('画像を選んでください');
  const blob = await shrink(file);
  const { key } = await api.upload(blob);
  return key;
}

/** ファイルを選ぶ画面を開く（キャンセルなら null） */
export function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/heic';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
