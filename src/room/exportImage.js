// Embed same-origin artwork before rasterizing: exported SVG images cannot load external image URLs.
export async function downloadStage(svg, filename, { scale = 1.5 } = {}) {
  if (!svg) throw new Error('画面还没有准备好，请稍后再试。');
  const copy = svg.cloneNode(true);
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.querySelectorAll('[data-editor-only]').forEach(node => node.remove());
  await Promise.all([...copy.querySelectorAll('image')].map(async node => {
    const href = node.getAttribute('href');
    if (!href || href.startsWith('data:')) return;
    const source = new URL(href, location.href);
    if (source.origin !== location.origin) throw new Error('图片来源无法用于导出。');
    const response = await fetch(source.href);
    if (!response.ok) throw new Error('部分图片未能读取，请稍后再保存。');
    const blob = await response.blob();
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
    node.setAttribute('href', data);
  }));
  const width = svg.viewBox.baseVal.width, height = svg.viewBox.baseVal.height;
  copy.setAttribute('width', width); copy.setAttribute('height', height);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('暂时无法生成图片，请重试。')); image.src = url; });
    const canvas = document.createElement('canvas'); canvas.width = width * scale; canvas.height = height * scale;
    const context = canvas.getContext('2d'); if (!context) throw new Error('当前浏览器暂不支持保存图片。');
    context.scale(scale, scale); context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('图片未能生成，请重试。');
    const png = URL.createObjectURL(blob), link = document.createElement('a'); link.href = png; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(png), 10000);
  } finally { URL.revokeObjectURL(url); }
}
