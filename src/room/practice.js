export const practiceKey = 'hitori-room:practice:v1';
export const emptyPractice = { version: 1, current: null, records: [], totalMinutes: 0, totalSessions: 0 };
const phases = ['focus', 'break', 'paused-focus', 'paused-break'];
export function dateKey(time) {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validatePractice(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.records) || value.records.length > 365
    || ![value.totalMinutes, value.totalSessions].every(number => Number.isSafeInteger(number) && number >= 0)) throw new Error('练习记录格式不正确');
  const records = value.records.filter(record => record && typeof record.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(record.id)
    && /^\d{4}-\d{2}-\d{2}$/.test(record.date) && Number.isInteger(record.minutes) && record.minutes >= 1 && record.minutes <= 180);
  const current = value.current;
  if (current && (typeof current.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(current.id) || !phases.includes(current.phase)
    || !Number.isInteger(current.minutes) || current.minutes < 1 || current.minutes > 180
    || !Number.isInteger(current.breakMinutes) || current.breakMinutes < 0 || current.breakMinutes > 60
    || !Number.isFinite(current.deadline) || !Number.isFinite(current.remaining) || current.remaining < 0 || current.remaining > 10800000)) throw new Error('当前计时格式不正确');
  return { version: 1, records: [...new Map(records.map(record => [record.id, { id: record.id, date: record.date, minutes: record.minutes }])).values()],
    current: current ? { ...current } : null, totalMinutes: value.totalMinutes, totalSessions: value.totalSessions };
}
export function startPractice(store, now, minutes, breakMinutes, id) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180 || !Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 60) throw new Error('练习为 1–180 分钟，休息为 0–60 分钟。');
  return validatePractice({ ...store, current: { id, phase: 'focus', minutes, breakMinutes, deadline: now + minutes * 60000, remaining: minutes * 60000 } });
}
export function remainingPractice(current, now) {
  return !current ? 0 : current.phase.startsWith('paused-') ? current.remaining : Math.max(0, current.deadline - now);
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
export function advancePractice(store, now) {
  let current = store.current;
  if (!current || current.phase.startsWith('paused-') || now < current.deadline) return store;
  let result = store;
  if (current.phase === 'focus') {
    if (!store.records.some(record => record.id === current.id)) {
      result = { ...store, records: [...store.records, { id: current.id, date: dateKey(current.deadline), minutes: current.minutes }].slice(-365),
        totalMinutes: store.totalMinutes + current.minutes, totalSessions: store.totalSessions + 1 };
    }
    current = current.breakMinutes ? { ...current, phase: 'break', deadline: current.deadline + current.breakMinutes * 60000, remaining: current.breakMinutes * 60000 } : null;
  }
  if (current?.phase === 'break' && now >= current.deadline) current = null;
  return { ...result, current };
}
export function practiceStreak(records, now) {
  const days = new Set(records.map(record => record.date));
  const cursor = new Date(now);
  if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(dateKey(cursor))) { count++; cursor.setDate(cursor.getDate() - 1); }
  return count;
}
