import { publishedBase } from './articlePage.js';

export const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export const featuredIndexUrl = `${publishedBase}featured/`;

function workPath(slug) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw new Error('公开精选地址无效。');
  return `featured/${slug}/`;
}

export function publicShareUrl(slug) {
  return publishedBase + workPath(slug);
}

function artwork(item, root, loading = 'eager') {
  if (!item?.title || !item.summary || !item.alt
      || !/^assets\/[a-zA-Z0-9/_.,-]+\.(svg|png|webp|jpg|jpeg)$/.test(item.image)
      || ![item.width, item.height].every(size => Number.isInteger(size) && size > 0)) {
    throw new Error('公开精选缺少有效内容。');
  }
  const tint = /^#[\da-f]{6}$/i.test(item.mat) ? ` style="--featured-mat:${item.mat}"` : '';
  return `<div class="featured-mat"${tint}><img src="${root}${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" width="${item.width}" height="${item.height}" loading="${loading}"></div>`;
}

function head({ title, summary, url, type, root }) {
  const e = escapeHtml;
  const cover = publishedBase + 'assets/share-room.png';
  const coverAlt = '一里小屋原创票根封面';
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#28232d">
  <title>${e(title)} · 一里小屋</title>
  <meta name="description" content="${e(summary)}">
  <link rel="canonical" href="${e(url)}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="一里小屋 · HITORI ROOM">
  <meta property="og:title" content="${e(title)}">
  <meta property="og:description" content="${e(summary)}">
  <meta property="og:url" content="${e(url)}">
  <meta property="og:image" content="${cover}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${coverAlt}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${e(title)}">
  <meta name="twitter:description" content="${e(summary)}">
  <meta name="twitter:image" content="${cover}">
  <link rel="icon" href="${root}assets/favicon.svg">
  <link rel="stylesheet" href="${root}featured/exhibition.css">
</head>`;
}

function masthead(root, detail = false) {
  return `<header class="featured-header"><div class="featured-width">
    <a class="featured-brand" href="${root}">一里小屋 <span>HITORI ROOM</span></a>
    ${detail ? '<a href="../">小屋公开精选</a>' : ''}
  </div></header>`;
}

export function renderPublicShare(item, { url, target = item?.target } = {}) {
  const root = '../../';
  const image = artwork(item, root);
  const canonical = url ?? publicShareUrl(item.slug);
  if (!/^\/room\/[a-zA-Z0-9/_?=&-]+$/.test(target || '')) throw new Error('公开精选入口无效。');
  const e = escapeHtml;
  return `${head({ title: item.title, summary: item.summary, url: canonical, type: 'article', root })}
<body class="featured-page">
  ${masthead(root, true)}
  <main class="featured-width featured-detail">
    <article aria-labelledby="work-title">
      ${image}
      <div class="featured-label">
        <p class="featured-kind">${e(item.kind)}</p>
        <h1 id="work-title">${e(item.title)}</h1>
        <p class="featured-summary">${e(item.summary)}</p>
        <p>${e(item.text)}</p>
        <div class="featured-actions">
          <a class="featured-primary" href="${root}#${e(target)}">到小屋继续创作</a>
          <a href="../">看看其他公开精选</a>
        </div>
      </div>
    </article>
  </main>
  <footer class="featured-width featured-footer">本站原创同人作品 · 非官方站点</footer>
</body></html>`;
}

export function renderFeaturedIndex(items) {
  const e = escapeHtml;
  const root = '../';
  const title = '小屋公开精选';
  const summary = '小屋里的原创票根与图形海报。';
  return `${head({ title, summary, url: featuredIndexUrl, type: 'website', root })}
<body class="featured-page featured-index-page">
  ${masthead(root)}
  <main class="featured-width featured-index">
    <h1>${title}</h1>
    <ul class="featured-works" role="list">
      ${items.map((item, index) => {
        const path = workPath(item.slug);
        return `<li><a class="featured-work" href="${root}${path}" aria-labelledby="work-${item.slug}">
          <figure>
            ${artwork(item, root, index < 2 ? 'eager' : 'lazy')}
            <figcaption class="featured-label">
              <p class="featured-kind">${e(item.kind)}</p>
              <h2 id="work-${item.slug}">${e(item.title)}</h2>
              <p>${e(item.summary)}</p>
            </figcaption>
          </figure>
        </a></li>`;
      }).join('\n')}
    </ul>
  </main>
  <footer class="featured-width featured-footer">本站原创同人作品 · 非官方站点</footer>
</body></html>`;
}
