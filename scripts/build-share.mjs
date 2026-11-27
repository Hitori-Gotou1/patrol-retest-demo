import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { featuredWorks } from '../src/data/featuredWorks.js';
import { renderPublicShare, renderFeaturedIndex, publicShareUrl } from '../src/services/sharePage.js';
import {galleryCollectionExamples} from '../src/data/galleryCollections.js';
import {galleryImages} from '../src/data/gallery.js';
import {withAttribution} from '../src/data/galleryAttributions.js';
import {collectionUrl,renderCollectionPage} from '../src/services/collectionPage.js';
const dist=resolve(process.argv[2]||'dist');
for(const item of featuredWorks){const dir=resolve(dist,'featured',item.slug);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'index.html'),renderPublicShare(item));}
await mkdir(resolve(dist,'featured'),{recursive:true});await writeFile(resolve(dist,'featured/index.html'),renderFeaturedIndex(featuredWorks));
const collectionCss = await readFile(new URL('../src/styles/collection-folios.css',import.meta.url),'utf8');
for(const collection of galleryCollectionExamples){const dir=resolve(dist,'albums',collection.id);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'index.html'),renderCollectionPage(collection,galleryImages.map(withAttribution),collectionCss));}
const sitemap=resolve(dist,'sitemap.xml');
await writeFile(sitemap,(await readFile(sitemap,'utf8')).replace('</urlset>',[...featuredWorks.map(item=>publicShareUrl(item.slug)),...galleryCollectionExamples.map(item=>collectionUrl(item.id))].map(url=>`<url><loc>${url}</loc></url>`).join('')+'</urlset>'));
console.log(`Generated ${featuredWorks.length} public featured pages; private works are never read.`);
