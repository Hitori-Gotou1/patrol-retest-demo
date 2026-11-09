import { cast, stickers, roomProps, walkPlaces, searchObjects, concertOptions, concertEvents, ambientLayers } from '../data/playroom.js';

export const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const allowed = (value, options, fallback) => options.includes(value) ? value : fallback;
export function validateObjects(value, mode) {
  const catalog = mode === 'photo' ? [...cast, ...stickers] : roomProps;
  const keys = new Set();
  return (Array.isArray(value) ? value : []).slice(0, 20).filter(o => o && catalog.some(c => c.id === o.id)).map((o, index) => {
    let key = typeof o.key === 'string' && /^[\w-]{1,60}$/.test(o.key) ? o.key : `item-${index}`;
    while (keys.has(key)) key += '-x'; keys.add(key);
    return { key, id: o.id, x: clamp(o.x, 35, mode === 'photo' ? 685 : 925), y: clamp(o.y, 70, mode === 'photo' ? 755 : 570), size: clamp(o.size ?? (mode === 'photo' ? 230 : 1), mode === 'photo' ? 32 : .5, mode === 'photo' ? 420 : 1.8), rotation: clamp(o.rotation, -30, 30) };
  });
}
export const defaultPhoto = { version: 1, theme: 'pink', caption: '今天，也和大家站在一起。', objects: cast.map((c, i) => ({ key: c.id, id: c.id, x: 130 + i * 150, y: 470 + (i % 2) * 20, size: 250, rotation: 0 })) };
export function validatePhoto(v) {
  if (!v || v.version !== 1 || !Array.isArray(v.objects)) throw new Error('invalid photo');
  return { version: 1, theme: allowed(v.theme, ['pink', 'night', 'mint'], 'pink'), caption: String(v.caption || '').slice(0, 36), objects: validateObjects(v.objects, 'photo') };
}
export const defaultRoom = { version: 1, light: 'warm', objects: [{ key: 'guitar', id: 'guitar', x: 145, y: 440, size: 1, rotation: -8 }, { key: 'amp', id: 'amp', x: 265, y: 470, size: 1, rotation: 0 }, { key: 'box', id: 'box', x: 625, y: 475, size: 1, rotation: 0 }, { key: 'poster', id: 'poster', x: 730, y: 220, size: 1, rotation: -4 }, { key: 'plant', id: 'plant', x: 840, y: 430, size: 1, rotation: 0 }] };
export function validateRoom(v) {
  if (!v || v.version !== 1 || !Array.isArray(v.objects)) throw new Error('invalid room');
  return { version: 1, light: allowed(v.light, ['warm', 'pink', 'night'], 'warm'), objects: validateObjects(v.objects, 'room') };
}
export function validateWalk(v) {
  const visited = [...new Set((v?.visited || []).filter(id => walkPlaces.some(p => p.id === id)))];
  return { visited, selected: allowed(v?.selected, walkPlaces.map(p => p.id), 'station') };
}
export function shuffled(items, seed) {
  const result = [...items]; let state = Number(seed) >>> 0;
  for (let i = result.length - 1; i > 0; i--) { state = (Math.imul(1664525, state) + 1013904223) >>> 0; const j = state % (i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function newSearch(seed = Date.now()) {
  const order = shuffled(searchObjects.map(p => p.id), seed);
  return { version: 1, seed, targets: shuffled(order, seed + 91).slice(0, 6), found: [], mistakes: 0, hints: 0 };
}
export function validateSearch(v) {
  if (!v || v.version !== 1 || !Number.isSafeInteger(v.seed) || !Array.isArray(v.targets) || v.targets.length !== 6 || new Set(v.targets).size !== 6 || !v.targets.every(id => searchObjects.some(p => p.id === id))) throw new Error('invalid round');
  return { version: 1, seed: v.seed, targets: [...v.targets], found: [...new Set((v.found || []).filter(id => v.targets.includes(id)))], mistakes: Math.floor(clamp(v.mistakes, 0, 9999)), hints: Math.floor(clamp(v.hints, 0, 9999)) };
}
export const concertBudget = 1800;
export const defaultConcert = { name: '房间之外，舞台之上', sound: 'balanced', promo: 'posters', lights: 'colors', setlist: 'together' };
export function validateConcert(v) {
  if (!v || typeof v !== 'object') throw new Error('invalid plan');
  return { name: String(v.name || defaultConcert.name).slice(0, 28), ...Object.fromEntries(Object.entries(concertOptions).map(([key, value]) => [key, allowed(v[key], value.choices.map(x => x.id), defaultConcert[key])])), setlist: allowed(v.setlist, ['together', 'quiet', 'energy'], 'together') };
}
export function concertCost(plan) { return Object.entries(concertOptions).reduce((sum, [key, options]) => sum + options.choices.find(c => c.id === plan[key]).cost, 0); }
export function resolveConcert(input, eventId, choiceId) {
  const plan = validateConcert(input), event = concertEvents.find(e => e.id === eventId), choice = event?.choices.find(c => c.id === choiceId);
  if (!choice || concertCost(plan) + choice.cost > concertBudget) throw new Error('筹备预算不足，请选择另一种处理方式。');
  const options = Object.entries(concertOptions).map(([key, options]) => options.choices.find(c => c.id === plan[key]));
  const quality = Math.round(clamp(18 + options.reduce((n, c) => n + c.quality, 0) + choice.quality + (plan.setlist === 'together' ? 8 : 4), 0, 100));
  const audience = Math.round(clamp(20 + options.reduce((n, c) => n + c.reach, 0) + choice.reach + (plan.setlist === 'energy' ? 8 : 4), 0, 100));
  return { name: plan.name, quality, audience, spent: concertCost(plan) + choice.cost, ending: choice.ending, grade: quality >= 85 ? '忘不了的一晚' : quality >= 68 ? '属于我们的好演出' : '迈出了第一步', light: plan.lights, eventId, choiceId };
}
export function validateAmbient(v) {
  if (!v || typeof v !== 'object') throw new Error('invalid scene');
  return { name: String(v.name || '今晚的小屋').slice(0, 28), light: allowed(v.light, ['violet', 'amber', 'blue'], 'violet'), levels: Object.fromEntries(ambientLayers.map(l => [l.id, clamp(v.levels?.[l.id], 0, 1)])) };
}
