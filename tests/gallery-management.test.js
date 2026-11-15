import test from 'node:test';
import assert from 'node:assert/strict';
import { createGalleryManager } from '../src/services/galleryManagement.js';
import { validateGalleryMetadata, validateCollection } from '../src/services/galleryMetadata.js';
import { imageResize, galleryFileDigest } from '../src/services/galleryImagePreparation.js';
import { createGalleryUploadQueue } from '../src/services/galleryUploadQueue.js';

const OWNER='11111111-1111-4111-8111-111111111111';
const IMAGE='22222222-2222-4222-8222-222222222222';
const png=new File([Uint8Array.from([137,80,78,71,13,10,26,10])],'image.png',{type:'image/png'});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({insertError=false,unknownCommit=false,uploadFailAt=0,existing=null,admin=true}={}) {
  const events=[];const removed=[];let uploads=0;let insertAttempted=false;
  const db={
    auth:{async getUser(){return {data:{user:{id:OWNER}}};}},
    from(table) {
      const call={table,filters:[],operation:'select'};
      const builder={
        select(){return this;},eq(key,value){call.filters.push([key,value]);return this;},
        or(value){call.or=value;return this;},order(){return this;},range(){return Promise.resolve({data:[],count:0});},
        update(value){call.operation='update';call.value=value;events.push(call);return this;},
        insert(value){insertAttempted=true;events.push({operation:'insert',value});return Promise.resolve(insertError?{error:new Error('insert rejected')}:{data:null,error:null});},
        single(){return Promise.resolve({data:{id:IMAGE,...call.value},error:null});},
        maybeSingle(){
          if(table==='gallery_admins')return Promise.resolve({data:admin?{user_id:OWNER}:null,error:null});
          if(call.filters.some(([key])=>key==='content_sha256'))return Promise.resolve({data:null,error:null});
          if(insertAttempted&&unknownCommit)return Promise.resolve({data:null,error:new Error('network unreachable')});
          return Promise.resolve({data:existing,error:null});
        }
      };return builder;
    },
    storage:{from(){return {
      async upload(path){uploads++;events.push({operation:'upload',path});return uploads===uploadFailAt?{error:new Error('upload rejected')}:{error:null};},
      async remove(paths){removed.push(...paths);return {error:null};}
    };}}
  };
  const prepared={width:3000,height:2000,thumbnail:{blob:new Blob(['thumb'],{type:'image/webp'}),extension:'webp'},preview:{blob:new Blob(['preview'],{type:'image/webp'}),extension:'webp'}};
  return {manager:createGalleryManager(async()=>db,{prepare:async()=>prepared,digestFile:async()=> 'a'.repeat(64)}),events,removed};
}

test('explicit metadata validates characters, preserves legacy null, separates category tokens and bounded tags',()=>{
  assert.equal(validateGalleryMetadata({}).characters,null);
  assert.deepEqual(validateGalleryMetadata({characters:[]}).characters,[]);
  assert.deepEqual(validateGalleryMetadata({characters:['hitori','kita','hitori'],tags:'雨夜，演出夜, 雨夜'}).characters,['hitori','kita']);
  assert.deepEqual(validateGalleryMetadata({tags:'雨夜，演出夜, 雨夜'}).tags,['雨夜','演出夜']);
  for(const input of [{characters:['unknown']},{characters:'hitori'},{tags:Array(9).fill('雨')},{tags:'<script>'},{tags:'a'.repeat(21)},{source_url:'javascript:alert(1)'},{source_url:'https://user:pass@example.com'},{creator:'a'.repeat(121)},{category:'../unsafe'}]) assert.throws(()=>validateGalleryMetadata(input));
  assert.equal(validateGalleryMetadata({category:'rainy-night',source_url:'https://example.com/art'}).category,'rainy-night');
});

test('preview sizing does not upscale; SHA-256 compares contents rather than filenames',async()=>{
  assert.deepEqual(imageResize(4000,2000,1920),{width:1920,height:960});
  assert.deepEqual(imageResize(200,400,1920),{width:200,height:400});
  const same=new File([await png.arrayBuffer()],'different-name.png',{type:'image/png'});
  const other=new File(['other'],'image.png',{type:'image/png'});
  assert.equal(await galleryFileDigest(png),await galleryFileDigest(same));
  assert.notEqual(await galleryFileDigest(png),await galleryFileDigest(other));
});

