import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceBuildPlugin } from '../scripts/device-build.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
test('offline graph follows static imports and CSS, without downloading all dynamic route chunks', () => {
  const emitted = [], plugin = deviceBuildPlugin({ base: '/patrol-retest-demo/' });
  plugin.configResolved({ root: path.resolve('.') });
  const make = (fileName, suffix, imports = []) => ({ type: 'chunk', fileName, facadeModuleId: path.resolve('src/' + suffix), moduleIds: [], imports, code: fileName, viteMetadata: { importedCss: new Set() } });
  const entry = make('assets/entry.js', 'main.js', ['assets/vue.js']); entry.isEntry = true; entry.dynamicImports = ['assets/gallery.js'];
  const photo = make('assets/photo.js', 'components/room/PhotoBooth.vue', ['assets/editor.js']); photo.viteMetadata.importedCss.add('assets/photo.css');
  const bundle = Object.fromEntries([entry, photo, make('assets/vue.js', 'vue.js'), make('assets/editor.js', 'editor.js'), make('assets/gallery.js', 'components/GalleryScene.vue')].map(item => [item.fileName, item]));
  plugin.generateBundle.call({ emitFile: file => emitted.push(file) }, {}, bundle);
  const manifest = JSON.parse(emitted.find(file => file.fileName === 'offline-manifest.json').source);
  assert.ok(manifest.core.includes('assets/entry.js')); assert.ok(manifest.core.includes('assets/vue.js'));
  assert.ok(!manifest.core.includes('assets/gallery.js')); assert.ok(!manifest.core.includes('assets/photo.js'));
  assert.ok(manifest.groups.photobooth.files.includes('assets/editor.js'));
  assert.ok(manifest.groups.photobooth.files.includes('assets/photo.css'));
  for (const id of ['decorate','graffiti','walk']) for (const member of ['hitori','nijika','ryo','kita']) assert.ok(manifest.groups[id].files.includes(`assets/characters/${member}-artwork.webp`), `${id} needs its own ${member} artwork`);
  assert.ok(!emitted.find(file => file.fileName === 'sw.js').source.includes('__HITORI_MANIFEST__'));
});
test('offline worker only clears CacheStorage, never user drafts or works', () => {
  const worker = readFileSync('scripts/offline-worker.js', 'utf8');
  assert.doesNotMatch(worker, /localStorage\.(clear|removeItem)|indexedDB\.deleteDatabase/);
  assert.match(worker, /HITORI_ACTIVATE_UPDATE/);
  assert.match(worker, /cacheFiles\(files, 'update'\)/);
});
test('offline build version changes when fixed-URL selected artwork or raw HTML changes', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const temp = mkdtempSync(path.join(tmpdir(),'hitori-device-fingerprint-'));
  try {
    mkdirSync(path.join(temp,'scripts'),{recursive:true});mkdirSync(path.join(temp,'public/assets/characters'),{recursive:true});
    writeFileSync(path.join(temp,'scripts/offline-worker.js'),readFileSync('scripts/offline-worker.js'));
    writeFileSync(path.join(temp,'index.html'),'<html><title>A</title></html>');
    const image=path.join(temp,'public/assets/characters/hitori-thumbnail.webp');writeFileSync(image,Buffer.from('ABC'));
    const build=()=>{const emitted=[],plugin=deviceBuildPlugin();plugin.configResolved({root:temp});plugin.generateBundle.call({emitFile:f=>emitted.push(f)},{},{'entry.js':{type:'chunk',fileName:'entry.js',isEntry:true,imports:[],moduleIds:[],code:'same code'}});return JSON.parse(emitted.find(f=>f.fileName==='offline-manifest.json').source).version;};
    const first=build();writeFileSync(image,Buffer.from('XYZ'));const second=build();assert.notEqual(first,second);
    writeFileSync(path.join(temp,'index.html'),'<html><title>B</title></html>');assert.notEqual(second,build());
  } finally { rmSync(temp,{recursive:true,force:true}); }
});
