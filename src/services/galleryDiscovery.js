export const galleryCharacters = [
  { id: 'hitori', label: '后藤一里', names: ['后藤一里', '後藤ひとり', '一里', '波奇', 'ぼっち'], latin: ['hitori', 'bocchi'] },
  { id: 'nijika', label: '伊地知虹夏', names: ['伊地知虹夏', '虹夏'], latin: ['nijika'] },
  { id: 'ryo', label: '山田凉', names: ['山田凉', '山田涼'], latin: ['ryo', 'ryou'] },
  { id: 'kita', label: '喜多郁代', names: ['喜多郁代', '喜多', '郁代'], latin: ['kita', 'ikuyo'] }
];
const normalized = value => String(value || '').normalize('NFKC').toLowerCase().trim();

// Use names actually supplied in the caption, not guesses about image pixels.
export function imageCharacters(item) {
  if (Array.isArray(item.characters)) return galleryCharacters.filter(character => item.characters.includes(character.id));
  const text = normalized(`${item.title || ''} ${item.alt || ''}`);
  if (/四位(?:\s*q\s*版)?成员/u.test(text)) return galleryCharacters;
  return galleryCharacters.filter(character => character.names.some(name => text.includes(name))
    || character.latin.some(name => new RegExp(`\\b${name}\\b`, 'u').test(text))
    || (character.id === 'ryo' && /(?:^|[、，,与和的：\s])凉(?=[、，,与和的在戴蹲坐穿举]|$)/u.test(text)));
}

export function filterGallery(items, { category = 'all', query = '', character = 'all', favoritesOnly = false } = {}, favorites = new Set()) {
  const terms = normalized(query).split(/\s+/u).filter(Boolean);
  return items.filter(item => {
    if (category !== 'all' && item.category !== category) return false;
    if (favoritesOnly && !favorites.has(item.id)) return false;
    const characters = imageCharacters(item);
    if (character === 'unmarked' ? characters.length > 0 : character !== 'all' && !characters.some(member => member.id === character)) return false;
    const text = normalized([item.title, item.subtitle, item.alt, item.credit, item.tag,
      ...characters.flatMap(member => [member.label, ...member.names, ...member.latin])].join(' '));
    return terms.every(term => text.includes(term));
  });
}

export const favoritesStorageKey = 'hitori-room:favorites:v1';
export const maxBackupBytes = 1024 * 1024;
const maxFavorites = 5000;
export const validGalleryId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,95}$/u.test(value);

function checkedIds(ids) {
  if (!Array.isArray(ids) || ids.length > maxFavorites || !ids.every(validGalleryId)) {
    throw new Error('收藏记录格式不正确，或超过 5000 条。');
  }
  return [...new Set(ids)];
}

export function readSavedFavorites(text) {
  return new Set(checkedIds(JSON.parse(text || '[]')));
}

export function createFavoritesBackup(favorites, date = new Date()) {
  return JSON.stringify({ format: 'hitori-room:favorites', version: 1, exportedAt: date.toISOString(), ids: checkedIds([...favorites]) }, null, 2) + '\n';
}

export function parseFavoritesBackup(text) {
  if (new TextEncoder().encode(text).length > maxBackupBytes) throw new Error('收藏备份不能超过 1 MiB。');
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error('无法读取收藏备份，请选择导出的 JSON 文件。'); }
  if (!backup || backup.format !== 'hitori-room:favorites' || backup.version !== 1) {
    throw new Error('这不是支持的一里小屋收藏备份。');
  }
  return new Set(checkedIds(backup.ids));
}

export function mergeFavorites(current, incoming) {
  return new Set(checkedIds([...new Set([...current, ...incoming])]));
}

export function galleryRouteImage(value) { return validGalleryId(value) ? value : ''; }
export function galleryImageLocation(id) {
  if (!validGalleryId(id)) throw new Error('图片编号不正确。');
  return { path: '/', query: { image: id }, hash: '#gallery' };
}
