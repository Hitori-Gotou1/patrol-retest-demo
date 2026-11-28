import {clamp} from './playroom.js';
const colors=['#e3a0c0','#e8cd88','#a5cbd8'];
const number=(v,low,high,fallback=low)=>Number.isFinite(v)?clamp(v,low,high):fallback;
export const validColor=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function newLightShow(){return {version:1,name:'今晚的第一束光',bpm:96,background:false,cues:Array.from({length:3},(_,track)=>Array.from({length:16},(_,step)=>({x:150+track*300+(step%4-1.5)*35,color:colors[track],intensity:step%4===track?.8:.35,fade:true}))) };}
export function validateLightShow(v){if(!v||v.version!==1||typeof v.name!=='string'||v.name.length>60||!Array.isArray(v.cues)||v.cues.length!==3||v.cues.some(row=>!Array.isArray(row)||row.length!==16))throw new Error('需要三束灯光、每束十六步的编排。');return {version:1,name:v.name.slice(0,60),bpm:Math.round(number(v.bpm,60,180,96)),background:v.background===true,cues:v.cues.map(row=>row.map(c=>{if(!c||!validColor(c.color))throw new Error('灯光颜色无效。');return {x:number(c.x,50,850,450),color:c.color,intensity:number(c.intensity,0,1,.5),fade:c.fade===true};}))};}
export function lightFrame(show,step,fraction){return show.cues.map(row=>{const now=row[step],next=row[(step+1)%16],a=now.fade?clamp(fraction,0,1):0;return {...now,x:now.x+(next.x-now.x)*a,intensity:now.intensity+(next.intensity-now.intensity)*a};});}
export const comicScenes=[{id:'room',label:'放学后的房间',background:'#e7cdd8',floor:'#b695ab'},{id:'stage',label:'小小舞台',background:'#3d354d',floor:'#6e586f'},{id:'street',label:'晴天的街角',background:'#c6d9d2',floor:'#a0b6a6'}];
export const comicLayouts = [{ id: 'grid', label: '两列四格' }, { id: 'vertical', label: '竖向四格' }];
export const graffitiFormats = [{ id: 'wall', label: '演出墙 · 横向' }, { id: 'poster', label: '小海报 · 竖向' }];
export const graffitiTools = [{ id: 'pen', label: '画笔' }, { id: 'eraser', label: '橡皮' }, { id: 'stamp', label: '印章' }];
const ids=['hitori','nijika','ryo','kita'];
export function newComic(){return {version:1,title:'今天，也一起。',layout:'grid',panels:Array.from({length:4},(_,i)=>({scene:comicScenes[i%3].id,caption:['放学以后','排练之前','稍微有点紧张','不过，大家都在'][i],dialogue:['今、今天要练哪一段？','从第一小节开始吧。','我来数拍子。','一、二、三、四！'][i],objects:[{key:`a${i}`,id:ids[i],x:190,y:265,scale:1},{key:`b${i}`,id:ids[(i+1)%4],x:410,y:265,scale:1}]}))};}
function validateComicPanel(panel, index) {
  if (!panel || !Array.isArray(panel.objects) || panel.objects.length > 4) throw new Error('角色数据无效。');
  const keys = new Set();
  let speaker = '';
  const objects = panel.objects.filter(object => ids.includes(object?.id)).map((object, position) => {
    let key = typeof object.key === 'string' && /^[\w-]{1,80}$/.test(object.key) ? object.key : `${index}-${position}`;
    if (keys.has(key)) {
      key = `panel-${index}-${position}`;
      while (keys.has(key)) key += '-';
    }
    keys.add(key);
    if (!speaker && panel.speaker && panel.speaker === object.key) speaker = key;
    return { key, id:object.id, x:number(object.x,35,565,190), y:number(object.y,190,325,265), scale:number(object.scale,.6,1.5,1) };
  });
  return {
    scene:comicScenes.some(scene => scene.id === panel.scene) ? panel.scene : 'room',
    caption:String(panel.caption || '').slice(0,40),
    dialogue:String(panel.dialogue || '').slice(0,60),
    ...(speaker ? { speaker } : {}), objects
  };
}
export function validateComic(value) {
  if (!value || value.version !== 1 || typeof value.title !== 'string' || !Array.isArray(value.panels) || value.panels.length !== 4) {
    throw new Error('漫画需要四个画面。');
  }
  return { version:1, title:value.title.slice(0,40), layout:value.layout === 'vertical' ? 'vertical' : 'grid', panels:value.panels.map(validateComicPanel) };
}
export function wrapComicText(text,width=19){const chars=Array.from(String(text).replace(/\s+/g,' '));return Array.from({length:Math.ceil(chars.length/width)},(_,i)=>chars.slice(i*width,(i+1)*width).join('')).slice(0,4);}
export function newGraffiti(){return {version:1,format:'wall',paper:'#f4e8da',layers:Array.from({length:3},(_,i)=>({name:`图层 ${i+1}`,visible:true,strokes:[]}))};}
export function validateGraffiti(v){if(!v||v.version!==1||!Array.isArray(v.layers)||v.layers.length!==3||!validColor(v.paper))throw new Error('涂鸦数据无效。');let count=0;return {version:1,format:v.format==='poster'?'poster':'wall',paper:v.paper,layers:v.layers.map((l,i)=>({name:`图层 ${i+1}`,visible:l.visible!==false,strokes:(Array.isArray(l.strokes)?l.strokes:[]).slice(-300).map(s=>{if(++count>300||!['pen','eraser','stamp'].includes(s.tool)||!validColor(s.color)||!Array.isArray(s.points)||s.points.length>2000)throw new Error('涂鸦内容过多。');return {tool:s.tool,color:s.color,size:number(s.size,1,80,8),stamp:ids.includes(s.stamp)?s.stamp:['✦','♪','LIVE!','♥'].includes(s.stamp)?s.stamp:'✦',points:s.points.map(p=>{if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))throw new Error('无效的笔迹。');return p.map(n=>clamp(n,0,1));})};})}))};}
export function mixScore(challenge,channels){const axis=challenge.focus,range={volume:1,pan:2,tone:24}[axis];const difference=challenge.target.reduce((sum,t,i)=>sum+Math.abs(t[axis]-channels[i][axis])/range,0)/4;return Math.round(clamp(100-difference*200,0,100));}
export function validateMix(v){if(!v||v.version!==1||!Array.isArray(v.channels)||v.channels.length!==4)throw new Error('混音需要四条轨道。');return {version:1,task:Number.isInteger(v.task)&&v.task>=0&&v.task<=3?v.task:0,channels:v.channels.map(c=>({volume:number(c.volume,0,1,.5),pan:number(c.pan,-1,1,0),tone:number(c.tone,-12,12,0),mute:c.mute===true,solo:c.solo===true})),cleared:[...new Set((Array.isArray(v.cleared)?v.cleared:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<3))]};}
