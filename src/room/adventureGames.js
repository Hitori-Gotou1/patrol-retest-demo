import { duetQuestions } from '../data/adventures.js';
import { shuffled,clamp } from './playroom.js';
export function echoSequence(seed,length){return Array.from({length:Math.max(3,Math.min(9,length))},(_,i)=>shuffled([0,1,2,3,4,5],seed+i*7919)[0]);}
export function judgeEcho(sequence,answers){const correct=sequence.reduce((n,note,i)=>n+Number(note===answers[i]),0);return {correct,total:sequence.length,accuracy:Math.round(correct/sequence.length*100),perfect:correct===sequence.length&&answers.length===sequence.length};}
export const allLights=511;
export function toggleLights(mask,index){if(!Number.isInteger(index)||index<0||index>8)return mask;const x=index%3,y=Math.floor(index/3);for(const [dx,dy] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<3&&ny>=0&&ny<3)mask^=1<<(ny*3+nx);}return mask;}
export const initialLights=[0,4,8].reduce(toggleLights,allLights);
export function solveLights(mask){const queue=[[mask,[]]],seen=new Set([mask]);for(let cursor=0;cursor<queue.length;cursor++){const [current,path]=queue[cursor];if(current===allLights)return path;for(let i=0;i<9;i++){const next=toggleLights(current,i);if(!seen.has(next)){seen.add(next);queue.push([next,[...path,i]]);}}}return [];}
export function newEscape(){return {version:1,id:Date.now(),inspected:[],caseOpen:false,power:false,wired:false,lights:initialLights,moves:0,hints:0,complete:false};}
export function validateEscape(v){if(!v||v.version!==1)throw new Error('invalid escape');return {version:1,id:Number.isSafeInteger(v.id)?v.id:0,inspected:[...new Set((Array.isArray(v.inspected)?v.inspected:[]).filter(x=>['poster','ticket','case','power','wires','desk','door'].includes(x)))],caseOpen:v.caseOpen===true,power:v.caseOpen===true&&v.power===true,wired:v.caseOpen===true&&v.power===true&&v.wired===true,lights:Math.floor(clamp(v.lights,0,511)),moves:Math.floor(clamp(v.moves,0,10000)),hints:Math.floor(clamp(v.hints,0,1000)),complete:v.complete===true&&v.caseOpen===true&&v.power===true&&v.wired===true&&v.lights===allLights};}
export function escapeAction(input,type,value){const state=validateEscape(input);if(state.complete)return {state,message:'舞台已经亮起来了。'};let message='';
  if(type==='case'){if(String(value)!=='2413')return {state:input,message:'密码没有对上。看看海报的颜色顺序，再对照票根上的数字。'};state.caseOpen=true;message='箱子打开了：找到一枚保险丝、一束连接线和一张接线便签。';}
  else if(type==='power'){if(!state.caseOpen)return {state:input,message:'缺少保险丝，先打开储物箱。'};state.power=true;message='保险丝装好了，工作灯亮了。接下来检查乐器的线路。';}
  else if(type==='wires'){if(!state.power)return {state:input,message:'先恢复工作电源，再接线。'};if(!Array.isArray(value)||value.join(',')!=='pink,blue,yellow')return {state:input,message:'线路还没接对。便签写着：吉他接粉色，贝斯接蓝色，鼓接黄色。'};state.wired=true;message='三条线路都通了。现在可以去灯光台点亮九盏灯。';}
  else if(type==='light'){if(!state.wired)return {state:input,message:'电源和接线还没有准备好。'};state.lights=toggleLights(state.lights,value);message=state.lights===allLights?'九盏灯都亮了！去推开舞台的门吧。':'按下一格，会切换它和上下左右的灯。';}
  else if(type==='door'){if(!state.power||!state.wired||state.lights!==allLights)return {state:input,message:'门后的灯还没全亮，先完成电源、接线与灯光台。'};state.complete=true;message='幕布升起来了。所有等待，都有了第一拍的回响。';}
  else return {state:input,message:''};state.moves++;return {state,message};
}
export function duetRound(seed){return shuffled(duetQuestions,seed).slice(0,5).map(q=>q.id);}
export function judgeDuet(questions,a,b){const matches=questions.filter((_,i)=>Number.isInteger(a[i])&&a[i]>=0&&a[i]<4&&a[i]===b[i]).length;return {matches,total:questions.length,percent:Math.round(matches/questions.length*100)};}
export function relayCode(seed,round){return Array.from({length:4+Math.min(round,2)},(_,i)=>shuffled([0,1,2,3],seed+i*101+round*307)[0]);}
