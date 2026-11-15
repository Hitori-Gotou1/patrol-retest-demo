import test from 'node:test';
import assert from 'node:assert/strict';
import { reactive } from 'vue';
import { createDraftPersistence, draftOwnerKey, draftConflicts } from '../src/services/draftPersistence.js';
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) }; };
const validate = value => { if (typeof value?.name !== 'string') throw new Error('bad draft'); return { name: value.name }; };
test('Vue proxy snapshots initialize without DataCloneError', () => {
  const state = reactive({ name: '当前草稿' }), target = storage();
  const guard = createDraftPersistence({ key:'draft',storage:target,read:()=>state,replace:next=>Object.assign(state,next),validate });
  assert.equal(guard.write(), true); guard.destroy();
});
test('stored incoming draft updates an open editor and cannot be overwritten at unmount', () => {
  const target = storage(); target.setItem('draft',JSON.stringify({name:'A'})); let current={name:'A'};
  const guard=createDraftPersistence({key:'draft',storage:target,read:()=>current,replace:next=>current=next,validate});
  target.setItem('draft',JSON.stringify({name:'B'})); guard.receive({key:'draft'});
  assert.equal(current.name,'B'); assert.equal(guard.write(),true); assert.equal(JSON.parse(target.getItem('draft')).name,'B'); guard.destroy();
});
test('missed storage events are guarded at the last synchronous write', () => {
  const target=storage();target.setItem('draft',JSON.stringify({name:'A'}));let current={name:'A'};
  const guard=createDraftPersistence({key:'draft',storage:target,read:()=>current,replace:next=>current=next,validate});
  target.setItem('draft',JSON.stringify({name:'B'})); assert.equal(guard.write(),false);assert.equal(current.name,'B');assert.equal(JSON.parse(target.getItem('draft')).name,'B');guard.destroy();
});
test('actual unsaved local and incoming edits remain in a visible conflict until a choice', () => {
  const target=storage();target.setItem('draft',JSON.stringify({name:'A'}));let current={name:'A'};
  const guard=createDraftPersistence({key:'draft',storage:target,read:()=>current,replace:next=>current=next,validate});
  current={name:'A editing'};target.setItem('draft',JSON.stringify({name:'B'}));guard.receive({key:'draft'});
  assert.equal(guard.conflicted,true);assert.equal(current.name,'A editing');assert.equal(guard.write(),false);assert.equal(draftConflicts.length,1);
  draftConflicts[0].resolve('incoming');assert.equal(current.name,'B');assert.equal(draftConflicts.length,0);guard.destroy();
});
test('account switch to an absent draft loads tool default, never previous account content', () => {
  const target=storage();target.setItem(draftOwnerKey,'A');target.setItem('draft',JSON.stringify({name:'A private'}));let current={name:'A private'};
  const guard=createDraftPersistence({key:'draft',storage:target,read:()=>current,replace:next=>current=next,validate,fallback:{name:'new default'}});
  target.removeItem('draft');target.setItem(draftOwnerKey,'B');guard.receive({key:draftOwnerKey});assert.equal(current.name,'new default');guard.write();assert.doesNotMatch(target.getItem('draft'),/A private/);guard.destroy();
});
test('storage denial leaves a usable in-memory draft and reports unsaved', () => {
  let current=reactive({name:'memory'});const target={getItem(){throw new DOMException('blocked','SecurityError');},setItem(){throw new DOMException('blocked','SecurityError');}};
  const guard=createDraftPersistence({key:'draft',storage:target,read:()=>current,replace:next=>current=next,validate});assert.equal(guard.available,false);assert.equal(guard.write(),false);assert.equal(current.name,'memory');guard.destroy();
});
test('invalid text being typed survives a simultaneous incoming draft without throwing', () => {
  const target=storage();target.setItem('draft',JSON.stringify({name:'A'}));let current={name:'A'};
  const strict=value=>{if(!value.name.trim())throw new Error('name required');return {name:value.name};};
  const guard=createDraftPersistence({key:'draft',storage:target,read:()=>current,replace:next=>current=next,validate:strict});
  current={name:''};target.setItem('draft',JSON.stringify({name:'B'}));assert.doesNotThrow(()=>guard.receive({key:'draft'}));assert.equal(guard.conflicted,true);assert.equal(current.name,'');assert.equal(guard.write(),false);draftConflicts[0].resolve('incoming');guard.destroy();
});
test('legacy running game state can persist raw while incoming data still validates', () => {
  const target=storage();let current={x:123,checkpoint:0};const validate=value=>({...value,x:value.checkpoint});
  const guard=createDraftPersistence({key:'platform',storage:target,read:()=>current,replace:next=>current=next,validate,validateOnWrite:false});
  assert.equal(guard.write(),true);assert.equal(JSON.parse(target.getItem('platform')).x,123);
  target.setItem('platform',JSON.stringify({x:400,checkpoint:210}));guard.receive({key:'platform'});assert.equal(current.x,210);guard.destroy();
});
