// Explicit fields are shared by uploads and edits. null characters retain legacy inference.
export const galleryCategoryOptions = [
  { id: 'collection', label: '站主收藏' },
  { id: 'illustration', label: '同人插画' },
  { id: 'poster', label: '设计海报' }
];
export const galleryCharacterOptions = [
  { id: 'hitori', label: '后藤一里' }, { id: 'nijika', label: '伊地知虹夏' },
  { id: 'ryo', label: '山田凉' }, { id: 'kita', label: '喜多郁代' }
];
export const MAX_GALLERY_TAGS = 8;
export function validateGalleryMetadata(input = {}) {
  const category = String(input.category || 'collection');
  // A token, rather than a closed enum, allows a future category registry without changing rows.
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(category)) throw new Error('分类编号不正确。');
  const characters = input.characters == null ? null : input.characters;
  if (characters !== null && (!Array.isArray(characters) || characters.length > 4
    || !characters.every(value => galleryCharacterOptions.some(option => option.id === value)))) throw new Error('请选择有效角色。');
  const rawTags = typeof input.tags === 'string' ? input.tags.split(/[,，\n]/u).map(tag => tag.trim()).filter(Boolean) : (input.tags || []);
  if (!Array.isArray(rawTags) || rawTags.length > MAX_GALLERY_TAGS) throw new Error('标签最多 8 个，请用逗号分隔。');
  const tags = [...new Set(rawTags.map(tag => String(tag).normalize('NFKC').trim()))];
  if (tags.some(tag => !tag || tag.length > 20 || /[\u0000-\u001f<>]/u.test(tag))) throw new Error('每个标签需为 1–20 字，不能含控制字符或尖括号。');
  const creator = String(input.creator || '').trim();
  const source_url = String(input.source_url || input.sourceUrl || '').trim();
  if (creator.length > 120) throw new Error('作者名称最多 120 字。');
  if (source_url) {
    let parsed;
    try { parsed = new URL(source_url); } catch { throw new Error('来源网址需为完整的 http 或 https 地址。'); }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || source_url.length > 1000) throw new Error('来源网址需为有效的 http 或 https 地址。');
  }
  return { category, characters: characters === null ? null : [...new Set(characters)], tags, creator, source_url };
}
export function validateCollection(input = {}) {
  const title = String(input.title || '').trim();
  const description = String(input.description || '').trim();
  const imageIds = [...new Set(input.imageIds || [])];
  if (!title || title.length > 80) throw new Error('合集标题需为 1–80 字。');
  if (description.length > 600) throw new Error('合集简介最多 600 字。');
  if (imageIds.length > 500 || imageIds.some(id => typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,95}$/.test(id))) throw new Error('合集图片编号不正确，或超过 500 张。');
  const cover_image_id = String(input.cover_image_id || imageIds[0] || '');
  if (cover_image_id && !imageIds.includes(cover_image_id)) throw new Error('封面需选择本合集中的图片。');
  const sort_order = Number(input.sort_order || 0);
  if (!Number.isInteger(sort_order) || Math.abs(sort_order) > 1_000_000) throw new Error('展示顺序需为 -1000000 至 1000000 的整数。');
  return { title, description, cover_image_id, sort_order, published: input.published !== false, imageIds };
}
