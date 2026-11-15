import { activityCatalog } from '../data/activityCatalog.js';
export const activityFavoritesKey = 'hitori-room:activity-favorites:v1';
const ids = new Set(activityCatalog.map(card => card.id));
export function validateActivityFavorites(value) {
  if (!Array.isArray(value) || value.length > 100) throw new Error('常用活动记录无法读取。');
  return [...new Set(value.filter(id => typeof id === 'string' && ids.has(id)))];
}
export function readActivityFavorites(storage = globalThis.localStorage) {
  try { return validateActivityFavorites(JSON.parse(storage.getItem(activityFavoritesKey) || '[]')); } catch { return []; }
}
export function writeActivityFavorites(value, storage = globalThis.localStorage) {
  const next = validateActivityFavorites(value); storage.setItem(activityFavoritesKey, JSON.stringify(next));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('hitori:activity-favorites'));
  return next;
}
export function toggleActivityFavorite(id, storage = globalThis.localStorage) {
  if (!ids.has(id)) throw new Error('这个活动暂不能加入常用。');
  const list = readActivityFavorites(storage);
  return writeActivityFavorites(list.includes(id) ? list.filter(item => item !== id) : [...list, id], storage);
}
export function moveActivityFavorite(id, offset, storage = globalThis.localStorage) {
  const list = readActivityFavorites(storage), index = list.indexOf(id), target = index + offset;
  if (index >= 0 && target >= 0 && target < list.length) [list[index], list[target]] = [list[target], list[index]];
  return writeActivityFavorites(list, storage);
}