test('failed insert removes only derivatives uploaded by this attempt',async()=>{
  const {manager,removed,events}=fixture({insertError:true});
  await assert.rejects(manager.publish({file:png,title:'雨夜',uploadId:IMAGE}),/insert rejected/);
  assert.deepEqual(removed,events.filter(event=>event.operation==='upload').map(event=>event.path));
  assert.equal(removed.length,3);
  assert.ok(removed.every(path=>path.startsWith(`${OWNER}/`) && !path.includes(IMAGE)));
});


test('ambiguous storage failure cleans every fresh attempted path including the failed response',async()=>{
  const {manager,removed,events}=fixture({uploadFailAt:2});
  await assert.rejects(manager.publish({file:png,title:'雨夜',uploadId:IMAGE}),/upload rejected/);
  assert.deepEqual(removed,events.filter(event=>event.operation==='upload').map(event=>event.path));
  assert.equal(removed.length,2);
});

test('ambiguous database commit retains files rather than deleting a possibly published image',async()=>{
  const {manager,removed}=fixture({insertError:true,unknownCommit:true});
  await assert.rejects(manager.publish({file:png,title:'雨夜',uploadId:IMAGE}),/暂时无法确认/);
  assert.deepEqual(removed,[]);
});

test('retry with an existing immutable ID returns its record without uploading resources again',async()=>{
  const row={id:IMAGE,title:'已发布'};const {manager,events}=fixture({existing:row});
  assert.deepEqual(await manager.publish({file:png,title:'雨夜',uploadId:IMAGE}),row);
  assert.equal(events.filter(event=>event.operation==='upload').length,0);
});

test('metadata update cannot send resource paths, ownership or image identity',async()=>{
  const {manager,events}=fixture();
  await manager.update(IMAGE,{title:'新标题',characters:['hitori'],tags:'雨夜',category:'collection',owner_id:'attacker',object_path:'bad',id:'changed'});
  const update=events.find(event=>event.operation==='update');
  assert.equal(Object.hasOwn(update.value,'id'),false);
  assert.equal(Object.hasOwn(update.value,'owner_id'),false);
  assert.equal(Object.hasOwn(update.value,'object_path'),false);
  assert.deepEqual(update.value.characters,['hitori']);
});

test('non-owner account is denied before any upload or mutation',async()=>{
  const {manager,events}=fixture({admin:false});
  await assert.rejects(manager.publish({file:png,title:'雨夜'}),/只有站主/);
  await assert.rejects(manager.update(IMAGE,{title:'雨夜'}),/只有站主/);
  assert.deepEqual(events,[]);
});

test('bounded queue limits parallel work, permits single retry and cancels queued items',async()=>{
  let running=0,peak=0;const releases=[];const attempts=new Map();
  const queue=createGalleryUploadQueue({concurrency:2,publish:async task=>{
    running++;peak=Math.max(peak,running);attempts.set(task.id,(attempts.get(task.id)||0)+1);
    await new Promise(resolve=>releases.push(resolve));running--;
    if(task.id==='two'&&attempts.get(task.id)===1)throw new Error('retry me');return task.id;
  }});
  for(const id of ['one','two','three','four'])queue.add({id});
  queue.cancel('four');queue.start();assert.equal(running,2);assert.equal(peak,2);
  releases.shift()();await tick();assert.equal(running,2);
  releases.shift()();await tick();assert.equal(queue.tasks[1].status,'failed');
  releases.shift()();await tick();assert.equal(queue.tasks[2].status,'done');
  queue.retry('two');releases.shift()();await tick();
  assert.deepEqual(queue.tasks.map(task=>task.status),['done','done','done','cancelled']);assert.equal(peak,2);assert.equal(queue.active,false);
});

test('collection validation permits multi-membership, requires a real cover member and bounded order',()=>{
  const first=validateCollection({title:'四人合照',imageIds:['quiet-guitar','live-ticket'],cover_image_id:'live-ticket'});
  const second=validateCollection({title:'演出后台',imageIds:['live-ticket']});
  assert.ok(first.imageIds.includes(second.imageIds[0]));
  assert.throws(()=>validateCollection({title:'合集',imageIds:['quiet-guitar'],cover_image_id:'missing'}),/封面/);
  assert.throws(()=>validateCollection({title:'合集',imageIds:['../path']}),/编号/);
  assert.throws(()=>validateCollection({title:'合集',imageIds:[],sort_order:1.5}),/整数/);
});
