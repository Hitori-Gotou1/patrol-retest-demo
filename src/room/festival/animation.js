import { art, circle, clamp, cream, inset, line, rect, registration, text, weft } from './art.js';
import { patchArt } from './patch.js';

export const puppets = {
  drum: { name: '鼓棒', texture: '#e4a963', dark: '#794c39' },
  hand: { name: '举拨片的手', texture: '#dc8796', dark: '#713d59' },
  cable: { name: '摆动的琴线', texture: '#79a78e', dark: '#3d665e' }
};
export const maxFrames = 16;
export const maxHold = 8;
export const poseBox = { width: 420, height: 294 };
const root = { x: 94, y: 198 };

export function initialAnimation() {
  return {
    puppet: 'drum', selected: 'wind-up', phase: 'pose', patch: null,
    frames: [
      { id: 'wind-up', pose: { shoulder: -50, elbow: 20 }, hold: 1 },
      { id: 'anticipation', pose: { shoulder: -36, elbow: 9 }, hold: 1 },
      { id: 'impact', pose: { shoulder: -7, elbow: 24 }, hold: 1 }
    ]
  };
}

export function copyFrame(frame, id) {
  return { id, pose: { ...frame.pose }, hold: frame.hold };
}

export function betweenFrames(first, second, id) {
  const angle = key => Math.round((first.pose[key] + second.pose[key]) / 2);
  return { id, pose: { shoulder: angle('shoulder'), elbow: angle('elbow') }, hold: 1 };
}

export function expandFrames(frames) {
  let slot = 0;
  return frames.flatMap((frame, frameIndex) => Array.from({ length: frame.hold }, (_, repeat) =>
    ({ frame, frameIndex, repeat, slot: ++slot })));
}

function polar(point, angle, length) {
  const radians = angle * Math.PI / 180;
  return { x: point.x + Math.cos(radians) * length, y: point.y + Math.sin(radians) * length };
}

export function poseGeometry(pose) {
  const elbow = polar(root, pose.shoulder, 91);
  const total = pose.shoulder + pose.elbow;
  const end = polar(elbow, total, 84);
  return { root, elbow, end, total, badge: polar(elbow, total, 47) };
}

export function draggedAngle(pose, joint, point) {
  const base = joint === 'shoulder' ? root : poseGeometry(pose).elbow;
  const degrees = Math.atan2(point.y - base.y, point.x - base.x) * 180 / Math.PI - (joint === 'elbow' ? pose.shoulder : 0);
  const normalized = (degrees + 540) % 360 - 180;
  return clamp(Math.round(normalized), -100, 85);
}

function pivot(point, color) {
  return circle(point.x, point.y, 8, '#f6e2b1', `stroke="${color}" stroke-width="2"`)
    + line({ x: point.x - 3, y: point.y + 3 }, { x: point.x + 3, y: point.y - 3 }, color, 1.5);
}

function jointOutline(a, b, radius) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const x = (a.y - b.y) * radius / length;
  const y = (b.x - a.x) * radius / length;
  return `M${a.x + x} ${a.y + y}L${b.x + x} ${b.y + y}A${radius} ${radius} 0 0 0 ${b.x - x} ${b.y - y}
    L${a.x - x} ${a.y - y}A${radius} ${radius} 0 0 0 ${a.x + x} ${a.y + y}Z`;
}

