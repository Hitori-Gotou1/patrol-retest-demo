import { loadLocal,saveLocal } from '../room/storage.js';
import { readPreferences } from '../room/preferences.js';
export const analyticsKey='hitori-room:counts:v1';
export const eventKinds=['open','complete','export'];
const allowed=new Set(['home','gallery','notes','works','project','calendar','pilgrimage','sources','cards','jigsaw','shop','platform','lights','comic','mix','graffiti','relay','pinball','maze','effects','companion','echo','escape','duet','photobooth','decorate','walk','search','concert','ambient','rhythm','stories','studio','practice','guestbook']);
export function validateCounts(v){if(!v||v.version!==1||!v.days||typeof v.days!=='object')throw new Error('统计备份无法读取。');const days={};for(const [day,rows] of Object.entries(v.days).slice(-90)){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!rows||typeof rows!=='object')throw new Error('统计日期无效。');days[day]={};for(const [target,counts] of Object.entries(rows)){if(!allowed.has(target)||!counts||typeof counts!=='object')throw new Error('统计项目无效。');days[day][target]=Object.fromEntries(eventKinds.map(k=>{const n=counts[k]??0;if(!Number.isInteger(n)||n<0||n>10000000)throw new Error('计数无效。');return [k,n];}));}}return {version:1,days};}
export const readCounts=()=>loadLocal(analyticsKey,{version:1,days:{}},validateCounts);
let lastOpen='';
export function countEvent(event,target){
 if(!eventKinds.includes(event)||!allowed.has(target)||!readPreferences().metrics)return;
 if(event==='open'&&lastOpen===target)return;if(event==='open')lastOpen=target;
 const day=new Date().toISOString().slice(0,10),data=readCounts();
 const row=((data.days[day]??={})[target]??={open:0,complete:0,export:0});row[event]=Math.min(10000000,row[event]+1);
 const keys=Object.keys(data.days).sort();while(keys.length>90)delete data.days[keys.shift()];saveLocal(analyticsKey,data);
 if(typeof window!=='undefined')window.dispatchEvent(new Event('hitori:counts'));
 void sendCount(event,target);
}
async function sendCount(event,target){
 const root=import.meta.env?.VITE_SUPABASE_URL,key=import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(!root||!key||import.meta.env.VITE_SITE_ANALYTICS!=='enabled')return;
 try{await fetch(root.replace(/\/$/,'')+'/rest/v1/rpc/hitori_record_event',{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(!key.startsWith('sb_publishable_')?{Authorization:`Bearer ${key}`}:{})},body:JSON.stringify({event_kind:event,target_key:target}),signal:AbortSignal.timeout(4000)});}catch{/* Local counts remain available when the optional collector is offline. */}
}
export function mergeCounts(text){if(new TextEncoder().encode(text).length>200000)throw new Error('统计备份不能超过 200 KB。');const incoming=validateCounts(JSON.parse(text));const current=readCounts();for(const [day,rows] of Object.entries(incoming.days)){current.days[day]??={};for(const [target,counts] of Object.entries(rows)){current.days[day][target]??={open:0,complete:0,export:0};for(const k of eventKinds)current.days[day][target][k]=Math.max(current.days[day][target][k],counts[k]);}}if(!saveLocal(analyticsKey,validateCounts(current)))throw new Error('未能保存统计。');return current;}
