import { art, circle, clamp, cream, inset, line, registration, rect, text, weft, xml } from './art.js';

const makePins = positions => positions.map(([x, y], index) => ({ x, y, id: String.fromCharCode(65 + index) }));
const emptyPins = Array.from({ length: 7 }, (_, row) =>
  Array.from({ length: 7 }, (_, col) => ({ id: `${String.fromCharCode(65 + row)}${col + 1}`, x: 72 + col * 26, y: 72 + row * 26 }))
).flat();

export const templates = {
  pick: { name: '拨片', pins: makePins([[101, 85], [199, 85], [227, 125], [173, 210], [127, 210], [73, 125], [99, 169], [201, 169]]), outline: 'M101 85 Q150 62 199 85 Q225 96 227 125 Q218 154 201 169 L173 210 Q150 246 127 210 L99 169 Q80 147 73 125 Q75 95 101 85Z' },
  coil: { name: '盘起的琴线', pins: makePins([[148, 183], [111, 178], [100, 141], [128, 110], [170, 108], [199, 128], [204, 163], [184, 195], [145, 213], [101, 207], [74, 181], [71, 133], [91, 94], [138, 75], [187, 82], [224, 104], [242, 123]]), outline: 'M148 183 C89 195 82 111 145 107 C222 90 229 181 163 210 C92 236 52 199 76 124 C104 54 197 62 242 123' },
  sticks: { name: '鼓棒', pins: makePins([[78, 193], [102, 217], [220, 104], [196, 80], [68, 104], [91, 79], [222, 194], [198, 219], [148, 136], [148, 169]]), outline: 'M78 193L196 80 Q215 67 225 87L220 104 102 217Z M68 104 Q54 84 75 75L91 79 222 194 198 219Z' },
  blank: { name: '空白底布', pins: emptyPins, outline: '' }
};

export const threadColors = {
  blue: { name: '钴蓝', shade: '#163a6b', body: '#4177c4', shine: '#9bc7ed' },
  yellow: { name: '金黄', shade: '#935821', body: '#f1b743', shine: '#ffdf80' },
  rose: { name: '莓红', shade: '#743448', body: '#c7697f', shine: '#f5acb0' },
  mint: { name: '松绿', shade: '#325a4a', body: '#679581', shine: '#b5d1a2' }
};

export const edges = {
  round: { name: '圆形', path: 'M150 21a129 129 0 1 1 0 258a129 129 0 1 1 0-258Z' },
  ticket: { name: '圆角方形', path: 'M57 26H243Q274 26 274 57V243Q274 274 243 274H57Q26 274 26 243V57Q26 26 57 26Z' },
  crest: { name: '盾形', path: 'M39 33Q150 14 261 33L263 155Q253 233 150 284Q47 233 37 155Z' }
};

export function initialPiece(template = 'pick') {
  return { template, stitches: [], crossings: {}, edge: 'round', spacing: 5, mount: { x: 256, y: 177, scale: 0.7, angle: -9, pins: [] } };
}

export function initialPatchDraft() {
  return { active: 'pick', color: 'blue', phase: 'sew', pieces: Object.fromEntries(Object.keys(templates).map(key => [key, initialPiece(key)])) };
}

export function examplePatch() {
  const piece = initialPiece();
  piece.stitches = [
    ['A', 'B', 'blue'], ['C', 'D', 'blue'], ['E', 'F', 'blue'], ['B', 'C', 'blue'],
    ['D', 'E', 'blue'], ['F', 'A', 'blue'], ['A', 'D', 'blue'], ['B', 'E', 'yellow']
  ].map(([from, to, color], index) => ({ from, to, color, id: `sample-${index}` }));
  piece.crossings['sample-6:sample-7'] = 'sample-6';
  return piece;
}

export function needlePaths(piece) {
  const points = new Map(templates[piece.template].pins.map(point => [point.id, point]));
  const front = piece.stitches.map(stitch => ({ ...stitch, a: points.get(stitch.from), b: points.get(stitch.to) }));
  const back = [];
  const previousEnds = new Map();
  for (const stitch of front) {
    const last = previousEnds.get(stitch.color);
    if (last && last.id !== stitch.a.id) {
      back.push({ id: stitch.id, color: stitch.color, from: last.id, to: stitch.from, a: last, b: stitch.a });
    }
    previousEnds.set(stitch.color, stitch.b);
  }
  return { front, back };
}

function intersection(first, second) {
  const direction = edge => ({ x: edge.b.x - edge.a.x, y: edge.b.y - edge.a.y });
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const delta = { x: second.a.x - first.a.x, y: second.a.y - first.a.y };
  const a = direction(first), b = direction(second), denominator = cross(a, b);
  if (denominator === 0) return null;
  const t = cross(delta, b) / denominator, u = cross(delta, a) / denominator;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return { x: first.a.x + t * a.x, y: first.a.y + t * a.y };
}

export function stitchCrossings(piece, front = needlePaths(piece).front) {
  const crossings = [];
  for (const [index, first] of front.entries()) {
    for (const second of front.slice(index + 1)) {
      const point = intersection(first, second);
      if (!point) continue;
      const id = `${first.id}:${second.id}`;
      const top = piece.crossings[id] === first.id ? first : second;
      crossings.push({ id, point, first, second, top });
    }
  }
  return crossings;
}

