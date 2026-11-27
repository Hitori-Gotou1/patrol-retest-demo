<script setup>
import '../../styles/review-folio.css';
import { recordActivity } from '../../room/activityLog.js';
import { computed, onBeforeUnmount, ref } from 'vue';
import { searchObjects } from '../../data/playroom.js';
import { newSearch, shuffled, validateSearch } from '../../room/playroom.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import RoomProp from './RoomProp.vue';
import SearchIcon from './SearchIcon.vue';
const {state,saved}=useLocalDraft('hitori-room:search:v1',newSearch(),validateSearch);
const message=ref('找到上面清单里的六件物品，轻点它们。没有时间限制。'),highlight=ref(''), landing=ref('');
let hintTimer;
const targets=computed(()=>state.value.targets.map(id=>searchObjects.find(o=>o.id===id)));
const positions=[[85,116],[270,104],[448,115],[631,113],[96,256],[276,246],[454,258],[630,256],[94,408],[278,397],[459,402],[631,402]];
const layout=computed(()=>shuffled(searchObjects,state.value.seed).map((item,i)=>({...item,x:positions[i][0],y:positions[i][1],angle:shuffled([-12,-5,7,15],state.value.seed+i)[0]})));
const complete=computed(()=>state.value.found.length===6);
function inspect(item){
  if(complete.value)return;
  if(state.value.found.includes(item.id)){message.value='这件已经收好啦，继续看看别的地方。';return;}
  if(state.value.targets.includes(item.id)){state.value.found.push(item.id);landing.value=item.id;message.value=item.reply;if(complete.value){recordActivity('search','找齐开演前的六件小物',String(state.value.seed));message.value='找齐了！大家终于可以开始排练。'+` 本轮借助 ${state.value.hints} 次提示，误认 ${state.value.mistakes} 次。`;}}
  else {state.value.mistakes++;message.value='这件不用找，看看清单里还少了什么。';}
}
function hint(){const id=state.value.targets.find(id=>!state.value.found.includes(id));if(!id)return;state.value.hints++;highlight.value=id;message.value='有件要找的东西，在发光的那一小块区域。';clearTimeout(hintTimer);hintTimer=setTimeout(()=>highlight.value='',3500);}
function next(){clearTimeout(hintTimer);highlight.value='';landing.value='';state.value=newSearch(Math.max(Date.now(),state.value.seed+1));message.value='物品的位置和寻找清单都换好了，开始新的一轮吧。';}
onBeforeUnmount(()=>clearTimeout(hintTimer));
</script>
<template>
  <section class="room-panel review-folio search-room" aria-labelledby="search-title"><div class="play-heading"><div><p class="play-eyebrow">开演前的器材箱</p><h2 id="search-title">拨片，又跑到哪里去了？</h2><p class="room-intro">帮大家找齐六件物品。每轮的位置和清单都会变化；需要时可以要一点提示。</p></div></div>
    <section class="search-targets" aria-labelledby="search-case-title">
      <header><h3 id="search-case-title">这轮要带走的小物</h3><strong id="search-progress" aria-live="polite">已收好 {{ state.found.length }} / 6</strong></header>
      <ol class="carry-slots">
        <li v-for="item in targets" :key="item.id" :data-slot-for="item.id" :data-packed="state.found.includes(item.id)">
          <svg viewBox="-43 -42 86 84" class="carry-recess" aria-hidden="true"><SearchIcon :kind="item.icon"/></svg>
          <svg v-if="state.found.includes(item.id)" viewBox="-43 -42 86 84" class="carry-piece"
            :class="{ 'is-landing':landing===item.id }" aria-hidden="true" @animationend="landing===item.id && (landing='')">
            <SearchIcon :kind="item.icon"/>
          </svg>
          <span>{{ item.label }}</span><small class="visually-hidden">{{ state.found.includes(item.id) ? '已收好' : '待收' }}</small>
          <i v-if="state.found.includes(item.id)" aria-hidden="true">✓</i>
        </li>
      </ol>
    </section>
    <div class="search-board" :data-complete="complete"><svg viewBox="0 0 720 480" role="group" aria-label="寻找物品的原创排练室插画">
      <rect width="720" height="480" fill="#dfd0c7"/><path d="M0 0h720v305H0Z" fill="#eaded0"/><path d="M0 305h720M0 390h720M140 305 75 480M360 305v175M580 305l65 175" fill="none" stroke="#b39b91" stroke-width="2"/>
      <rect x="24" y="44" width="146" height="180" fill="#b3bac5" stroke="#99858e" stroke-width="6"/><path d="M97 44v180M24 135h146" fill="none" stroke="#e9ded0" stroke-width="5"/>
      <path d="M226 55h100v138H226Z" fill="#b18fa6"/><text x="276" y="166" text-anchor="middle" fill="#f9e8b8" font-family="sans-serif" font-size="24" font-weight="800">STARRY</text>
      <g transform="translate(448 150) scale(1.3)"><RoomProp kind="amp"/></g><g transform="translate(629 147)"><RoomProp kind="chair"/></g>
      <path d="M20 276h164v18H20zM32 294v54m140-54v54" fill="#9b7c7b" stroke="#806a70" stroke-width="5"/>
      <path d="M228 272h100v26H228zM238 299v55m81-55v55" fill="#c7ae98" stroke="#806a70" stroke-width="5"/>
      <g transform="translate(630 301) scale(.9)"><RoomProp kind="box"/></g><ellipse cx="429" cy="394" rx="130" ry="50" fill="#b59faa"/><path d="M350 378h154M340 392h176M355 406h145" stroke="#d3c1bf" stroke-width="3"/>
      <g transform="translate(58 390) rotate(-22)"><RoomProp kind="guitar"/></g><path d="M413 67h80M418 57h65M424 47h59M248 217h65M250 207h54" stroke="#a48b89" stroke-width="9"/>
      <g v-for="item in layout" :key="item.id" :transform="`translate(${item.x},${item.y})`" class="search-hotspot" :class="{'is-highlighted':highlight===item.id,'is-found':state.found.includes(item.id)}" role="button" tabindex="0" :aria-label="`检查第${layout.indexOf(item)+1}处物品${state.found.includes(item.id)?'，已找到':''}`" :aria-pressed="state.found.includes(item.id)" :data-object="item.id" @click="inspect(item)" @keydown.enter.prevent="inspect(item)" @keydown.space.prevent="inspect(item)">
        <rect class="search-hit" x="-53" y="-53" width="106" height="106" rx="25" fill="transparent"/><circle v-if="highlight===item.id" r="48" fill="#ffe5a4" opacity=".8"/>
        <g :transform="`rotate(${item.angle})`" :class="{ 'search-empty-print':state.found.includes(item.id) }">
          <SearchIcon :kind="item.icon"/>
        </g>
      </g>
      <text x="20" y="466" fill="#70565f" font-family="monospace" font-size="10" letter-spacing="2">KESSOKU BAND / REHEARSAL ROOM</text>
    </svg></div>
    <div class="room-actions play-sticky-actions"><button v-if="!complete" type="button" @click="hint">给一点提示</button><button type="button" :class="{primary:complete}" @click="next">{{complete?'找齐啦，再来一轮 →':'换一轮清单'}}</button></div>
    <div v-if="complete" class="search-complete"><span aria-hidden="true">✦</span><h3>开演的小东西，都到齐了。</h3><p>大事之前，那些很小的准备，也有人认真记得。</p><RouterLink to="/room/concert" class="play-quiet-link">接下来，筹备今晚的演出 ↗</RouterLink></div>
    <p class="room-status" role="status">{{message}}</p><p class="play-footer-note">{{saved?'未完成的清单会留在这台设备。':'浏览器无法保存，本次仍可正常寻找。'}} 没有倒计时，随时可以离开再回来。插画与物品图形为本站原创。</p>
  </section>
