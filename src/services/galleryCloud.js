import { validateGalleryConfig } from './galleryCloudConfig.js';
import { fetchAuthWithDeadline, withCloudDeadline } from './cloudConnection.js';

const url = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const bucket = 'gallery-uploads';
export const cloudConfigured = validateGalleryConfig(url, key);
let clientPromise;
export async function getCloudClient() {
  if (!cloudConfigured) return null;
  if (!clientPromise) clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'hitori-room:owner-session:v1' },
    global: { fetch: (input, options) => String(input instanceof Request ? input.url : input).includes('/auth/v1/')
      ? fetchAuthWithDeadline(input, options) : fetch(input, options) }
  })).catch(error => { clientPromise = undefined; throw error; });
  return clientPromise;
}
export async function isGalleryAdmin(signal) {
  const client = await getCloudClient();
  if (!client) return false;
  const { data: { user }, error } = await client.auth.getUser();
  if (error) throw error;
  if (!user) return false;
  const query = client.from('gallery_admins').select('user_id').eq('user_id', user.id);
  if (signal) query.abortSignal(signal);
  const result = await query.maybeSingle();
  if (result.error) throw Object.assign(new Error('无法验证上传权限，请检查服务配置或稍后重试。'), { status: result.status, code: result.error.code });
  return !!result.data;
}
const safePath = path => typeof path === 'string' && /^[a-f0-9-]+\/[a-f0-9-]+(?:-thumb|-preview)?\.(?:jpg|png|webp)$/.test(path);
function publicImage(path) { return `${url}/storage/v1/object/public/${bucket}/${path}`; }
export const galleryMetadataCacheKey = `${url}:gallery:v2`;
export function cloudImage(row) {
  if (!row || !safePath(row.object_path) || (row.thumbnail_path && !safePath(row.thumbnail_path)) || (row.preview_path && !safePath(row.preview_path))) return null;
  return {
    id: `cloud-${row.id}`, category: row.category || 'collection', title: row.title, alt: row.alt || row.title,
    credit: row.credit || '站主上传', creator: row.creator || '', sourceUrl: row.source_url || '',
    subtitle: '站主收藏 · 新收录', tag: row.category === 'illustration' ? '同人插画' : row.category === 'poster' ? '设计海报' : '站主收藏',
    ...(Array.isArray(row.characters) ? { characters: row.characters } : {}), tags: Array.isArray(row.tags) ? row.tags : [],
    width: row.width, height: row.height, src: publicImage(row.preview_path || row.object_path),
    preview: row.preview_path ? publicImage(row.preview_path) : '',
    originalSrc: publicImage(row.object_path), thumbnail: publicImage(row.thumbnail_path || row.preview_path || row.object_path),
    sortOrder: Number.isFinite(row.sort_order) ? row.sort_order : 0, createdAt: row.created_at || '', cloudManaged: true
  };
}
let legacySchema = false;
const headers = () => ({ apikey: key, ...(!key.startsWith('sb_publishable_') ? { Authorization: `Bearer ${key}` } : {}) });
async function publicRows(params, signal) {
  return withCloudDeadline(async requestSignal => {
    const response = await fetch(`${url}/rest/v1/gallery_uploads?${params}`, { headers: headers(), signal: requestSignal });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw Object.assign(new Error('Cloud gallery unavailable'), { status: response.status, code: detail.code, detail: detail.message });
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('收藏数据格式不正确。');
    return rows;
  }, { signal });
}
function schemaMissing(error) { return ['42703', 'PGRST204'].includes(error?.code); }
export async function loadCloudGalleryPage({ cursor = null, limit = 36, signal } = {}) {
  if (!cloudConfigured) return { items: [], cursor: null, hasMore: false };
  // Another concurrent share lookup can discover an old schema first.
  // Retry according to the fields THIS request used, not the current shared flag.
  const usedLegacySchema = legacySchema;
  const count = Math.max(1, Math.min(100, Math.trunc(limit)));
  const params = new URLSearchParams({ select: '*', order: usedLegacySchema ? 'created_at.desc,id.desc' : 'sort_order.asc,created_at.desc,id.desc', limit: String(count + 1) });
  if (!usedLegacySchema) params.set('published', 'eq.true');
  // Keyset pagination avoids shifting offsets when a new image is published.
  if (cursor) {
    if (usedLegacySchema) params.set('or', `(created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id}))`);
    else params.set('or', `(sort_order.gt.${cursor.sortOrder},and(sort_order.eq.${cursor.sortOrder},created_at.lt.${cursor.createdAt}),and(sort_order.eq.${cursor.sortOrder},created_at.eq.${cursor.createdAt},id.lt.${cursor.id}))`);
  }
  let rows;
  try { rows = await publicRows(params, signal); }
  catch (error) {
    if (!usedLegacySchema && schemaMissing(error)) { legacySchema = true; return loadCloudGalleryPage({ cursor, limit, signal }); }
    throw error;
  }
  const hasMore = rows.length > count;
  const visible = rows.slice(0, count);
  const last = visible.at(-1);
  return { items: visible.map(cloudImage).filter(Boolean), hasMore,
    cursor: hasMore && last ? { id: last.id, createdAt: last.created_at, sortOrder: last.sort_order || 0 } : null,
    legacySchema };
}
export async function findCloudGalleryImage(id, signal) {
  if (!cloudConfigured || !/^cloud-[a-f0-9-]{36}$/.test(id)) return null;
  const usedLegacySchema = legacySchema;
  const params = new URLSearchParams({ select: '*', id: `eq.${id.slice(6)}`, limit: '1' });
  if (!usedLegacySchema) params.set('published', 'eq.true');
  let rows;
  try { rows = await publicRows(params, signal); }
  catch (error) {
    if (!usedLegacySchema && schemaMissing(error)) { legacySchema = true; return findCloudGalleryImage(id, signal); }
    throw error;
  }
  return cloudImage(rows[0]);
}
// Kept for the full-site search contract: callers explicitly need every page.
export async function loadCloudGallery(signal, onBatch = () => {}) {
  const records = new Map();
  let cursor = null;
  do {
    const page = await loadCloudGalleryPage({ cursor, signal, limit: 100 });
    for (const item of page.items) records.set(item.id, item);
    onBatch([...records.values()], page.hasMore);
    if (!page.hasMore) break;
    cursor = page.cursor;
  } while (cursor);
  return [...records.values()];
}
export { publishGalleryImage } from './galleryManagement.js';
