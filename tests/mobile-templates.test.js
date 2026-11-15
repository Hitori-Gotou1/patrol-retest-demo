import test from 'node:test';
import assert from 'node:assert/strict';
import { getTemplates, templatePayload, preserveTemplateDraft, previousTemplateDraft } from '../src/room/templates.js';
import { validatePhoto } from '../src/room/playroom.js';
import { validateComic, validateLightShow } from '../src/room/creativeTools.js';
import { validatePattern } from '../src/room/pattern.js';
import { readActivityFavorites, toggleActivityFavorite, moveActivityFavorite, validateActivityFavorites } from '../src/room/activityFavorites.js';
import { activityCatalog, filterActivities, featuredActivities } from '../src/data/activityCatalog.js';
const store=()=>{const items=new Map();return {getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,v)};};
test('curated templates produce valid editable payloads and independent copies',()=>{
 for(const [tool,validate] of Object.entries({photobooth:validatePhoto,comic:validateComic,lights:validateLightShow,studio:validatePattern})){
  const items=getTemplates(tool);assert.equal(items.length,2);
  for(const item of items){const first=templatePayload(item.id);assert.doesNotThrow(()=>validate(first));first.name='changed';assert.notEqual(templatePayload(item.id).name,'changed');}
 }
});
test('template replacement preserves the actual draft and fails safely when storage is denied',()=>{
 const storage=store(),current=templatePayload('comic-rain');current.title='自己的标题';preserveTemplateDraft('comic',current,storage);current.title='after';assert.equal(previousTemplateDraft('comic',storage).title,'自己的标题');
 assert.throws(()=>preserveTemplateDraft('comic',current,{setItem(){throw new Error();}}),/没有覆盖/);
 assert.throws(()=>preserveTemplateDraft('unknown',current,storage));
 assert.equal(previousTemplateDraft('comic',store()),null);
});
test('common activities preserve order, deduplicate, reject corrupt imports and allow removal',()=>{
 const storage=store();assert.deepEqual(readActivityFavorites(storage),[]);toggleActivityFavorite('photobooth',storage);toggleActivityFavorite('lights',storage);assert.deepEqual(moveActivityFavorite('lights',-1,storage),['lights','photobooth']);assert.deepEqual(toggleActivityFavorite('lights',storage),['photobooth']);assert.deepEqual(validateActivityFavorites(['photobooth','bad','photobooth']),['photobooth']);assert.throws(()=>validateActivityFavorites({}));assert.throws(()=>toggleActivityFavorite('bad',storage));
});
test('major topics participate in discovery filters without replacing the three featured corners',()=>{
 assert.equal(featuredActivities.length,3);assert.equal(new Set(activityCatalog.map(c=>c.id)).size,activityCatalog.length);
 for(const id of ['project','calendar','pilgrimage'])assert.ok(activityCatalog.some(c=>c.id===id));
 assert.ok(filterActivities(activityCatalog,{group:'creative',query:'演出'}).some(c=>c.id==='project'));
 assert.ok(filterActivities(activityCatalog,{group:'read',query:'下北泽'}).some(c=>c.id==='pilgrimage'));
 assert.ok(filterActivities(activityCatalog,{query:'十六步编曲'}).some(c=>c.id==='studio'));
 assert.ok(filterActivities(activityCatalog,{query:'段落编曲台'}).some(c=>c.id==='studio'));
});
