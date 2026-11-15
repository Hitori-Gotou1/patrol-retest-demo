import { defaultPhoto, validatePhoto } from './playroom.js';
import { newComic, newLightShow, validateComic, validateLightShow } from './creativeTools.js';
const clone = value => JSON.parse(JSON.stringify(value));
const photo = (theme,caption) => validatePhoto({...clone(defaultPhoto),theme,caption});
function comic(theme) {
  const value=newComic(); value.layout=theme==='rain'?'vertical':'grid'; value.title=theme==='rain'?'雨停之前，一起等一会儿。':'生日这天，也一起。';
  const captions=theme==='rain'?['放学时，下起了雨','屋檐下，多了一把伞','再等一会儿也没关系','回家的路，一起走']:['悄悄准备','差一点被发现','三、二、一','今天的合影'];
  const lines=theme==='rain'?['我、我好像忘记带伞了。','来这边吧，还能站一个人。','雨声也像一段鼓点呢。','那就等这一小节结束。']:['彩带要放在哪里？','咦？今天排练这么安静？','生日快乐！','下一年，也一起弹下去。'];
  value.panels.forEach((p,i)=>{p.scene=theme==='rain'?'street':i===2?'stage':'room';p.caption=captions[i];p.dialogue=lines[i];});return validateComic(value);
}
function lights(theme) {
  const value=newLightShow(); value.name=theme==='rain'?'雨夜窗边 · 三束慢光':'演出夜 · 四色开场';value.bpm=theme==='rain'?72:120;
  value.cues.forEach((row,t)=>row.forEach((cue,s)=>{cue.color=theme==='rain'?['#9ab9d9','#b9a7d3','#c5d8e3'][t]:['#e6a0c0','#edcc78','#a4c9df','#dc8790'][(t+Math.floor(s/4))%4];cue.x=150+t*280+Math.sin(s/16*Math.PI*2+t)*85;cue.intensity=theme==='rain'?.2+.3*(1+Math.sin((s+t*3)/16*Math.PI*2))/2:s%4===0?.95:.35;cue.fade=theme==='rain'||s%4!==3;}));return validateLightShow(value);
}
const catalog=[
 {id:'photo-birthday',tool:'photobooth',title:'生日合影',description:'粉色相纸与四人合影，把祝福改成自己的话。',make:()=>{const v=photo('pink','今天，也把生日愿望分给大家。');v.objects.push({key:'birthday-star',id:'star',x:160,y:235,size:100,rotation:-12},{key:'birthday-heart',id:'heart',x:565,y:655,size:75,rotation:8});return v;}},
 {id:'photo-night',tool:'photobooth',title:'演出结束以后',description:'深夜相纸与稍微错落的站位，留下散场后的合影。',make:()=>{const v=photo('night','灯熄灭以前，再合一张影。');v.objects.forEach((o,i)=>{o.y=460+(i%2)*45;o.rotation=(i%2?1:-1)*4;});v.objects.push({key:'night-live',id:'live',x:360,y:225,size:180,rotation:-4});return v;}},
 {id:'comic-rain',tool:'comic',title:'雨天日常',description:'竖排四格、四句原创对白，接着写屋檐下的小故事。',make:()=>comic('rain')},
 {id:'comic-birthday',tool:'comic',title:'悄悄准备的生日',description:'从准备到合影的四个画面，对白与角色均可继续编辑。',make:()=>comic('birthday')},
 {id:'lights-night',tool:'lights',title:'演出夜的开场',description:'120 BPM，分段变色与强拍闪光，适合合奏开场。',make:()=>lights('night')},
 {id:'lights-rain',tool:'lights',title:'雨夜慢光',description:'72 BPM，蓝紫灯束缓慢交错，留给安静的一段旋律。',make:()=>lights('rain')},
 {id:'studio-night',tool:'studio',title:'放学后的开场',description:'120 BPM，底鼓、军鼓、镲片和吉他的轻快合奏。',make:()=>({version:1,name:'放学后的开场',bpm:120,masks:[4369,4112,21845,18705]})},
 {id:'studio-rain',tool:'studio',title:'雨声里的练习',description:'72 BPM，留白较多的节拍，适合继续写自己的旋律。',make:()=>({version:1,name:'雨声里的练习',bpm:72,masks:[257,4112,4369,17473]})}
];
export const getTemplates = tool => catalog.filter(item=>item.tool===tool).map(({make,...meta})=>({...meta}));
export function templatePayload(id) { const entry=catalog.find(item=>item.id===id);if(!entry)throw new Error('这个模板暂时找不到。');return clone(entry.make()); }
export const templateDraftKey = tool => `hitori-room:template-previous:v1:${tool}`;
export function preserveTemplateDraft(tool,current,storage=globalThis.localStorage) {
  if(!['photobooth','comic','lights','studio'].includes(tool))throw new Error('这个工具暂不支持模板。');
  const snapshot=JSON.stringify({version:1,at:Date.now(),payload:current});
  if(snapshot.length>1024*1024)throw new Error('当前草稿较大，请先在作品架保存后再使用模板。');
  try{storage.setItem(templateDraftKey(tool),snapshot);}catch{throw new Error('当前草稿暂时无法保留，模板没有覆盖内容。请先保存作品后再试。');}
}
export function previousTemplateDraft(tool,storage=globalThis.localStorage) {try{const v=JSON.parse(storage.getItem(templateDraftKey(tool))||'null');return v?.version===1&&v.payload?clone(v.payload):null;}catch{return null;}}
