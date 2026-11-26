import { validateProject } from '../room/projects.js';
import { concertDimensions, loadConcertImages, paintConcertFrame } from '../room/concertFrame.js';
export { paintConcertFrame } from '../room/concertFrame.js';
import { renderArrangement } from './arrangementEngine.js';
import { withWebmDuration } from './webmDuration.js';
export function videoFormat(Recorder = globalThis.MediaRecorder) {
  if (!Recorder || typeof Recorder.isTypeSupported !== 'function') return null;
  for (const [mime, extension] of [['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'], ['video/webm;codecs=vp9,opus', 'webm'], ['video/webm;codecs=vp8,opus', 'webm'], ['video/webm', 'webm']]) if (Recorder.isTypeSupported(mime)) return { mime, extension };
  return null;
}
export async function exportConcertVideo(input, { orientation = 'landscape', quality = 'standard', maxSeconds = 60, signal, onProgress = () => {}, onFrame = () => {} } = {}) {
  const project = validateProject(input), format = videoFormat();
  if (!format || !HTMLCanvasElement.prototype.captureStream) throw new Error('此浏览器不支持视频录制。可导出项目 JSON、舞台 PNG 与编曲 WAV，在支持的浏览器继续。');
  if (![10, 20, 30, 60].includes(maxSeconds)) throw new Error('请选择 10、20、30 或 60 秒上限。');
  const canvas = document.createElement('canvas');
  Object.assign(canvas, concertDimensions(orientation, quality));
  const paint = canvas.getContext('2d');
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw new Error('此浏览器无法准备视频声音。');
  const context = new Audio();
  let stream, source, gain, recorder, animationFrame = 0, completed = false;
  const abortError = () => new DOMException('已取消视频导出，项目仍保留。', 'AbortError');
  try {
    // Browser audio activation must happen in the export click stack.
    await context.resume();
    const [rendered, images] = await Promise.all([
      renderArrangement(project.pattern, { cycles: project.cycles, limitSeconds:maxSeconds, useTone: project.useTone, tone: project.tone, signal, onProgress: p => onProgress(p * .25) }),
      loadConcertImages(project, signal)
    ]);
    if (signal?.aborted) throw abortError();
    const duration = Math.min(maxSeconds, rendered.duration);
    const destination = context.createMediaStreamDestination(); gain = context.createGain(); gain.gain.value = 1; gain.connect(destination);
    source = context.createBufferSource(); source.buffer = rendered.buffer; source.connect(gain);
    paintConcertFrame(paint, project, 0, images, canvas.width, canvas.height);
    onFrame(0);
    const visual = canvas.captureStream(30); stream = new MediaStream([...visual.getVideoTracks(), ...destination.stream.getAudioTracks()]);
    recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: quality === 'high' ? 5_000_000 : 2_500_000, audioBitsPerSecond: 128000 });
    const chunks = [], origin = context.currentTime + .05;
    if (duration < rendered.duration) { gain.gain.setValueAtTime(1, origin + Math.max(0, duration - .15)); gain.gain.linearRampToValueAtTime(0, origin + duration); }
    const blob = await new Promise((resolve, reject) => {
      let failure = null;
      function clean() { signal?.removeEventListener('abort', abort); document.removeEventListener('visibilitychange', hidden); }
      function fail(error) { if (completed || failure) return; failure = error; if (recorder.state !== 'inactive') recorder.stop(); else { clean(); reject(error); } }
      function abort() { fail(abortError()); }
      function hidden() { if (document.hidden) fail(new Error('视频导出因页面进入后台而停止。请保持页面可见，再次导出；项目仍保留。')); }
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = event => fail(event.error || new Error('浏览器视频编码失败。'));
      recorder.onstop = () => { completed = true; clean(); if (failure) reject(failure); else if (!chunks.length) reject(new Error('未生成视频数据，请重试或选择其他浏览器。')); else resolve(new Blob(chunks, { type: format.mime })); };
      signal?.addEventListener('abort', abort, { once: true }); document.addEventListener('visibilitychange', hidden);
      function frame() { if (completed || failure) return; const elapsed = Math.min(duration, Math.max(0, context.currentTime - origin)); paintConcertFrame(paint, project, elapsed, images, canvas.width, canvas.height); onFrame(elapsed); onProgress(.25 + Math.min(1, elapsed / duration) * .74); if (elapsed >= duration) { recorder.stop(); return; } animationFrame = requestAnimationFrame(frame); }
      recorder.start(500); source.start(origin); animationFrame = requestAnimationFrame(frame);
    });
    const output = format.extension === 'webm' ? await withWebmDuration(blob, duration + .05) : blob;
    onProgress(1); return { blob: output, extension: format.extension, mime: format.mime, duration, width: canvas.width, height: canvas.height };
  } finally {
    cancelAnimationFrame(animationFrame); if (recorder?.state !== 'inactive' && recorder) recorder.stop(); try { source?.stop(); } catch {} source?.disconnect(); gain?.disconnect(); stream?.getTracks().forEach(track => track.stop()); await context.close().catch(() => {}); canvas.width = 0; canvas.height = 0;
  }
}
