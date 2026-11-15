export const rhythmLevels = {
  easy: { label: '轻松', bpm: 90, notes: 16, spacing: 2 },
  normal: { label: '合奏', bpm: 108, notes: 32, spacing: 1 },
  hard: { label: '挑战', bpm: 126, notes: 48, spacing: 2 / 3 }
};
export const rhythmLanes = [
  { label: '一里 · 吉他', key: 'D', sound: 'guitar', frequency: 196, color: '#d886aa' },
  { label: '虹夏 · 节拍', key: 'F', sound: 'snare', color: '#d8ae3e' },
  { label: '凉 · 贝斯', key: 'J', sound: 'bass', frequency: 82.41, color: '#7397be' },
  { label: '喜多 · 和弦', key: 'K', sound: 'chord', color: '#c96d68' }
];
export function makeRhythmChart(level = 'normal') {
  const config = rhythmLevels[level];
  if (!config) throw new Error('未知难度');
  const beat = 60000 / config.bpm;
  return Array.from({ length: config.notes }, (_, index) => ({ id: index, lane: (index * 7 + Math.floor(index / 4)) % 4, at: (4 + index * config.spacing) * beat, judgment: '' }));
}
export function newRhythmRound(level) {
  return { notes: makeRhythmChart(level), score: 0, combo: 0, maxCombo: 0, stray: 0, message: '跟着节拍，让声音落在线上。' };
}
export function expireRhythmNotes(round, now) {
  let missed = false;
  const notes = round.notes.map(note => {
    if (!note.judgment && now - note.at > 180) { missed = true; return { ...note, judgment: 'Miss' }; }
    return note;
  });
  return missed ? { ...round, notes, combo: 0, message: 'Miss · 下一拍继续。' } : round;
}
export const rhythmPreferencesKey = 'hitori-room:rhythm-preferences:v1';
export const defaultRhythmPreferences = { version: 1, offsetMs: 0, keys: ['d', 'f', 'j', 'k'] };
export function validateRhythmPreferences(value) {
  if (!value || value.version !== 1 || !Number.isInteger(value.offsetMs) || Math.abs(value.offsetMs) > 300
    || !Array.isArray(value.keys) || value.keys.length !== 4 || value.keys.some(key => typeof key !== 'string' || !/^[a-z0-9]$/i.test(key))
    || new Set(value.keys.map(key => key.toLowerCase())).size !== 4) throw new Error('请使用四个不同的字母或数字键，校准范围为 −300～300 毫秒。');
  return { version: 1, offsetMs: value.offsetMs, keys: value.keys.map(key => key.toLowerCase()) };
}
export function calibrationOffset(samples) {
  if (!Array.isArray(samples) || samples.length < 4 || samples.some(value => !Number.isFinite(value) || Math.abs(value) > 300)) throw new Error('请跟随提示完成至少四次有效点击，再保存校准。');
  const sorted = [...samples].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}
export function hitRhythmNote(round, lane, rawNow, offsetMs = 0) {
  const now = rawNow - Math.max(-300, Math.min(300, Number(offsetMs) || 0));
  const current = expireRhythmNotes(round, now);
  const candidate = current.notes.filter(note => note.lane === lane && !note.judgment && Math.abs(note.at - now) <= 180)
    .sort((a, b) => Math.abs(a.at - now) - Math.abs(b.at - now))[0];
  if (!candidate) return { ...current, combo: 0, stray: current.stray + 1, message: '空拍 · 看准落点再按。' };
  const error = Math.abs(now - candidate.at);
  const judgment = error <= 70 ? 'Perfect' : error <= 130 ? 'Great' : 'Good';
  const combo = current.combo + 1;
  return { ...current, notes: current.notes.map(note => note.id === candidate.id ? { ...note, judgment, deviation: now - candidate.at, rawDeviation: rawNow - candidate.at } : note), combo,
    maxCombo: Math.max(combo, current.maxCombo), score: current.score + ({ Perfect: 1000, Great: 700, Good: 300 }[judgment]) + Math.min(combo, 50) * 20, message: judgment };
}
export function rhythmResult(round) {
  const weights = { Perfect: 1, Great: .7, Good: .3, Miss: 0 };
  const accuracy = Math.round(round.notes.reduce((sum, note) => sum + (weights[note.judgment] || 0), 0) / (round.notes.length + round.stray) * 1000) / 10;
  const deviations = round.notes.filter(note => Number.isFinite(note.deviation)).map(note => note.deviation);
  const distribution = [
    { label: '早 70ms 以上', min: -Infinity, max: -70 }, { label: '早 15–70ms', min: -70, max: -15 },
    { label: '落点 ±15ms', min: -15, max: 15 }, { label: '晚 15–70ms', min: 15, max: 70 }, { label: '晚 70ms 以上', min: 70, max: Infinity }
  ].map((bucket, index) => ({ label: bucket.label, count: deviations.filter(value => (index === 0 ? value < bucket.max : index === 2 ? value >= bucket.min && value <= bucket.max : value >= bucket.min && value < bucket.max) && !(index === 3 && value === 15)).length }));
  return { score: round.score, accuracy, maxCombo: round.maxCombo, rank: accuracy >= 95 ? 'S' : accuracy >= 85 ? 'A' : accuracy >= 70 ? 'B' : 'C',
    deviations, distribution, early: deviations.filter(value => value < -15).length, late: deviations.filter(value => value > 15).length,
    centered: deviations.filter(value => Math.abs(value) <= 15).length,
    meanDeviation: deviations.length ? Math.round(deviations.reduce((sum, value) => sum + value, 0) / deviations.length) : null };
}
