import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainLoadError } from '../src/services/appRecovery.js';
import { renderPublicShare, publicShareUrl } from '../src/services/sharePage.js';
import { renderCollectionPage } from '../src/services/collectionPage.js';
import { featuredWorks } from '../src/data/featuredWorks.js';
import { galleryCollectionExamples } from '../src/data/galleryCollections.js';
import {searchSite} from '../src/services/siteSearch.js';
import { galleryImages } from '../src/data/gallery.js';

test('route load errors distinguish version resource recovery without destructive actions',()=>{
  assert.equal(explainLoadError(new Error('Failed to fetch dynamically imported module')).kind,'version');
  assert.equal(explainLoadError(new Error('invalid page data')).kind,'page');
});
test('public curated pages are server readable, escape metadata and never embed private local state',()=>{
  const html=renderPublicShare({...featuredWorks[0],title:'测试 "><script>alert(1)</script>'});
  assert.match(html,/og:title/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>alert/);
  assert.match(html,/继续创作/);assert.doesNotMatch(html,/localStorage|workshelf|sync/);
  assert.throws(()=>publicShareUrl('../private'));
  assert.throws(()=>renderPublicShare({...featuredWorks[0],target:'javascript:alert(1)'}));
});
test('static collections include real existing records and keep missing records out',()=>{
  for(const collection of galleryCollectionExamples){
    assert.ok(collection.imageIds.length);
    for(const id of collection.imageIds)assert.ok(galleryImages.some(image=>image.id===id),id);
    const html=renderCollectionPage(collection,galleryImages);
    assert.match(html,/og:image/);assert.match(html,/在小屋打开/);
    assert.match(html,new RegExp(collection.imageIds[0]));
  }
});

test('new collections and device pages are discoverable in global search',()=>{
  assert.ok(searchSite('主题合集').some(item=>item.to==='/collections'));
  assert.ok(searchSite('跨设备').some(item=>item.to==='/settings/device'));
});
