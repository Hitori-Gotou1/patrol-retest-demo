export function isPublicGalleryKey(value) {
  if (typeof value !== 'string') return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  try { return JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; } catch { return false; }
}
export function validateGalleryConfig(url, key) {
  if (!url && !key) return false;
  if (!url || !key) throw new Error('收藏上传配置不完整：需要项目 URL 和 Publishable key。');
  if (!/^https:\/\/[^/?#]+\/?$/.test(url)) throw new Error('收藏服务 URL 必须是 HTTPS 项目根地址。');
  if (!isPublicGalleryKey(key)) throw new Error('收藏上传只允许 Publishable key 或 legacy anon key；禁止使用 Secret / service_role key。');
  return true;
}
