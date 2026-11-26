<script setup>
import EditorWorkspace from '../tools/EditorWorkspace.vue';
import {computed,ref,watch,onMounted,onBeforeUnmount} from 'vue';
import {newGraffiti,validateGraffiti} from '../../room/creativeTools.js';
import {useLocalDraft} from '../../composables/useLocalDraft.js';
import {cast,stickers} from '../../data/playroom.js';
import {recordActivity} from '../../room/activityLog.js';
const {state,saved}=useLocalDraft('hitori-room:graffiti:v1',newGraffiti(),validateGraffiti),canvas=ref(null),tool=ref('pen'),color=ref('#a75e83'),size=ref(9),layer=ref(1),stamp=ref('✦'),message=ref('先留一笔，或者盖上一枚角色印章。'),canRedo=ref(false);
const dimensions=computed(()=>state.value.format==='poster'?{w:720,h:960}:{w:900,h:600});
const colors=['#a75e83','#506b85','#618872','#d4ad4e','#514150','#e7b3c5','#f4e8da'];
const images = new Map(), redo = [[],[],[]];
const buffers = Array.from({ length:3 }, () => document.createElement('canvas'));
const previews = [];
let stroke=null,pointer=null,frame=0;
function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;draw();});}
function paint(context,s,w,h){if(!s.points.length)return;context.save();context.fillStyle=s.color;context.strokeStyle=s.color;context.lineWidth=s.size*w/900;context.lineCap='round';context.lineJoin='round';if(s.tool==='stamp'){const [x,y]=s.points[0],image=images.get(s.stamp);if(image?.complete&&image.naturalWidth){const height=s.size*3*w/900,width=height*image.naturalWidth/image.naturalHeight;context.drawImage(image,x*w-width/2,y*h-height/2,width,height);}else if(!cast.some(c=>c.id===s.stamp)){context.font=`bold ${s.size*2*w/900}px sans-serif`;context.textAlign='center';context.textBaseline='middle';context.fillText(s.stamp,x*w,y*h);}context.restore();return;}if(s.tool==='eraser')context.globalCompositeOperation='destination-out';context.beginPath();context.moveTo(s.points[0][0]*w,s.points[0][1]*h);for(const [x,y] of s.points.slice(1))context.lineTo(x*w,y*h);if(s.points.length===1){context.lineTo(s.points[0][0]*w+.01,s.points[0][1]*h);}context.stroke();context.restore();}
function sizeCanvas(surface, width, height) {
  if (surface.width !== width) surface.width = width;
  if (surface.height !== height) surface.height = height;
}
function draw() {
  const surface = canvas.value;
  if (!surface) return;
  const { w, h } = dimensions.value;
  sizeCanvas(surface, w, h);
  const context = surface.getContext('2d');
  context.fillStyle = state.value.paper;
  context.fillRect(0, 0, w, h);
  state.value.layers.forEach((sheet, index) => {
    const buffer = buffers[index];
    sizeCanvas(buffer, w, h);
    const transparent = buffer.getContext('2d');
    transparent.clearRect(0, 0, w, h);
    for (const entry of sheet.strokes) paint(transparent, entry, w, h);
    if (index === layer.value && stroke) paint(transparent, stroke, w, h);
    const preview = previews[index];
    if (preview) {
      const factor = 200 / Math.max(w, h);
      sizeCanvas(preview, Math.round(w * factor), Math.round(h * factor));
      const sample = preview.getContext('2d');
      sample.clearRect(0, 0, preview.width, preview.height);
      sample.drawImage(buffer, 0, 0, preview.width, preview.height);
    }
    if (sheet.visible) context.drawImage(buffer, 0, 0);
  });
}
function showLayer(index, event) {
  if (index === layer.value) cancel();
  state.value.layers[index].visible = event.target.checked;
}
function point(e){const rect=canvas.value.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))];}
function down(e){if(e.button!==0||!e.isPrimary)return;if(!state.value.layers[layer.value].visible){message.value='先显示这一图层，再开始画吧。';return;}if(state.value.layers.reduce((n,l)=>n+l.strokes.length,0)>=300){message.value='这张画已画满 300 笔，可以导出后开始新作品。';return;}e.preventDefault();canvas.value.setPointerCapture(e.pointerId);pointer=e.pointerId;stroke={tool:tool.value,color:color.value,size:size.value,stamp:stamp.value,points:[point(e)]};schedule();}
function move(e){if(pointer!==e.pointerId||!stroke||stroke.tool==='stamp')return;const p=point(e),previous=stroke.points.at(-1);if(Math.hypot(p[0]-previous[0],p[1]-previous[1])>.002&&stroke.points.length<2000)stroke.points.push(p);schedule();}
function up(e){if(pointer!==e.pointerId)return;if(stroke&&e.type!=='pointercancel'){state.value.layers[layer.value].strokes.push(stroke);redo[layer.value]=[];canRedo.value=false;}stroke=null;pointer=null;schedule();}
function cancel(){stroke=null;pointer=null;schedule();}
function undo(){cancel();const s=state.value.layers[layer.value].strokes.pop();if(s)redo[layer.value].push(s);canRedo.value=redo[layer.value].length>0;}
function redoStroke(){if(state.value.layers.reduce((n,l)=>n+l.strokes.length,0)>=300){message.value='这张画已画满，可以导出后继续新作品。';return;}const s=redo[layer.value].pop();if(s)state.value.layers[layer.value].strokes.push(s);canRedo.value=redo[layer.value].length>0;}
function exportPng(){draw();canvas.value.toBlob(blob=>{if(!blob){message.value='导出失败，请再试一次。';return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hitori-graffiti.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);recordActivity('graffiti','留下一张演出涂鸦');message.value='这一张涂鸦，已经打包成 PNG。';},'image/png');}
function backdrop(){draw();try{const data=canvas.value.toDataURL('image/jpeg',.8);if(data.length>1500000)throw new Error();localStorage.setItem('hitori-room:stage-background:v1',data);message.value='已保存为本机舞台背景，到灯光编舞台就能使用。';recordActivity('graffiti','为舞台画了一张背景');}catch{message.value='背景未能保存，可以先导出 PNG 留念。';}}
function reset(){cancel();state.value=newGraffiti();redo.forEach(a=>a.length=0);canRedo.value=false;}
function key(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.target.closest('input,textarea,select')){e.preventDefault();e.shiftKey?redoStroke():undo();}}
watch(state,schedule,{deep:true});watch(layer,()=>{cancel();canRedo.value=redo[layer.value].length>0;});
onMounted(()=>{for(const m of cast){const img=new Image();img.onload=schedule;img.src=`${import.meta.env.BASE_URL}${m.image}`;images.set(m.id,img);}draw();window.addEventListener('keydown',key);window.addEventListener('blur',cancel);});onBeforeUnmount(()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',key);window.removeEventListener('blur',cancel);images.forEach(img=>img.onload=null);});
</script>
<template><section class="room-panel graffiti-room" aria-labelledby="graffiti-title"><header class="activity-title"><p class="pg-kicker">创作室 · 三张描图纸</p><h2 id="graffiti-title">散场之前，留下一点颜色。</h2><p class="room-intro">笔迹、擦口和印章都在各自的纸上，点一层就能继续画。</p></header><div class="pg-toolbar"><label>画布 <select v-model="state.format" @change="cancel"><option value="wall">演出墙 · 横向</option><option value="poster">小海报 · 竖向</option></select></label><button id="graffiti-export" class="primary" @click="exportPng">导出 PNG</button><button id="graffiti-backdrop" @click="backdrop">用作舞台背景 ↗</button></div><EditorWorkspace title="涂鸦编辑" save-label="导出 PNG" @save="exportPng"><template #overview>
  <fieldset class="graffiti-sheets"><legend>描图纸 · 从底层到顶层</legend>
    <div v-for="(sheet,index) in state.layers" :key="index" class="graffiti-layer" :data-layer="index" :data-visible="sheet.visible">
      <button type="button" :aria-pressed="layer === index" @click="layer = index">
        <span class="graffiti-sample"><canvas :ref="el => previews[index] = el" data-editor-only aria-hidden="true"></canvas></span>
        <strong>{{ sheet.name }}</strong><small>{{ sheet.strokes.length }} 笔</small>
      </button>
      <label class="graffiti-visibility"><input type="checkbox" :checked="sheet.visible" :aria-label="'显示' + sheet.name" @change="showLayer(index,$event)">{{ sheet.visible ? '显示' : '隐藏' }}</label>
    </div>
  </fieldset>
</template><template #canvas><div class="pg-board graffiti-canvas"><canvas ref="canvas" class="pg-canvas" aria-label="涂鸦画布，使用鼠标或触屏绘画" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="cancel"></canvas></div></template><template #tools><div class="pg-settings"><div class="pg-toolbar"><button v-for="(label,id) in {pen:'画笔',eraser:'橡皮',stamp:'印章'}" :key="id" :aria-pressed="tool===id" @click="tool=id">{{label}}</button></div><label>笔触 / 印章大小 · {{size}}<input v-model.number="size" type="range" min="1" max="80"></label><div class="pg-toolbar"><button v-for="c in colors" :key="c" :aria-label="`颜色 ${c}`" :aria-pressed="color===c" class="paint-color" :style="{background:c}" @click="color=c"></button><input v-model="color" type="color" aria-label="自选颜色"></div><label v-if="tool==='stamp'">印章<select v-model="stamp"><optgroup label="角色"><option v-for="m in cast" :key="m.id" :value="m.id">{{m.name}}</option></optgroup><optgroup label="小标记"><option v-for="s in stickers.filter(s=>['✦','♪','LIVE!','♥'].includes(s.text))" :key="s.id" :value="s.text">{{s.name}}</option></optgroup></select></label><label>纸张颜色<input v-model="state.paper" type="color"></label><div class="pg-toolbar"><button id="graffiti-undo" :disabled="!state.layers[layer].strokes.length" @click="undo">撤销</button><button :disabled="!canRedo" @click="redoStroke">重做</button></div><button @click="state.layers[layer].strokes=[];redo[layer]=[];canRedo=false">清空当前图层</button><button @click="reset">新的一张画</button></div></template></EditorWorkspace><p class="pg-status" role="status">{{message}}</p><p class="pg-small">橡皮只擦除当前图层。Ctrl / ⌘ Z 撤销，Shift Z 重做。{{saved?'笔迹自动保存在本机。':'本机存档暂不可用。'}} 最多 300 笔，每笔最多 2000 个采样点。</p></section></template>
<style scoped>
.graffiti-canvas { align-self:start; background:#684c60; padding:6px; }
.paint-color { width:32px; height:32px; padding:0; min-height:32px; border:1px solid #b699aa; }
.paint-color[aria-pressed=true] { outline:2px solid #715168; outline-offset:2px; }
input[type=color] { width:44px; height:36px; padding:2px; }
.graffiti-sheets { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; min-width:0; border:0; border-bottom:1px solid #bda1b2; padding:8px 12px; margin:8px 0 0; flex-shrink:0; }
.graffiti-sheets legend { font-size:12px; padding-inline:12px; }
.graffiti-layer { position:relative; min-width:0; display:flex; align-items:start; flex-wrap:wrap; gap:3px 6px; }
.graffiti-layer>button { width:100%; min-width:0; display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:baseline; padding:4px; text-align:left; gap:3px; position:relative; background:#f6ead8; }
.graffiti-layer>button[aria-pressed=true] { border:2px solid #75465e; padding:3px; background:#f7dccd; }
.graffiti-layer>button[aria-pressed=true]::after { content:""; position:absolute; top:1px; right:1px; width:15px; height:15px; background:#87526a; clip-path:polygon(0 0,100% 0,100% 100%); }
.graffiti-layer strong { font-size:11px; overflow-wrap:anywhere; }
.graffiti-layer small { font-size:10px; white-space:nowrap; }
.graffiti-sample { grid-column:1/-1; display:grid; place-items:center; width:100%; height:clamp(41px,8vw,76px); overflow:hidden; background:repeating-conic-gradient(#e4d8cd 0 25%,#f9f0e2 0 50%) 50% / 12px 12px; }
.graffiti-sample canvas { max-width:100%; max-height:100%; height:100%; object-fit:contain; }
.graffiti-visibility { min-height:44px; display:flex; align-items:center; gap:3px; }
.graffiti-visibility input { width:16px; height:16px; }
.pg-toolbar label { font-size:12px; }
@media(max-width:760px) { .graffiti-sheets { gap:4px; padding:5px 7px; } }
@media(max-height:500px) { .graffiti-sample { height:35px; } }
</style>
