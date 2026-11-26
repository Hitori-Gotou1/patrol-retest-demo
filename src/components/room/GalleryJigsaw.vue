<script setup>
import {computed,nextTick,onBeforeUnmount,ref,watch} from 'vue';
import {galleryImages} from '../../data/gallery.js';
import {newJigsaw,validateJigsaw,swapJigsaw,rotateJigsaw,hintJigsaw,jigsawSolved} from '../../room/jigsaw.js';
import {useLocalDraft} from '../../composables/useLocalDraft.js';
import {recordActivity} from '../../room/activityLog.js';
const pictures=galleryImages.filter(i=>i.id==='quiet-guitar'||i.id==='pink-frequency'||i.id==='live-ticket'||Math.max(i.width||0,i.height||0)>=700).slice(0,12);
const validate=v=>{if(!v||v.version!==1)throw new Error();return {version:1,image:pictures.some(p=>p.id===v.image)?v.image:pictures[0].id,puzzle:validateJigsaw(v.puzzle),best:typeof v.best==='object'&&v.best?Object.fromEntries(Object.entries(v.best).filter(([k,n])=>/^\w[\w-]{0,80}$/.test(k)&&Number.isInteger(n)&&n>0).slice(0,40)): {}};};
const {state,saved}=useLocalDraft('hitori-room:jigsaw:v1',{version:1,image:pictures[0].id,puzzle:newJigsaw(),best:{}},validate),selected=ref(-1),preview=ref(false),square=ref(''),loading=ref(false),message=ref('选中一块，再点另一块交换；桌面也可以拖动交换。'),dragged=ref(-1);
const turn = ref(null);
const completeImage = ref(null);
let pulse = 0, revision = 0, alive = true;
const puzzle=computed(()=>state.value.puzzle),picture=computed(()=>pictures.find(p=>p.id===state.value.image)),solved=computed(()=>jigsawSolved(puzzle.value));
const best=computed(()=>state.value.best[`${state.value.image}-${puzzle.value.size}-${Number(puzzle.value.rotating)}`]);
const asset=path=>`${import.meta.env.BASE_URL}${path}`;
watch(()=>state.value.image,async()=>{const token=++revision;loading.value=true;square.value='';try{const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=asset(picture.value.src);});if(!alive||token!==revision)return;const canvas=document.createElement('canvas');canvas.width=900;canvas.height=900;const c=canvas.getContext('2d'),size=Math.min(image.naturalWidth,image.naturalHeight);c.drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,0,0,900,900);square.value=canvas.toDataURL('image/jpeg',.9);}catch{if(alive)message.value='这张图片暂时无法读取，换一张试试。';}finally{if(alive&&token===revision)loading.value=false;}},{immediate:true});
function finish(was){if(!was&&solved.value){const key=`${state.value.image}-${puzzle.value.size}-${Number(puzzle.value.rotating)}`;state.value.best[key]=Math.min(state.value.best[key]||Infinity,puzzle.value.moves||1);message.value='画面完整了。每一小块，都被你认真放回来了。';recordActivity('jigsaw',`${picture.value.title} · ${puzzle.value.moves} 次操作`,`${puzzle.value.seed}`);}}
function pick(index){if(loading.value||solved.value||!square.value)return;turn.value=null;if(selected.value<0){selected.value=index;return;}const before=solved.value;state.value.puzzle=swapJigsaw(puzzle.value,selected.value,index);selected.value=-1;finish(before);}
function rotate() {
  if (selected.value < 0 || solved.value || loading.value || !puzzle.value.rotating) return;
  const index = selected.value;
  state.value.puzzle = rotateJigsaw(puzzle.value, index);
  turn.value = { index, revision:++pulse };
  message.value = `第 ${index + 1} 格顺时针转了一格。`;
  finish(false);
}
function space(event, index) {
  if (!puzzle.value.rotating) return;
  event.preventDefault();
  selected.value = index;
  rotate();
}
watch(solved, completed => {
  if (completed) nextTick(() => completeImage.value?.focus({ preventScroll:true }));
});
function hint(){if (loading.value || !square.value) return;turn.value=null;const before=solved.value;state.value.puzzle=hintJigsaw(puzzle.value);selected.value=-1;message.value='帮你归位了一块，继续看看其他地方。';finish(before);}
function restart(){turn.value=null;state.value.puzzle=newJigsaw(puzzle.value.size,Date.now(),puzzle.value.rotating);selected.value=-1;message.value='新的排列，准备好了。';}
function drop(index){if(dragged.value<0||solved.value||loading.value||!square.value)return;turn.value=null;const before=solved.value;state.value.puzzle=swapJigsaw(puzzle.value,dragged.value,index);dragged.value=-1;selected.value=-1;finish(before);}
onBeforeUnmount(()=>{alive=false;revision++;});
</script>
<template>
  <section class="room-panel jigsaw-room" aria-labelledby="jigsaw-title">
    <header class="activity-title">
      <p class="pg-kicker">收藏图片拼图台</p>
      <h2 id="jigsaw-title">把这张喜欢，一小块一小块拼回来。</h2>
      <p class="room-intro">选两块交换，或拖到另一格。参考图可以摊开在手边。</p>
    </header>
    <div class="jigsaw-settings">
      <label class="room-field">收藏画面<select v-model="state.image" @change="restart"><option v-for="p in pictures" :key="p.id" :value="p.id">{{ p.title }}</option></select></label>
      <label class="room-field">拼图块数<select v-model.number="state.puzzle.size" @change="restart"><option :value="3">3 × 3 · 轻松</option><option :value="4">4 × 4 · 标准</option><option :value="5">5 × 5 · 挑战</option></select></label>
      <label class="room-check"><input v-model="state.puzzle.rotating" type="checkbox" @change="restart">加入旋转挑战</label>
    </div>
    <div class="jigsaw-wrap">
      <div class="jigsaw-workbench">
        <div v-if="!square" class="jigsaw-loading" role="status">{{ loading ? '正在准备图片…' : '图片暂不可用' }}</div>
        <div v-else class="jigsaw-board" :style="{ '--pieces':puzzle.size }" :data-solved="solved" role="group" :aria-label="solved ? '拼好的收藏图片' : '点击两块交换拼图'">
          <img v-if="solved" ref="completeImage" class="jigsaw-complete" :src="square" :alt="picture.alt || picture.title" tabindex="-1">
          <button v-for="(id,index) in (solved ? [] : puzzle.tiles)" :key="index" type="button"
            :data-tile="id" :data-slot="index" :data-turn="puzzle.rotations[id]"
            :aria-label="`第 ${index + 1} 格，画面块 ${id + 1}${puzzle.rotating ? '，转过 ' + puzzle.rotations[id] * 90 + ' 度' : ''}`"
            :aria-pressed="selected === index"
            :class="{ 'is-correct':id === index && puzzle.rotations[id] === 0 }"
            draggable="true" @dragstart="dragged = index" @dragend="dragged = -1" @dragover.prevent @drop.prevent="drop(index)"
            @click="pick(index)" @keydown.space="space($event,index)">
            <span :key="turn?.index === index ? turn.revision : 0" :class="{ 'jigsaw-turn':turn?.index === index }" :style="{
              backgroundImage:`url(${square})`, backgroundSize:`${puzzle.size * 100}% ${puzzle.size * 100}%`,
              backgroundPosition:`${id % puzzle.size / (puzzle.size - 1) * 100}% ${Math.floor(id / puzzle.size) / (puzzle.size - 1) * 100}%`,
              '--tile-angle':puzzle.rotations[id] * 90 + 'deg'
            }"></span>
            <small>{{ index + 1 }}</small>
          </button>
        </div>
        <div v-if="solved" class="jigsaw-result">
          <h3>这一张，完整了。</h3>
          <p>{{ picture.title }} · {{ puzzle.moves }} 次操作 · {{ puzzle.hints }} 次提示</p>
        </div>
        <div class="jigsaw-controls">
          <button type="button" :disabled="!puzzle.rotating || selected < 0 || solved" @click="rotate">旋转选中块 ↻</button>
          <button id="jigsaw-hint" type="button" :disabled="solved || loading || !square" @click="hint">帮我归位一块</button>
          <button type="button" @click="restart">重新打乱</button>
        </div>
        <p class="pg-small">本机最佳 {{ best ? best + ' 次操作' : '还没完成' }} · 已操作 {{ puzzle.moves }} 次 · 已归位 {{ puzzle.tiles.filter((id,i) => id === i && puzzle.rotations[id] === 0).length }} / {{ puzzle.tiles.length }} 块</p>
      </div>
      <aside class="jigsaw-drawer" :class="{ 'reference-open': preview }" aria-label="拼图参考抽页">
        <div class="jigsaw-paper-head">
          <h3>参考抽页</h3>
          <button type="button" :aria-expanded="preview" aria-controls="jigsaw-reference" @click="preview = !preview">{{ preview ? '收起参考图' : '看一眼完整画面' }}</button>
        </div>
        <div id="jigsaw-reference" class="jigsaw-reference-slot" :hidden="!preview">
          <img v-if="square" :src="square" alt="拼图完整参考图" class="jigsaw-reference" width="900" height="900">
          <p v-else>图片暂未准备好</p>
          <p v-if="square">{{ picture.title }}</p>
        </div>
      </aside>
    </div>
    <p class="pg-status" role="status">{{ message }}</p>
    <p class="pg-small">{{ saved ? '图片选择、排列与最佳记录保存在本机。' : '本次仍可拼图。' }} 参考图与棋盘使用收藏作品的中央方形取景。</p>
  </section>
