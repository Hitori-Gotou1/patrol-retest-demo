import { loadLocal, saveLocal } from './storage.js';
export const activityKey='hitori-room:activity-log:v1';
export const activityKinds={photo:'拍贴合影',room:'房间布置',walk:'散步集章',search:'排练室寻物',concert:'演出筹备',ambient:'氛围收藏',studio:'自己的编曲',practice:'认真练习',maze:'纸箱迷宫',effects:'新的音色',echo:'旋律回声',escape:'解谜夜',duet:'双人挑战'};
export function validateActivity(v){if(!v||typeof v.id!=='string'||v.id.length>90||!Object.hasOwn(activityKinds,v.kind)||typeof v.detail!=='string')throw new Error('invalid activity');return {id:v.id,kind:v.kind,detail:v.detail.slice(0,90),at:Number.isFinite(v.at)?v.at:0};}
export function validateActivityLog(v){if(!Array.isArray(v))throw new Error('invalid log');return v.slice(0,30).flatMap(x=>{try{return [validateActivity(x)];}catch{return [];}});}
let memory=[];
export function readActivities(){return loadLocal(activityKey,memory,validateActivityLog);}
export function recordActivity(kind,detail,receipt=detail){
  if(!Object.hasOwn(activityKinds,kind))return false;
  let hash=2166136261;for(const char of `${kind}:${receipt}`)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  const id=`${kind}-${hash>>>0}`,log=readActivities();if(log.some(e=>e.id===id))return false;
  const event=validateActivity({id,kind,detail:String(detail),at:Date.now()});memory=[event,...log].slice(0,30);saveLocal(activityKey,memory);
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('hitori:activity',{detail:event}));return true;
}
