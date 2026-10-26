import { ref, onMounted, onUnmounted } from 'vue';
export function useChord() {
  const playing = ref(false), message = ref('');
  let context, output, sources = [], request = 0;
  function stop() {
    for (const source of sources) { source.onended = null; try { source.stop(); } catch {} source.disconnect(); }
    sources = []; output?.disconnect(); output = null; playing.value = false;
  }
  function pluck(frequency) {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 1.25), context.sampleRate);
    const samples = buffer.getChannelData(0), delay = Math.round(context.sampleRate / frequency), string = new Float32Array(delay);
    for (let i = 0; i < delay; i++) string[i] = Math.random() * 2 - 1;
    // 阻尼延迟环合成拨弦，不读取或复制动画原声。
    for (let i = 0; i < samples.length; i++) {
      const n = i % delay, value = string[n];
      string[n] = (value + string[(n + 1) % delay]) * .496;
      samples[i] = value * Math.min(1, i / (context.sampleRate * .004)) * Math.min(1, (samples.length - i) / (context.sampleRate * .12));
    }
    return buffer;
  }
  async function play() {
    const token = ++request; stop();
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      context ||= new Audio();
      await context.resume();
      if (token !== request) return;
      const gain = context.createGain(); gain.gain.value = .13; gain.connect(context.destination); output = gain;
      playing.value = true;
      [82.41,123.47,164.81,196,246.94,329.63].forEach((frequency,index) => {
        const source = context.createBufferSource(); source.buffer = pluck(frequency); source.connect(gain); sources.push(source);
        source.onended = () => { source.disconnect(); sources = sources.filter(s => s !== source); if (token === request && !sources.length) { gain.disconnect(); output = null; playing.value = false; } };
        source.start(context.currentTime + .015 + index * .025);
      });
      message.value = '和弦响起，今天也向前一点。';
    } catch { if (token === request) { stop(); message.value = '暂时无法播放，请再试一次。'; } }
  }
  function pause() { request++; stop(); if (context?.state === 'running') context.suspend().catch(() => {}); }
  function hidden() { if (document.hidden) pause(); }
  onMounted(() => { window.addEventListener('pagehide', pause); document.addEventListener('visibilitychange', hidden); });
  onUnmounted(() => { pause(); context?.close().catch(() => {}); window.removeEventListener('pagehide', pause); document.removeEventListener('visibilitychange', hidden); });
  return { playing, message, play };
}
