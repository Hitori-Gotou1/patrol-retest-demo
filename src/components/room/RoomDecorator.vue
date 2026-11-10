<script setup>
import { recordActivity } from '../../room/activityLog.js';
import { computed, ref } from 'vue';
import { cast, roomProps } from '../../data/playroom.js';
import { defaultRoom, validateRoom } from '../../room/playroom.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { useStageEditor } from '../../composables/useStageEditor.js';
import { downloadStage } from '../../room/exportImage.js';
import RoomProp from './RoomProp.vue';
const { state, saved, persist } = useLocalDraft('hitori-room:decoration:v1', defaultRoom, validateRoom);
const asset=path=>`${import.meta.env.BASE_URL}${path}`;
const stage = ref(null), message = ref('把纸箱移到一里身边，再轻点它试试。'), busy = ref(false), boxedKey = ref(''), ampOn = ref(false), undo = ref(null);
const objects = computed(() => state.value.objects);
const hiding = computed(() => objects.value.some(o => o.key === boxedKey.value));
const colors = computed(() => ({warm:['#f3e3cf','#d3b3a4','#f1d6a1'],pink:['#ecd3df','#b69baa','#e5afc9'],night:['#77738e','#514d66','#c1aedc']}[state.value.light]));
const prop = item => roomProps.find(p => p.id === item.id);
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
  <section class="room-panel" aria-labelledby="decorate-title">
    <div class="play-heading"><div><p class="play-eyebrow">MY LITTLE ROOM / 给喜欢的东西留位置</p><h2 id="decorate-title">今天，想住在怎样的房间？</h2><p class="room-intro">点选物品后拖动，或用方向键挪动。纸箱、音箱、台灯和合照都有一点小回应。</p></div><span class="play-number" aria-hidden="true">02</span></div>
    <div class="play-preview">
      <svg ref="stage" class="play-editor-svg" viewBox="0 0 960 620" role="group" aria-label="一里的房间布置画布" @pointermove="editor.move" @pointerup="editor.up" @pointercancel="editor.up">
        <rect width="960" height="620" :fill="colors[0]"/><path d="M0 0h100v382L0 470Z" fill="#745466" opacity=".12"/><path d="M100 382h860v238H0V470Z" :fill="colors[1]"/><path d="M100 0v382H960" fill="none" stroke="#7b5b62" stroke-width="3"/>
        <g opacity=".25" stroke="#785a64"><path d="M0 470h960M0 540h960M210 382 60 620M470 382 470 620M720 382 860 620"/></g>
        <rect x="155" y="85" width="218" height="218" rx="110" fill="#fff1da" stroke="#927485" stroke-width="5"/><path d="M264 86v215M158 195h212" fill="none" stroke="#927485" stroke-width="5"/>
        <circle cx="320" cy="132" r="24" :fill="state.light==='night'?'#fff4d4':'#f0c987'"/><path d="M160 267q110-90 210-18v51H160Z" fill="#b9c4bf" opacity=".7"/>
        <path d="M40 80h105v260H40Z" fill="#be8fa4" opacity=".55"/><path d="M385 80h35v260h-35Z" fill="#be8fa4" opacity=".55"/>
        <ellipse cx="515" cy="495" rx="228" ry="70" fill="#e8d9c5" opacity=".9"/><ellipse cx="515" cy="495" rx="207" ry="55" fill="none" stroke="#ad8d8e" stroke-dasharray="7 5"/>
        <g transform="translate(804 340)"><rect x="-94" y="-16" width="188" height="21" fill="#ab877b"/><path d="M-80 5v74M80 5v74" stroke="#8a6865" stroke-width="8"/><path d="M-42-61h48v45h-48" fill="#9eafab"/><path d="M18-36h38v20H18" fill="#d7bd87"/></g>
        <image v-if="!hiding" :href="asset(cast[0].image)" x="420" y="300" width="175" height="215" preserveAspectRatio="xMidYMid meet"/>
        <g v-for="item in objects" :key="item.key" :transform="`translate(${item.x},${item.y}) rotate(${item.rotation}) scale(${item.size})`" role="button" tabindex="0" :aria-label="`移动或轻点${prop(item).name}`" @pointerdown="editor.down($event,item)" @keydown="editor.key($event,item)" @focus="editor.selectedKey.value=item.key">
          <rect :x="-prop(item).w/2-8" :y="-prop(item).h/2-8" :width="prop(item).w+16" :height="prop(item).h+16" fill="transparent"/>
          <RoomProp :kind="item.id" :lit="item.id==='amp'?ampOn:state.light!=='night'"/>
          <text v-if="boxedKey===item.key" y="-58" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#79546b">…在这里</text>
          <rect v-show="editor.selectedKey.value===item.key" data-editor-only class="play-selected" :x="-prop(item).w/2-8" :y="-prop(item).h/2-8" :width="prop(item).w+16" :height="prop(item).h+16"/>
        </g>
        <rect x="18" y="18" width="924" height="584" fill="none" stroke="#7c5e70" stroke-width="1.5"/><text x="32" y="588" font-family="monospace" font-size="12" letter-spacing="3" fill="#664c61">HITORI ROOM / MAKE YOURSELF AT HOME.</text>
      </svg>
    </div>
    <div class="room-actions play-sticky-actions"><button type="button" class="primary" :disabled="busy" @click="exportRoom">{{busy?'保存中…':'保存房间照片 ↓'}}</button><button v-for="[id,label] in [['warm','暖色午后'],['pink','粉色灯光'],['night','深夜小屋']]" :key="id" type="button" :aria-pressed="state.light===id" @click="state.light=id">{{label}}</button></div>
    <p id="decoration-reaction" class="room-status" role="status">{{message}}</p>
    <h3 class="play-subheading">从这里，添一件喜欢的东西</h3><div class="play-palette room-prop-palette"><button v-for="item in roomProps" :key="item.id" type="button" :aria-label="`添加${item.name}`" @click="add(item)"><svg viewBox="-80 -85 160 170" width="58" height="62" aria-hidden="true"><RoomProp :kind="item.id"/></svg>{{item.name}}</button></div>
    <label class="room-field" for="decoration-object">选择已经摆放的物品<select id="decoration-object" v-model="editor.selectedKey.value"><option value="">选择一件物品</option><option v-for="(item,index) in objects" :key="item.key" :value="item.key">{{index+1}} / {{prop(item).name}}</option></select></label>
    <div v-if="selected" class="play-editor-controls"><strong>正在摆放：{{prop(selected).name}}</strong><div class="room-fields"><label>物品大小<input v-model.number="selected.size" class="play-range" type="range" min="0.5" max="1.8" step="0.05"></label><label>物品角度<input v-model.number="selected.rotation" class="play-range" type="range" min="-30" max="30"></label></div><div class="play-toolbar"><button v-for="[label,key] in [['←','ArrowLeft'],['↑','ArrowUp'],['↓','ArrowDown'],['→','ArrowRight']]" :key="key" type="button" :aria-label="`挪动${label}`" @click="editor.key({key,preventDefault(){}},selected)">{{label}}</button><button type="button" @click="interact(selected)">轻点互动</button><button type="button" @click="editor.remove">收起这件</button></div></div>
    <div class="play-toolbar"><button type="button" @click="reset">恢复初始房间</button><button v-if="undo" type="button" @click="restore">撤销重置</button></div><p class="play-footer-note">{{saved?'房间布置自动保存在这台设备。':'浏览器无法保存草稿，可以保存房间照片。'}} 场景与物品为本站原创图形，人物沿用站主提供的素材。</p>
  </section>
</template>
<style scoped>.room-prop-palette{grid-template-columns:repeat(8,minmax(0,1fr))}@media(max-width:760px){.room-prop-palette{grid-template-columns:repeat(4,minmax(0,1fr))}}</style>
