import { onScopeDispose, ref, watch } from 'vue';
import { loadLocal,saveLocal } from '../room/storage.js';
import { activityKey,readActivities } from '../room/activityLog.js';
import { defaultCompanion,validateCompanion,rememberActivity,giveCompanion,greetings,companionReaction,updateCompanionMemory,deleteCompanionMemory } from '../room/companion.js';
const key='hitori-room:companion:v1';
let state,saved,users=0,unwatch;
function receive(event){try{state.value=rememberActivity(state.value,event.detail);}catch{/* Ignore malformed local events. */}}
function catchUp(event){
  if(event&&(event.key===key||event.type==='hitori:sync-applied'||event.key===null)){
    const latest=loadLocal(key,state.value,validateCompanion);
    if(JSON.stringify(latest)!==JSON.stringify(state.value))state.value=latest;
  }
  if(event&&event.type!=='hitori:sync-applied'&&event.key!==activityKey&&event.key!==null)return;
  for(const activity of readActivities().slice().reverse())receive({detail:activity});
}
export function useCompanion(){
  if(!state){state=ref(loadLocal(key,defaultCompanion,validateCompanion));saved=ref(true);}
  if(users++===0){catchUp();unwatch=watch(state,()=>{saved.value=saveLocal(key,state.value);},{deep:true,immediate:true});window.addEventListener('hitori:activity',receive);window.addEventListener('storage',catchUp);window.addEventListener('hitori:sync-applied',catchUp);}
  onScopeDispose(()=>{if(--users===0){saved.value=saveLocal(key,state.value);unwatch?.();window.removeEventListener('hitori:activity',receive);window.removeEventListener('storage',catchUp);window.removeEventListener('hitori:sync-applied',catchUp);}});
  function choose(member){if(!Object.hasOwn(greetings,member))return;state.value.member=member;state.value.reply=greetings[member];}
  function greet(){const memory=state.value.memories[0];state.value.reply=memory?companionReaction(state.value.member,memory):greetings[state.value.member];}
  function gift(kind){const next=giveCompanion(state.value,kind);state.value=next.state;state.value.reply=next.message;}
  function rest(){state.value.energy=Math.min(100,state.value.energy+15);state.value.reply='先安静坐一会儿。休息也可以是今天认真做的一件事。';}
  function pinMemory(id,pinned){state.value=updateCompanionMemory(state.value,id,{pinned});}
  function linkMemory(id,work){state.value=updateCompanionMemory(state.value,id,{workId:work?.id||'',workTitle:work?.title||''});}
  function deleteMemory(id){state.value=deleteCompanionMemory(state.value,id);}
  return {state,saved,choose,greet,gift,rest,pinMemory,linkMemory,deleteMemory};
}
