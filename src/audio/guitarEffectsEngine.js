import { defaultTone,validateTone } from '../room/effects.js';

export function pluckBuffer(context,frequency){
  const rate=context.sampleRate,duration=2.2,buffer=context.createBuffer(1,Math.ceil(rate*duration),rate),samples=buffer.getChannelData(0),length=Math.max(2,Math.round(rate/frequency));
  let seed=Math.round(frequency*100);const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
  const line=Float32Array.from({length},noise);
  for(let i=0;i<samples.length;i++){const j=i%length,value=line[j];line[j]=(value+line[(j+1)%length])*.497;samples[i]=value*.65*Math.min(1,i/(rate*.003),(samples.length-i)/(rate*.06));}
  return buffer;
}
export function distortionCurve(amount){const curve=new Float32Array(4096),drive=1+amount*70,normal=Math.tanh(drive);for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=Math.tanh(x*drive)/normal*.65;}return curve;}
export function createToneGraph(context,inputPreset,destination){
  const preset=validateTone(inputPreset),nodes=[],controls={};
  const gain=value=>{const node=context.createGain();node.gain.value=value;nodes.push(node);return node;};
  const input=gain(1);let previous=input;
  for(const id of preset.order){
    if(!preset.enabled[id])continue;
    const output=gain(1);
    if(id==='drive'){const shaper=context.createWaveShaper();shaper.curve=distortionCurve(preset.drive);shaper.oversample='2x';nodes.push(shaper);previous.connect(shaper);shaper.connect(output);controls.drive=shaper;}
    if(id==='delay'){
      const dry=gain(1-preset.delayMix*.5),wet=gain(preset.delayMix),feedback=gain(preset.feedback),delay=context.createDelay(2);delay.delayTime.value=preset.delayTime;nodes.push(delay);
      previous.connect(dry);dry.connect(output);previous.connect(delay);delay.connect(wet);wet.connect(output);delay.connect(feedback);feedback.connect(delay);controls.delay={dry,wet,feedback,delay};
    }
    if(id==='reverb'){
      const dry=gain(1-preset.reverbMix*.4),wet=gain(preset.reverbMix),convolver=context.createConvolver();
      const ir=context.createBuffer(2,Math.ceil(context.sampleRate*1.6),context.sampleRate);
      for(let channel=0;channel<2;channel++){const samples=ir.getChannelData(channel);let seed=997+channel*97;for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=(seed/2147483648-1)*Math.pow(1-i/samples.length,2.5);}}
      convolver.buffer=ir;nodes.push(convolver);previous.connect(dry);dry.connect(output);previous.connect(convolver);convolver.connect(wet);wet.connect(output);controls.reverb={dry,wet};
    }
    previous=output;
  }
  previous.connect(destination);
  function update(value){const p=validateTone(value),now=context.currentTime;if(controls.drive&&p.drive!==preset.drive){controls.drive.curve=distortionCurve(p.drive);preset.drive=p.drive;}if(controls.delay){controls.delay.dry.gain.setTargetAtTime(1-p.delayMix*.5,now,.03);controls.delay.wet.gain.setTargetAtTime(p.delayMix,now,.03);controls.delay.feedback.gain.setTargetAtTime(p.feedback,now,.03);controls.delay.delay.delayTime.setTargetAtTime(p.delayTime,now,.04);}if(controls.reverb){controls.reverb.dry.gain.setTargetAtTime(1-p.reverbMix*.4,now,.03);controls.reverb.wet.gain.setTargetAtTime(p.reverbMix,now,.03);}}
  return {input,update,dispose(){for(const node of nodes)node.disconnect();}};
}
export function createGuitarEffectsEngine({createContext,isHidden=()=>false}={}){
  let context,master,graph,ready=false,disposed=false,generation=0,preset=validateTone(defaultTone),volume=.18;
  const voices=new Set(),buffers=new Map();
  function clear(){for(const source of voices){source.onended=null;try{source.stop();}catch{}source.disconnect();}voices.clear();}
  function stop(){generation++;ready=false;clear();graph?.dispose();graph=null;if(context?.state==='running')context.suspend().catch(()=>{});}
  async function unlock(){if(disposed||isHidden())return false;stop();const token=++generation;try{if(!context){context=createContext();master=context.createGain();master.connect(context.destination);}await context.resume();if(disposed||token!==generation||isHidden()||context.state!=='running'){if(!ready&&context.state==='running')await context.suspend();return false;}master.gain.value=volume;graph=createToneGraph(context,preset,master);ready=true;return true;}catch{if(token===generation)stop();return false;}}
  function setPreset(value){const next=validateTone(value),changed=JSON.stringify([next.order,next.enabled])!==JSON.stringify([preset.order,preset.enabled]);preset=next;if(!ready||!context)return;if(changed){clear();graph?.dispose();graph=createToneGraph(context,preset,master);}else graph.update(preset);}
  function play(frequency,offset=0){if(!ready||disposed||isHidden()||context.state!=='running')return false;const hz=Math.max(40,Math.min(1100,Number(frequency)||196)),key=String(hz);if(!buffers.has(key)){if(buffers.size>=24)buffers.delete(buffers.keys().next().value);buffers.set(key,pluckBuffer(context,hz));}while(voices.size>=12){const source=voices.values().next().value;source.onended=null;source.stop();source.disconnect();voices.delete(source);}const source=context.createBufferSource();source.buffer=buffers.get(key);source.connect(graph.input);source.onended=()=>{voices.delete(source);source.disconnect();};voices.add(source);source.start(context.currentTime+Math.max(0,Math.min(.2,offset)));return true;}
  function setVolume(value){volume=Math.max(0,Math.min(.5,Number(value)||0));if(master)master.gain.setTargetAtTime(volume,context.currentTime,.03);}
  function dispose(){if(disposed)return;disposed=true;stop();buffers.clear();master?.disconnect();if(context&&context.state!=='closed')context.close().catch(()=>{});}
  return {unlock,play,setPreset,setVolume,stop,dispose};
}
export async function renderToneWav(preset,OfflineContext){
  const context=new OfflineContext(1,22050*6,22050),master=context.createGain();master.gain.setValueAtTime(.35,0);master.gain.setValueAtTime(.35,5.7);master.gain.linearRampToValueAtTime(0,5.99);master.connect(context.destination);const graph=createToneGraph(context,preset,master);
  for(const [i,hz] of [196,246.94,293.66,392,196,246.94,329.63].entries()){const source=context.createBufferSource();source.buffer=pluckBuffer(context,hz);source.connect(graph.input);source.start(i<4?i*.65:3+(i-4)*.04);}
  const result=await context.startRendering(),samples=result.getChannelData(0),bytes=new ArrayBuffer(44+samples.length*2),view=new DataView(bytes);
  const word=(at,text)=>[...text].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));word(0,'RIFF');view.setUint32(4,36+samples.length*2,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,22050,true);view.setUint32(28,44100,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,samples.length*2,true);for(let i=0;i<samples.length;i++)view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);graph.dispose();return new Blob([bytes],{type:'audio/wav'});
}
