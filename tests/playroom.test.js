import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPhoto, validatePhoto, validateRoom, validateWalk, newSearch, validateSearch, shuffled, concertBudget, concertCost, resolveConcert, validateAmbient } from '../src/room/playroom.js';
import { concertEvents, concertOptions, searchObjects } from '../src/data/playroom.js';

test('saved artwork rejects foreign objects, bounds coordinates, and does not mutate defaults', () => {
  const photo=validatePhoto({...defaultPhoto,theme:'unknown',caption:'x'.repeat(100),objects:[{id:'hitori',key:'same',x:-999,y:99999,size:900},{id:'hitori',key:'same',x:200,y:300,size:100},{id:'https://example.test/image.svg'}]});
  assert.equal(photo.objects.length,2);assert.equal(photo.objects[0].x,35);assert.equal(photo.objects[0].y,755);assert.equal(photo.objects[0].size,420);
  assert.notEqual(photo.objects[0].key,photo.objects[1].key);assert.equal(photo.caption.length,36);assert.equal(photo.theme,'pink');
  photo.objects[0].x=100;assert.equal(defaultPhoto.objects[0].x,130);
  assert.throws(()=>validatePhoto({version:9,objects:[]}));
  assert.deepEqual(validateRoom({version:1,light:'evil',objects:[{id:'script'}]}),{version:1,light:'warm',objects:[]});
});
test('walk stamps are unique and limited to the six locations',()=>{
  assert.deepEqual(validateWalk({visited:['station','station','nowhere','starry'],selected:'missing'}),{visited:['station','starry'],selected:'station'});
});
test('search rounds are reproducible, varied, and always solvable',()=>{
  const signatures=new Set();
  for(let seed=1;seed<70;seed++){
    const round=newSearch(seed);assert.deepEqual(round,newSearch(seed));assert.equal(new Set(round.targets).size,6);
    assert.ok(round.targets.every(id=>searchObjects.some(o=>o.id===id)));signatures.add(round.targets.join(','));
    const restored=validateSearch({...round,found:[...round.targets,round.targets[0],'wrong']});assert.equal(restored.found.length,6);
    assert.deepEqual(new Set(shuffled(searchObjects,seed)),new Set(searchObjects));
  }
  assert.ok(signatures.size>40);
  const round=newSearch(5);assert.throws(()=>validateSearch({...round,targets:[...round.targets,round.targets[0]]}));
});
test('every concert budget has a free response and results stay within bounds',()=>{
  for(const sound of concertOptions.sound.choices)for(const promo of concertOptions.promo.choices)for(const lights of concertOptions.lights.choices){
    const plan={name:'我们的演出',sound:sound.id,promo:promo.id,lights:lights.id,setlist:'together'};
    assert.ok(concertCost(plan)<=concertBudget);
    for(const event of concertEvents){
      let affordable=0;
      for(const choice of event.choices){
        if(concertCost(plan)+choice.cost>concertBudget){assert.throws(()=>resolveConcert(plan,event.id,choice.id));continue;}
        const result=resolveConcert(plan,event.id,choice.id);affordable++;assert.ok(result.spent<=concertBudget);assert.ok(result.quality>=0&&result.quality<=100);assert.ok(result.audience>=0&&result.audience<=100);assert.ok(result.ending.length>0);
      }
      assert.ok(affordable>0);
    }
  }
  assert.throws(()=>resolveConcert({},'unknown','unknown'));
});
test('ambient drafts contain only supported channels and bounded levels',()=>{
  assert.deepEqual(validateAmbient({name:'晚风',light:'wrong',levels:{rain:2,street:-5,tuning:'0.5',crowd:null,remote:'url'}}),{name:'晚风',light:'violet',levels:{rain:1,street:0,tuning:.5,crowd:0}});
});
