import { validatePattern, patternRange, patternSounds } from '../room/pattern.js';
import { createToneGraph, pluckBuffer } from './guitarEffectsEngine.js';
import { defaultTone } from '../room/effects.js';
export const arrangementTail = 2.4;
export const maxAudioSeconds = 180;
const abortError = () => new DOMException('已取消导出。', 'AbortError');
export function arrangementDuration(input, cycles = 1) {
  const pattern = validatePattern(input), range = patternRange(pattern);
  if (!Number.isInteger(cycles) || cycles < 1 || cycles > 16) throw new Error('循环次数需要为 1–16。');
  return (range.end - range.start + 1) * 4 * 60 / pattern.bpm * cycles;
}
export function arrangementEvents(input, cycles = 1) {
  const pattern = validatePattern(input), range = patternRange(pattern), events = [];
  const stepSeconds = 60 / pattern.bpm / 4;
  let absolute = 0;
  for (let cycle = 0; cycle < cycles; cycle++) for (let bar = range.start; bar <= range.end; bar++) for (let step = 0; step < 16; step++, absolute++) {
    for (const track of patternSounds(pattern, step, bar)) events.push({ ...track, at: absolute * stepSeconds, bar, step, cycle });
  }
  return events;
}
export function synthNoteBuffer(context, type, frequency = 196) {
  if (type === 'guitar') return pluckBuffer(context, frequency);
  const duration = { bass: .75, kick: .34, hat: .12 }[type] || .2, rate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.ceil(rate * duration), rate), samples = buffer.getChannelData(0);
  let seed = 27183, previous = 0, phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate, edge = Math.min(1, t / .003, (samples.length - i) / (rate * .025));
    let value = 0;
    if (type === 'bass') value = (Math.sin(2 * Math.PI * frequency * t) + .2 * Math.sin(4 * Math.PI * frequency * t)) * Math.exp(-t * 6) * .55;
    if (type === 'kick') { phase += 2 * Math.PI * (48 + 105 * Math.exp(-t * 35)) / rate; value = Math.sin(phase) * Math.exp(-t * 14) * .7; }
    if (type === 'hat') { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const noise = seed / 2147483648 - 1; value = (noise - previous) * .24 * Math.exp(-t * 36); previous = noise; }
    samples[i] = value * edge;
  }
  return buffer;
}
export async function renderArrangement(input, { cycles = 1, tone = defaultTone, useTone = false, tail = true, signal, onProgress = () => {}, OfflineContext = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext, sampleRate = 44100, limitSeconds = null } = {}) {
  const pattern = validatePattern(input), musicalDuration = arrangementDuration(pattern, cycles), completeDuration = musicalDuration + (tail ? arrangementTail : 0);
  if(limitSeconds!==null&&(!Number.isFinite(limitSeconds)||limitSeconds<=0||limitSeconds>maxAudioSeconds))throw new Error('导出片段长度超出支持范围。');
  const duration=limitSeconds===null?completeDuration:Math.min(completeDuration,limitSeconds);
  if (!OfflineContext) throw new Error('此浏览器不支持离线音频渲染，请换用支持 Web Audio 的浏览器。');
  if (duration > maxAudioSeconds) throw new Error('单次音频最多三分钟，请缩短循环范围或减少次数。');
  if (signal?.aborted) throw abortError();
  onProgress(0);
  const context = new OfflineContext(2, Math.ceil(sampleRate * duration), sampleRate), gain = context.createGain();
  gain.gain.setValueAtTime(.65, 0); gain.gain.setValueAtTime(.65, Math.max(0, duration - .08)); gain.gain.linearRampToValueAtTime(0, duration);
  gain.connect(context.destination);
  const graph = useTone ? createToneGraph(context, tone, gain) : null, buffers = new Map(), sources = [];
  for (const event of arrangementEvents(pattern, cycles)) {
    if(event.at>=duration)break;
    const key = `${event.sound}:${event.frequency || ''}`;
    if (!buffers.has(key)) buffers.set(key, synthNoteBuffer(context, event.sound, event.frequency));
    const source = context.createBufferSource(); source.buffer = buffers.get(key); source.connect(graph && event.sound === 'guitar' ? graph.input : gain); source.start(event.at); sources.push(source);
  }
  let rejectAbort;
  const cancelled = new Promise((_, reject) => { rejectAbort = reject; });
  const onAbort = () => { rejectAbort(abortError()); };
  signal?.addEventListener('abort', onAbort, { once: true });
  // Suspend on audio-time checkpoints so long renders report actual completed audio and can stop safely.
  for (let at = 1; typeof context.suspend === 'function' && typeof context.resume === 'function' && at < duration; at += 1) context.suspend(at).then(() => {
    if (signal?.aborted) return context.resume();
    onProgress(Math.min(.9, at / duration * .9));
    return context.resume();
  }).catch(() => {});
  try {
    const output = await Promise.race([context.startRendering(), cancelled]);
    if (signal?.aborted) throw abortError();
    let peak = 0;
    for (let channel = 0; channel < output.numberOfChannels; channel++) for (const sample of output.getChannelData(channel)) peak = Math.max(peak, Math.abs(sample));
    if (peak > .94) for (let channel = 0; channel < output.numberOfChannels; channel++) { const samples = output.getChannelData(channel); for (let i = 0; i < samples.length; i++) samples[i] *= .94 / peak; }
    onProgress(1);
    return { buffer: output, musicalDuration, duration: output.duration, peak: Math.min(peak, .94) };
  } finally {
    signal?.removeEventListener('abort', onAbort); graph?.dispose(); gain.disconnect(); for (const source of sources) { try { source.stop(); } catch {} source.disconnect(); }
  }
}
export function audioBufferWav(buffer) {
  const channels = buffer.numberOfChannels, length = buffer.length, rate = buffer.sampleRate;
  const bytes = new ArrayBuffer(44 + length * channels * 2), view = new DataView(bytes);
  const text = (at, value) => [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + length * channels * 2, true); text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, rate, true); view.setUint32(28, rate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, length * channels * 2, true);
  const samples = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  for (let i = 0; i < length; i++) for (let c = 0; c < channels; c++) view.setInt16(44 + (i * channels + c) * 2, Math.round(Math.max(-1, Math.min(1, samples[c][i])) * 32767), true);
  return new Blob([bytes], { type: 'audio/wav' });
}
export function downloadAudioBlob(blob, filename) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function createArrangementPlayer({ createContext, isHidden = () => false } = {}) {
  let context, source, master, origin = 0, generation = 0, disposed = false, controller;
  function stop() { generation++; controller?.abort(); controller = null; if (source) { source.onended = null; try { source.stop(); } catch {} source.disconnect(); source = null; } if (context?.state === 'running') context.suspend().catch(() => {}); }
  async function play(pattern, options = {}) {
    stop(); const token = ++generation; controller = new AbortController();
    if (disposed || isHidden()) return false;
    try {
      if (!context || context.state === 'closed') { context = createContext(); master = context.createGain(); master.connect(context.destination); }
      // Resume in the original click stack, before awaiting rendering.
      await context.resume();
      const rendered = await renderArrangement(pattern, { ...options, tail: !options.loop, signal: controller.signal });
      if (disposed || token !== generation || isHidden() || context.state !== 'running') return false;
      master.gain.value = options.volume ?? .36;
      source = context.createBufferSource(); source.buffer = rendered.buffer; source.loop = options.loop === true; source.connect(master); origin = context.currentTime + .04; source.start(origin);
      return true;
    } catch (error) { if (token === generation) stop(); if (error.name === 'AbortError') return false; throw error; }
  }
  return { play, stop, elapsed: () => context ? Math.max(0, context.currentTime - origin) * 1000 : 0, volume(value) { if (master && context) master.gain.setTargetAtTime(value, context.currentTime, .02); }, dispose() { disposed = true; stop(); master?.disconnect(); context?.close().catch(() => {}); } };
}
