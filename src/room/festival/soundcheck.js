import { art, circle, clamp, cream, inset, line, rect, registration, text } from './art.js';

export const speedOfSound = 343;
export const roomWidth = 12;
export const roomDepthLimits = [13, 18];
export const seats = {
  front: { name: '前排', x: 5, y: 5 },
  rear: { name: '后排', x: 7, y: 12 },
  side: { name: '侧台', x: 1.8, y: 8 }
};
export const routes = {
  direct: { name: '直达声', color: '#f6ca71' },
  left: { name: '左墙反射', color: '#9fd6c3' },
  rear: { name: '后墙反射', color: '#f1a8a9' }
};

export function initialRoom() {
  return { seat: 'front', source: { x: 5, y: 2 }, listener: { x: 5, y: 5 }, depth: 15, curtains: { left: false, rear: false } };
}

export const initialSoundDraft = () => ({ current: initialRoom(), baseline: null, task: 'front-dry', slow: false, comparison: 'after' });

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function reflectionPoint(source, listener, axis, boundary) {
  const mirror = { ...source, [axis]: boundary * 2 - source[axis] };
  const proportion = (boundary - mirror[axis]) / (listener[axis] - mirror[axis]);
  return { x: mirror.x + (listener.x - mirror.x) * proportion,
    y: mirror.y + (listener.y - mirror.y) * proportion, [axis]: boundary };
}

export function readings(room) {
  const { source, listener, depth, curtains } = room;
  const direct = distance(source, listener);
  const paths = [
    { id: 'direct', points: [source, listener], distance: direct, relative: 1 },
    ...[['left', 'x', 0], ['rear', 'y', depth]].map(([id, axis, boundary]) => {
      const bounce = reflectionPoint(source, listener, axis, boundary);
      const length = distance(source, bounce) + distance(bounce, listener);
      const reflection = curtains[id] ? .22 : .82;
      return { id, points: [source, bounce, listener], distance: length, relative: (direct / length * reflection) ** 2 };
    })
  ];
  return paths.map(path => ({ ...path, ...routes[path.id], ms: path.distance / speedOfSound * 1000 }));
}

export function pointAlongRoute(route, fraction) {
  let remaining = route.distance * fraction;
  for (let index = 1; index < route.points.length; index++) {
    const a = route.points[index - 1], b = route.points[index];
    const length = distance(a, b);
    if (remaining <= length) {
      const mix = length ? remaining / length : 0;
      return { x: a.x + (b.x - a.x) * mix, y: a.y + (b.y - a.y) * mix };
    }
    remaining -= length;
  }
  return route.points.at(-1);
}

export function placePoint(room, x, y) {
  return { x: Math.round(clamp(x, .8, roomWidth - .8) * 10) / 10,
    y: Math.round(clamp(y, .8, room.depth - .6) * 10) / 10 };
}

export const milliseconds = value => `${value.toFixed(1)} ms`;
export const percentage = value => `${(value * 100).toFixed(1)}%`;
export const seatName = room => seats[room.seat]?.name || '自定位置';

export function taskResults(task, room, paths = readings(room)) {
  const [direct, left, rear] = paths;
  if (task === 'front-dry') {
    return [
      { label: '前排直达声 ≤ 12 ms', value: `${seatName(room)} · ${milliseconds(direct.ms)}`, done: room.seat === 'front' && direct.ms <= 12 },
      { label: '后墙反射 ≤ 0.4%', value: percentage(rear.relative), done: rear.relative <= .004 }
    ];
  }
  const gap = Math.abs(left.ms - rear.ms);
  const quieter = Math.min(left.relative, rear.relative);
  return [
    { label: '两次反射相差 ≥ 14 ms', value: milliseconds(gap), done: gap >= 14 },
    { label: '两次反射各 ≥ 3%', value: `${percentage(left.relative)} / ${percentage(rear.relative)}`, done: quieter >= .03 }
  ];
}

export const soundTasks = {
  'front-dry': { name: '前排留清楚，压低后墙', goal: '直达 ≤ 12 ms · 后墙 ≤ 0.4%', hint: '坐在前排，试着给后墙挂帘。' },
  'echo-order': { name: '听清两次反射的先后', goal: '间隔 ≥ 14 ms · 反射各 ≥ 3%', hint: '试试侧台。帘子会降低反射，挪后墙会改到达时间。' }
};

export function exampleReport() {
  const before = initialRoom();
  before.seat = 'rear';
  before.listener = { x: seats.rear.x, y: seats.rear.y };
  const after = { ...before, curtains: { ...before.curtains, rear: true } };
  return { before, after, task: 'echo-order' };
}

export const roomBox = { width: 460, height: 363, x: 46, y: 74, scaleX: 29.7, scaleY: 13.9 };
export const mapPoint = ({ x, y }) => ({ x: roomBox.x + x * roomBox.scaleX, y: roomBox.y + y * roomBox.scaleY });

function curtainLine(first, second, color, hung) {
  return line(first, second, color, hung ? 8 : 3, hung ? 'stroke-dasharray="3 3" opacity=".85"' : 'opacity=".65"');
}