</template>

<style scoped>
.jigsaw-settings { display:grid; grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) auto; gap:8px 14px; align-items:end; }
.jigsaw-wrap { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(210px,1fr); align-items:start; gap:clamp(12px,3vw,30px); max-width:960px; margin:12px auto; }
.jigsaw-workbench { min-width:0; }
.jigsaw-board,.jigsaw-loading { display:grid; grid-template-columns:repeat(var(--pieces),minmax(0,1fr)); aspect-ratio:1; gap:4px; overflow:hidden; background:#544150; border:7px solid #544150; box-shadow:0 5px 0 #a78583; }
.jigsaw-loading { display:grid; place-items:center; color:#ffead9; }
.jigsaw-board button { aspect-ratio:1; padding:0; min-height:0; border:0; position:relative; overflow:hidden; background:#e5d5ce; display:block; }
.jigsaw-board button>span { position:absolute; inset:0; background-repeat:no-repeat; pointer-events:none; transform:rotate(var(--tile-angle)); }
.jigsaw-board button>small { position:absolute; left:4px; bottom:4px; background:#352838d9; color:#fff3e1; font:11px monospace; padding:2px 4px; pointer-events:none; }
.jigsaw-board button[aria-pressed=true] { outline:3px solid #ffe1a7; outline-offset:-4px; z-index:1; }
.jigsaw-board button[aria-pressed=true]::after { content:""; position:absolute; inset:5px; border:1px dashed #382236; pointer-events:none; }
.jigsaw-board button:focus-visible { outline:3px solid #fff; outline-offset:-3px; z-index:2; }
.jigsaw-board[data-solved=true] { display:block; border-width:4px; }
.jigsaw-complete { display:block; width:100%; height:100%; object-fit:contain; }
.jigsaw-turn { animation:quarter-turn .2s ease-out both; }
@keyframes quarter-turn { from { transform:rotate(calc(var(--tile-angle) - 90deg)); } to { transform:rotate(var(--tile-angle)); } }
.jigsaw-controls { display:flex; flex-wrap:wrap; gap:5px; margin-top:12px; }
.jigsaw-controls button { min-height:44px; padding:5px 9px; }
.jigsaw-result h3,.jigsaw-result p { margin:9px 0 0; }
.jigsaw-drawer { background:#ede0c9; border:1px solid #b59a85; padding:10px; min-width:0; }
.jigsaw-paper-head { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:6px; }
.jigsaw-paper-head h3 { margin:0; font-size:15px; }
.jigsaw-drawer button { min-height:44px; padding:5px 9px; }
.jigsaw-reference-slot { margin-top:9px; border:1px solid #c3a68b; background:#fcf3df; padding:7px; }
.jigsaw-reference { display:block; width:100%; height:auto; aspect-ratio:1; object-fit:contain; }
.jigsaw-reference-slot p { margin:5px 0 0; font-size:12px; }
@media(max-width:760px) {
  .jigsaw-wrap { grid-template-columns:minmax(0,1fr); gap:9px; }
  .jigsaw-settings { grid-template-columns:minmax(0,1.25fr) minmax(0,1fr); gap:5px; }
  .jigsaw-settings .room-check { grid-column:1/-1; }
  .jigsaw-board { gap:3px; border-width:4px; }
  .jigsaw-reference-slot:not([hidden]) { display:grid; grid-template-columns:min(46%,150px) minmax(0,1fr); gap:8px; align-items:end; }
  .jigsaw-drawer { padding:6px 9px; }
}
@media(prefers-reduced-motion:reduce) { .jigsaw-turn { animation:none; } }
</style>
