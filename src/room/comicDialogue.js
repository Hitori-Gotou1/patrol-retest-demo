import { wrapComicText } from './creativeTools.js';
import { clamp } from './playroom.js';

const faceBox = object => ({
  left: object.x - object.scale * 43, right: object.x + object.scale * 43,
  top: object.y - object.scale * 117, bottom: object.y - object.scale * 64
});

function intersection(bubble, box) {
  return Math.max(0, Math.min(bubble.x + bubble.width, box.right) - Math.max(bubble.x, box.left))
    * Math.max(0, Math.min(bubble.y + bubble.height, box.bottom) - Math.max(bubble.y, box.top));
}

function tailBase(tip, bubble) {
  const { x, y, width, height } = bubble;
  if (tip.x < x - 7 || tip.x > x + width + 7) {
    return { x: tip.x < x ? x + 1 : x + width - 1, y: clamp(tip.y, y + 18, y + height - 18), vertical: true };
  }
  if (tip.y < y - 7 || tip.y > y + height + 7) {
    return { x: clamp(tip.x, x + 20, x + width - 20), y: tip.y < y ? y + 1 : y + height - 1, vertical: false };
  }
  return null;
}

function findTail(bubble, object, faces) {
  const face = faceBox(object);
  const options = [
    { x:object.x, y:face.top - 9 },
    { x:face.left - 8, y:face.top + object.scale * 15 },
    { x:face.right + 8, y:face.top + object.scale * 15 }
  ];
  let best;
  for (const tip of options) {
    if (tip.x < 9 || tip.x > 591 || tip.y < 38 || tip.y > 337) continue;
    const base = tailBase(tip, bubble);
    if (!base) continue;
    const dx = tip.x - base.x, dy = tip.y - base.y;
    const hitsFace = [.24, .48, .72, 1].some(fraction => faces.some(({ left, right, top, bottom }) =>
      base.x + dx * fraction >= left && base.x + dx * fraction <= right &&
      base.y + dy * fraction >= top && base.y + dy * fraction <= bottom));
    const score = Math.hypot(dx, dy) + (hitsFace ? 250 : 0);
    if (!best || score < best.score) best = { base, tip, score };
  }
  if (!best) return null;
  const { base, tip } = best;
  const dx = base.vertical ? 0 : 10, dy = base.vertical ? 8 : 0;
  const start = `${base.x - dx} ${base.y - dy}`, end = `${base.x + dx} ${base.y + dy}`;
  return { path:`M${start}L${tip.x} ${tip.y}L${end}`, x:tip.x, y:tip.y };
}

export function comicDialogue(panel) {
  const lines = wrapComicText(panel.dialogue, 24);
  const longest = Math.max(0, ...lines.map(line => Array.from(line).length));
  const width = clamp(longest * 20 + 36, 128, 524);
  const height = 22 + lines.length * 23;
  const speaker = panel.objects.find(object => panel.speaker === object.key);
  const faces = panel.objects.map(faceBox);
  const preferred = clamp((speaker?.x || 300) - width / 2, 16, 584 - width);
  const bubble = [preferred, 16, 584 - width, 300 - width / 2].reduce((best, x) => {
    const candidate = { x, y:47, width, height };
    const score = faces.reduce((sum, face) => sum + intersection(candidate, face), 0) + Math.abs(x - preferred);
    return score < (best?.score ?? Infinity) ? { ...candidate, score } : best;
  }, null);
  return { ...bubble, lines, tail: speaker ? findTail(bubble, speaker, faces) : null };
}