function puppetArt(model, pose, ghost) {
  const { root, elbow, end, total, badge } = poseGeometry(pose);
  const { texture, dark } = puppets[model.puppet];
  const colors = ghost === 'previous' ? { shade: '#9c4d70', body: 'none' }
    : ghost === 'next' ? { shade: '#426b92', body: 'none' }
      : { shade: dark, body: texture };
  const accent = fill => ghost ? 'none' : fill;
  const borders = 'stroke-linecap="round" stroke-linejoin="round"';
  let prop;
  if (model.puppet === 'cable') {
    prop = `<path d="M0 0C19-33 83-44 78-11C73 27 37 41 36 17C35 6 50 2 58 9" fill="none" stroke="${colors.shade}" stroke-width="${ghost ? 2 : 9}" ${borders}/>
      <path d="M0 0C19-33 83-44 78-11C73 27 37 41 36 17C35 6 50 2 58 9" fill="none" stroke="${colors.body}" stroke-width="5" ${borders}/>
      <rect x="53" y="3" width="16" height="8" rx="2" fill="${accent('#b6854c')}" stroke="${colors.shade}"/>`;
  } else if (model.puppet === 'hand') {
    prop = `<path d="M-12 10Q-21 15-22 3L-21-19Q-20-28-13-23L-9-13L-7-35Q-5-42 1-36L4-23L10-31Q15-34 18-28L17-14Q30-26 35-18Q37-10 21 3L15 14Z" fill="${colors.body}" stroke="${colors.shade}" stroke-width="2.5"/>
      <path d="M16-12Q22-35 39-34Q54-30 51-20Q48-9 35 2Q25-2 16-12Z" fill="${accent('#e8ba5b')}" stroke="${colors.shade}" stroke-width="2.5"/>`;
  } else {
    prop = `<path d="M-29-7L66-4Q81-12 84-3Q85 6 68 5L-29 8Z" fill="${accent('#e8b668')}" stroke="${colors.shade}" stroke-width="2.5"/>
      <path d="M-22-3L63-1" stroke="${accent('#f9df91')}" stroke-width="2"/>
      <path d="M-26-7L-10-6V7L-26 8Z" fill="${accent('#885b50')}" opacity=".8"/>`;
  }
  if (ghost) {
    const thin = model.puppet === 'cable';
    const pattern = ghost === 'previous' ? '8 4' : '2 6';
    return `<g data-onion="${ghost}" stroke="${colors.shade}" stroke-dasharray="${pattern}" stroke-width="2.2" opacity=".83" fill="none">
      <path d="${jointOutline(root, elbow, thin ? 6 : 16)}"/>
      <path d="${jointOutline(elbow, end, thin ? 5.5 : 13.5)}"/>
      <circle cx="${elbow.x}" cy="${elbow.y}" r="5"/>
      <g transform="translate(${end.x} ${end.y}) rotate(${total})">${prop}</g>
      </g>`;
  }
  return `<g data-onion="current">
    ${line(root, elbow, colors.shade, model.puppet === 'cable' ? 12 : 32, borders)}
    ${line(root, elbow, colors.body, model.puppet === 'cable' ? 8 : 27, borders)}
    ${line(elbow, end, colors.shade, model.puppet === 'cable' ? 11 : 27, borders)}
    ${line(elbow, end, colors.body, model.puppet === 'cable' ? 7 : 22, borders)}
    ${pivot(root, colors.shade)}${pivot(elbow, colors.shade)}${pivot(end, colors.shade)}
    <g transform="translate(${end.x} ${end.y}) rotate(${total})">${prop}</g>
    ${model.patch ? `<g data-puppet-patch="" transform="translate(${badge.x} ${badge.y}) rotate(${total})">${inset(patchArt(model.patch.data), -20, -38, 42, 43)}</g>` : ''}
    </g>`;
}

export function poseArt(model, pose, { previous, next, guides = false } = {}) {
  const { width, height } = poseBox;
  const drum = model.puppet === 'drum' ? `<g>
    <path d="M239 242L250 275H352L366 242Z" fill="#906971" stroke="#684b55" stroke-width="2"/>
    <ellipse cx="303" cy="240" rx="64" ry="17" fill="#f5dba2" stroke="#684b55" stroke-width="3"/>
    <ellipse cx="303" cy="239" rx="55" ry="12" fill="#f9ebc6" stroke="#ae8365" stroke-width="1"/>
    <path d="M253 252L259 272M270 256L273 273M350 250L343 272" stroke="#eac5a0" stroke-width="2"/>
    </g>` : '';
  return art(width, height, rect(0, 0, width, height, '#f4e8cf')
    + rect(11, 11, width - 22, height - 22, '#fff5d8', 'stroke="#c7ab8d" stroke-width="1"')
    + weft(width, height, '#d9c4a5', 17)
    + registration(25, 27, '#9e695b') + registration(width - 25, 27, '#9e695b')
    + line({ x: 24, y: 223 }, { x: width - 24, y: 223 }, '#c1a88e', 1, 'stroke-dasharray="3 5"')
    + circle(26, 146, 5, '#b99c7d') + circle(394, 146, 5, '#b99c7d')
    + drum
    + (previous ? puppetArt(model, previous, 'previous') : '') + (next ? puppetArt(model, next, 'next') : '')
    + puppetArt(model, pose)
    + (guides ? text(22, height - 22, 'STARRY  ·  透光定位台', 12, '#75534f', 'letter-spacing="1"') : ''));
}

export function filmStripArt(model, slots = expandFrames(model.frames), { columns = 4, caption = true } = {}) {
  const colCount = Math.max(1, Math.min(columns, slots.length));
  const cellW = 192, cellH = 158, margin = 16, header = caption ? 39 : 8;
  const width = cellW * colCount + margin * 2, height = Math.ceil(slots.length / colCount) * cellH + header + 14;
  const cells = slots.map((slot, index) => {
    const x = margin + (index % colCount) * cellW, y = header + Math.floor(index / colCount) * cellH;
    const teeth = Array.from({ length: 9 }, (_, tooth) => rect(x + 8 + tooth * 19, y + 5, 9, 4.5, '#d5ad7e', 'rx="1"')).join('');
    return `<g data-film-slot="${slot.slot}" data-source-frame="${slot.frameIndex + 1}">
      ${rect(x, y, 186, 154, '#42303b', 'rx="4"')}
      ${teeth}
      ${inset(poseArt(model, slot.frame.pose), x + 7, y + 13, 172, 121)}
      ${text(x + 9, y + 147, `${String(slot.slot).padStart(2, '0')}  /  帧 ${slot.frameIndex + 1} · ${slot.repeat + 1}/${slot.frame.hold}`, 10, cream)}
      </g>`;
  }).join('');
  return art(width, height, rect(0, 0, width, height, '#28212c')
    + (caption ? text(margin, 25, `STARRY 手摇片带 · ${slots.length} 格`, 15, cream, 'font-weight="700"') : '') + cells);
}
