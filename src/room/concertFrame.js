import { projectPosition } from './projects.js';
import { lightFrame } from './creativeTools.js';
import { assetUrl } from '../data/site.js';
import { cast } from '../data/playroom.js';

export function concertDimensions(orientation, quality) {
  const long = quality === 'high' ? 1280 : 960;
  const short = long * 9 / 16;
  return orientation === 'portrait' ? { width: short, height: long } : { width: long, height: short };
}

function loadImage(src, signal) {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const clean = () => {
      signal?.removeEventListener('abort', abort);
      img.onload = null;
      img.onerror = null;
    };
    const abort = () => {
      clean();
      img.removeAttribute('src');
      reject(new DOMException('已取消读取。', 'AbortError'));
    };
    if (signal?.aborted) return abort();
    img.onload = () => { clean(); resolve(img); };
    img.onerror = () => { clean(); reject(new Error('舞台图片读取失败，请重试或移除无法读取的画面。')); };
    signal?.addEventListener('abort', abort, { once: true });
    img.src = src;
  });
}

export async function loadConcertImages(project, signal) {
  const [backdrop, poster, members] = await Promise.all([
    loadImage(project.backdrop, signal),
    loadImage(project.poster, signal),
    Promise.all(cast.map(member => loadImage(assetUrl(member.image), signal)))
  ]);
  return { backdrop, poster, cast: members };
}

function cover(paint, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sw = width / scale, sh = height / scale;
  paint.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, width, height);
}
function contain(paint, image, x, y, width, height, bottom = false) {
  const scale = Math.min(width / image.width, height / image.height);
  const w = image.width * scale, h = image.height * scale;
  paint.drawImage(image, x + (width - w) / 2, y + (bottom ? height - h : (height - h) / 2), w, h);
}
function stageFrame(paint, project, pos, images, box, title) {
  const scale = box.width / 900;
  paint.save();
  paint.translate(box.x, box.y);
  paint.scale(scale, scale);
  paint.beginPath();
  paint.rect(0, 0, 900, 520);
  paint.clip();
  paint.fillStyle = '#292334';
  paint.fillRect(0, 0, 900, 520);
  if (images.backdrop) {
    paint.globalAlpha = .65;
    cover(paint, images.backdrop, 0, 0, 900, 450);
    paint.globalAlpha = 1;
  }
  paint.fillStyle = '#59415c';
  paint.beginPath();
  paint.moveTo(0, 0);
  paint.lineTo(900, 0);
  paint.lineTo(900, 55);
  for (let x = 900; x > 0; x -= 300) paint.quadraticCurveTo(x - 150, 150, x - 300, 55);
  paint.closePath();
  paint.fill();
  paint.fillStyle = '#654c64';
  paint.fillRect(0, 430, 900, 90);
  for (const [i, light] of lightFrame(project.lights, pos.step, pos.fraction).entries()) {
    const gradient = paint.createLinearGradient(0, 35, 0, 445);
    gradient.addColorStop(0, light.color + 'aa');
    gradient.addColorStop(1, light.color + '14');
    paint.globalAlpha = light.intensity;
    paint.fillStyle = gradient;
    paint.beginPath();
    paint.moveTo(150 + i * 300, 35);
    paint.lineTo(light.x - 160, 445);
    paint.lineTo(light.x + 160, 445);
    paint.closePath();
    paint.fill();
    paint.fillStyle = light.color;
    paint.globalAlpha *= .5;
    paint.beginPath();
    paint.ellipse(light.x, 435, 155, 20, 0, 0, Math.PI * 2);
    paint.fill();
  }
  paint.globalAlpha = 1;
  if (images.poster) contain(paint, images.poster, 28, 170, 130, 175);
  images.cast.forEach((img, i) => contain(paint, img, 190 + i * 155, 260, 110, 175, true));
  if (title) {
    paint.fillStyle = '#f4dfe7';
    paint.font = '650 24px sans-serif';
    paint.textAlign = 'center';
    paint.fillText(project.name, 450, 485, 840);
  }
  paint.restore();
}

function titleLines(paint, name, width) {
  const lines = [''];
  for (const char of name) {
    const line = lines.at(-1);
    if (line && paint.measureText(line + char).width > width) lines.push(char);
    else lines[lines.length - 1] = line + char;
  }
  return lines;
}

function ticketFrame(paint, project, pos, images, width, height) {
  const margin = width * .055;
  const inside = width - margin * 2;
  const stage = { x: margin, y: height * .34, width: inside };
  paint.fillStyle = '#f3e2cb';
  paint.fillRect(margin, height * .055, inside, height * .89);
  paint.fillStyle = '#493044';
  paint.textAlign = 'left';
  paint.font = `700 ${width * .074}px sans-serif`;
  paint.fillText('STARRY', margin * 1.65, height * .138);
  paint.textAlign = 'right';
  paint.font = `${width * .034}px monospace`;
  paint.fillText('HITORI ROOM', width - margin * 1.65, height * .13);
  paint.strokeStyle = '#9f7888';
  paint.lineWidth = Math.max(1, width * .002);
  paint.beginPath();
  paint.moveTo(margin * 1.65, height * .158);
  paint.lineTo(width - margin * 1.65, height * .158);
  paint.stroke();
  let size = width * .055;
  const lineWidth = inside - margin * 1.3;
  paint.font = `650 ${size}px sans-serif`;
  let lines = titleLines(paint, project.name, lineWidth);
  while (lines.length > 3) {
    size *= .93;
    paint.font = `650 ${size}px sans-serif`;
    lines = titleLines(paint, project.name, lineWidth);
  }
  paint.textAlign = 'left';
  lines.forEach((line, i) => paint.fillText(line, margin * 1.65, height * .2 + i * size * 1.38));
  stageFrame(paint, project, pos, images, stage, false);
  const tear = height * .714;
  paint.strokeStyle = '#8f6b7d';
  paint.setLineDash([width * .013, width * .012]);
  paint.beginPath();
  paint.moveTo(margin, tear);
  paint.lineTo(width - margin, tear);
  paint.stroke();
  paint.setLineDash([]);
  paint.fillStyle = '#211b29';
  for (const x of [margin, width - margin]) {
    paint.beginPath();
    paint.arc(x, tear, margin * .26, 0, Math.PI * 2);
    paint.fill();
  }
  paint.fillStyle = '#593951';
  paint.font = `700 ${width * .038}px sans-serif`;
  paint.fillText('结束乐队 · 演出留影', margin * 1.65, height * .778);
  paint.font = `${width * .033}px sans-serif`;
  paint.fillText(`第 ${pos.bar + 1} 小节 · 第 ${pos.cycle} 轮 · ${project.pattern.bpm} BPM`, margin * 1.65, height * .824);
}

export function paintConcertFrame(paint, project, elapsed, images, width, height) {
  const pos = projectPosition(elapsed * 1000, project);
  paint.fillStyle = '#211b29';
  paint.fillRect(0, 0, width, height);
  if (height > width) {
    ticketFrame(paint, project, pos, images, width, height);
    return;
  }
  const scale = Math.min(width / 900, height / 520);
  stageFrame(paint, project, pos, images, {
    x: (width - 900 * scale) / 2, y: (height - 520 * scale) / 2, width: 900 * scale
  }, true);
}
