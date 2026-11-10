import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuitarEffectsEngine,pluckBuffer,distortionCurve} from '../src/audio/guitarEffectsEngine.js';
import {defaultTone} from '../src/room/effects.js';
function setup(){
  const active=new Set(),nodes=[];let created=0,gate=null;
  const param=()=>({value:0,setTargetAtTime(value){this.value=value;}});
  const node=()=>{const n={connect(){},disconnect(){this.disconnected=true;},gain:param(),delayTime:param()};nodes.push(n);return n;};
  const context={state:'suspended',sampleRate:200,currentTime:0,destination:{},createGain:node,createDelay:node,createWaveShaper:node,createConvolver:node,
    createBuffer(channels,length,rate){const arrays=Array.from({length:channels},()=>new Float32Array(length));return {sampleRate:rate,getChannelData:index=>arrays[index]};},
    createBufferSource(){return {...node(),start(){active.add(this);},stop(){active.delete(this);}};},
    async resume(){if(gate)await gate;if(this.state!=='closed')this.state='running';},async suspend(){this.state='suspended';},async close(){this.state='closed';}
  };
  let hidden=false;const engine=createGuitarEffectsEngine({createContext:()=>{created++;return context;},isHidden:()=>hidden});
  return {engine,context,active,nodes,get created(){return created;},hide:()=>hidden=true,delay(){let release;gate=new Promise(resolve=>release=resolve);return release;}};
}
test('guitar stays silent before unlock, caps voices, and cancels all sources on mute',async()=>{
  const h=setup();h.engine.setPreset(defaultTone);assert.equal(h.created,0);assert.equal(h.engine.play(196),false);assert.equal(await h.engine.unlock(),true);
  for(let i=0;i<30;i++)h.engine.play(110+i);assert.equal(h.active.size,12);h.engine.stop();assert.equal(h.active.size,0);assert.equal(h.context.state,'suspended');assert.equal(h.engine.play(196),false);
  await h.engine.unlock();h.engine.play(196);h.engine.dispose();assert.equal(h.active.size,0);assert.equal(h.context.state,'closed');assert.equal(await h.engine.unlock(),false);
});
test('live knob changes preserve a note, rewiring clears old tails, and late resume is cancelled',async()=>{
  const h=setup();await h.engine.unlock();h.engine.play(196);h.engine.setPreset({...defaultTone,delayMix:.5});assert.equal(h.active.size,1);
  h.engine.setPreset({...defaultTone,order:['delay','drive','reverb']});assert.equal(h.active.size,0);assert.ok(h.nodes.some(n=>n.disconnected));h.engine.dispose();
  for(const operation of ['stop','dispose']){const h=setup(),release=h.delay(),promise=h.engine.unlock();h.engine[operation]();release();assert.equal(await promise,false);assert.equal(h.active.size,0);h.engine.dispose();}
});
test('original plucks and distortion curves contain finite, bounded, distinct samples',()=>{
  const h=setup(),a=pluckBuffer(h.context,82.41).getChannelData(0),b=pluckBuffer(h.context,110).getChannelData(0);
  assert.ok(a.every(Number.isFinite));assert.ok(a.some(n=>n!==0));assert.notDeepEqual(a,b);
  const clean=distortionCurve(0),drive=distortionCurve(.9);assert.ok(drive.every(n=>Number.isFinite(n)&&Math.abs(n)<=1));assert.notDeepEqual(clean,drive);
});
