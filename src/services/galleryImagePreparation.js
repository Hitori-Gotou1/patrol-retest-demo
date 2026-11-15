import { validateImageSignature, validateImageDimensions } from './galleryUploadRules.js';
export function imageResize(width, height, longEdge) {
  const ratio = Math.min(1, longEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
export async function galleryFileDigest(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}
async function derivative(bitmap, file, edge, quality) {
  const size = imageResize(bitmap.width, bitmap.height, edge);
  const canvas = document.createElement('canvas');
  Object.assign(canvas, size);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法创建图片画布。');
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  // JPEG has no alpha; PNG/WebP use WebP so transparency survives compression.
  const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
  const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
  canvas.width = canvas.height = 1;
  if (!blob) throw new Error('无法生成图片预览，请换一个浏览器重试。');
  return { blob, extension: blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png', ...size };
}
export async function prepareGalleryImage(file, signal) {
  await validateImageSignature(file);
  signal?.throwIfAborted();
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('这张图片无法解码，请重新保存后上传。'); }
  try {
    const { width, height } = bitmap;
    validateImageDimensions(width, height);
    const thumbnail = await derivative(bitmap, file, 640, .84);
    signal?.throwIfAborted();
    const preview = Math.max(width, height) > 1920 ? await derivative(bitmap, file, 1920, .9) : null;
    signal?.throwIfAborted();
    return { width, height, thumbnail, preview };
  } finally { bitmap.close(); }
}
