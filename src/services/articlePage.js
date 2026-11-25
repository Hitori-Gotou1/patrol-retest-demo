import { galleryImages } from '../data/gallery.js';

export const publishedBase='https://hitori-gotou1.github.io/patrol-retest-demo/';
export const articleUrl = slug => publishedBase + 'notes/' + encodeURIComponent(slug) + '/';

export function articleCover(note) {
  for (const related of note?.gallery || []) {
    const image = galleryImages.find(item => item.id === related.id);
    if (image) return image;
  }
  return null;
}

const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function renderArticle(note, readingCss = '') {
  const url = articleUrl(note.slug);
  const cover = articleCover(note);
  const defaultImage = note.category === '角色小记' && /^(hitori|ryo|kita|nijika)-/.test(note.slug)
    ? `assets/characters/${note.slug.split('-')[0]}-artwork.webp`
    : note.category === '观后随笔' ? 'assets/activities/comic.webp' : 'assets/bocchi-cover.webp';
  const image = publishedBase + (cover?.src || defaultImage);
  const structured = {
    '@context': 'https://schema.org', '@type': 'Article', headline: note.title, description: note.summary,
    datePublished: note.date, author: { '@type': 'Organization', name: note.author }, image, mainEntityOfPage: url
  };
  const sources = (note.sources || []).filter(source => /^https:\/\//.test(source.url))
    .map(source => `<li><a href="${esc(source.url)}" rel="noopener noreferrer">${esc(source.label)} ↗</a></li>`).join('');
  const sections = note.sections.map(section => `<section><h2 class="journal-section-heading">${esc(section.heading)}</h2>
    <p class="journal-text">${esc(section.text)}</p></section>`).join('');
  const illustration = cover ? `<figure class="journal-cover">
    <img src="${esc('../../' + cover.src)}" alt="${esc(cover.alt)}">
    <figcaption>《${esc(cover.title)}》 · ${esc(cover.credit)}</figcaption></figure>` : '';
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#251d2b"><title>${esc(note.title)} · 一里小屋</title>
  <meta name="description" content="${esc(note.summary)}"><link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="article"><meta property="og:site_name" content="一里小屋">
  <meta property="og:title" content="${esc(note.title)}"><meta property="og:description" content="${esc(note.summary)}">
  <meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}">
  <meta property="og:image:alt" content="一里小屋 · ${esc(note.category)}">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(note.title)}">
  <meta name="twitter:description" content="${esc(note.summary)}"><meta name="twitter:image" content="${esc(image)}">
  <link rel="icon" href="${publishedBase}assets/favicon.svg">
  <script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>
  <style>*{box-sizing:border-box}body{margin:0;background:#211b28}body>header,body>footer{font:14px system-ui,sans-serif;color:#f2dce3;max-width:850px;margin:auto;padding:18px 12px}body>header a{color:inherit}main{width:calc(100% - 24px)}${readingCss}</style>
</head>
<body>
  <header><a href="${publishedBase}">一里小屋 · HITORI ROOM</a></header>
  <main class="journal-reading">
    <article class="journal-sheet">
      <a class="journal-back" href="${publishedBase}#/room/notes">← 返回小屋手记</a>
      <p class="journal-byline">${esc(note.category)} · <time datetime="${esc(note.date)}">${esc(note.date)}</time> · ${esc(note.author)}</p>
      <h1 class="journal-headline">${esc(note.title)}</h1>
      <p class="journal-lede">${esc(note.summary)}</p>
      ${illustration}${note.notice ? `<p class="journal-notice">${esc(note.notice)}</p>` : ''}${sections}
      ${sources ? `<section class="journal-reference"><h2 class="journal-section-heading">参考资料</h2><ul>${sources}</ul></section>` : ''}
      <div class="journal-actions"><a href="${publishedBase}#/room/notes/${encodeURIComponent(note.slug)}">在小屋里继续阅读 ↗</a>
        ${note.activity ? `<a href="${publishedBase}#/room/${encodeURIComponent(note.activity)}">把灵感带去活动室 ↗</a>` : ''}</div>
    </article>
  </main>
  <footer>本站原创同人解读 · 非官方站点</footer>
  <script>try{const p=JSON.parse(localStorage.getItem('hitori-room:preferences:v1')||'{}');if([1,1.15,1.3].includes(p.font))document.documentElement.style.setProperty('--reader-scale',p.font);if(p.contrast===true)document.documentElement.dataset.contrast='high';if([1.8,2.1,2.4].includes(p.line))document.documentElement.style.setProperty('--reader-line',p.line)}catch{}</script>
</body></html>`;
}
