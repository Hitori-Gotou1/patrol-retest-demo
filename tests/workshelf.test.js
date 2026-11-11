import test from 'node:test';
import assert from 'node:assert/strict';
import { saveWork, readWorks, readDrafts, restoreWork, removeWork, exportWorks, importWorks, worksKey, draftKey, maxWorks } from '../src/room/workshelf.js';
import { defaultPhoto } from '../src/room/playroom.js';
import { defaultPattern } from '../src/room/pattern.js';

function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value) };
}
test('versions are deduplicated without replacing another saved version or the active draft', () => {
  const s=storage(); s.setItem(draftKey('photobooth'),JSON.stringify(defaultPhoto));
  const one=saveWork('photobooth',defaultPhoto,'',s);
  assert.equal(saveWork('photobooth',defaultPhoto,'',s).id,one.id);
  saveWork('photobooth',{...defaultPhoto,caption:'下一次的合影'},'',s);
  assert.equal(readWorks(s).length,2);
  assert.deepEqual(JSON.parse(s.getItem(draftKey('photobooth'))),defaultPhoto);
});
test('restoring an older version first preserves the different active draft', () => {
  const s=storage(),one=saveWork('studio',defaultPattern,'',s),current={...defaultPattern,name:'尚未收好的新编曲',bpm:120};
  s.setItem(draftKey('studio'),JSON.stringify(current));
  assert.equal(restoreWork(one.id,s),'/room/studio');
  assert.deepEqual(JSON.parse(s.getItem(draftKey('studio'))),defaultPattern);
  assert(readWorks(s).some(work=>work.snapshot.name===current.name));
});
test('a failed backup prevents replacing the current draft during restore', () => {
  const s=storage(),one=saveWork('studio',defaultPattern,'',s),current={...defaultPattern,name:'还有一段没保存'};
  s.setItem(draftKey('studio'),JSON.stringify(current));
  const stored=s.setItem; s.setItem=(key,value)=>{if(key===worksKey)throw new Error('quota');stored(key,value);};
  assert.throws(()=>restoreWork(one.id,s),/未能写入/);
  assert.deepEqual(JSON.parse(s.getItem(draftKey('studio'))),current);
});
test('backup merging validates all entries before writing and leaves drafts untouched', () => {
  const source=storage(),dest=storage(); saveWork('photobooth',defaultPhoto,'',source);
  const backup=JSON.stringify(exportWorks(source));
  dest.setItem(draftKey('studio'),JSON.stringify(defaultPattern));
  assert.equal(importWorks(backup,dest),1); assert.equal(importWorks(backup,dest),0);
  const before=dest.getItem(worksKey),bad=exportWorks(source); bad.works.push({...bad.works[0],preview:'data:image/svg+xml,<svg onload=alert(1)>'});
  assert.throws(()=>importWorks(JSON.stringify(bad),dest),/预览/); assert.equal(dest.getItem(worksKey),before);
  assert.deepEqual(JSON.parse(dest.getItem(draftKey('studio'))),defaultPattern);
});
test('removal is reversible with the same backup contract and never clears editor drafts', () => {
  const s=storage(); s.setItem(draftKey('photobooth'),JSON.stringify(defaultPhoto));
  const saved=saveWork('photobooth',defaultPhoto,'',s),removed=removeWork(saved.id,s);
  assert.equal(readWorks(s).length,0); importWorks(JSON.stringify({version:1,works:[removed]}),s);
  assert.equal(readWorks(s)[0].id,saved.id); assert.equal(readDrafts(s).length,1);
});
test('corrupt storage and full shelves never silently discard saved work', () => {
  const corrupt=storage(); corrupt.setItem(worksKey,'broken data');
  assert.deepEqual(readWorks(corrupt),[]); assert.throws(()=>saveWork('studio',defaultPattern,'',corrupt),/原记录仍保留/); assert.equal(corrupt.getItem(worksKey),'broken data');
  const s=storage(); for(let i=0;i<maxWorks;i++)saveWork('studio',{...defaultPattern,name:`编曲 ${i}`},'',s);
  const before=s.getItem(worksKey); assert.throws(()=>saveWork('studio',{...defaultPattern,name:'多出来的一首'},'',s),/最多放/); assert.equal(s.getItem(worksKey),before);
});
test('invalid dates, unknown work kinds and blocked storage cannot produce broken entries', () => {
  const s=storage(); assert.throws(()=>saveWork('unknown',defaultPattern,'',s));
  const entry=saveWork('studio',defaultPattern,'',s),bad={version:1,works:[{...entry,at:1e20}]};
  assert.throws(()=>importWorks(JSON.stringify(bad),s),/无法读取/);
  const blocked={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  assert.deepEqual(readWorks(blocked),[]); assert.deepEqual(readDrafts(blocked),[]); assert.throws(()=>saveWork('studio',defaultPattern,'',blocked));
});
