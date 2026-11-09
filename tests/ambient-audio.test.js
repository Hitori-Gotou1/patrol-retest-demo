import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmbientAudioEngine } from '../src/audio/ambientAudioEngine.js';
function harness(){
  const active=new Set(),tasks=new Map();let created=0,next=1,gate=null;
  const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
  const node=()=>({connect(){},disconnect(){},gain:parameter(),frequency:parameter()});
  const context={state:'suspended',sampleRate:200,currentTime:0,destination:{},createGain:node,createBiquadFilter:node,
    createBuffer:(_channels,length)=>({getChannelData:()=>new Float32Array(length)}),
    createBufferSource(){return {...node(),start(){active.add(this);},stop(){active.delete(this);}};},
    createOscillator(){return {...node(),start(){active.add(this);},stop(at){if(at===undefined)active.delete(this);}};},
    async resume(){if(gate)await gate;if(this.state!=='closed')this.state='running';},async suspend(){this.state='suspended';},async close(){this.state='closed';}
  };
  let hidden=false;
  const engine=createAmbientAudioEngine({createContext:()=>{created++;return context;},isHidden:()=>hidden,schedule:fn=>{const id=next++;tasks.set(id,fn);return id;},cancel:id=>tasks.delete(id)});
  return {engine,context,active,tasks,get created(){return created;},setHidden:value=>hidden=value,delay:()=>{let resolve;gate=new Promise(r=>resolve=r);return resolve;}};
}
test('ambient starts only after consent and releases all loops and timers on stop',async()=>{
  const h=harness();h.engine.setLevels({rain:.5,street:.2,tuning:.4,crowd:.1});assert.equal(h.created,0);assert.equal(h.active.size,0);
  assert.equal(await h.engine.start(),true);assert.equal(h.active.size,4);assert.equal(h.tasks.size,1);
  h.engine.stop();assert.equal(h.active.size,0);assert.equal(h.tasks.size,0);assert.equal(h.context.state,'suspended');
  assert.equal(await h.engine.start(),true);h.engine.dispose();assert.equal(h.active.size,0);assert.equal(h.context.state,'closed');assert.equal(await h.engine.start(),false);
});
test('late audio permission cannot start sound after stop or route disposal',async()=>{
  for(const action of ['stop','dispose']){
    const h=harness(),release=h.delay(),starting=h.engine.start();h.engine[action]();release();assert.equal(await starting,false);assert.equal(h.active.size,0);assert.equal(h.tasks.size,0);h.engine.dispose();
  }
});
test('hidden pages stay silent and all-zero tuning leaves no plucked oscillator',async()=>{
  const h=harness();h.setHidden(true);assert.equal(await h.engine.start(),false);assert.equal(h.created,0);h.setHidden(false);
  h.engine.setLevels({rain:0,street:0,tuning:0,crowd:0});assert.equal(await h.engine.start(),true);assert.equal(h.active.size,3);h.engine.stop();
});
