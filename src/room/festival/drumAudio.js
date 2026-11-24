function drumSample(context) {
  const buffer = context.createBuffer(1, Math.round(context.sampleRate * .112), context.sampleRate);
  const samples = buffer.getChannelData(0);
  let random = 40391;
  for (let index = 0; index < samples.length; index++) {
    const time = index / context.sampleRate;
    random = (Math.imul(1664525, random) + 1013904223) >>> 0;
    const noise = (random / 4294967296 * 2 - 1) * Math.exp(-time * 135) * .66;
    const body = Math.sin(2 * Math.PI * (154 * time - 210 * time * time)) * Math.exp(-time * 69) * .57;
    samples[index] = (noise + body) * Math.min(1, time / .0015);
  }
  return buffer;
}

export function createDrumPlayer() {
  let context, buffer, master;
  let hits = [], generation = 0;

  function stop() {
    generation++;
    for (const hit of hits) {
      try { hit.stop(); } catch {}
      hit.disconnect();
    }
    hits = [];
  }

  async function play(paths, volume, claim) {
    stop();
    const token = generation;
    try {
      if (!context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();
        buffer = drumSample(context);
        master = context.createGain();
        master.connect(context.destination);
      }
      if (context.state !== 'running') await context.resume();
      if (token !== generation || context.state !== 'running') return false;
      claim();
      const start = context.currentTime + .014;
      master.gain.setValueAtTime(volume * .65 / (1 + paths[0].distance * .08), start);
      for (const route of paths) {
        const hit = context.createBufferSource();
        const gain = context.createGain();
        gain.gain.value = Math.sqrt(route.relative);
        hit.buffer = buffer;
        hit.connect(gain).connect(master);
        hits.push(hit);
        hit.addEventListener('ended', () => {
          hit.disconnect();
          gain.disconnect();
          hits = hits.filter(node => node !== hit);
        }, { once: true });
        hit.start(start + route.ms / 1000);
      }
      return true;
    } catch {
      return false;
    }
  }

  function dispose() {
    stop();
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }

  return { play, stop, dispose };
}
