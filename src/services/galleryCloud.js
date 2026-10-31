import { validateGalleryConfig } from './galleryCloudConfig.js';
import { validateUploadFile, validateImageSignature, validateImageDimensions, validateGalleryText } from './galleryUploadRules.js';

const url = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const bucket = 'gallery-uploads';
export const cloudConfigured = validateGalleryConfig(url, key);
let clientPromise;
export async function getCloudClient() {
  if (!cloudConfigured) return null;
  if (!clientPromise) clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'hitori-room:owner-session:v1' }
  }));
  return clientPromise;
}
export async function isGalleryAdmin() {
  const client = await getCloudClient();
  if (!client) return false;
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return false;
  const result = await client.from('gallery_admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (result.error) throw new Error('无法验证上传权限，请检查服务配置或稍后重试。');
  return !!result.data;
}
const safePath = path => typeof path === 'string' && /^[a-f0-9-]+\/[a-f0-9-]+(?:-thumb)?\.(?:jpg|png|webp)$/.test(path);
function publicImage(path) { return `${url}/storage/v1/object/public/${bucket}/${path}`; }
export function cloudImage(row) {
  if (!row || !safePath(row.object_path) || (row.thumbnail_path && !safePath(row.thumbnail_path))) return null;
  return {
    id: `cloud-${row.id}`, category: 'collection', title: row.title, alt: row.alt || row.title,
    credit: row.credit || '站主上传', subtitle: '站主收藏 · 新收录', tag: '站主收藏',
    width: row.width, height: row.height, src: publicImage(row.object_path),
    originalSrc: publicImage(row.object_path), thumbnail: publicImage(row.thumbnail_path || row.object_path)
  };
}
export async function loadCloudGallery(signal) {
  if (!cloudConfigured) return [];
  // 访客仅发匿名读取请求，不加载登录 SDK，不修改站主会话。
  const records = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(`${url}/rest/v1/gallery_uploads?select=id,object_path,thumbnail_path,title,alt,credit,width,height&order=created_at.desc,id.desc&limit=${pageSize}&offset=${offset}`, {
      headers: { apikey: key, ...(!key.startsWith('sb_publishable_') ? { Authorization: `Bearer ${key}` } : {}) }, signal
    });
    if (!response.ok) throw new Error('新上传的收藏暂时无法加载，原有收藏仍可浏览。');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('收藏数据格式不正确。');
    records.push(...rows.map(cloudImage).filter(Boolean));
    if (rows.length < pageSize) return records;
  }
}
async function prepareImage(file) {
  await validateImageSignature(file);
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('这张图片无法解码，请重新保存后上传。'); }
  try {
    const { width, height } = bitmap;
    validateImageDimensions(width, height);
    const ratio = Math.min(1, 640 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const thumbnail = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .87));
    if (!thumbnail) throw new Error('无法生成图片预览，请换一个浏览器重试。');
    return { width, height, thumbnail, thumbnailExtension: thumbnail.type === 'image/webp' ? 'webp' : 'png' };
  } finally { bitmap.close(); }
}
export async function publishGalleryImage({ file, title, alt, credit, onProgress = () => {} }) {
  const extension = validateUploadFile(file);
  const text = validateGalleryText({ title, alt, credit });
  onProgress('正在准备图片…');
  const prepared = await prepareImage(file);
  const client = await getCloudClient();
  if (!client || !await isGalleryAdmin()) throw new Error('只有站主可以上传，请重新登录。');
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('登录已过期，请重新登录。');
  const id = crypto.randomUUID();
  const original = `${user.id}/${id}.${extension}`;
  const thumb = `${user.id}/${id}-thumb.${prepared.thumbnailExtension}`;
  const storage = client.storage.from(bucket);
  const uploaded = [];
  let inserting = false;
  const row = { id, owner_id: user.id, object_path: original, thumbnail_path: thumb, ...text, width: prepared.width, height: prepared.height };
  try {
    onProgress('正在上传原图…');
    let result = await storage.upload(original, file, { contentType: file.type, upsert: false });
    if (result.error) throw result.error;
    uploaded.push(original);
    onProgress('正在上传预览…');
    result = await storage.upload(thumb, prepared.thumbnail, { contentType: prepared.thumbnail.type, upsert: false });
    if (result.error) throw result.error;
    uploaded.push(thumb);
    onProgress('正在发布到收藏区…');
    inserting = true;
    result = await client.from('gallery_uploads').insert(row);
    if (result.error) throw result.error;
    return cloudImage(row);
  } catch {
    // 数据提交与存储不在同一事务：先查验提交结果，避免网络丢包后误删已发布原图。
    if (inserting) {
      const check = await client.from('gallery_uploads').select('id').eq('id', id).maybeSingle();
      if (check.data) return cloudImage(row);
      if (check.error) throw new Error('发布结果暂时无法确认，请稍后查看收藏区再决定是否重试。');
    }
    if (uploaded.length) {
      const cleanup = await storage.remove(uploaded);
      if (cleanup.error) throw new Error('未能发布，部分文件可能已上传。请在存储中检查后重试。');
    }
    throw new Error('上传未完成，请检查网络和上传权限后重试。');
  }
}
