<script setup>
import { recordActivity } from '../../room/activityLog.js';
import { computed, ref } from 'vue';
import { cast, walkPlaces } from '../../data/playroom.js';
import { validateWalk } from '../../room/playroom.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { downloadStage } from '../../room/exportImage.js';
const { state, saved } = useLocalDraft('hitori-room:walk:v1', { visited: [], selected: 'station' }, validateWalk);
const asset=path=>`${import.meta.env.BASE_URL}${path}`;
const stage = ref(null), message = ref('先选一个街角。每次抵达，都会留下一枚印章。'), busy = ref(false), undo = ref(null);
const selected = computed(() => walkPlaces.find(p => p.id===state.value.selected));
const person = computed(() => cast.find(c=>c.id===selected.value.member));
const complete = computed(() => state.value.visited.length===walkPlaces.length);
function visit(place){state.value.selected=place.id;if(!state.value.visited.includes(place.id)){state.value.visited.push(place.id);message.value=place.detail;if(state.value.visited.length===6)recordActivity('walk','六个街角，都去过了','all-six');}else message.value='又回到了这个街角，故事还留在这里。';}
function next(){const place=walkPlaces.find(p=>!state.value.visited.includes(p.id));if(place)visit(place);}
function reset(){undo.value=structuredClone(validateWalk(state.value));state.value={visited:[],selected:'station'};message.value='新的一次散步，可以从任何地方开始。';}
async function souvenir(){busy.value=true;try{await downloadStage(stage.value,'shimokita-walk-stamps.png');message.value='散步手帐已生成，把路上的小片刻带回去吧。';}catch(e){message.value=e.message;}finally{busy.value=false;}}
</script>
<template>
  <section class="room-panel" aria-labelledby="walk-title"><div class="play-heading"><div><p class="play-eyebrow">A SMALL WALK / 六个街角，一本小手帐</p><h2 id="walk-title">今天，走到下一个路口。</h2><p class="room-intro">一张本站想象的下北泽散步图。点选地点，读一段原创相遇，盖下一枚章。</p></div><span class="play-number" aria-hidden="true">03</span></div>
    <div class="play-preview walk-preview"><svg ref="stage" viewBox="0 0 960 650" role="group" aria-labelledby="walk-map-title"><title id="walk-map-title">有六个可探索街角的原创散步地图</title>
      <rect width="960" height="650" fill="#eee8d6"/><rect x="16" y="16" width="928" height="618" fill="none" stroke="#a8a08f"/><path d="M0 260 960 200M200 0l25 650M650 0 610 650" stroke="#d0d2bf" stroke-width="60" fill="none"/><path d="M0 260 960 200M200 0l25 650M650 0 610 650" stroke="#faf6e9" stroke-width="40" fill="none"/>
      <path d="M-30 460Q430 240 990 500" fill="none" stroke="#a8c9ca" stroke-width="48"/><path d="M-30 460Q430 240 990 500" fill="none" stroke="#e3f0df" stroke-width="2" stroke-dasharray="8 10"/>
      <g fill="#d3bbaf" stroke="#b1938b" stroke-width="2"><path d="M64 80h92v112H64zM282 55h125v112H282zM446 63h100v92H446zM670 72h152v115H670zM810 268h92v82H810zM70 495h96v68H70zM425 454h138v110H425zM680 500h100v62H680z"/></g>
      <g fill="#a9bda2"><circle v-for="(x,i) in [60,110,450,500,825,865,870]" :key="x" :cx="x" :cy="[210,220,160,158,100,135,530][i]" r="20"/><path d="M703 85h106v88H703z"/></g>
      <g fill="#ede4cc"><path d="M76 107h63v18H76zM76 139h63v18H76zM299 83h90v18h-90zM299 115h90v18h-90zM687 100h118v20H687z"/></g>
      <path d="M128 346 330 140 532 310 724 135 774 400 348 450" fill="none" stroke="#a0707e" stroke-width="3" stroke-dasharray="5 10" opacity=".7"/>
      <g v-for="(place,index) in walkPlaces" :key="place.id" :transform="`translate(${place.x},${place.y})`" class="walk-marker" role="button" tabindex="0" :aria-label="`${place.name}${state.visited.includes(place.id)?'，已盖章':''}`" :aria-pressed="state.selected===place.id" @click="visit(place)" @keydown.enter.prevent="visit(place)" @keydown.space.prevent="visit(place)">
        <circle r="44" fill="transparent"/><path d="M0 40C-5 20-32 9-32-13a32 32 0 0 1 64 0C32 9 5 20 0 40Z" :fill="state.visited.includes(place.id)?'#8e647a':'#fff9e9'" :stroke="state.selected===place.id?'#4e364b':'#9d7a85'" :stroke-width="state.selected===place.id?4:2"/><text y="-4" text-anchor="middle" dominant-baseline="middle" :fill="state.visited.includes(place.id)?'#fff2dc':'#816475'" font-family="monospace" font-size="22">{{state.visited.includes(place.id)?'✓':`0${index+1}`}}</text>
        <rect x="-68" y="47" width="136" height="30" rx="2" fill="#fffaed"/><text y="67" text-anchor="middle" fill="#66515c" font-family="sans-serif" font-size="15">{{place.name}}</text>
      </g>
      <rect x="36" y="558" width="888" height="62" fill="#fff8e9"/><text x="54" y="595" font-family="monospace" font-size="12" letter-spacing="2" fill="#816475">WALK JOURNAL</text>
      <g v-for="(place,index) in walkPlaces" :key="place.id" :transform="`translate(${266+index*108},590)`"><circle r="24" fill="none" :stroke="state.visited.includes(place.id)?'#a1657c':'#d6c8bb'" stroke-width="2"/><text y="5" text-anchor="middle" font-family="sans-serif" font-size="13" :fill="state.visited.includes(place.id)?'#a1657c':'#c9baad'">{{state.visited.includes(place.id)?place.stamp:'·'}}</text></g>
      <text x="42" y="52" font-family="monospace" font-size="12" fill="#816475" letter-spacing="3">SHIMOKITA / A FICTIONAL LITTLE WALK</text>
    </svg></div>
    <div class="walk-place-buttons" role="group" aria-label="选择散步地点"><button v-for="place in walkPlaces" :key="place.id" type="button" :aria-pressed="state.selected===place.id" @click="visit(place)">{{state.visited.includes(place.id)?'✓':'○'}} {{place.name}}</button></div>
    <div class="walk-story"><img :src="asset(person.image)" :alt="person.name" width="100" height="120"><div><span class="play-eyebrow">{{person.name}} / {{selected.name}}</span><h3>{{selected.title}}</h3><p>{{selected.text}}</p></div></div>
    <div class="play-mini-progress" aria-hidden="true"><span :style="{width:`${state.visited.length/6*100}%`}"></span></div><p class="play-footer-note">散步印章 {{state.visited.length}} / 6 <span v-if="complete" class="play-badge">六个街角，都去过了</span></p>
    <div class="room-actions"><button v-if="!complete" type="button" class="primary" @click="next">去下一个街角 →</button><button type="button" :disabled="busy" @click="souvenir">{{busy?'制作中…':complete?'保存完整散步手帐 ↓':'保存当前散步手帐 ↓'}}</button><button type="button" @click="reset">开始新的散步</button><button v-if="undo" type="button" @click="state=undo;undo=null">撤销重置</button></div>
    <p class="room-status" role="status">{{message}}</p><p class="play-footer-note">{{saved?'印章会保存在这台设备。':'浏览器无法保存进度，可以下载手帐图片。'}} 这是原创同人想象地图，地点布局和故事用于体验，不作为真实出行路线。</p>
  </section>
</template>
<style scoped>.walk-marker{cursor:pointer;outline:none}.walk-marker:focus-visible>path{stroke:#462b4d;stroke-width:5}.walk-place-buttons{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:18px 0}.walk-story{display:flex;gap:22px;background:#f0e5dd;padding:22px;margin-top:22px}.walk-story>img{width:100px;height:130px;object-fit:contain;flex:0 0 100px}.walk-story h3{margin:8px 0}.walk-story p{font-size:14px;margin:0}@media(max-width:600px){.walk-place-buttons{grid-template-columns:repeat(2,minmax(0,1fr))}.walk-story{gap:12px;padding:16px}.walk-story>img{width:65px;height:105px;flex-basis:65px}.walk-story p{font-size:13px}}</style>
