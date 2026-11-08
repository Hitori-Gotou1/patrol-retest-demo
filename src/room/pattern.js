export const studioTracks = [
  { id: 'guitar', label: '吉他', sound: 'guitar', frequency: 196 },
  { id: 'bass', label: '贝斯', sound: 'bass', frequency: 82.41 },
  { id: 'kick', label: '底鼓', sound: 'kick' },
  { id: 'hat', label: '踩镲', sound: 'hat' }
];
export const defaultPattern = { version: 1, name: '今晚的第一段', bpm: 96, masks: [0x1111, 0x0101, 0x1111, 0x5555] };
export function validatePattern(value) {
  if (!value || value.version !== 1 || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 60
    || !Number.isInteger(value.bpm) || value.bpm < 60 || value.bpm > 180 || !Array.isArray(value.masks) || value.masks.length !== 4
    || !value.masks.every(mask => Number.isInteger(mask) && mask >= 0 && mask <= 65535)) throw new Error('编排格式不正确：需要 60–180 BPM、四条 16 步轨道和有效名称。');
  return { version: 1, name: value.name.trim(), bpm: value.bpm, masks: [...value.masks] };
}
export function togglePatternStep(pattern, track, step) {
  if (!Number.isInteger(track) || track < 0 || track > 3 || !Number.isInteger(step) || step < 0 || step > 15) throw new Error('无效的轨道或步数');
  const result = validatePattern(pattern);
  result.masks[track] ^= 1 << step;
  return result;
}
export function patternSounds(pattern, step) {
  return studioTracks.filter((track, index) => (pattern.masks[index] & (1 << step)) !== 0);
}
export function encodePattern(value) {
  const pattern = validatePattern(value);
  const bytes = new TextEncoder().encode(JSON.stringify(pattern));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function decodePattern(text) {
  try {
    if (typeof text !== 'string' || !/^[A-Za-z0-9_-]{1,2048}$/.test(text)) throw new Error();
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return validatePattern(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, character => character.charCodeAt(0)))));
  } catch { throw new Error('这个编排链接无法读取，本机编排未被替换。'); }
}
export function parsePatternFile(text) {
  if (new TextEncoder().encode(text).length > 16384) throw new Error('编排文件不能超过 16 KiB。');
  try { return validatePattern(JSON.parse(text)); } catch { throw new Error('请选择有效的编排 JSON 文件。'); }
}
// A delayed frame plays only its current step, never a burst of old notes.
export function sequencerStep(elapsed, bpm) { return Math.floor(Math.max(0, elapsed) / (60000 / bpm / 4)) % 16; }
