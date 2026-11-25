<script setup>
import EditorWorkspace from '../tools/EditorWorkspace.vue';
import {readWorks} from '../../room/workshelf.js';
import { recordActivity } from '../../room/activityLog.js';
import { computed, ref } from 'vue';
import { cast, roomProps } from '../../data/playroom.js';
import { defaultRoom, validateRoom } from '../../room/playroom.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { useStageEditor } from '../../composables/useStageEditor.js';
import { downloadStage } from '../../room/exportImage.js';
import RoomProp from './RoomProp.vue';
import RoomLightScene from './RoomLightScene.vue';
const hangingWorks=ref(readWorks().filter(w=>w.preview)),chosenWork=ref('');
function hangWork(){const work=hangingWorks.value.find(w=>w.id===chosenWork.value);if(!work){message.value='先在作品架存一张带预览的合影、漫画或海报。';return;}if(objects.value.length>=20){message.value='房间已放满20件物品，先收起一件。';return;}const item={key:`art-${Date.now()}`,id:'photo',x:620,y:200,size:1.5,rotation:0,artwork:work.preview,artTitle:work.title};objects.value.push(item);editor.selectedKey.value=item.key;message.value=`已挂上「${work.title}」，可以挪动、缩放和旋转。`;}
const { state, saved, persist } = useLocalDraft('hitori-room:decoration:v1', defaultRoom, validateRoom);
const asset=path=>`${import.meta.env.BASE_URL}${path}`;
const stage = ref(null), message = ref('把纸箱移到一里身边，再轻点它试试。'), busy = ref(false), boxedKey = ref(''), ampOn = ref(false), undo = ref(null);
const objects = computed(() => state.value.objects);
const hiding = computed(() => objects.value.some(o => o.key === boxedKey.value));
const contactPoints = { guitar: [5, 54, 19], amp: [0, 52, 54], box: [0, 41, 62], plant: [0, 49, 23], lamp: [0, 65, 30], chair: [0, 52, 36] };
const prop = item => roomProps.find(p => p.id === item.id);
const edges = computed(() => ({ warm: '#ffe8ad', pink: '#ffcfeb', night: '#bea0c0' }[state.value.light]));
const onWall = item => item.id === 'poster' || item.id === 'photo';
function contactShadow(item) {
  const [baseX, baseY, width] = contactPoints[item.id];
  const radians = item.rotation * Math.PI / 180;
  const x = item.x + item.size * (baseX * Math.cos(radians) - baseY * Math.sin(radians));
  const y = item.y + item.size * (baseX * Math.sin(radians) + baseY * Math.cos(radians));
  return { cx: x, cy: y, rx: width * item.size, ry: Math.max(4, width / 5) * item.size,
    transform: `rotate(${item.rotation} ${x} ${y})` };
}
function front() {
  const index = objects.value.indexOf(selected.value);
  if (index >= 0) objects.value.push(...objects.value.splice(index, 1));
}
const editor = useStageEditor(stage, objects, { width: 960, height: 620, minY: 100, maxY: 550, onClick: interact });
const selected = computed(() => objects.value.find(o => o.key === editor.selectedKey.value));
function interact(item) {
  if (item.id === 'box') {
    if (boxedKey.value === item.key) { boxedKey.value = ''; message.value = '一里：我、我出来了。刚才只是在给社交电量充电。'; }
    else if (Math.hypot(item.x-510,item.y-455) < 200) { boxedKey.value=item.key; message.value='一里躲进了纸箱。再轻点这个纸箱，就能叫她出来。'; }
    else message.value='纸箱有点远，把它拖到一里旁边再试试。';
  } else if (item.id === 'amp') { ampOn.value=!ampOn.value; message.value=ampOn.value?'音箱的小灯亮了。今天，也准备好练习了。':'练习结束，音箱也休息一下。'; }
  else if (item.id === 'photo') message.value='合照背面写着：下次演出，也要四个人一起。';
  else if (item.id === 'guitar') message.value='一里：有吉他在身边，好像就能多一点勇气。';
  else if (item.id === 'lamp') { state.value.light=state.value.light==='night'?'warm':'night'; message.value='给房间换了一种灯光。'; }
}
function add(item) {
  if(objects.value.length>=20){message.value='房间最多摆放 20 件物品，先收起一件吧。';return;}
  const object={key:`${item.id}-${Date.now()}-${Math.floor(Math.random()*10000)}`,id:item.id,x:450,y:item.id==='poster'||item.id==='photo'?230:440,size:1,rotation:0};
  objects.value.push(object);editor.selectedKey.value=object.key;message.value=`摆下了${item.name}，可以拖动或用方向键挪动。`;
}
function reset(){undo.value=structuredClone(validateRoom(state.value));state.value=structuredClone(defaultRoom);boxedKey.value='';editor.selectedKey.value='';}
function restore(){state.value=undo.value;undo.value=null;editor.selectedKey.value='';}
async function exportRoom(){if(busy.value)return;busy.value=true;persist();try{await downloadStage(stage.value,'my-hitori-room.png');message.value='房间照片已生成。今晚的灯，替你留住了。';recordActivity('room','留下一张自己的房间照片',JSON.stringify(state.value));}catch(e){message.value=e.message;}finally{busy.value=false;}}
</script>
<template>
  <section class="room-panel decorate-room" aria-labelledby="decorate-title">
    <header class="activity-title">
      <p class="play-eyebrow">一里的房间</p>
      <h2 id="decorate-title">今天，想住在怎样的房间？</h2>
      <p class="room-intro">拖动物品，挂上自己的作品，看看窗光落在哪里。</p>
    </header>
    <EditorWorkspace title="房间布置" save-label="保存房间照片" @save="exportRoom"><template #canvas><div class="play-preview">
      <svg ref="stage" class="play-editor-svg" viewBox="0 0 960 620" role="group" aria-label="一里的房间布置画布" @pointermove="editor.move" @pointerup="editor.up" @pointercancel="editor.up">
        <RoomLightScene :light="state.light"/>
        <image v-if="!hiding" :href="asset(cast[0].image)" x="420" y="300" width="175" height="215" preserveAspectRatio="xMidYMid meet"/>
        <template v-for="item in objects" :key="item.key">
          <ellipse v-if="!onWall(item)" v-bind="contactShadow(item)" fill="url(#room-floor-contact)" :data-contact="item.key"/>
          <g :data-object="item.key" :transform="`translate(${item.x},${item.y}) rotate(${item.rotation}) scale(${item.size})`" role="button" tabindex="0" :aria-label="`移动或轻点${prop(item).name}`" @pointerdown="editor.down($event,item)" @keydown="editor.key($event,item)" @focus="editor.selectedKey.value=item.key">
            <rect :x="-prop(item).w/2-8" :y="-prop(item).h/2-8" :width="prop(item).w+16" :height="prop(item).h+16" fill="transparent"/>
            <rect v-if="onWall(item)" :x="item.artwork ? -62 : -prop(item).w/2+2" :y="item.artwork ? -45 : -prop(item).h/2+3"
              :width="item.artwork ? 128 : prop(item).w+2" :height="item.artwork ? 96 : prop(item).h+2" fill="#2a1a2b" opacity=".33" stroke="none"/>
            <RoomProp v-if="!item.artwork" :kind="item.id" :lit="item.id==='amp' ? ampOn : true" :edge="edges"/>
            <g v-else pointer-events="none">
              <rect x="-64" y="-48" width="128" height="96" fill="#fff8ed" stroke="#815f70" stroke-width="3"/>
              <image :href="item.artwork" x="-58" y="-42" width="116" height="84" preserveAspectRatio="xMidYMid meet"/>
              <path d="M-64-47H64" :stroke="edges" stroke-width="1.5"/>
            </g>
            <text v-if="boxedKey===item.key" y="-58" text-anchor="middle" font-family="sans-serif" font-size="16"
              :fill="state.light==='night' ? '#ffdfcb' : '#613b52'">…在这里</text>
            <rect v-show="editor.selectedKey.value===item.key" data-editor-only class="play-selected" :x="-prop(item).w/2-8" :y="-prop(item).h/2-8" :width="prop(item).w+16" :height="prop(item).h+16"/>
          </g>
        </template>
        <rect x="18" y="18" width="924" height="584" fill="none" :stroke="state.light==='night' ? '#aaa0b5' : '#9a7666'" stroke-width="1.5"/><text x="32" y="588" font-family="monospace" font-size="12" letter-spacing="3" :fill="state.light==='night' ? '#f0d5db' : '#4b333b'">HITORI ROOM</text>
      </svg>
    </div></template><template #tools>
    <div class="room-actions play-sticky-actions room-light-options"><button type="button" class="primary" :disabled="busy" @click="exportRoom">{{busy?'保存中…':'保存房间照片 ↓'}}</button><button v-for="[id,label] in [['warm','暖色午后'],['pink','粉色灯光'],['night','深夜小屋']]" :key="id" type="button" :aria-pressed="state.light===id" @click="state.light=id">{{label}}</button></div>
    <p id="decoration-reaction" class="room-status" role="status">{{message}}</p>
    <h3 class="play-subheading">把自己的作品挂上墙</h3><div class="room-fields"><label class="room-field">从作品架选择<select v-model="chosenWork"><option value="">选择带预览的作品</option><option v-for="work in hangingWorks" :key="work.id" :value="work.id">{{work.title}}</option></select></label></div><div class="room-actions"><button id="hang-work" type="button" @click="hangWork">挂到房间里 ＋</button><RouterLink to="/room/works">去作品架整理 ↗</RouterLink></div><p class="play-footer-note">保存的是作品画面副本；原作品后来被移出作品架，这张挂画仍会保留。</p><h3 class="play-subheading">从这里，添一件喜欢的东西</h3><div class="play-palette room-prop-palette"><button v-for="item in roomProps" :key="item.id" type="button" :aria-label="`添加${item.name}`" @click="add(item)"><svg viewBox="-80 -85 160 170" width="58" height="62" aria-hidden="true"><RoomProp :kind="item.id"/></svg>{{item.name}}</button></div>
    <label class="room-field" for="decoration-object">选择已经摆放的物品<select id="decoration-object" v-model="editor.selectedKey.value"><option value="">选择一件物品</option><option v-for="(item,index) in objects" :key="item.key" :value="item.key">{{index+1}} / {{prop(item).name}}</option></select></label>
    <div v-if="selected" class="play-editor-controls"><strong>正在摆放：{{prop(selected).name}}</strong><div class="room-fields"><label>物品大小<input v-model.number="selected.size" class="play-range" type="range" min="0.5" max="1.8" step="0.05"></label><label>物品角度<input v-model.number="selected.rotation" class="play-range" type="range" min="-30" max="30"></label></div><div class="play-toolbar"><button v-for="[label,key] in [['←','ArrowLeft'],['↑','ArrowUp'],['↓','ArrowDown'],['→','ArrowRight']]" :key="key" type="button" :aria-label="`挪动${label}`" @click="editor.key({key,preventDefault(){}},selected)">{{label}}</button><button type="button" @click="interact(selected)">轻点互动</button><button type="button" @click="front">移到最前</button><button type="button" @click="editor.remove">收起这件</button></div></div>
    <div class="play-toolbar"><button type="button" @click="reset">恢复初始房间</button><button v-if="undo" type="button" @click="restore">撤销重置</button></div><p class="play-footer-note">{{saved?'房间布置自动保存在这台设备。':'浏览器无法保存草稿，可以保存房间照片。'}} 场景与物品为本站原创图形，人物沿用站主提供的素材。</p></template></EditorWorkspace>
  </section>
</template>
<style scoped>
.decorate-room .play-preview { padding:7px; background:#4a3546; border:1px solid #70576a; }
.room-prop-palette { grid-template-columns:repeat(4,minmax(0,1fr)); }
.room-prop-palette button { padding-inline:2px; }
.room-light-options { margin-top:0; }
.room-light-options button { flex:1 1 auto; }
@media(max-width:760px) {
  .decorate-room .play-preview { padding:4px; }
  .room-light-options { position:static; margin:0; padding:0; }
  .room-light-options button.primary { flex-basis:100%; }
}
</style>
