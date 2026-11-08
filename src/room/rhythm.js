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
export function hitRhythmNote(round, lane, now) {
  const current = expireRhythmNotes(round, now);
  const candidate = current.notes.filter(note => note.lane === lane && !note.judgment && Math.abs(note.at - now) <= 180)
    .sort((a, b) => Math.abs(a.at - now) - Math.abs(b.at - now))[0];
  if (!candidate) return { ...current, combo: 0, stray: current.stray + 1, message: '空拍 · 看准落点再按。' };
  const error = Math.abs(now - candidate.at);
  const judgment = error <= 70 ? 'Perfect' : error <= 130 ? 'Great' : 'Good';
  const combo = current.combo + 1;
  return { ...current, notes: current.notes.map(note => note.id === candidate.id ? { ...note, judgment } : note), combo,
    maxCombo: Math.max(combo, current.maxCombo), score: current.score + ({ Perfect: 1000, Great: 700, Good: 300 }[judgment]) + Math.min(combo, 50) * 20, message: judgment };
}
export function rhythmResult(round) {
  const weights = { Perfect: 1, Great: .7, Good: .3, Miss: 0 };
  const accuracy = Math.round(round.notes.reduce((sum, note) => sum + (weights[note.judgment] || 0), 0) / (round.notes.length + round.stray) * 1000) / 10;
  return { score: round.score, accuracy, maxCombo: round.maxCombo, rank: accuracy >= 95 ? 'S' : accuracy >= 85 ? 'A' : accuracy >= 70 ? 'B' : 'C' };
}
