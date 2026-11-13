import { loadLocal, saveLocal } from './storage.js';
export const preferencesKey='hitori-room:preferences:v1';
export const defaults={version:1,font:1,line:2.1,contrast:false,motion:'system',metrics:true};
export function validatePreferences(v){return {version:1,font:[1,1.15,1.3].includes(v?.font)?v.font:1,line:[1.8,2.1,2.4].includes(v?.line)?v.line:2.1,contrast:v?.contrast===true,motion:['system','reduce'].includes(v?.motion)?v.motion:'system',metrics:v?.metrics!==false};}
export const readPreferences=()=>loadLocal(preferencesKey,defaults,validatePreferences);
const listeners=new Set();
let native;
export function reducedMotion(){return readPreferences().motion==='reduce'||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);}
export function motionPreference(){
 if(!native&&typeof matchMedia==='function'){native=matchMedia('(prefers-reduced-motion: reduce)');native.addEventListener('change',()=>{applyPreferences();notify();});}
 return {get matches(){return reducedMotion();},addEventListener(type,fn){if(type==='change')listeners.add(fn);},removeEventListener(type,fn){if(type==='change')listeners.delete(fn);}};
}
function notify(){for(const fn of listeners)fn({matches:reducedMotion()});}
export function applyPreferences(){
 const p=readPreferences();if(typeof document==='undefined')return p;
 document.documentElement.style.setProperty('--reader-scale',p.font);
 document.documentElement.style.setProperty('--reader-line',p.line);
 document.documentElement.dataset.contrast=p.contrast?'high':'normal';
 document.documentElement.dataset.motion=reducedMotion()?'reduce':'normal';return p;
}
export function setPreferences(value){const p=validatePreferences(value);if(!saveLocal(preferencesKey,p))throw new Error('设置暂未保存，请检查浏览器存储。');applyPreferences();notify();if(typeof window!=='undefined')window.dispatchEvent(new Event('hitori:preferences'));return p;}
