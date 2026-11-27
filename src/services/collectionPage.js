import { publishedBase } from './articlePage.js';
import { escapeHtml } from './sharePage.js';
import { httpsLink } from './safeMedia.js';

export const collectionUrl = id => publishedBase + 'albums/' + encodeURIComponent(id) + '/';

export function orderedCollectionImages(collection, images) {
  const available = new Map(images.filter(image => image.src || image.thumbnail).map(image => [image.id,image]));
  return (collection?.imageIds || []).map(id => available.get(id)).filter(Boolean);
}

export function collectionLayout(count) {
  if (count === 1) return 'front';
  if (count === 2) return 'spread';
  return 'index';
}

export function collectionAsset(path, base) {
  return /^https?:\/\//.test(path) ? path : base + path;
}

function renderLeaf(item, layout) {
  const e = escapeHtml;
  const original = collectionAsset(item.src || item.thumbnail,publishedBase);
  const picture = collectionAsset(layout==='index' ? item.thumbnail || item.src : item.src || item.thumbnail,publishedBase);
  const copyright = [item.credit,item.creator].filter(Boolean).join(' · ') || '沿用站内来源记录';
  const source = httpsLink(item.sourceUrl);
  return `<figure class="collection-leaf" data-image-id="${e(item.id)}">
    <a class="collection-picture" href="${e(original)}">
      <img loading="lazy" src="${e(picture)}" alt="${e(item.alt||item.title)}">
      <span>查看原图 ↗</span>
    </a>
    <figcaption><strong>${e(item.title)}</strong><small>${e(copyright)}</small>
      ${source ? `<a href="${e(source)}" rel="noopener noreferrer">原作来源 ↗</a>` : ''}
      <a href="${publishedBase}#/?image=${encodeURIComponent(item.id)}#gallery">在收藏墙查看 ↗</a>
    </figcaption>
  </figure>`;
}

export function renderCollectionPage(collection, images, folioStyles = '') {
  const e = escapeHtml, url = collectionUrl(collection.id);
  const available = orderedCollectionImages(collection,images), layout = collectionLayout(available.length);
  const cover = available.find(image => image.id===collection.cover_image_id) || available[0];
  const image = cover ? collectionAsset(cover.thumbnail || cover.src, publishedBase) : publishedBase+'assets/share-room.png';
  const content = available.map(item => renderLeaf(item,layout)).join('');
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(collection.title)} · 一里小屋主题册</title><meta name="description" content="${e(collection.description)}">
<link rel="canonical" href="${e(url)}"><meta property="og:type" content="article"><meta property="og:site_name" content="一里小屋">
<meta property="og:title" content="${e(collection.title)}"><meta property="og:description" content="${e(collection.description)}">
<meta property="og:url" content="${e(url)}"><meta property="og:image" content="${e(image)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(collection.title)}">
<meta name="twitter:description" content="${e(collection.description)}"><meta name="twitter:image" content="${e(image)}">
<style>
*{box-sizing:border-box}body{background:#211829;color:#4b3747;font-family:system-ui,sans-serif;margin:0}
header,footer{max-width:1090px;margin:auto;padding:22px;color:#f3d0de}
main{max-width:1090px;background:#fbf0df;padding:clamp(12px,4.5vw,40px);margin:0 auto}
h1{font-size:clamp(28px,5vw,42px);line-height:1.35;margin:.3em 0}p{line-height:1.8;overflow-wrap:anywhere}
a{color:inherit;text-underline-offset:4px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
.actions a{display:inline-flex;align-items:center;min-height:44px;border:1px solid #a57996;padding:9px}
a:focus-visible{outline:3px solid #a65e8b;outline-offset:3px}@media(max-width:1100px){main{margin-inline:12px}}
${folioStyles}</style></head>
<body><header><a href="${publishedBase}">一里小屋 · HITORI ROOM</a></header>
<main><p>小屋主题册 · ${available.length} 张</p><h1>${e(collection.title)}</h1><p>${e(collection.description)}</p>
${content ? `<div class="collection-image-grid" data-layout="${layout}">${content}</div>` : '<p>这一册还在慢慢收集。</p>'}
<div class="actions"><a href="${publishedBase}#/collections/${encodeURIComponent(collection.id)}">在小屋打开这份合集 ↗</a><a href="${publishedBase}#/collections">浏览其他主题册 ↗</a></div>
</main><footer>本站同人策展 · 非官方站点。 <a href="${publishedBase}">返回一里小屋</a></footer></body></html>`;
}