</template>
<style scoped>
.search-targets { display:grid; min-width:0; margin:0 0 14px; background:#403747; color:#fcecd7; padding:9px; border:2px solid #887385; border-radius:11px 11px 7px 7px; box-shadow:inset 0 0 0 3px #2b2735; }
.search-targets>header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px 8px; padding:2px 5px 7px; color:inherit; }
.search-targets h3 { margin:0; color:inherit; font-size:15px; }
.search-targets strong { color:#f4d2bc; font-size:12px; font-variant-numeric:tabular-nums; }
.carry-slots { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); list-style:none; gap:6px; margin:0; padding:0; }
.carry-slots li { position:relative; display:grid; grid-template-rows:58px auto; justify-items:center; align-items:center; min-width:0; color:#eed9dc; background:#2e2a37; border:1px solid #74677a; padding:3px 2px 5px; text-align:center; border-radius:7px; }
.carry-recess,.carry-piece { grid-row:1; grid-column:1; width:min(100%,70px); height:57px; display:block; }
.carry-recess { opacity:.48; filter:grayscale(1); }
.carry-recess :deep([stroke]) { stroke:#cbbac8; }
.carry-recess :deep([fill]:not([fill=none])) { fill:#645867; }
.carry-slots li[data-packed=true] { border-color:#b89c87; }
.carry-slots li>span { grid-row:2; font-size:12px; line-height:1.25; }
.carry-slots li>i { position:absolute; top:3px; right:4px; font-size:11px; line-height:1; color:#f5dfaa; font-style:normal; }
.carry-piece.is-landing { animation:slot-land .26s ease-out both; }
@keyframes slot-land { from { transform:translateY(-13px) rotate(-8deg) scale(.85); opacity:.45; } 80% { transform:translateY(2px); } to { transform:none; opacity:1; } }
.search-board { border:1px solid #bca193; }
.search-board>svg { display:block; width:100%; height:auto; }
.search-hotspot { cursor:pointer; outline:none; }
.search-hotspot:focus-visible .search-hit { stroke:#82526d; stroke-width:4; fill:#fff4dd55; }
.search-empty-print { opacity:.25; filter:grayscale(1); }
.search-empty-print :deep([fill]:not([fill=none])) { fill:#867883; }
.search-complete { background:#e9e2cf; border:1px dashed #aa947f; padding:20px; text-align:center; }
.search-complete p { font-size:13px; }
@media(max-width:650px) {
  .carry-slots { grid-template-columns:repeat(3,minmax(0,1fr)); gap:4px; }
  .carry-slots li { grid-template-rows:37px auto; }
  .carry-recess,.carry-piece { height:37px; }
  .carry-slots li>span { font-size:11px; }
  .search-targets { margin-bottom:9px; padding:7px; }
  .search-hit { x:-60px; y:-58px; width:120px; height:116px; }
}
@media(prefers-reduced-motion:reduce) { .carry-piece.is-landing { animation:none; } }
:global(html[data-motion=reduce]) .carry-piece.is-landing { animation:none; }
</style>
