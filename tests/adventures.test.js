import test from 'node:test';
import assert from 'node:assert/strict';
import {mazeLevels,duetQuestions} from '../src/data/adventures.js';
import {newMaze,moveMaze,mazeHazards,validateMaze} from '../src/room/maze.js';
import {echoSequence,judgeEcho,allLights,initialLights,toggleLights,solveLights,newEscape,escapeAction,validateEscape,duetRound,judgeDuet,relayCode} from '../src/room/adventureGames.js';
import {defaultCompanion,rememberActivity,giveCompanion,validateCompanion} from '../src/room/companion.js';
import {validateActivity,validateActivityLog} from '../src/room/activityLog.js';
import {defaultTone,validateTone,moveEffect,parseToneFile} from '../src/room/effects.js';

test('all three authored mazes have a reachable keyed exit without exhausting energy',()=>{
  for(let level=0;level<mazeLevels.length;level++){
    assert.ok(mazeLevels[level].rows.every(r=>r.length===11));
    const queue=[newMaze(level)],seen=new Map();let solved=false;
    for(let cursor=0;cursor<queue.length&&cursor<100000;cursor++){
      const state=queue[cursor];if(state.phase==='won'){solved=true;assert.equal(state.hasKey,true);assert.ok(state.energy>0);break;}
      for(const action of ['right','down','left','up','wait','hide']){
        const next=moveMaze(state,action).state;if(next===state||next.phase==='rest')continue;
        const key=[next.x,next.y,next.turn%12,next.hasKey,next.hidden,...next.boxes.map(b=>`${b.x},${b.y}`)].join('|');
        if((seen.get(key)??-1)>=next.energy)continue;seen.set(key,next.energy);queue.push(next);
      }
    }
    assert.ok(solved,`level ${level+1} must be solvable`);
  }
});
test('walls do not advance patrols, boxes push and block light, hiding restores energy',()=>{
  const start=newMaze();assert.equal(moveMaze(start,'up').state,start);
  const approaching={...newMaze(),x:2,y:3,energy:40};
  const pushed=moveMaze(approaching,'right').state;assert.deepEqual(pushed.boxes,[{x:4,y:3}]);assert.equal(approaching.boxes[0].x,3);
  const hidden=moveMaze(pushed,'hide').state;assert.equal(hidden.hidden,true);assert.ok(hidden.energy>pushed.energy);
  assert.ok(moveMaze(hidden,'wait').state.energy>hidden.energy);
  const beam={...newMaze(),turn:3};assert.ok(mazeHazards(beam).light.has('7,2'));
  assert.equal(mazeHazards({...beam,boxes:[{x:7,y:2}]}).light.has('7,2'),false);
  assert.throws(()=>validateMaze({...start,x:0,y:0}));assert.throws(()=>validateMaze({...start,boxes:[{x:3,y:3},{x:3,y:3}]}));
});
test('melodies are reproducible, grow within playable keys and judge actual positions',()=>{
  for(let seed=1;seed<30;seed++){const notes=echoSequence(seed,8);assert.deepEqual(notes,echoSequence(seed,8));assert.equal(notes.length,8);assert.ok(notes.every(n=>n>=0&&n<6));assert.equal(judgeEcho(notes,notes).accuracy,100);}
  assert.deepEqual(judgeEcho([0,2,4],[0,4,2]),{correct:1,total:3,accuracy:33,perfect:false});
});
test('escape progression requires all clues and connections, and the light board is solvable',()=>{
  let state=newEscape();assert.equal(escapeAction(state,'door').state.complete,false);assert.equal(escapeAction(state,'power').state,state);assert.equal(escapeAction(state,'case','1234').state,state);
  state=escapeAction(state,'case','2413').state;state=escapeAction(state,'power').state;assert.equal(escapeAction(state,'wires',['pink','pink','yellow']).state.wired,false);
  state=escapeAction(state,'wires',['pink','blue','yellow']).state;assert.equal(state.wired,true);
  const solution=solveLights(initialLights);assert.ok(solution.length>0);for(const index of solution)state=escapeAction(state,'light',index).state;
  assert.equal(state.lights,allLights);state=escapeAction(state,'door').state;assert.equal(state.complete,true);
  assert.equal(validateEscape({version:1,complete:true,power:true,wired:true,lights:511}).complete,false);
  for(let mask=0;mask<512;mask+=7){const solution=solveLights(mask);assert.equal(solution.reduce(toggleLights,mask),allLights);}
});
test('duet questions never repeat in a round and only valid choices count as matches',()=>{
  for(let seed=1;seed<20;seed++){const ids=duetRound(seed);assert.equal(ids.length,5);assert.equal(new Set(ids).size,5);assert.ok(ids.every(id=>duetQuestions.some(q=>q.id===id)));}
  const ids=duetRound(1);assert.equal(judgeDuet(ids,[0,1,2,3,0],[0,1,2,3,0]).matches,5);assert.equal(judgeDuet(ids,[4,4,4,4,4],[4,4,4,4,4]).matches,0);
  for(let round=0;round<3;round++){const code=relayCode(7,round);assert.equal(code.length,4+round);assert.ok(code.every(n=>n>=0&&n<4));}
});
test('companion remembers each receipt once, bounds memory and preserves display preferences',()=>{
  let state={...structuredClone(defaultCompanion),enabled:false};
  const event={id:'one',kind:'photo',detail:'新的合影',at:1};state=rememberActivity(state,event);const once=structuredClone(state);state=rememberActivity(state,event);assert.deepEqual(state,once);assert.equal(state.enabled,false);
  for(let i=0;i<100;i++)state=rememberActivity(state,{...event,id:`event-${i}`,kind:'maze'});
  assert.equal(state.memories.length,8);assert.equal(state.seen.length,80);assert.ok(state.energy<=100&&state.courage<=100);
  const gift=giveCompanion(state,'tea');assert.equal(gift.state.gifts.tea,state.gifts.tea-1);assert.equal(gift.state.enabled,false);
  assert.equal(validateCompanion({...state,member:'<script>'}).member,'hitori');
  assert.throws(()=>validateActivity({...event,kind:'constructor'}));assert.throws(()=>validateActivity({...event,kind:'__proto__'}));assert.equal(validateActivityLog([event,{...event,kind:'unknown'}]).length,1);
});
test('tone imports whitelist the chain and clamp potentially unstable delay feedback',()=>{
  const tone=validateTone({...defaultTone,order:['delay','delay','remote'],feedback:100,reverbMix:100,name:'n'.repeat(100)});assert.deepEqual(tone.order,['drive','delay','reverb']);assert.equal(tone.feedback,.65);assert.equal(tone.reverbMix,.75);assert.equal(tone.name.length,32);
  const moved=moveEffect(defaultTone,'drive',1);assert.deepEqual(moved.order,['delay','drive','reverb']);assert.deepEqual(defaultTone.order,['drive','delay','reverb']);assert.throws(()=>validateTone({version:5}));
  assert.deepEqual(parseToneFile(JSON.stringify(defaultTone)),defaultTone);assert.throws(()=>parseToneFile('{"version":1}'));assert.throws(()=>parseToneFile(' '.repeat(16385)));assert.throws(()=>parseToneFile(JSON.stringify({...defaultTone,drive:'https://example.test'})));
});
