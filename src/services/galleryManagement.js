import { validateUploadFile, validateGalleryText } from './galleryUploadRules.js';
import { validateGalleryMetadata, validateCollection } from './galleryMetadata.js';
import { galleryFileDigest, prepareGalleryImage } from './galleryImagePreparation.js';
import { clearGalleryMetadataCache } from './galleryPager.js';
function galleryChanged() { clearGalleryMetadataCache(); if (typeof window !== 'undefined') window.dispatchEvent(new Event('hitori:gallery-changed')); }

const defaultClient = async () => (await import('./galleryCloud.js')).getCloudClient();
const cleanQuery = text => String(text || '').trim().slice(0, 100).replace(/[(),]/g, ' ').replace(/[\\%_]/g, '\\$&');
const throwResult = result => {
  if (result.error) {
    if (['42703','42P01','PGRST202','PGRST204','PGRST205'].includes(result.error.code)) throw new Error('图库工作台的数据结构尚未升级，请站主执行 gallery-upgrade.sql；原有收藏仍可浏览。');
    throw result.error;
  }
  return result;
};
export function createGalleryManager(getClient = defaultClient, { prepare = prepareGalleryImage, digestFile = galleryFileDigest } = {}) {
  async function client() {
    const connection = await getClient();
    if (!connection) throw new Error('云端图库尚未配置。');
    return connection;
  }
  async function owner(connection) {
    const { data, error } = await connection.auth.getUser();
    if (error || !data.user) throw new Error('登录已过期，请重新登录。');
    const result = await connection.from('gallery_admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (result.error || !result.data) throw new Error('只有站主可以管理图库。');
    return data.user.id;
  }
  return {
    async list({ page = 1, pageSize = 12, query = '', published = 'all', category = 'all' } = {}) {
      const connection = await client();
      const ownerId = await owner(connection);
      let request = connection.from('gallery_uploads').select('*', { count: 'exact' }).eq('owner_id', ownerId);
      const term = cleanQuery(query);
      if (term) request = request.or(`title.ilike.%${term}%,alt.ilike.%${term}%,credit.ilike.%${term}%,creator.ilike.%${term}%`);
      if (published !== 'all') request = request.eq('published', published === 'published');
      if (category !== 'all') request = request.eq('category', category);
      const start = (Math.max(1, page) - 1) * pageSize;
      const result = throwResult(await request.order('sort_order').order('created_at', { ascending: false }).order('id').range(start, start + pageSize - 1));
      return { rows: result.data || [], count: result.count || 0 };
    },
    async update(id, input) {
      const connection = await client();
      await owner(connection);
      const sort_order = Number(input.sort_order || 0);
      if (!Number.isInteger(sort_order) || Math.abs(sort_order) > 1_000_000) throw new Error('展示顺序需为 -1000000 至 1000000 的整数。');
      const updates = { ...validateGalleryText(input), ...validateGalleryMetadata(input), sort_order, published: input.published !== false };
      const result = throwResult(await connection.from('gallery_uploads').update(updates).eq('id', id).select('*').single());
      galleryChanged();
      return result.data;
    },
    async duplicate(digest) {
      const connection = await client();
      await owner(connection);
      const result = throwResult(await connection.from('gallery_uploads').select('id,title,published').eq('content_sha256', digest).maybeSingle());
      return result.data;
    },
    async publish({ file, title, alt = '', credit = '', onProgress = () => {}, signal, uploadId, digest, ...metadata }) {
      const extension = validateUploadFile(file);
      const text = validateGalleryText({ title, alt, credit });
      const fields = validateGalleryMetadata(metadata);
      const connection = await client();
      const owner_id = await owner(connection);
      const id = uploadId || crypto.randomUUID();
      // Retries reuse their ID. A lost success response must never create a second record.
      const previous = throwResult(await connection.from('gallery_uploads').select('*').eq('id', id).maybeSingle());
      if (previous.data) { galleryChanged(); return previous.data; }
      const content_sha256 = digest || await digestFile(file);
      const duplicate = throwResult(await connection.from('gallery_uploads').select('id,title').eq('content_sha256', content_sha256).maybeSingle());
      if (duplicate.data) throw new Error(`与已上传的「${duplicate.data.title}」内容相同，请在已发布列表中编辑或恢复。`);
      onProgress('正在生成缩略图和适屏预览…');
      const prepared = await prepare(file, signal);
      // Resource IDs are unique per attempt; an ambiguous storage response can be
      // cleaned without touching resources from a previous retry or published row.
      const resourceId = crypto.randomUUID();
      const original = `${owner_id}/${resourceId}.${extension}`;
      const thumb = `${owner_id}/${resourceId}-thumb.${prepared.thumbnail.extension}`;
      const preview = prepared.preview ? `${owner_id}/${resourceId}-preview.${prepared.preview.extension}` : original;
      const storage = connection.storage.from('gallery-uploads');
      const uploaded = [];
      let inserting = false;
      const row = { id, owner_id, object_path: original, thumbnail_path: thumb, preview_path: preview,
        ...text, ...fields, width: prepared.width, height: prepared.height, published: true, sort_order: 0, content_sha256 };
      try {
        const objects = [
          [original, file, '正在上传原图…'], [thumb, prepared.thumbnail.blob, '正在上传缩略图…'],
          ...(prepared.preview ? [[preview, prepared.preview.blob, '正在上传适屏预览…']] : [])
        ];
        for (const [path, blob, label] of objects) {
          signal?.throwIfAborted();
          onProgress(label);
          uploaded.push(path);
          throwResult(await storage.upload(path, blob, { contentType: blob.type, upsert: false }));
        }
        signal?.throwIfAborted();
        onProgress('正在发布到收藏区…');
        inserting = true;
        throwResult(await connection.from('gallery_uploads').insert(row));
        galleryChanged();
        return row;
      } catch (cause) {
        if (inserting) {
          const check = await connection.from('gallery_uploads').select('*').eq('id', id).maybeSingle();
          if (check.data) { galleryChanged(); return check.data; }
          if (check.error) throw new Error('发布结果暂时无法确认。请先刷新已发布列表；再次重试会使用相同编号，不会重复收录。');
        }
        // These are only freshly generated paths attempted by this call, never old resources.
        if (uploaded.length) {
          const cleanup = await storage.remove(uploaded);
          if (cleanup.error) throw new Error(`发布失败且临时文件清理未完成，请按任务编号 ${id} 在存储中核查后重试。`);
        }
        throw new Error(cause?.message || '上传未完成，请检查网络和权限后重试。');
      }
    },
    async collections({ ownerOnly = false } = {}) {
      const connection = await client();
      const ownerId = ownerOnly ? await owner(connection) : null;
      let request = connection.from('gallery_collections').select('*,gallery_collection_items(image_id,sort_order)');
      if (ownerId) request = request.eq('owner_id', ownerId);
      else request = request.eq('published', true);
      const result = throwResult(await request.order('sort_order').order('created_at', { ascending: false }));
      return (result.data || []).map(row => ({ ...row, imageIds: [...(row.gallery_collection_items || [])].sort((a, b) => a.sort_order - b.sort_order).map(item => item.image_id) }));
    },
    async saveCollection(id, input) {
      const connection = await client();
      await owner(connection);
      const fields = validateCollection(input);
      const { imageIds, ...collection } = fields;
      const result = throwResult(await connection.rpc('gallery_save_collection', { collection_id: id || crypto.randomUUID(), details: collection, image_ids: imageIds }));
      return result.data;
    },
    async deleteCollection(id) {
      const connection = await client();
      await owner(connection);
      throwResult(await connection.from('gallery_collections').delete().eq('id', id));
    }
  };
}
export const galleryManager = createGalleryManager();
export async function publishGalleryImage(input) {
  const row = await galleryManager.publish(input);
  const { cloudImage } = await import('./galleryCloud.js');
  return cloudImage(row);
}
