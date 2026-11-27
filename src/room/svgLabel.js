export const svgLabelFont = 'sans-serif';

const graphemes = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('zh', { granularity: 'grapheme' })
  : null;
let paint;

export function layoutSvgLabel(text, width, fontSize) {
  paint ??= document.createElement('canvas').getContext('2d');
  paint.font = `${fontSize}px ${svgLabelFont}`;
  const measure = value => paint.measureText(value).width;
  let widest = measure(text);
  let lines = [text];
  if (widest <= width) return { lines, fontSize };

  // Measure both rows so a break preserves the whole label and fits the available width.
  const glyphs = graphemes ? Array.from(graphemes.segment(text), part => part.segment) : Array.from(text);
  let left = '';
  for (let i = 1; i < glyphs.length; i++) {
    left += glyphs[i - 1];
    const right = text.slice(left.length);
    const rowWidth = Math.max(measure(left), measure(right));
    if (rowWidth < widest) {
      widest = rowWidth;
      lines = [left, right];
    }
  }
  return { lines, fontSize: Math.min(fontSize, fontSize * width / widest) };
}
