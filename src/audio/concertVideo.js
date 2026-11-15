import { validateProject, projectPosition } from '../room/projects.js';
import { lightFrame } from '../room/creativeTools.js';
import { cast } from '../data/playroom.js';
import { assetUrl } from '../data/site.js';
import { renderArrangement } from './arrangementEngine.js';
import { withWebmDuration } from './webmDuration.js';
export function videoFormat(Recorder = globalThis.MediaRecorder) {
  if (!Recorder || typeof Recorder.isTypeSupported !== 'function') return null;
  for (const [mime, extension] of [['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'], ['video/webm;codecs=vp9,opus', 'webm'], ['video/webm;codecs=vp8,opus', 'webm'], ['video/webm', 'webm']]) if (Recorder.isTypeSupported(mime)) return { mime, extension };
  return null;
}
function image(src, signal) {
  return new Promise((resolve, reject) => {
    if (!src) return resolve(null);
    const img = new Image();
    const clean = () => { signal?.removeEventListener('abort', abort); img.onload = null; img.onerror = null; };
    const abort = () => { clean(); img.src=''; reject(new DOMException('已取消导出。', 'AbortError')); };
    img.onload = () => { clean(); resolve(img); }; img.onerror = () => { clean(); reject(new Error('舞台图片读取失败，请重试或移除无法读取的画面。')); };
    signal?.addEventListener('abort', abort, { once: true }); img.src = src;
  });
}
function cover(paint, image, x, y, width, height) { const scale = Math.max(width / image.width, height / image.height); const sw = width / scale, sh = height / scale; paint.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, width, height); }
export function paintConcertFrame(paint, project, elapsed, images, width, height) {
  const pos = projectPosition(elapsed * 1000, project), lights = lightFrame(project.lights, pos.step, pos.fraction);
  paint.fillStyle = '#191724'; paint.fillRect(0, 0, width, height);
  const portrait = height > width, scale = portrait ? width / 900 : Math.min(width / 900, height / 520), stageY = portrait ? height * .29 : (height - 520 * scale) / 2;
  paint.save(); paint.translate((width - 900 * scale) / 2, stageY); paint.scale(scale, scale);
  paint.fillStyle = '#292334'; paint.fillRect(0, 0, 900, 520);
  if (images.backdrop) { paint.save(); paint.globalAlpha = .65; cover(paint, images.backdrop, 0, 0, 900, 450); paint.restore(); }
  paint.fillStyle = '#59415c'; paint.beginPath(); paint.moveTo(0, 0); paint.lineTo(900, 0); paint.lineTo(900, 55); for (let x = 900; x > 0; x -= 300) paint.quadraticCurveTo(x - 150, 150, x - 300, 55); paint.closePath(); paint.fill();
  paint.fillStyle = '#654c64'; paint.fillRect(0, 430, 900, 90);
  for (let i = 0; i < lights.length; i++) { const light = lights[i], gradient = paint.createLinearGradient(0, 35, 0, 445); gradient.addColorStop(0, light.color + 'aa'); gradient.addColorStop(1, light.color + '14'); paint.save(); paint.globalAlpha = light.intensity; paint.fillStyle = gradient; paint.beginPath(); paint.moveTo(150 + i * 300, 35); paint.lineTo(light.x - 160, 445); paint.lineTo(light.x + 160, 445); paint.closePath(); paint.fill(); paint.fillStyle = light.color; paint.globalAlpha *= .5; paint.beginPath(); paint.ellipse(light.x, 435, 155, 20, 0, 0, Math.PI * 2); paint.fill(); paint.restore(); }
  if (images.poster) paint.drawImage(images.poster, 28, 170, 130, 175);
  images.cast.forEach((img, i) => { const fit = Math.min(110 / img.width, 175 / img.height); paint.drawImage(img, 190 + i * 155 + (110 - img.width * fit) / 2, 260 + 175 - img.height * fit, img.width * fit, img.height * fit); });
  paint.fillStyle = '#f4dfe7'; paint.font = '24px sans-serif'; paint.textAlign = 'center'; paint.fillText(project.name, 450, 485, 840); paint.restore();
  if (portrait) { paint.textAlign = 'center'; paint.fillStyle = '#e5a2c1'; paint.font = `${width * .045}px sans-serif`; paint.fillText('HITORI ROOM · STARRY', width / 2, height * .15); paint.fillStyle = '#f4e8d9'; paint.font = `${width * .055}px sans-serif`; paint.fillText(project.name, width / 2, height * .2, width * .88); paint.font = `${width * .031}px sans-serif`; paint.fillText('放学后，把今晚排成一场演出。', width / 2, height * .77); paint.fillStyle = '#b7a0c5'; paint.fillText(`第 ${pos.bar + 1} 小节 · 第 ${pos.cycle} 轮 · ${project.pattern.bpm} BPM`, width / 2, height * .82); }
}
export async function exportConcertVideo(input, { orientation = 'landscape', quality = 'standard', maxSeconds = 60, signal, onProgress = () => {} } = {}) {
  const project = validateProject(input), format = videoFormat();
  if (!format || !HTMLCanvasElement.prototype.captureStream) throw new Error('此浏览器不支持视频录制。可导出项目 JSON、舞台 PNG 与编曲 WAV，在支持的浏览器继续。');
  if (![10, 20, 30, 60].includes(maxSeconds)) throw new Error('请选择 10、20、30 或 60 秒上限。');
  const canvas = document.createElement('canvas'), width = quality === 'high' ? 1280 : 960;
  canvas.width = orientation === 'portrait' ? Math.round(width * 9 / 16) : width; canvas.height = orientation === 'portrait' ? width : Math.round(width * 9 / 16);
  const paint = canvas.getContext('2d');
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw new Error('此浏览器无法准备视频声音。');
  const context = new Audio();
  let stream, source, gain, recorder, animationFrame = 0, completed = false;
  const abortError = () => new DOMException('已取消视频导出，项目仍保留。', 'AbortError');
  try {
    // Browser audio activation must happen in the export click stack.
    await context.resume();
    const [rendered, backdrop, poster, members] = await Promise.all([
      renderArrangement(project.pattern, { cycles: project.cycles, limitSeconds:maxSeconds, useTone: project.useTone, tone: project.tone, signal, onProgress: p => onProgress(p * .25) }),
      image(project.backdrop, signal), image(project.poster, signal), Promise.all(cast.map(member => image(assetUrl(member.image), signal)))
    ]);
    if (signal?.aborted) throw abortError();
    const duration = Math.min(maxSeconds, rendered.duration), images = { backdrop, poster, cast: members };
    const destination = context.createMediaStreamDestination(); gain = context.createGain(); gain.gain.value = 1; gain.connect(destination);
    source = context.createBufferSource(); source.buffer = rendered.buffer; source.connect(gain);
    paintConcertFrame(paint, project, 0, images, canvas.width, canvas.height);
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
      function frame() { if (completed || failure) return; const elapsed = Math.max(0, context.currentTime - origin); paintConcertFrame(paint, project, elapsed, images, canvas.width, canvas.height); onProgress(.25 + Math.min(1, elapsed / duration) * .74); if (elapsed >= duration) { recorder.stop(); return; } animationFrame = requestAnimationFrame(frame); }
      recorder.start(500); source.start(origin); animationFrame = requestAnimationFrame(frame);
    });
    const output = format.extension === 'webm' ? await withWebmDuration(blob, duration + .05) : blob;
    onProgress(1); return { blob: output, extension: format.extension, mime: format.mime, duration, width: canvas.width, height: canvas.height };
  } finally {
    cancelAnimationFrame(animationFrame); if (recorder?.state !== 'inactive' && recorder) recorder.stop(); try { source?.stop(); } catch {} source?.disconnect(); gain?.disconnect(); stream?.getTracks().forEach(track => track.stop()); await context.close().catch(() => {}); canvas.width = 0; canvas.height = 0;
  }
}
