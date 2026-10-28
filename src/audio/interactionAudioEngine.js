/** 独立于音乐播放器的短音效引擎。注入 AudioContext 工厂，便于测试异步竞态。 */
export function createInteractionAudioEngine({ createContext, onState = () => {}, isHidden = () => false, maxVoices = 5 } = {}) {
  let context, master, enabled = false, volume = .18, generation = 0, disposed = false;
  const voices = new Set();
  const owners = new Map();
  const buffers = new Map();
  const publish = message => onState({ enabled, volume, activeVoices: voices.size, message });

  function removeVoice(voice, stop = false) {
    if (!voices.delete(voice)) return;
    voice.source.onended = null;
    if (stop) { try { voice.source.stop(); } catch {} }
    voice.source.disconnect();
    publish();
  }
  function stop(owner) {
    if (owner === undefined) generation++;
    else if (owners.has(owner)) owners.get(owner).version++;
    for (const voice of [...voices]) if (owner === undefined || voice.owner === owner) removeVoice(voice, true);
  }
  function release(owner) {
    stop(owner);
    const state = owners.get(owner);
    if (state) state.released = true;
    // 旧 Promise 持有 state 引用，删除 Map 条目也不会让过期请求重新有效。
    owners.delete(owner);
  }
  function reconcileCancelledResume(audio) {
    if (disposed) { if (audio.state !== 'closed') audio.close().catch(() => {}); }
    else if ((!enabled || isHidden()) && audio.state === 'running') audio.suspend().catch(() => {});
  }
  function suspend() {
    stop();
    if (context?.state === 'running') context.suspend().catch(() => {});
  }
  function ensureContext() {
    if (!context) {
      context = createContext();
      master = context.createGain();
      master.gain.value = volume;
      master.connect(context.destination);
    }
    return context;
  }
  async function setEnabled(value) {
    if (disposed) return false;
    const token = ++generation;
    enabled = Boolean(value);
    if (!enabled) { suspend(); publish('互动音效已静音。'); return false; }
    publish('互动音效已开启，轻轻弹一下吧。');
    try {
      const audio = ensureContext();
      await audio.resume();
      if (disposed || token !== generation || !enabled || isHidden()) {
        // resume 可能晚于静音/离页完成，再次停下上下文，避免后台留下空转音频。
        reconcileCancelledResume(audio);
        return false;
      }
      if (audio.state !== 'running') throw new Error('Audio context is suspended');
      return true;
    } catch {
      if (token === generation && !disposed) { enabled = false; stop(); publish('浏览器暂时无法开启音效，请再点一次。'); }
      return false;
    }
  }
  function setVolume(value) {
    if (disposed) return;
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    volume = Math.max(0, Math.min(.5, next));
    if (master) master.gain.setTargetAtTime(volume, context.currentTime, .015);
    publish();
  }
  function bufferFor(type, frequency = type === 'bass' ? 82.41 : 196) {
    const hz = Math.max(30, Math.min(1200, Number(frequency) || 196));
    const key = `${type}:${hz}`;
    if (buffers.has(key)) return buffers.get(key);
    const duration = { guitar: .8, bass: .75, kick: .34, snare: .23, hat: .12, chord: 1.15 }[type];
    if (!duration) return null;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0), rate = context.sampleRate;
    const pluck = (target, note, offset = 0, gain = .65) => {
      // Karplus–Strong 阻尼延迟环：原创拨弦示范，不下载或截取商业音乐。
      const delay = Math.max(2, Math.round(rate / note));
      const line = Float32Array.from({ length: delay }, () => Math.random() * 2 - 1);
      const start = Math.round(offset * rate);
      for (let i = start; i < target.length; i++) {
        const index = (i - start) % delay, value = line[index];
        line[index] = (value + line[(index + 1) % delay]) * .496;
        const edge = Math.min(1, (i - start) / (rate * .003), (target.length - i) / (rate * .05));
        target[i] += value * gain * edge;
      }
    };
    if (type === 'guitar') pluck(samples, hz);
    else if (type === 'chord') [82.41, 123.47, 164.81, 196, 246.94, 329.63].forEach((note, index) => pluck(samples, note, index * .018, .25));
    else {
      let phase = 0, previousNoise = 0;
      for (let i = 0; i < samples.length; i++) {
        const t = i / rate, attack = Math.min(1, t / .003), tail = Math.min(1, (samples.length - i) / (rate * .025));
        let value = 0;
        if (type === 'bass') value = (Math.sin(2 * Math.PI * hz * t) + .2 * Math.sin(4 * Math.PI * hz * t)) * Math.exp(-t * 6) * .55;
        if (type === 'kick') { phase += 2 * Math.PI * (48 + 105 * Math.exp(-t * 35)) / rate; value = Math.sin(phase) * Math.exp(-t * 14) * .7; }
        if (type === 'snare') value = ((Math.random() * 2 - 1) * .48 + Math.sin(2 * Math.PI * 175 * t) * .18) * Math.exp(-t * 21);
        if (type === 'hat') { const noise = Math.random() * 2 - 1; value = (noise - previousNoise) * .24 * Math.exp(-t * 36); previousNoise = noise; }
        samples[i] = value * attack * tail;
      }
    }
    if (buffers.size >= 48) buffers.delete(buffers.keys().next().value);
    buffers.set(key, buffer);
    return buffer;
  }
  async function play(type, frequency, owner = 'interaction') {
    if (disposed || !enabled || isHidden()) return false;
    if (!owners.has(owner)) owners.set(owner, { version: 0, released: false });
    const state = owners.get(owner), token = generation, ownerToken = state.version;
    try {
      const audio = ensureContext();
      if (audio.state !== 'running') await audio.resume();
      // 静音、离页或组件卸载会使旧 Promise 失效，延迟完成的 resume 不能补放声音。
      if (disposed || !enabled || token !== generation || state.released || ownerToken !== state.version || isHidden() || audio.state !== 'running') {
        reconcileCancelledResume(audio);
        return false;
      }
      const buffer = bufferFor(type, frequency);
      if (!buffer) return false;
      while (voices.size >= maxVoices) removeVoice(voices.values().next().value, true);
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(master);
      const voice = { source, owner };
      voices.add(voice);
      source.onended = () => removeVoice(voice);
      try { source.start(); } catch (error) { removeVoice(voice, true); throw error; }
      publish();
      return true;
    } catch {
      if (token === generation && !disposed) publish('这一声暂时没响起，请再试一次。');
      return false;
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true; enabled = false; stop();
    master?.disconnect(); buffers.clear(); owners.clear();
    if (context && context.state !== 'closed') context.close().catch(() => {});
    publish();
  }
  return { setEnabled, setVolume, play, stop, release, suspend, dispose };
}
