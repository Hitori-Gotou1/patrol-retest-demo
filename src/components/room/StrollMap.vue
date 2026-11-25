<script setup>
import { computed, ref } from 'vue';
import { cast, walkPlaces } from '../../data/playroom.js';
import { validateWalk } from '../../room/playroom.js';
import { recordActivity } from '../../room/activityLog.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { downloadStage } from '../../room/exportImage.js';
import WalkStamp from './WalkStamp.vue';

const { state, saved } = useLocalDraft('hitori-room:walk:v1', { visited: [], selected: 'station' }, validateWalk);
const inks = { station: '#994b49', shop: '#8b5269', vending: '#465c83', park: '#4d7159', bridge: '#3d6974', starry: '#906038' };
const stage = ref(null);
const message = ref('先选一个街角。每次抵达，都会留下一枚印章。');
const busy = ref(false);
const undo = ref(null);
const freshStamp = ref('');
const selected = computed(() => walkPlaces.find(place => place.id === state.value.selected));
const person = computed(() => cast.find(member => member.id === selected.value.member));
const complete = computed(() => state.value.visited.length === walkPlaces.length);
const visited = place => state.value.visited.includes(place.id);
const asset = path => `${import.meta.env.BASE_URL}${path}`;

function visit(place) {
  state.value.selected = place.id;
  if (visited(place)) {
    freshStamp.value = '';
    message.value = `又回到了${place.name}，故事还留在这里。`;
    return;
  }
  state.value.visited.push(place.id);
  freshStamp.value = place.id;
  message.value = place.detail;
  if (complete.value) recordActivity('walk', '六个街角，都去过了', 'all-six');
}
function next() {
  const place = walkPlaces.find(place => !visited(place));
  if (place) visit(place);
}
function reset() {
  undo.value = structuredClone(validateWalk(state.value));
  state.value = { visited: [], selected: 'station' };
  freshStamp.value = '';
  message.value = '新的一次散步，可以从任何地方开始。';
}
function restore() {
  state.value = undo.value;
  undo.value = null;
  message.value = '刚才的散步手帐已翻回来。';
}
async function souvenir() {
  if (busy.value) return;
  busy.value = true;
  try {
    await downloadStage(stage.value, 'shimokita-walk-stamps.png');
    message.value = '散步手帐已生成，把路上的小片刻带回去吧。';
  } catch (error) {
    message.value = error.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="room-panel walk-room" aria-labelledby="walk-title">
    <header class="activity-title">
      <p class="play-eyebrow">下北泽散步手帐</p>
      <h2 id="walk-title">今天，走到下一个路口。</h2>
      <p class="room-intro">点一个街角，读一段原创相遇，盖下一枚章。</p>
    </header>
    <div class="walk-spread">
      <div class="walk-sheet">
        <svg ref="stage" viewBox="0 0 960 650" role="group" aria-labelledby="walk-map-title">
          <title id="walk-map-title">有六个可探索街角的原创散步地图</title>
          <defs>
            <pattern id="walk-paper-fibres" width="56" height="38" patternUnits="userSpaceOnUse">
              <path d="M6 7l8 1m21 14 7-1M20 32l3 1" stroke="#75654d" opacity=".13" fill="none"/>
            </pattern>
          </defs>
          <rect width="960" height="650" fill="#f8f0dd"/>
          <rect width="960" height="650" fill="url(#walk-paper-fibres)"/>
          <rect x="20" y="20" width="920" height="610" fill="none" stroke="#bbad8c"/>
          <path d="M468 21v608h13V21M21 293h918" fill="#c9b99b" fill-opacity=".14" stroke="#c7b89a" stroke-dasharray="2 5"/>
          <path d="M20 425q246-116 538-84t382 101v27q-144-80-388-100T20 454Z" fill="#b7d4cb"/>
          <path d="M20 438q246-116 538-84t382 101" fill="none" stroke="#ecf5e7" stroke-width="3"/>
          <g fill="#e8e0cb" stroke="#d8cfb7" stroke-width="2">
            <path d="M63 143h105v82H63zM114 235h93v43h-93zM241 76h56v108h-56zM393 115h60v72h-60zM560 119h66v96h-66zM798 144h96v87h-96zM615 234h79v52h-79zM428 399h97v64h-97zM81 455h117v48H81z"/>
            <path d="M666 91h113v83H666z" fill="#cfddc2"/>
          </g>
          <g fill="none" stroke="#fffff1" stroke-width="17">
            <path d="M26 310 207 296 233 54M216 287l168-53 168 30 211-62L938 235M389 63l-8 170L342 497M640 65l-13 177-25 72M807 487l-36-93 38-181"/>
          </g>
          <path d="M128 346 330 140 532 310 724 135 774 400 348 450"
            fill="none" stroke="#a6756e" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="3 12"/>
          <text x="45" y="62" fill="#534537" font-family="sans-serif" font-size="32" font-weight="700">下北泽散步手帐</text>
          <text x="911" y="61" text-anchor="end" fill="#5f5645" font-family="monospace" font-size="15" letter-spacing="1">SHIMOKITA / 想象地图</text>
          <g v-for="place in walkPlaces" :key="place.id" :transform="`translate(${place.x},${place.y})`"
             class="walk-marker" role="button" tabindex="0" :aria-label="`${place.name}${visited(place) ? '，已盖章' : ''}`"
             :aria-pressed="state.selected === place.id" @click="visit(place)"
             @keydown.enter.prevent="visit(place)" @keydown.space.prevent="visit(place)">
            <rect class="walk-target" x="-58" y="-48" width="116" height="93" rx="20" fill="transparent"/>
            <circle :fill="visited(place) ? '#fffbef' : '#f8f0dd'" :stroke="inks[place.id]"
              :stroke-width="state.selected === place.id ? 3 : 1.5" :stroke-dasharray="visited(place) ? null : '2 5'" r="40"/>
            <WalkStamp :place="place.id" :ink="inks[place.id]" :pressed="visited(place)"/>
            <rect x="-85" y="47" width="170" height="34" rx="2" fill="#fff9ec" :stroke="state.selected === place.id ? inks[place.id] : 'none'"/>
            <text y="71" text-anchor="middle" fill="#514235" font-family="sans-serif" font-size="22" font-weight="650">{{ place.name }}</text>
          </g>
          <path d="M39 526H921" stroke="#b3a17c" stroke-dasharray="3 5"/>
          <text x="45" y="546" fill="#554634" font-family="sans-serif" font-size="17" font-weight="700">街角印章</text>
          <text x="911" y="546" text-anchor="end" fill="#554634" font-family="monospace" font-size="18">{{ state.visited.length }} / 6</text>
          <g v-for="(place, index) in walkPlaces" :key="place.id" :transform="`translate(${105 + index * 150},581)`"
             :data-stamp="place.id" :data-inked="visited(place)">
            <rect x="-61" y="-25" width="122" height="61" rx="3" :stroke="visited(place) ? inks[place.id] : '#a89c88'"
              :stroke-dasharray="visited(place) ? null : '2 4'" :fill="visited(place) ? '#fcf4e4' : 'none'"/>
            <g :class="{ 'walk-fresh-ink': freshStamp === place.id }">
              <g transform="translate(-25 6) scale(.65)">
                <WalkStamp :place="place.id" :ink="visited(place) ? inks[place.id] : '#9e9180'" :pressed="visited(place)"/>
              </g>
              <text x="24" y="11" text-anchor="middle" :fill="visited(place) ? inks[place.id] : '#6f6356'"
                font-family="sans-serif" font-size="22" :font-weight="visited(place) ? 700 : 400">{{ place.stamp }}</text>
            </g>
          </g>
        </svg>
      </div>
      <div class="walk-page">
        <div class="walk-place-buttons" role="group" aria-label="选择散步地点">
          <button v-for="place in walkPlaces" :key="place.id" type="button" :aria-pressed="state.selected === place.id"
            :aria-label="`${place.name}${visited(place) ? '，已盖章' : ''}`" @click="visit(place)">
            <svg viewBox="-38 -36 76 72" aria-hidden="true"><WalkStamp :place="place.id" :ink="inks[place.id]" :pressed="visited(place)"/></svg>
            <span>{{ place.name }}</span>
          </button>
        </div>
        <article class="walk-story" :style="{ '--story-ink': inks[selected.id] }">
          <div>
            <p class="play-eyebrow">{{ person.name }} · {{ selected.name }}</p>
            <h3>{{ selected.title }}</h3>
            <p>{{ selected.text }}</p>
          </div>
          <img :src="asset(person.image)" :alt="person.name" width="106" height="122">
        </article>
        <div class="room-actions">
          <button v-if="!complete" type="button" class="primary" @click="next">去下一个街角 →</button>
          <button type="button" :disabled="busy" @click="souvenir">{{ busy ? '制作中…' : complete ? '保存完整散步手帐 ↓' : '保存当前散步手帐 ↓' }}</button>
          <button type="button" @click="reset">开始新的散步</button>
          <button v-if="undo" type="button" @click="restore">撤销重置</button>
        </div>
        <p class="room-status" role="status">{{ message }}</p>
        <p class="play-footer-note">散步印章 {{ state.visited.length }} / 6 · {{ saved ? '印章会保存在这台设备。' : '可以下载手帐图片。' }}</p>
        <p v-if="complete" class="play-badge">六个街角，都去过了</p>
      </div>
    </div>
    <p class="walk-map-note">街角位置是想象地图。真实取景地址可以在<RouterLink to="/room/pilgrimage">巡礼取景册</RouterLink>里找到。</p>
  </section>
</template>

<style scoped>
.walk-spread { display:grid; grid-template-columns:minmax(0, 1.62fr) minmax(280px, 1fr); align-items:start; gap:clamp(14px, 3vw, 40px); }
.walk-sheet { min-width:0; }
.walk-sheet>svg { display:block; width:100%; height:auto; box-shadow:0 8px 18px #593e3222; }
.walk-marker { cursor:pointer; outline:none; }
.walk-marker:focus-visible .walk-target { stroke:#3b2240; stroke-width:4; }
.walk-map-note { color:#63544c; margin:14px 0 0; font-size:12px; }
.walk-map-note a { margin-inline:3px; text-decoration:underline; text-underline-offset:3px; }
.walk-place-buttons { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; }
.walk-place-buttons button { display:grid; justify-items:center; align-content:start; min-height:70px; padding:6px 3px; border:1px solid #c3ae98; border-radius:3px; background:#fbf4e6; color:#513f38; font-size:12px; }
.walk-place-buttons button[aria-pressed=true] { background:#f1dfc9; border-color:#86634d; box-shadow:inset 0 -3px #86634d; }
.walk-place-buttons svg { width:37px; height:34px; }
.walk-story { display:flex; align-items:end; min-height:132px; gap:10px; margin:16px 0; background:#fff8eb; border-left:3px solid var(--story-ink); padding:15px 12px 15px 16px; }
.walk-story .play-eyebrow { color:var(--story-ink); margin:0; }
.walk-story h3 { margin:6px 0; color:#4a383d; font-size:clamp(17px, 2vw, 23px); }
.walk-story p { font-size:14px; line-height:1.7; margin:0; }
.walk-story img { width:clamp(55px,8vw,102px); height:auto; max-height:140px; object-fit:contain; }
.walk-fresh-ink { transform-box:fill-box; transform-origin:center; animation:walk-ink .34s ease-out both; }
@keyframes walk-ink { from { opacity:.2; transform:scale(1.12); } 68% { opacity:1; transform:scale(.94); } to { opacity:1; transform:scale(1); } }
@media(max-width:800px) { .walk-spread { grid-template-columns:minmax(0,1fr); } .walk-story { min-height:0; } }
@media(prefers-reduced-motion:reduce) { .walk-fresh-ink { animation:none; } }
</style>
