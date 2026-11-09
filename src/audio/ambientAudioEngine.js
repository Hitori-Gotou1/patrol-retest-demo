/** Original synthesized ambience; no recordings or network sources. Nothing starts before start(). */
export function createAmbientAudioEngine({ createContext, isHidden = () => false, schedule = setTimeout, cancel = clearTimeout } = {}) {
  let context, master, timer, generation = 0, disposed = false, running = false;
  const gains = new Map(), sources = new Set(), filters = new Set();
  let levels = { rain: .65, street: .18, tuning: .3, crowd: .1 }, volume = .18;
  const bounded = n => Math.max(0, Math.min(1, Number(n) || 0));
  function clearNodes() {
    cancel(timer); timer = undefined;
    for (const source of sources) { source.onended = null; try { source.stop(); } catch {} source.disconnect(); }
    for (const node of filters) node.disconnect();
    for (const node of gains.values()) node.disconnect();
    sources.clear(); filters.clear(); gains.clear();
  }
  function stop() {
    generation++; running = false; clearNodes();
    if (context?.state === 'running') context.suspend().catch(() => {});
  }
  function noise(id, type, frequency, strength) {
    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate), samples = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < samples.length; i++) { const white = Math.random() * 2 - 1; previous = (previous + .025 * white) / 1.025; samples[i] = (id === 'rain' ? white * .23 : previous * 2.8) * Math.min(1, i / 600, (samples.length - i) / 600); }
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = buffer; source.loop = true; filter.type = type; filter.frequency.value = frequency; gain.gain.value = levels[id] * strength;
    source.connect(filter); filter.connect(gain); gain.connect(master); sources.add(source); filters.add(filter); gains.set(id, gain); source.start();
  }
  function pluck(token) {
    if (disposed || !running || token !== generation || isHidden()) return;
    if (levels.tuning > 0) {
      const frequency = [82.41, 110, 146.83, 196, 246.94, 329.63][Math.floor(Math.random()*6)];
      const source = context.createOscillator(), gain = context.createGain(), now = context.currentTime;
      source.type = 'triangle'; source.frequency.value = frequency; gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(levels.tuning * .16, now + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + 2.5);
      source.connect(gain); gain.connect(master); sources.add(source); filters.add(gain);
      source.onended = () => { sources.delete(source); filters.delete(gain); source.disconnect(); gain.disconnect(); };
      source.start(); source.stop(now + 2.6);
    }
    timer = schedule(() => pluck(token), 4200 + Math.random()*2800);
  }
  async function start() {
    if (disposed || isHidden()) return false;
    stop(); const token = ++generation;
    try {
      if (!context) { context = createContext(); master = context.createGain(); master.connect(context.destination); }
      await context.resume();
      if (disposed || token !== generation || isHidden() || context.state !== 'running') { if (!running && context.state === 'running') await context.suspend(); return false; }
      master.gain.value = volume;
      noise('rain', 'highpass', 900, .8); noise('street', 'lowpass', 230, .55); noise('crowd', 'bandpass', 640, .38);
      running = true; pluck(token); return true;
    } catch { if (token === generation) stop(); return false; }
  }
  function setLevels(value) {
    levels = Object.fromEntries(['rain','street','tuning','crowd'].map(id=>[id,bounded(value?.[id])]));
    for (const [id, strength] of [['rain',.8],['street',.55],['crowd',.38]]) gains.get(id)?.gain.setTargetAtTime(levels[id]*strength, context.currentTime, .08);
    if (levels.tuning === 0) for (const source of [...sources]) if (!source.buffer) { source.onended?.(); try { source.stop(); } catch {} }
  }
  function setVolume(value) { volume = Math.max(0,Math.min(.5,Number(value)||0)); if(master)master.gain.setTargetAtTime(volume,context.currentTime,.06); }
  function dispose() { if(disposed)return;disposed=true;stop();master?.disconnect();if(context&&context.state!=='closed')context.close().catch(()=>{}); }
  return {start,stop,setLevels,setVolume,dispose};
}
