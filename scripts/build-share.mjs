import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { featuredWorks } from '../src/data/featuredWorks.js';
import { renderPublicShare, renderFeaturedIndex, publicShareUrl, featuredIndexUrl } from '../src/services/sharePage.js';
import {galleryCollectionExamples} from '../src/data/galleryCollections.js';
import {galleryImages} from '../src/data/gallery.js';
import {withAttribution} from '../src/data/galleryAttributions.js';
import {collectionUrl,renderCollectionPage} from '../src/services/collectionPage.js';
const dist=resolve(process.argv[2]||'dist');
const featuredDir = resolve(dist, 'featured');
const featuredCss = await Promise.all(['room-materials.css', 'featured.css'].map(file =>
  readFile(new URL(`../src/styles/${file}`, import.meta.url), 'utf8')));
await mkdir(featuredDir, { recursive: true });
await writeFile(resolve(featuredDir, 'exhibition.css'), featuredCss.join('\n'));
await writeFile(resolve(featuredDir, 'index.html'), renderFeaturedIndex(featuredWorks));
for (const item of featuredWorks) {
  const page = renderPublicShare(item);
  const dir = resolve(featuredDir, item.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'index.html'), page);
}
const collectionCss = await readFile(new URL('../src/styles/collection-folios.css',import.meta.url),'utf8');
for(const collection of galleryCollectionExamples){const dir=resolve(dist,'albums',collection.id);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'index.html'),renderCollectionPage(collection,galleryImages.map(withAttribution),collectionCss));}
const sitemap=resolve(dist,'sitemap.xml');
await writeFile(sitemap,(await readFile(sitemap,'utf8')).replace('</urlset>',[featuredIndexUrl,...featuredWorks.map(item=>publicShareUrl(item.slug)),...galleryCollectionExamples.map(item=>collectionUrl(item.id))].map(url=>`<url><loc>${url}</loc></url>`).join('')+'</urlset>'));
console.log(`Generated ${featuredWorks.length} public featured pages; private works are never read.`);
