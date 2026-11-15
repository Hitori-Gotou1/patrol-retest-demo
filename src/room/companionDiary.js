import { validateActivity } from './activityLog.js';
export const companionDiaryLimit = 180;
const members = ['hitori', 'nijika', 'ryo', 'kita'];
export const activityDestinations = { project:'project', photo:'photobooth', room:'decorate', walk:'walk', search:'search', concert:'concert', ambient:'ambient', studio:'studio', practice:'practice', maze:'maze', effects:'effects', echo:'echo', escape:'escape', duet:'duet', cards:'cards', jigsaw:'jigsaw', shop:'shop', platform:'platform', lights:'lights', comic:'comic', mix:'mix', graffiti:'graffiti', relay:'relay', pinball:'pinball' };
export function validateDiaryEntry(value) {
  const event = validateActivity(value);
  return { ...event, member: members.includes(value.member) ? value.member : 'hitori', pinned: value.pinned === true,
    reply: typeof value.reply === 'string' ? value.reply.slice(0, 240) : '',
    workId: typeof value.workId === 'string' && /^[\w-]{1,100}$/.test(value.workId) ? value.workId : '',
    workTitle: typeof value.workTitle === 'string' ? value.workTitle.slice(0, 90) : '' };
}
export function validateDiary(value) {
  if (!Array.isArray(value)) return [];
  const entries = value.slice(0, companionDiaryLimit * 2).flatMap(entry => { try { return [validateDiaryEntry(entry)]; } catch { return []; } });
  return [...new Map(entries.map(entry => [entry.id, entry])).values()].sort((a, b) => b.at - a.at).slice(0, companionDiaryLimit);
}
export function appendDiary(entries, event, member, reply) {
  const next = validateDiaryEntry({ ...event, member, reply });
  if (entries.some(entry => entry.id === next.id)) return entries;
  const current = validateDiary(entries), pins = current.filter(entry => entry.pinned), others = current.filter(entry => !entry.pinned);
  return [next, ...pins, ...others].slice(0, companionDiaryLimit).sort((a, b) => b.at - a.at);
}
export function changeDiary(entries, id, patch) {
  if (!entries.some(entry => entry.id === id)) throw new Error('这一页已经被移走，请重新打开手帐。');
  return entries.map(entry => entry.id === id ? validateDiaryEntry({ ...entry, ...patch, id: entry.id }) : entry);
}
export function diaryGroups(entries, { pinned = false, date = '' } = {}) {
  const grouped = new Map();
  for (const entry of entries.filter(entry => !pinned || entry.pinned).sort((a, b) => b.at - a.at)) {
    const time = new Date(entry.at), key = entry.at > 0 && Number.isFinite(time.getTime()) ? `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')}` : '日期未记录';
    if (date && key !== date) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  }
  return [...grouped].map(([date, memories]) => ({ date, memories }));
}
