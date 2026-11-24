export const ink = '#211e22';
export const cream = '#f7efe0';
export const paperFont = '"Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif';
export const clamp = (number, minimum, maximum) => Math.max(minimum, Math.min(maximum, number));
export const art = (width, height, content) => ({ width, height, content });

export function xml(value) {
  return String(value).replace(/[<>&"']/g, character => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
  })[character]);
}

export const rect = (x, y, width, height, fill, attributes = '') =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${attributes}/>`;

export const circle = (x, y, radius, fill, attributes = '') =>
  `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" ${attributes}/>`;

export const line = (a, b, color, width = 1, attributes = '') =>
  `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="${width}" ${attributes}/>`;

export const text = (x, y, value, size, color = ink, attributes = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${attributes}>${xml(value)}</text>`;

export function inset(picture, x, y, width, height, viewBox = `0 0 ${picture.width} ${picture.height}`) {
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" overflow="hidden">${picture.content}</svg>`;
}

export function registration(x, y, color = '#a87762', radius = 7) {
  return line({ x: x - radius, y }, { x: x + radius, y }, color)
    + line({ x, y: y - radius }, { x, y: y + radius }, color) + circle(x, y, 3, 'none', `stroke="${color}"`);
}

export function weft(width, height, color, step = 5) {
  const stripes = [];
  for (let offset = step; offset < Math.max(width, height); offset += step) {
    if (offset < width) stripes.push(`M${offset} 0v${height}`);
    if (offset < height) stripes.push(`M0 ${offset}h${width}`);
  }
  return `<path d="${stripes.join(' ')}" stroke="${color}" stroke-width=".65" opacity=".35"/>`;
}
