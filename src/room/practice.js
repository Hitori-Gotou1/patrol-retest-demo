export const practiceKey = 'hitori-room:practice:v1';
export const emptyPractice = { version: 1, current: null, records: [], totalMinutes: 0, totalSessions: 0, totalSeconds: 0 };
const phases = ['focus', 'break', 'paused-focus', 'paused-break'];
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const text = (value, length) => typeof value === 'string' ? value.trim().slice(0, length) : '';
const details = value => ({ track: text(value?.track, 80), goal: text(value?.goal, 120), reflection: text(value?.reflection, 240) });
export function dateKey(time) {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validatePractice(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.records) || value.records.length > 365
    || ![value.totalMinutes, value.totalSessions].every(number => Number.isSafeInteger(number) && number >= 0)) throw new Error('练习记录格式不正确');
  const records = value.records.flatMap(record => {
    if (!record || !validId(record.id) || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)
      || !Number.isInteger(record.minutes) || record.minutes < 0 || record.minutes > 180) return [];
    const seconds = record.actualSeconds ?? record.minutes * 60;
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 10800) return [];
    const planned = record.plannedMinutes ?? record.minutes;
    if (!Number.isInteger(planned) || planned < 1 || planned > 180) return [];
    return [{ id: record.id, date: record.date, minutes: Math.floor(seconds / 60), actualSeconds: seconds, plannedMinutes: planned,
      ...details(record), endedEarly: record.endedEarly === true }];
  });
  const current = value.current;
  if (current && (!validId(current.id) || !phases.includes(current.phase)
    || !Number.isInteger(current.minutes) || current.minutes < 1 || current.minutes > 180
    || !Number.isInteger(current.breakMinutes) || current.breakMinutes < 0 || current.breakMinutes > 60
    || !Number.isFinite(current.deadline) || !Number.isFinite(current.remaining) || current.remaining < 0 || current.remaining > 10800000)) throw new Error('当前计时格式不正确');
  const totalSeconds = Number.isSafeInteger(value.totalSeconds) && value.totalSeconds >= 0 ? value.totalSeconds : value.totalMinutes * 60;
  return { version: 1, records: [...new Map(records.map(record => [record.id, record])).values()],
    current: current ? { ...current, ...details(current) } : null, totalMinutes: Math.floor(totalSeconds / 60), totalSeconds, totalSessions: value.totalSessions };
}
export function startPractice(store, now, minutes, breakMinutes, id, metadata = {}) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180 || !Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 60) throw new Error('练习为 1–180 分钟，休息为 0–60 分钟。');
  return validatePractice({ ...store, current: { id, phase: 'focus', minutes, breakMinutes, deadline: now + minutes * 60000, remaining: minutes * 60000, ...details(metadata) } });
}
export function remainingPractice(current, now) {
  return !current ? 0 : current.phase.startsWith('paused-') ? current.remaining : Math.max(0, current.deadline - now);
}
export function actualPracticeSeconds(current, now) {
  if (!current || !current.phase.endsWith('focus')) return 0;
  return Math.floor(Math.max(0, Math.min(current.minutes * 60000, current.minutes * 60000 - remainingPractice(current, now))) / 1000);
}
export function pausePractice(store, now) {
  const current = store.current;
  if (!current || current.phase.startsWith('paused-')) return store;
  return { ...store, current: { ...current, phase: 'paused-' + current.phase, remaining: remainingPractice(current, now) } };
}
export function resumePractice(store, now) {
  const current = store.current;
  if (!current?.phase.startsWith('paused-')) return store;
  return { ...store, current: { ...current, phase: current.phase.slice(7), deadline: now + current.remaining } };
}
function recordPractice(store, current, now, seconds, endedEarly, reflection = current.reflection) {
  if (seconds < 1 || store.records.some(record => record.id === current.id)) return store;
  const totalSeconds = (store.totalSeconds ?? store.totalMinutes * 60) + seconds;
  return { ...store, records: [...store.records, { id: current.id, date: dateKey(now), minutes: Math.floor(seconds / 60), actualSeconds: seconds,
    plannedMinutes: current.minutes, ...details({ ...current, reflection }), endedEarly }].slice(-365),
    totalSeconds, totalMinutes: Math.floor(totalSeconds / 60), totalSessions: store.totalSessions + 1 };
}
export function finishPracticeEarly(store, now, saveActual, reflection = '') {
  const current = store.current;
  if (!current) return store;
  const next = saveActual && current.phase.endsWith('focus')
    ? recordPractice(store, current, now, actualPracticeSeconds(current, now), true, reflection) : store;
  return { ...next, current: null };
}
export function advancePractice(store, now) {
  let current = store.current;
  if (!current || current.phase.startsWith('paused-') || now < current.deadline) return store;
  let result = store;
  if (current.phase === 'focus') {
    result = recordPractice(store, current, current.deadline, current.minutes * 60, false);
    current = current.breakMinutes ? { ...current, phase: 'break', deadline: current.deadline + current.breakMinutes * 60000, remaining: current.breakMinutes * 60000 } : null;
  }
  if (current?.phase === 'break' && now >= current.deadline) current = null;
  return { ...result, current };
}
export function editPracticeRecord(store, id, metadata) {
  if (!store.records.some(record => record.id === id)) throw new Error('这条练习记录已不存在。');
  return { ...store, records: store.records.map(record => record.id === id ? { ...record, ...details({ ...record, ...metadata }) } : record) };
}
export function practiceStreak(records, now) {
  const days = new Set(records.map(record => record.date));
  const cursor = new Date(now);
  if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(dateKey(cursor))) { count++; cursor.setDate(cursor.getDate() - 1); }
  return count;
}
export function practiceTrend(records, now, days = 7) {
  if (![7, 30].includes(days)) throw new Error('趋势范围为最近 7 天或 30 天。');
  return Array.from({ length: days }, (_, index) => {
    const cursor = new Date(now); cursor.setDate(cursor.getDate() - (days - index - 1));
    const date = dateKey(cursor), matching = records.filter(record => record.date === date);
    return { date, seconds: matching.reduce((sum, record) => sum + (record.actualSeconds ?? record.minutes * 60), 0), sessions: matching.length };
  });
}
