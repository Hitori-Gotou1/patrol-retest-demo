import { art, inset, line, rect, registration, text } from './art.js';
import { examplePatch, patchArt } from './patch.js';
import { expandFrames, filmStripArt, initialAnimation, poseArt } from './animation.js';
import { exampleReport, milliseconds, percentage, readings, roomArt, seatName } from './soundcheck.js';

export const pageSize = { width: 297, height: 420 };
export const sheetSize = { width: 1188, height: 840 };
export const zineLayouts = {
  single: { name: '满版单图', boxes: [{ x: 28, y: 130, w: 241, h: 198 }], caption: 349, lines: 3 },
  pair: { name: '双图对照', boxes: [{ x: 28, y: 130, w: 116, h: 198 }, { x: 153, y: 130, w: 116, h: 198 }], caption: 349, lines: 3 },
  strip: { name: '帧带加短文', boxes: [{ x: 28, y: 130, w: 241, h: 166 }], caption: 319, lines: 5 }
};

export const defaultCrop = () => ({ x: 0, y: 0, zoom: 1 });
export const slotWith = asset => ({ asset, crop: defaultCrop() });
export const pageRole = number => number === 1 ? '封面' : number === 8 ? '封底' : '内页';

export function sampleAsset(kind, variant) {
  if (kind === 'patch') return { kind, variant, data: examplePatch(), name: '示例布章 · 蓝黄拨片' };
  if (kind === 'animation') {
    const data = initialAnimation();
    data.frames[1].hold = 3;
    return { kind, variant, data, name: '示例动画 · 落棒前停三格', first: 1, last: 5 };
  }
  return { kind, variant, data: exampleReport(), name: '示例试声 · 后排挂帘前后' };
}

function samplePage(index, title, caption, layout, ...assets) {
  return { id: `zine-page-${index}`, title, caption, layout, slots: [slotWith(assets[0] || null), slotWith(assets[1] || null)] };
}

export function initialZine() {
  const front = sampleAsset('patch', 'front'), back = sampleAsset('patch', 'back');
  const film = sampleAsset('animation', 'strip'), still = sampleAsset('animation', 'frame');
  const sound = sampleAsset('soundcheck', 'compare');
  return { selected: 'zine-page-1', pages: [
    samplePage(1, '地下文化祭', '一张纸，记下在 STARRY 做的四件事。', 'single', front),
    samplePage(2, '一枚布章的两面', '正面是蓝黄交叉，背面能找到同一股线的回路。', 'pair', front, back),
    samplePage(3, '拨片背面', '翻面看看下一针从哪里回来。', 'single', back),
    samplePage(4, '鼓棒落下之前', '同一个姿势停三格，动作会有一点犹豫。', 'strip', film),
    samplePage(5, '在透光台上', '纸偶用定位孔对齐，一格接着一格。', 'single', still),
    samplePage(6, '在后排听', '挂帘前后，比较后墙的反射强度。', 'single', sound),
    samplePage(7, '留一页笔记', '写下你想记住的声音或动作，也可以换上自己的稿件。', 'strip'),
    samplePage(8, 'STARRY 地下印刷所', '把纸折回封面，这一册就完成了。', 'single')
  ] };
}

function comparisonArt(report) {
  const panels = [report.before, report.after].map((room, index) => {
    const x = 13 + 254 * index;
    return text(x, 42, `${index ? '调整后' : '调整前'} · ${seatName(room)}`, 22, '#493841', 'font-weight="700"')
      + inset(roomArt(room, readings(room), { compare: true }), x, 57, 241, 190)
      + readings(room).map((path, row) => {
        const y = 278 + row * 38;
        return rect(x, y - 11, 9, 9, path.color, 'stroke="#473943"')
          + text(x + 14, y, milliseconds(path.ms), 17)
          + text(x + 125, y, percentage(path.relative), 17)
          + text(x + 14, y + 16, path.name, 12, '#6b5156');
      }).join('');
  });
  return art(520, 398, rect(0, 0, 520, 398, '#eadccc') + panels.join(''));
}

export function assetArt(asset) {
  if (asset.kind === 'patch') return patchArt(asset.data, { side: asset.variant });
  if (asset.kind === 'animation') {
    const slots = expandFrames(asset.data.frames);
    if (asset.variant === 'frame') return poseArt(asset.data, (slots[asset.first - 1] || slots[0]).frame.pose);
    return filmStripArt(asset.data, slots.slice(asset.first - 1, asset.last), { caption: false });
  }
  if (asset.variant === 'compare') return comparisonArt(asset.data);
  const room = asset.data[asset.variant];
  return roomArt(room, readings(room), { compare: true });
}

