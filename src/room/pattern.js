export const studioTracks = [
  { id: 'guitar', label: '吉他', sound: 'guitar', frequency: 196 },
  { id: 'bass', label: '贝斯', sound: 'bass', frequency: 82.41 },
  { id: 'kick', label: '底鼓', sound: 'kick' },
  { id: 'hat', label: '踩镲', sound: 'hat' }
];
export const maxPatternBars = 16;
export const defaultPattern = { version: 1, name: '今晚的第一段', bpm: 96, masks: [0x1111, 0x0101, 0x1111, 0x5555] };
const validMasks = masks => Array.isArray(masks) && masks.length === 4 && masks.every(mask => Number.isInteger(mask) && mask >= 0 && mask <= 65535);
export function validatePattern(value) {
  if (!value || ![1, 2].includes(value.version) || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 60
    || !Number.isInteger(value.bpm) || value.bpm < 60 || value.bpm > 180) throw new Error('编排需要 60–180 BPM 和 60 字以内的名称。');
  if (value.version === 1) {
    if (!validMasks(value.masks)) throw new Error('单小节编排需要四条 16 步轨道。');
    return { version: 1, name: value.name.trim(), bpm: value.bpm, masks: [...value.masks] };
  }
  if (!Array.isArray(value.bars) || !value.bars.length || value.bars.length > maxPatternBars) throw new Error('编排可包含 1–16 个小节。');
  const bars = value.bars.map((bar, index) => {
    if (!bar || typeof bar.id !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(bar.id) || typeof bar.name !== 'string' || !bar.name.trim() || bar.name.trim().length > 24 || !validMasks(bar.masks)) throw new Error(`第 ${index + 1} 小节的名称或节拍格式不正确。`);
    return { id: bar.id, name: bar.name.trim(), masks: [...bar.masks] };
  });
  if (new Set(bars.map(bar => bar.id)).size !== bars.length) throw new Error('小节编号不能重复。');
  const loop = value.loop;
  if (!loop || !Number.isInteger(loop.start) || !Number.isInteger(loop.end) || loop.start < 0 || loop.start > loop.end || loop.end >= bars.length) throw new Error('请选择有效的循环起止小节。');
  return { version: 2, name: value.name.trim(), bpm: value.bpm, bars, loop: { start: loop.start, end: loop.end } };
}
export const patternBars = pattern => pattern.version === 2 ? pattern.bars : [{ id: 'bar-1', name: '第一小节', masks: pattern.masks }];
export const patternRange = pattern => pattern.version === 2 ? pattern.loop : { start: 0, end: 0 };
export function toArrangement(value) {
  const pattern = validatePattern(value);
  return pattern.version === 2 ? pattern : { version: 2, name: pattern.name, bpm: pattern.bpm, bars: patternBars(pattern), loop: { start: 0, end: 0 } };
}
export function editPatternBar(value, operation, index, destination) {
  const pattern = toArrangement(value);
  if (!Number.isInteger(index) || index < 0 || index >= pattern.bars.length) throw new Error('请选择一个小节。');
  if (operation === 'copy') {
    if (pattern.bars.length >= maxPatternBars) throw new Error('最多十六小节；作品架的原有数量与空间限制仍适用。');
    const original = pattern.bars[index];
    pattern.bars.splice(index + 1, 0, { ...original, id: `bar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, name: `${original.name.slice(0, 20)} 副本`, masks: [...original.masks] });
  } else if (operation === 'delete') {
    if (pattern.bars.length === 1) throw new Error('至少保留一个小节。');
    pattern.bars.splice(index, 1);
  } else if (operation === 'move') {
    if (!Number.isInteger(destination) || destination < 0 || destination >= pattern.bars.length) throw new Error('无法移动到这个位置。');
    pattern.bars.splice(destination, 0, pattern.bars.splice(index, 1)[0]);
  } else throw new Error('未知的小节操作。');
  pattern.loop = { start: 0, end: pattern.bars.length - 1 };
  return validatePattern(pattern);
}
export function togglePatternStep(pattern, track, step, bar = 0) {
  if (!Number.isInteger(track) || track < 0 || track > 3 || !Number.isInteger(step) || step < 0 || step > 15 || !Number.isInteger(bar) || bar < 0 || bar >= patternBars(pattern).length) throw new Error('无效的轨道、小节或步数');
  const result = validatePattern(pattern);
  patternBars(result)[bar].masks[track] ^= 1 << step;
  return result;
}
export function patternSounds(pattern, step, bar = 0) {
  const masks = patternBars(pattern)[bar]?.masks || [0, 0, 0, 0];
  return studioTracks.filter((track, index) => (masks[index] & (1 << step)) !== 0);
}
export function arrangementPosition(elapsed, pattern, cycles = Infinity) {
  const range = patternRange(pattern), count = range.end - range.start + 1;
  const absolute = Math.floor(Math.max(0, elapsed) / (60000 / pattern.bpm / 4));
  return { step: absolute % 16, bar: range.start + Math.floor(absolute / 16) % count, cycle: Math.floor(absolute / (16 * count)) + 1, done: absolute >= cycles * 16 * count, fraction: Math.max(0, elapsed) / (60000 / pattern.bpm / 4) % 1 };
}
export function encodePattern(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(validatePattern(value)));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function decodePattern(text) {
  try {
    if (typeof text !== 'string' || !/^[A-Za-z0-9_-]{1,8192}$/.test(text)) throw new Error();
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return validatePattern(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, character => character.charCodeAt(0)))));
  } catch { throw new Error('这个编排链接无法读取，本机编排未被替换。'); }
}
export function parsePatternFile(text) {
  if (new TextEncoder().encode(text).length > 16384) throw new Error('编排文件不能超过 16 KiB。');
  try { return validatePattern(JSON.parse(text)); } catch { throw new Error('请选择有效的编排 JSON 文件。'); }
}
export function sequencerStep(elapsed, bpm) { return Math.floor(Math.max(0, elapsed) / (60000 / bpm / 4)) % 16; }
