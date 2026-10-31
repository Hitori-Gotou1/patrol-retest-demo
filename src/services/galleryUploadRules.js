export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export function validateUploadFile(file) {
  if (!file || !Object.hasOwn(types, file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片。');
  if (!file.size || file.size > MAX_UPLOAD_BYTES) throw new Error('每张图片需大于 0 字节且不超过 10 MB。');
  return types[file.type];
}
export function validateImageDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_IMAGE_PIXELS)
    throw new Error('图片尺寸过大，请使用不超过 4000 万像素的版本。');
}
export function validateGalleryText({ title, alt = '', credit = '' }) {
  const result = { title: String(title || '').trim(), alt: String(alt).trim(), credit: String(credit).trim() };
  if (!result.title || result.title.length > 120) throw new Error('请填写 1–120 字的标题。');
  if (result.alt.length > 300 || result.credit.length > 200) throw new Error('图片描述最多 300 字，来源最多 200 字。');
  return result;
}
export async function validateImageSignature(file) {
  validateUploadFile(file);
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = [137,80,78,71,13,10,26,10].every((v, i) => b[i] === v);
  const jpg = b[0] === 255 && b[1] === 216 && b[2] === 255;
  const webp = String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WEBP';
  if (!({ 'image/png': png, 'image/jpeg': jpg, 'image/webp': webp })[file.type]) throw new Error('文件内容与图片格式不符，请重新导出为 JPG、PNG 或 WebP。');
}