function glyphWidth(glyph) {
  if (/^\s$/.test(glyph)) return .34;
  if (/^[\x20-\x7e]$/.test(glyph)) {
    if (/[mwMW@%]/.test(glyph)) return .91;
    if (/[A-Z]/.test(glyph)) return .77;
    return .64;
  }
  return 1.04;
}

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null;
export function wrapText(value, width, size, maxLines) {
  const all = [];
  for (const paragraph of String(value).split('\n')) {
    let row = '', used = 0;
    const glyphs = segmenter ? [...segmenter.segment(paragraph)].map(item => item.segment) : Array.from(paragraph);
    for (const glyph of glyphs) {
      const amount = glyphWidth(glyph) * size;
      if (row && used + amount > width) {
        all.push(row.trimEnd());
        row = '';
        used = 0;
      }
      if (!row && /^\s$/.test(glyph)) continue;
      row += glyph;
      used += amount;
    }
    all.push(row.trimEnd());
  }
  const overflow = all.length > maxLines;
  const lines = all.slice(0, maxLines);
  if (overflow) {
    const last = Array.from(lines.at(-1));
    let used = last.reduce((sum, glyph) => sum + glyphWidth(glyph) * size, size * 1.04);
    while (last.length && used > width) used -= glyphWidth(last.pop()) * size;
    lines[maxLines - 1] = last.join('').trimEnd() + '…';
  }
  return { lines, overflow };
}

export function pageText(page, number) {
  const titleSize = number === 1 ? 27 : 23;
  return {
    titleSize,
    title: wrapText(page.title, 239, titleSize, 2),
    caption: wrapText(page.caption, 239, 12, zineLayouts[page.layout].lines)
  };
}

export function cropViewBox(picture, box, crop) {
  const ratio = box.w / box.h;
  const w = Math.max(picture.width, picture.height * ratio) / crop.zoom;
  const h = w / ratio;
  const x = (picture.width - w) / 2 + Math.max(0, picture.width - w) / 2 * crop.x;
  const y = (picture.height - h) / 2 + Math.max(0, picture.height - h) / 2 * crop.y;
  return `${x} ${y} ${w} ${h}`;
}

function pageSlot(slot, box, guides) {
  const { x, y, w, h } = box;
  const frame = rect(x, y, w, h, '#efe1cf', 'stroke="#c5a48b" stroke-width=".65"');
  if (!slot?.asset) return frame + (guides ? text(x + w / 2, y + h / 2, '放入稿件', 13, '#6f5a58', 'text-anchor="middle"') : '');
  const picture = assetArt(slot.asset);
  return frame + inset(picture, x, y, w, h, cropViewBox(picture, box, slot.crop));
}

export function pageArt(page, number, { guides = false, proof = false } = {}) {
  const { width, height } = pageSize;
  const palette = [ '#ede0c5', '#eedbd5', '#e6dccf', '#e9dec3', '#e3e5df', '#e5e1d1', '#eee4d5', '#dfcfce' ];
  const ground = palette[number - 1];
  const paper = rect(0, 0, width, height, '#fffdf8') + rect(20, 20, width - 40, height - 40, ground);
  const safe = guides ? rect(27, 31, width - 54, height - 62, 'none', 'stroke="#aa574e" stroke-width="1" stroke-dasharray="4 3"') : '';
  if (proof) {
    return art(width, height, paper + safe
      + `<path d="M148.5 51L112 101H135V139H162V101H185Z" fill="#8b4e58"/>`
      + text(width / 2, 266, number, 119, '#3b2830', 'text-anchor="middle" font-weight="800"')
      + text(width / 2, 307, pageRole(number), 24, '#65434c', 'text-anchor="middle"')
      + text(width / 2, 355, 'STARRY · 拼版校样', 14, '#65434c', 'text-anchor="middle"'));
  }
  const { boxes, caption } = zineLayouts[page.layout];
  const content = pageText(page, number);
  return art(width, height, paper
    + text(28, 48, `STARRY / ${pageRole(number)}`, 11, '#6d514e', 'font-weight="700" letter-spacing="1.5"')
    + line({ x: 28, y: 58 }, { x: width - 28, y: 58 }, '#a77f71', .7)
    + content.title.lines.map((row, index) => text(28, 89 + index * 28, row, content.titleSize, '#30262e', 'font-weight="800"')).join('')
    + boxes.map((box, index) => pageSlot(page.slots[index], box, guides)).join('')
    + content.caption.lines.map((row, index) => text(28, caption + index * 15, row, 12, '#442f37')).join('')
    + text(width - 28, 388, String(number).padStart(2, '0'), 11, '#6d514e', 'text-anchor="end"')
    + safe);
}

