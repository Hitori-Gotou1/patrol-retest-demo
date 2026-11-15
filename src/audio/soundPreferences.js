export const soundPreferencesKey = 'hitori-room:sound:v1';
export const defaultSoundPreferences = { version: 1, muted: false, music: .35, effects: .18, ambience: .18, effectsEnabled: false };
export function validateSoundPreferences(value) {
  if (!value || value.version !== 1) throw new Error('声音设置格式无法读取。');
  const next = { version: 1, muted: value.muted === true, effectsEnabled: value.effectsEnabled === true };
  for (const [key, max] of [['music', 1], ['effects', .5], ['ambience', .5]]) {
    if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > max) throw new Error('声音音量超出范围。');
    next[key] = value[key];
  }
  return next;
}
export const soundGain = (preferences, category) => preferences.muted ? 0 : preferences[category];