export function removeStitch(piece, id) {
  piece.stitches = piece.stitches.filter(stitch => stitch.id !== id);
  for (const key of Object.keys(piece.crossings)) {
    if (key.split(':').includes(id)) delete piece.crossings[key];
  }
}

function thread(stitch, { back = false, latest = false } = {}) {
  const color = threadColors[stitch.color];
  const soft = 'stroke-linecap="round"';
  return `<g data-stitch="${xml(stitch.id)}" ${latest ? 'data-latest-thread=""' : ''}>`
    + line({ x: stitch.a.x + 1, y: stitch.a.y + 2 }, { x: stitch.b.x + 1, y: stitch.b.y + 2 }, '#332320', back ? 5 : 8.5, `${soft} opacity=".28"`)
    + line(stitch.a, stitch.b, color.shade, back ? 4.5 : 7, soft)
    + line(stitch.a, stitch.b, color.body, back ? 3.2 : 5.6, soft)
    + line(stitch.a, stitch.b, color.shine, back ? 1.1 : 2, `${soft} stroke-dasharray="1 3" opacity=".72"`)
    + '</g>';
}

function crossover(item, crossings) {
  const { id, point, top } = item;
  const nearest = Math.min(18, ...crossings.filter(other => other !== item).map(other => Math.hypot(point.x - other.point.x, point.y - other.point.y)));
  const length = Math.hypot(top.b.x - top.a.x, top.b.y - top.a.y);
  const half = Math.min(nearest * .45, 8, Math.hypot(point.x - top.a.x, point.y - top.a.y), Math.hypot(point.x - top.b.x, point.y - top.b.y));
  const dx = (top.b.x - top.a.x) / length * half, dy = (top.b.y - top.a.y) / length * half;
  const span = { ...top, a: { x: point.x - dx, y: point.y - dy }, b: { x: point.x + dx, y: point.y + dy } };
  return `<g data-crossing="${xml(id)}" data-over="${top.color}">${thread(span)}</g>`;
}

let maskNumber = 0;

export function patchArt(piece, { side = 'front', guide = false, latest, showCrossings = false } = {}) {
  const isBack = side === 'back';
  const path = edges[piece.edge].path;
  const mask = `fest-weft-${++maskNumber}`;
  const { front, back } = needlePaths(piece);
  const crossings = stitchCrossings(piece, front);
  const pinShadows = templates[piece.template].pins.map(pin => circle(pin.x, pin.y, 2.3, '#896d5d', 'opacity=".65"')).join('');
  const strands = isBack
    ? `<g transform="translate(300) scale(-1 1)">${pinShadows}${back.map(stitch => thread(stitch, { back: true })).join('')}</g>`
    : pinShadows + front.map(stitch => thread(stitch, { latest: stitch.id === latest })).join('') + crossings.map(crossing => crossover(crossing, crossings)).join('');
  const crossingLabels = showCrossings && !isBack ? crossings.map(({ point }, index) =>
    circle(point.x + 9, point.y - 10, 7, '#2b2430', 'stroke="#f7efe0" stroke-width="1"') + text(point.x + 9, point.y - 7.5, index + 1, 8, cream, 'text-anchor="middle"')
  ).join('') : '';
  return art(300, 307,
    `<path d="${path}" transform="translate(2 6)" fill="#2a2726" opacity=".32"/>
    <path d="${path}" fill="${isBack ? '#d0aa8a' : '#edc9a0'}" stroke="#613e34" stroke-width="5"/>
    <mask id="${mask}"><path d="${path}" fill="white"/></mask>
    <g mask="url(#${mask})">${weft(300, 300, '#755343', 3)}</g>
    <path d="${path}" fill="none" stroke="#997354" stroke-width="10"/>
    <path d="${path}" fill="none" stroke="${isBack ? '#eee0b1' : '#f5ddad'}" stroke-width="8" stroke-dasharray="1.5 ${piece.spacing}"/>
    ${guide ? `<path d="${templates[piece.template].outline}" stroke="#6a514d" stroke-width="1.3" opacity=".63" stroke-dasharray="4 4" fill="none"/>` : ''}
    ${strands}${crossingLabels}`);
}

export const hoopBox = { width: 460, height: 366, x: 80, y: 31 };

export function hoopArt(piece, options) {
  const { width, height, x, y } = hoopBox;
  return art(width, height, rect(0, 0, width, height, '#302426')
    + weft(width, height, '#9a7062', 4)
    + circle(231, 185, 154, '#151119', 'opacity=".65"')
    + circle(230, 174, 151, '#8f5d42', 'stroke="#cf9d71" stroke-width="5"')
    + circle(230, 179, 141, '#bd8d65', 'stroke="#6e4434" stroke-width="4"')
    + inset(patchArt(piece, options), x, y, 300, 307)
    + rect(217, 10, 26, 15, '#705545', 'rx="4"')
    + rect(228, 4, 43, 6, '#d7aa66', 'rx="3"')
    + registration(29, height - 30, '#c49168') + registration(width - 29, 30, '#c49168'));
}