// The slit opens the middle two columns. The outer columns still join the two rows.
export const imposition = [
  [5, 4, 3, 2].map((page, col) => ({ page, col, row: 0, rotation: 180 })),
  [6, 7, 8, 1].map((page, col) => ({ page, col, row: 1, rotation: 0 }))
].flat();
export const cutLine = { x1: pageSize.width, x2: pageSize.width * 3, y: pageSize.height };

export function foldedOrder(panels = imposition) {
  const cell = (row, col) => panels.find(panel => panel.row === row && panel.col === col);
  const pairs = [[1, 3], [0, 3], [0, 2], [0, 1], [0, 0], [1, 0], [1, 1], [1, 2]];
  return pairs.map(([row, col]) => {
    const panel = cell(row, col);
    const turn = row === 0 ? 180 : 0;
    return { page: panel.page, rotation: (panel.rotation + turn) % 360 };
  });
}

export function printSheetArt(pages, { proof = false, guides = true } = {}) {
  const { width, height } = sheetSize;
  const panels = imposition.map(({ page, col, row, rotation }) => {
    const x = col * pageSize.width, y = row * pageSize.height;
    const cx = x + pageSize.width / 2, cy = y + pageSize.height / 2;
    return `<g data-print-page="${page}" data-rotation="${rotation}" transform="rotate(${rotation} ${cx} ${cy})">
      ${inset(pageArt(pages[page - 1], page, { proof }), x, y, pageSize.width, pageSize.height)}</g>`;
  }).join('');
  const fold = 'stroke-dasharray="8 6"';
  const folds = [1, 2, 3].map(index => line({ x: index * pageSize.width, y: 19 }, { x: index * pageSize.width, y: height - 19 }, '#a58c83', 1.1, fold)).join('')
    + line({ x: 19, y: cutLine.y }, { x: cutLine.x1, y: cutLine.y }, '#a58c83', 1.1, fold)
    + line({ x: cutLine.x2, y: cutLine.y }, { x: width - 19, y: cutLine.y }, '#a58c83', 1.1, fold);
  const cut = line({ x: cutLine.x1, y: cutLine.y }, { x: cutLine.x2, y: cutLine.y }, '#942e48', 2.3)
    + registration(cutLine.x1, cutLine.y, '#942e48', 7) + registration(cutLine.x2, cutLine.y, '#942e48', 7);
  return art(width, height, rect(0, 0, width, height, '#fffdf8') + panels + (guides ? folds : '') + cut);
}

export function foldIllustrations() {
  return [
    art(180, 110, rect(14, 10, 152, 89, '#ecddc8', 'stroke="#866461"')
      + [52, 90, 128].map(x => line({ x, y: 11 }, { x, y: 99 }, '#8c6e6a', 1, 'stroke-dasharray="3 3"')).join('')
      + line({ x: 14, y: 54 }, { x: 166, y: 54 }, '#8c6e6a', 1, 'stroke-dasharray="3 3"')),
    art(180, 110, rect(14, 10, 152, 89, '#ecddc8', 'stroke="#866461"')
      + line({ x: 14, y: 54 }, { x: 166, y: 54 }, '#8c6e6a', 1, 'stroke-dasharray="3 3"')
      + line({ x: 52, y: 54 }, { x: 128, y: 54 }, '#9e3d56', 3)
      + registration(52, 54, '#9e3d56', 5) + registration(128, 54, '#9e3d56', 5)),
    art(180, 110, '<path d="M11 55L46 42L90 19L134 42L169 55L134 69L90 91L46 69Z" fill="#ecddc8" stroke="#866461" stroke-width="1.5"/>'
      + '<path d="M46 42L90 31L134 42L90 77Z" fill="#513746" stroke="#9e3d56" stroke-width="1.5"/><path d="M46 69L90 77L134 69" fill="none" stroke="#866461"/>'),
    art(180, 110, '<path d="M58 92V17L123 15L125 91Z" fill="#a07975" stroke="#70504a"/><path d="M53 95V22L117 17V90Z" fill="#e8d8bf" stroke="#866461" stroke-width="1.5"/>'
      + text(83, 72, '1', 35, '#7a4352', 'text-anchor="middle" font-weight="800"'))
  ];
}