export function roomArt(room, paths = readings(room), { compare = false } = {}) {
  const { width, height, x, y, scaleX, scaleY } = roomBox;
  const wallY = mapPoint({ x: 0, y: room.depth }).y;
  const rightX = x + roomWidth * scaleX;
  const chairs = Array.from({ length: 7 }, (_, row) => Array.from({ length: 9 }, (_, col) => {
    if (col === 4 || col === 8) return '';
    const cx = x + 24 + col * 34.5, cy = y + 35 + row * 20;
    if (cy > wallY - 13) return '';
    return rect(cx, cy, 19, 10, '#3c484e', 'rx="2"') + line({ x: cx + 2, y: cy + 8 }, { x: cx + 17, y: cy + 8 }, '#637175', 1);
  }).join('')).join('');
  const { source, listener } = room;
  const s = mapPoint(source), l = mapPoint(listener);
  const lines = paths.map(path => {
    const points = path.points.map(mapPoint);
    return `<polyline data-sound-path="${path.id}" points="${points.map(point => `${point.x},${point.y}`).join(' ')}" fill="none"
      stroke="${path.color}" stroke-width="${path.id === 'direct' ? 2.8 : 1.4 + 2.4 * Math.sqrt(path.relative)}"
      stroke-linejoin="round" stroke-opacity="${path.id === 'direct' ? 1 : .43 + Math.sqrt(path.relative) * .65}"
      ${path.id === 'direct' ? '' : 'stroke-dasharray="7 4"'}/>
      ${points.length === 3 ? circle(points[1].x, points[1].y, 4, path.color, 'stroke="#222a2e" stroke-width="1"') : ''}`;
  }).join('');
  return art(width, height, rect(0, 0, width, height, '#222b30')
    + rect(x, 17, roomWidth * scaleX, y - 17, '#46383d', 'rx="4"')
    + text(x + 13, 40, 'STARRY / STAGE', 12, '#ebc692', 'letter-spacing="2"')
    + rect(x, y, roomWidth * scaleX, wallY - y, '#29353b', 'stroke="#566067" stroke-width="1"')
    + chairs
    + curtainLine({ x, y }, { x, y: wallY }, routes.left.color, room.curtains.left)
    + curtainLine({ x, y: wallY }, { x: rightX, y: wallY }, routes.rear.color, room.curtains.rear)
    + lines
    + circle(s.x, s.y, 9, '#f7c770', 'stroke="#5f4137" stroke-width="2"')
    + circle(l.x, l.y, 9, '#b7d2e6', 'stroke="#49687b" stroke-width="2"')
    + (compare ? text(s.x + 12, s.y - 4, '声源', 11, cream) + text(l.x + 11, l.y + 16, '听者', 11, cream) : '')
    + text(x, height - 14, `${seatName(room)} · 后墙 ${room.depth.toFixed(1)} m${room.curtains.rear ? '（帘）' : ''}`, 13, '#eddfc6')
    + registration(rightX - 5, height - 20, '#a78872', 6));
}

export function timeRulerArt(paths) {
  const width = 460, height = 115, start = 39, end = 424, x = ms => start + ms / 110 * (end - start);
  const ticks = Array.from({ length: 12 }, (_, index) => {
    const at = x(index * 10);
    return line({ x: at, y: 73 }, { x: at, y: 80 }, '#b5a999')
      + (index % 2 === 0 ? text(at, 95, index * 10, 10, '#ead9be', 'text-anchor="middle"') : '');
  }).join('');
  const marks = paths.map((path, index) => line({ x: x(path.ms), y: 20 + index * 16 }, { x: x(path.ms), y: 73 }, path.color, 1.2, 'opacity=".6"')
    + circle(x(path.ms), 20 + index * 16, 3.5 + Math.sqrt(path.relative) * 4, path.color)
    + text(clamp(x(path.ms) + 12, 44, 386), 24 + index * 16, milliseconds(path.ms), 11, path.color)).join('');
  return art(width, height, rect(0, 0, width, height, '#283136')
    + line({ x: start, y: 73 }, { x: end, y: 73 }, '#b5a999') + ticks + marks
    + text(end, 95, 'ms', 10, '#ead9be', 'text-anchor="end"'));
}

function reportPanel(room, x, heading) {
  const paths = readings(room);
  return text(x, 102, heading, 21, '#392c35', 'font-weight="700"')
    + text(x, 126, `${seatName(room)} · 左墙${room.curtains.left ? '有帘' : '裸墙'} · 后墙 ${room.depth.toFixed(1)} m ${room.curtains.rear ? '有帘' : '裸墙'}`, 13, '#624857')
    + inset(roomArt(room, paths, { compare: true }), x, 142, 413, 326)
    + paths.map((path, index) => {
      const y = 497 + 27 * index;
      return circle(x + 5, y - 5, 4, path.color, 'stroke="#384249"') + text(x + 16, y, path.name, 14)
        + text(x + 183, y, milliseconds(path.ms), 14) + text(x + 298, y, percentage(path.relative), 14);
    }).join('');
}

export function soundReportArt(report) {
  const width = 906, height = 612;
  const complete = taskResults(report.task, report.after).every(item => item.done);
  return art(width, height, rect(0, 0, width, height, '#f1e7d7')
    + text(28, 44, 'STARRY 空场试声单', 29, '#392c35', 'font-weight="800"')
    + text(28, 69, `委托 · ${soundTasks[report.task].name} · ${complete ? '达标' : '记录中'}`, 15, '#624857')
    + reportPanel(report.before, 28, '调整前') + reportPanel(report.after, 465, '调整后')
    + line({ x: 28, y: 565 }, { x: 878, y: 565 }, '#b89481')
    + text(28, 590, '简化二维模型 · 声速 343 m/s · 一次镜面反射 · 强度以各次直达声为 100%', 13, '#624857'));
}