export const caseBox = { width: 620, height: 360 };
const sewingPointOffsets = {
  round: [[-77, -81], [77, -81], [77, 81], [-77, 81]],
  ticket: [[-103, -97], [103, -97], [103, 97], [-103, 97]],
  crest: [[-86, -94], [86, -94], [52, 68], [-52, 68]]
};
export const sewingPoints = edge => sewingPointOffsets[edge].map(([x, y]) => ({ x, y }));

export function casePosition(mount, point) {
  const angle = mount.angle * Math.PI / 180;
  return { x: mount.x + mount.scale * (point.x * Math.cos(angle) - point.y * Math.sin(angle)),
    y: mount.y + mount.scale * (point.x * Math.sin(angle) + point.y * Math.cos(angle)) };
}

export function positionedMount(mount, x, y) {
  return { ...mount, x: clamp(Math.round(x), 155, 472), y: clamp(Math.round(y), 124, 237) };
}

export function caseArt(piece, { peeled = false, editor = false } = {}) {
  const { width, height } = caseBox;
  const { x, y, scale, angle, pins } = piece.mount;
  const mask = `fest-case-${++maskNumber}`;
  const bag = 'M103 77Q134 55 216 65L490 98Q549 107 554 166L555 217Q552 260 497 271L217 308Q122 323 93 274Q63 224 67 166Q70 105 103 77Z';
  const peelMask = `fest-peel-${++maskNumber}`;
  const attachment = sewingPoints(piece.edge).map((point, index) => {
    if (!pins.includes(index)) return editor ? circle(point.x, point.y, 6, '#9a6d5d', 'stroke="#fff0c9" stroke-width="2"') : '';
    const a = { x: point.x - 7, y: point.y + 4 }, b = { x: point.x + 7, y: point.y - 4 };
    return circle(a.x, a.y, 3, '#735348') + circle(b.x, b.y, 3, '#735348')
      + line(a, b, '#97662e', 5, 'stroke-linecap="round"')
      + line(a, b, '#f4c672', 3, 'stroke-linecap="round"');
  }).join('');
  const cloth = peeled
    ? `<path d="M-133 24Q-93 82 8 129Q-30 112-62 90Q-105 75-133 24Z" fill="#9b644f" stroke="#593829" stroke-width="3"/>
      <path d="M-128 29Q-93 83-14 116Q-32 96-62 79Q-101 71-128 29Z" fill="#f5dfb9" stroke="#856347" stroke-width="2"/>`
    : '';
  const face = inset(patchArt(piece), -150, -150, 300, 307);
  const patch = peeled ? `<mask id="${peelMask}" maskUnits="userSpaceOnUse" x="-150" y="-150" width="300" height="307">
    <rect x="-150" y="-150" width="300" height="307" fill="white"/>
    <path d="M-149 12Q-95 84 8 131L12 157H-149Z" fill="black"/>
    </mask><g mask="url(#${peelMask})">${face}</g>` : face;
  return art(width, height, rect(0, 0, width, height, '#d5ad78')
    + weft(width, height, '#74553b', 7)
    + `<path d="${bag}" transform="translate(4 11)" fill="#583929" opacity=".43"/>
    <path d="${bag}" fill="#292c34" stroke="#53434a" stroke-width="16"/>
    <mask id="${mask}"><path d="${bag}" fill="white"/></mask>
    <g mask="url(#${mask})">${weft(width, height, '#a49ca3', 4)}</g>
    <path d="${bag}" fill="none" stroke="#a4908d" stroke-width="2" stroke-dasharray="3 5"/>
    <path d="M440 93Q461 44 502 65L519 92" fill="none" stroke="#44313b" stroke-width="15" stroke-linecap="round"/>
    <path d="M361 255Q446 237 515 232" stroke="#ac8779" stroke-width="2" stroke-dasharray="2 3"/>
    <rect x="454" y="192" width="62" height="27" rx="2" fill="#bc8d71"/>
    ${text(485, 210, 'STARRY', 12, '#2d2830', 'text-anchor="middle" letter-spacing="1.6" font-weight="800"')}
    <g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})">${patch}${cloth}${attachment}</g>`);
}

export function patchCardArt(piece) {
  return art(760, 430, rect(0, 0, 760, 430, '#f3e9d6')
    + text(28, 38, `STARRY 工艺卡 · ${templates[piece.template].name}`, 24)
    + line({ x: 28, y: 54 }, { x: 732, y: 54 }, '#b88366')
    + inset(patchArt(piece), 41, 61, 310, 317)
    + inset(patchArt(piece, { side: 'back' }), 407, 61, 310, 317)
    + text(195, 393, '正面', 17, '#4e3831', 'text-anchor="middle"')
    + text(562, 393, '背面', 17, '#4e3831', 'text-anchor="middle"')
    + text(380, 417, `${edges[piece.edge].name} · 针距 ${piece.spacing} · 正面 ${piece.stitches.length} 针`, 13, '#4e3831', 'text-anchor="middle"'));
}
