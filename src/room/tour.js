import {loadLocal,saveLocal} from './storage.js';
export const tourKey='hitori-room:tour:v1';
export const readTour=()=>loadLocal(tourKey,{step:0,done:false},v=>({step:[0,1,2,3].includes(v?.step)?v.step:0,done:v?.done===true}));
export function updateTour(value){saveLocal(tourKey,value);if(typeof window!=='undefined')window.dispatchEvent(new Event('hitori:tour'));}
export function startTour(){updateTour({step:1,done:false});}
