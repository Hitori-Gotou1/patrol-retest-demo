import { validatePhoto, validateRoom, validateWalk, validateAmbient, validateConcertDraft } from './playroom.js';
import { validateComic, validateGraffiti, validateLightShow } from './creativeTools.js';
import { validatePattern } from './pattern.js';
import { validateTone } from './effects.js';

export const worksKey = 'hitori-room:workshelf:v1';
export const maxWorks = 24;
const maxShelfBytes = 3 * 1024 * 1024;
const maxBackupBytes = 5 * 1024 * 1024;
export const workTypes = {
  photobooth: { key: 'photobooth', label: '拍贴合影', icon: '▣', validate: validatePhoto, title: v => v.caption },
  decorate: { key: 'decoration', label: '房间布置', icon: '⌂', validate: validateRoom, title: () => '给小屋换一种心情' },
  comic: { key: 'comic', label: '四格漫画', icon: '▤', validate: validateComic, title: v => v.title },
  graffiti: { key: 'graffiti', label: '演出涂鸦', icon: '〰', validate: validateGraffiti, title: () => '今天的演出涂鸦' },
  lights: { key: 'lights', label: '灯光编舞', icon: '✦', validate: validateLightShow, title: v => v.name },
  studio: { key: 'studio', label: '自己的编曲', icon: '♫', validate: validatePattern, title: v => v.name },
  effects: { key: 'effects-draft', label: '吉他音色', icon: '≋', validate: validateTone, title: v => v.name },
  concert: { key: 'concert', label: '演出海报与筹备', icon: '★', validate: validateConcertDraft, title: v => v.plan.name },
  walk: { key: 'walk', label: '散步手帐', icon: '↗', validate: validateWalk, title: v => `收集了 ${v.visited.length} 枚街角印章` },
  ambient: { key: 'ambience', label: '雨夜氛围', icon: '☂', validate: v => {
    if (!v || v.version !== 1 || !Array.isArray(v.scenes)) throw new Error('氛围收藏格式无法读取。');
    return { version: 1, current: validateAmbient(v.current), scenes: v.scenes.slice(0, 6).map(validateAmbient) };
  }, title: v => v.current.name }
};
export const draftKey = kind => `hitori-room:${workTypes[kind].key}:v1`;
const bytes = value => new TextEncoder().encode(value).length;
function storageOrThrow(storage) {
  try { return storage || globalThis.localStorage; }
  catch { throw new Error('当前浏览器无法使用本机存储，请先导出作品。'); }
}
function validateEntry(value) {
  const type = workTypes[value?.kind];
  if (!type || typeof value.id !== 'string' || !/^[\w-]{1,100}$/.test(value.id) || !Number.isFinite(value.at) || value.at <= 0 || value.at > 8640000000000000) throw new Error('作品记录无法读取。');
  const snapshot = type.validate(value.snapshot);
  if (bytes(JSON.stringify(snapshot)) > 700000) throw new Error('这份作品内容较大，请使用原页面导出备份。');
  if (typeof value.preview !== 'string' || value.preview.length > 180000 || (value.preview && !/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value.preview))) throw new Error('作品预览格式无法读取。');
  return { id: value.id, kind: value.kind, at: value.at, title: String(value.title || type.title(snapshot) || type.label).slice(0, 90), snapshot, preview: value.preview };
}
function loadShelf(storage, strict = false) {
  try {
    const raw = storageOrThrow(storage).getItem(worksKey);
    if (!raw) return [];
    if (bytes(raw) > maxShelfBytes) throw new Error();
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.works) || value.works.length > maxWorks) throw new Error();
    const works = value.works.map(validateEntry);
    if (new Set(works.map(work => work.id)).size !== works.length) throw new Error();
    return works.sort((a, b) => b.at - a.at);
  } catch {
    if (strict) throw new Error('作品架暂时无法读取，原记录仍保留。请先检查浏览器存储或导出原记录。');
    return [];
  }
}
export const readWorks = storage => loadShelf(storage);
function writeShelf(works, storage) {
  if (works.length > maxWorks) throw new Error(`作品架最多放 ${maxWorks} 个版本，先备份并移走一些作品吧。`);
  const text = JSON.stringify({ version: 1, works });
  if (bytes(text) > maxShelfBytes) throw new Error('作品架空间不足，请先导出备份并移走一些作品。');
  try { storageOrThrow(storage).setItem(worksKey, text); }
  catch { throw new Error('未能写入作品架，原记录和草稿仍保留。请检查存储空间，或先导出作品。'); }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('hitori:works-changed'));
}
const sameWork = (a, b) => a.kind === b.kind && JSON.stringify(a.snapshot) === JSON.stringify(b.snapshot);
export function saveWork(kind, snapshot, preview = '', storage) {
  const entry = validateEntry({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, kind, snapshot, preview, at: Date.now() });
  const works = loadShelf(storage, true), existing = works.find(work => sameWork(work, entry));
  if (existing) return existing;
  writeShelf([entry, ...works], storage);
  return entry;
}
export function readDrafts(storage) {
  return Object.entries(workTypes).flatMap(([kind, type]) => {
    try { const raw = storageOrThrow(storage).getItem(draftKey(kind)); if (!raw) return []; const snapshot = type.validate(JSON.parse(raw)); return [{ kind, title: type.title(snapshot) || type.label, snapshot }]; }
    catch { return []; }
  });
}
export function restoreWork(id, storage) {
  const selected = loadShelf(storage, true).find(work => work.id === id);
  if (!selected) throw new Error('这份作品已被移走，请刷新作品架。');
  const target = storageOrThrow(storage), key = draftKey(selected.kind), current = target.getItem(key);
  if (current) {
    let snapshot;
    try { snapshot = workTypes[selected.kind].validate(JSON.parse(current)); }
    catch { throw new Error('当前草稿无法读取，已保留原数据。请先检查草稿。'); }
    if (JSON.stringify(snapshot) !== JSON.stringify(selected.snapshot)) saveWork(selected.kind, snapshot, '', target);
  }
  try { target.setItem(key, JSON.stringify(selected.snapshot)); }
  catch { throw new Error('无法恢复作品，当前草稿仍保留。请检查浏览器存储空间。'); }
  return `/room/${selected.kind}`;
}
export function removeWork(id, storage) {
  const works = loadShelf(storage, true), removed = works.find(work => work.id === id);
  writeShelf(works.filter(work => work.id !== id), storage);
  return removed;
}
export function exportWorks(storage) { return { version: 1, works: loadShelf(storage, true) }; }
export function importWorks(text, storage) {
  if (typeof text !== 'string' || bytes(text) > maxBackupBytes) throw new Error('请选择不超过 5 MiB 的作品架 JSON 备份。');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('这份 JSON 备份无法读取。'); }
  if (value?.version !== 1 || !Array.isArray(value.works) || value.works.length > maxWorks) throw new Error('这份作品架备份格式不正确。');
  const incoming = value.works.map(validateEntry), existing = loadShelf(storage, true), merged = [...existing];
  for (const entry of incoming) {
    if (merged.some(work => sameWork(work, entry))) continue;
    if (merged.some(work => work.id === entry.id)) entry.id = `${entry.id}-${Math.random().toString(36).slice(2, 7)}`;
    merged.push(entry);
  }
  writeShelf(merged.sort((a, b) => b.at - a.at), storage);
  return merged.length - existing.length;
}
