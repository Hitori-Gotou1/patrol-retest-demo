import { exportWorks, worksKey, workTypes, draftKey, maxWorks, validateWorkEntry, shelfByteLimit } from '../room/workshelf.js';
import { favoritesStorageKey, readSavedFavorites } from './galleryDiscovery.js';
import { activityCatalog } from '../data/activityCatalog.js';
import { validatePractice, emptyPractice, practiceKey } from '../room/practice.js';
import { contentHash, recordKey } from './syncCore.js';
export const activityFavoritesKey = 'hitori-room:activity-favorites:v1';
export const rhythmBestKey = 'hitori-room:rhythm-best:v1';
export const scopeKeys = [worksKey, favoritesStorageKey, activityFavoritesKey, practiceKey, rhythmBestKey,
  ...Object.keys(workTypes).map(draftKey)];
const parse = (storage, key, fallback) => JSON.parse(storage.getItem(key) || JSON.stringify(fallback));
const validId = value => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
function checkedActivityIds(value) {
  if (!Array.isArray(value) || value.length > 100 || value.some(id => !activityCatalog.some(item => item.id === id))) throw new Error('常用活动记录格式无法读取。');
  return [...new Set(value)];
}
export function readSyncSnapshot(storage = localStorage) {
  const entries = [];
  for (const work of exportWorks(storage).works) entries.push({ space: 'work', entity_id: work.id, payload: work });
  for (const [kind, type] of Object.entries(workTypes)) {
    const raw = storage.getItem(draftKey(kind));
    if (raw) entries.push({ space: 'draft', entity_id: kind, payload: type.validate(JSON.parse(raw)) });
  }
  for (const id of readSavedFavorites(storage.getItem(favoritesStorageKey))) entries.push({ space: 'favorite', entity_id: id, payload: true });
  checkedActivityIds(parse(storage, activityFavoritesKey, [])).forEach((id, rank) => entries.push({ space: 'activity', entity_id: id, payload: { rank } }));
  const practice = validatePractice(parse(storage, practiceKey, emptyPractice));
  for (const record of practice.records) entries.push({ space: 'practice', entity_id: record.id, payload: record });
  for (const [id, score] of Object.entries(parse(storage, rhythmBestKey, {}))) {
    if (!['easy', 'normal', 'hard'].includes(id) || !Number.isSafeInteger(score) || score < 0 || score > 100000000) throw new Error('节奏最高分格式无法读取。');
    entries.push({ space: 'rhythm', entity_id: id, payload: score });
  }
  return Object.fromEntries(entries.map(row => [recordKey(row), row]));
}
export async function snapshotHashes(snapshot) {
  return Object.fromEntries(await Promise.all(Object.entries(snapshot).map(async ([key, row]) => [key, await contentHash(row.payload)])));
}
export function stageSyncSnapshot(records, storage = localStorage) {
  const active = Object.values(records).filter(record => !record.deleted);
  const raw = new Map(scopeKeys.map(key => [key, storage.getItem(key)]));
  const stage = { getItem: key => raw.get(key) ?? null, setItem: (key, value) => raw.set(key, value) };
  if (active.filter(row => row.space === 'work').length > maxWorks) throw new Error(`合并后作品架最多放 ${maxWorks} 个版本，请先整理作品再重试；本机内容未替换。`);
  // Preserve different saved IDs even when their snapshots happen to match.
  const works = active.filter(row => row.space === 'work').map(row => {
    if (row.entity_id !== row.payload?.id) throw new Error('云端作品编号不一致。');
    return validateWorkEntry(row.payload);
  });
  if (new Set(works.map(work => work.id)).size !== works.length) throw new Error('云端作品编号重复。');
  const shelfText = JSON.stringify({ version: 1, works });
  if (new TextEncoder().encode(shelfText).length > shelfByteLimit) throw new Error('合并后超出作品架现有 3 MiB 限制，请先整理作品再重试。');
  stage.setItem(worksKey, shelfText);
  for (const kind of Object.keys(workTypes)) raw.set(draftKey(kind), null);
  for (const row of active.filter(row => row.space === 'draft')) {
    if (!Object.hasOwn(workTypes, row.entity_id)) throw new Error('云端草稿类型无法读取。');
    const value = workTypes[row.entity_id].validate(row.payload);
    if (new TextEncoder().encode(JSON.stringify(value)).length > 700000) throw new Error('云端草稿超出单份大小限制。');
    raw.set(draftKey(row.entity_id), JSON.stringify(value));
  }
  const favorites = active.filter(row => row.space === 'favorite').map(row => {
    if (row.payload !== true) throw new Error('云端收藏格式不正确。');
    return row.entity_id;
  });
  raw.set(favoritesStorageKey, JSON.stringify([...readSavedFavorites(JSON.stringify(favorites))]));
  const activities = active.filter(row => row.space === 'activity').sort((a, b) => a.payload.rank - b.payload.rank).map(row => row.entity_id);
  raw.set(activityFavoritesKey, JSON.stringify(checkedActivityIds(activities)));
  const currentPractice = validatePractice(parse(storage, practiceKey, emptyPractice));
  const practiceRecords = active.filter(row => row.space === 'practice').map(row => {
    if (!validId(row.entity_id) || row.payload.id !== row.entity_id) throw new Error('云端练琴记录编号不正确。');
    const checked = validatePractice({ ...emptyPractice, records: [row.payload] }).records;
    if (checked.length !== 1) throw new Error('云端练琴记录格式无法读取，本机日志保留。');
    return checked[0];
  }).sort((a, b) => a.date.localeCompare(b.date)).slice(-365);
  const totalSeconds = Math.max(currentPractice.totalSeconds ?? currentPractice.totalMinutes * 60, practiceRecords.reduce((sum, row) => sum + (row.actualSeconds ?? row.minutes * 60), 0));
  raw.set(practiceKey, JSON.stringify(validatePractice({ ...currentPractice, records: practiceRecords,
    totalSeconds, totalMinutes: Math.floor(totalSeconds / 60), totalSessions: Math.max(currentPractice.totalSessions, practiceRecords.length) })));
  const best = {};
  for (const row of active.filter(row => row.space === 'rhythm')) {
    if (!['easy', 'normal', 'hard'].includes(row.entity_id) || !Number.isSafeInteger(row.payload) || row.payload < 0 || row.payload > 100000000) throw new Error('云端最高分格式不正确。');
    best[row.entity_id] = row.payload;
  }
  raw.set(rhythmBestKey, JSON.stringify(best));
  return raw;
}
export function applyStagedSnapshot(staged, storage = localStorage) {
  const previous = new Map([...staged.keys()].map(key => [key, storage.getItem(key)]));
  try {
    for (const [key, value] of staged) value == null ? storage.removeItem(key) : storage.setItem(key, value);
  } catch (error) {
    for (const [key, value] of previous) { try { value == null ? storage.removeItem(key) : storage.setItem(key, value); } catch { /* Original browser quota error is surfaced. */ } }
    throw new Error('本机存储不足，已尝试保留原内容。请整理现有作品后重试。', { cause: error });
  }
  if (typeof window !== 'undefined') {
    for (const [key, value] of staged) window.dispatchEvent(new StorageEvent('storage', { key, newValue: value, oldValue: previous.get(key), storageArea: storage }));
    window.dispatchEvent(new Event('hitori:works-changed'));
    window.dispatchEvent(new Event('hitori:activity-favorites'));
    window.dispatchEvent(new Event('hitori:sync-applied'));
  }
}
