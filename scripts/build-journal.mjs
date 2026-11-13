import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {journalNotes} from '../src/data/journal.js';
import {renderArticle,articleUrl,publishedBase} from '../src/services/articlePage.js';
const dist=resolve(process.argv[2]||'dist');
for(const note of journalNotes){if(!/^[a-z0-9-]+$/.test(note.slug))throw new Error('Invalid article slug');const dir=resolve(dist,'notes',note.slug);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'index.html'),renderArticle(note));}
const urls=[publishedBase,...journalNotes.map(n=>articleUrl(n.slug))];
await writeFile(resolve(dist,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(url=>'<url><loc>'+url+'</loc></url>').join('')+'</urlset>\n');
await writeFile(resolve(dist,'robots.txt'),'User-agent: *\nAllow: /patrol-retest-demo/\nSitemap: '+publishedBase+'sitemap.xml\n');
console.log(`Generated ${journalNotes.length} complete article pages and sitemap.`);
