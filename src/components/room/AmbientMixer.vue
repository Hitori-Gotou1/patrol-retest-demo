<script setup>
import { recordActivity } from '../../room/activityLog.js';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ambientLayers, ambientPresets } from '../../data/playroom.js';
import { validateAmbient } from '../../room/playroom.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { useInteractionAudio } from '../../composables/useInteractionAudio.js';
import { createAmbientAudioEngine } from '../../audio/ambientAudioEngine.js';
import { downloadStage } from '../../room/exportImage.js';
const validate=v=>{if(!v||v.version!==1)throw new Error('invalid ambience');return {version:1,current:validateAmbient(v.current),scenes:(Array.isArray(v.scenes)?v.scenes:[]).slice(0,6).map(validateAmbient)};};
const {state,saved}=useLocalDraft('hitori-room:ambience:v1',{version:1,current:validateAmbient(ambientPresets[0]),scenes:[]},validate);
const audio=useInteractionAudio('ambient-room');
const playing=ref(false),starting=ref(false),message=ref('按下播放，再让夜晚慢慢响起来。'),stage=ref(null),busy=ref(false),removed=ref(null);
let alive=true,generation=0;
const engine=createAmbientAudioEngine({createContext:()=>{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('unavailable');return new Audio();},isHidden:()=>document.hidden});
const palette=computed(()=>({violet:['#29283e','#b69bc9','#e7c686'],amber:['#3e313c','#d39d9b','#f4ce88'],blue:['#202f45','#8dbbc8','#c1d7cc']}[state.value.current.light]));
watch(()=>state.value.current.levels,levels=>engine.setLevels(levels),{deep:true,immediate:true});
watch(audio.volume,volume=>engine.setVolume(volume),{immediate:true});
watch(audio.enabled,enabled=>{if(!enabled&&(playing.value||starting.value)){stop();message.value='互动音效已关闭，夜晚也安静下来了。';}});
async function play(){
  if(starting.value||playing.value)return;starting.value=true;const token=++generation;
  const enabling=audio.setEnabled(true),beginning=engine.start();
  try{const [enabled,started]=await Promise.all([enabling,beginning]);if(!alive||token!==generation){engine.stop();return;}playing.value=enabled&&started;if(!playing.value)engine.stop();message.value=playing.value?'今晚的声音，正在这里。':'声音暂时没有准备好，请再点一次播放。';}
  finally{if(alive)starting.value=false;}
}
function stop(){generation++;engine.stop();playing.value=false;starting.value=false;}
function preset(item){state.value.current=validateAmbient(item);message.value=`换成了「${item.name}」，也可以继续调整。`;}
function saveScene(){
  const current=validateAmbient(state.value.current);if(!current.name.trim()){message.value='先给这段氛围起个名字吧。';return;}
  const index=state.value.scenes.findIndex(s=>s.name===current.name);
  if(index<0&&state.value.scenes.length>=6){message.value='最多保存六种氛围，移走一张场景卡后再保存。';return;}
  if(index>=0)state.value.scenes.splice(index,1,current);else state.value.scenes.push(current);
  message.value=`「${current.name}」已放进本机的声音收藏。`;recordActivity('ambient',current.name,JSON.stringify(current));
}
function removeScene(index){removed.value=validateAmbient(state.value.scenes[index]);state.value.scenes.splice(index,1);message.value='已移走这张场景卡，可以撤销。';}
function hidden(){if(document.hidden&&(playing.value||starting.value)){stop();message.value='离开页面时已暂停，回来后可主动继续播放。';}}
async function card(){busy.value=true;try{await downloadStage(stage.value,'starry-night-sound-card.png');message.value='氛围卡已生成，记录下今晚的声音配方。';}catch(e){message.value=e.message;}finally{busy.value=false;}}
onMounted(()=>document.addEventListener('visibilitychange',hidden));
onBeforeUnmount(()=>{alive=false;stop();engine.dispose();document.removeEventListener('visibilitychange',hidden);});
</script>
<template>
  <section class="room-panel" aria-labelledby="ambient-title"><div class="play-heading"><div><p class="play-eyebrow">SOUNDS OF THE NIGHT / 为今晚留一盏灯</p><h2 id="ambient-title">雨停之前，在这里坐一会儿。</h2><p class="room-intro">调一调窗外的雨、远处的街道和台上的试音。声音由本站合成，默认安静。</p></div><span class="play-number" aria-hidden="true">06</span></div>
    <div class="play-split"><div class="play-preview ambient-preview" :data-playing="playing">
      <svg ref="stage" viewBox="0 0 720 840" role="img" aria-label="今晚 STARRY 的氛围场景卡">
        <rect width="720" height="840" :fill="palette[0]"/><rect x="20" y="20" width="680" height="800" fill="none" :stroke="palette[1]" opacity=".7"/>
        <text x="44" y="67" font-family="monospace" font-size="12" letter-spacing="4" :fill="palette[1]">HITORI ROOM / AFTER THE LAST TRAIN</text>
        <rect x="92" y="116" width="536" height="442" rx="160" fill="#171c30" :stroke="palette[1]" stroke-width="4"/>
        <path d="M113 401H607V539H113Z" :fill="palette[1]" opacity=".1"/><path d="M360 118v439M93 325h534" :stroke="palette[1]" stroke-width="8"/>
        <path d="M150 414V260h130v154M446 414V215h119v199" :stroke="palette[1]" stroke-width="3" fill="#343147"/>
        <g :fill="palette[2]"><rect v-for="i in 4" :key="i" :x="170+(i%2)*55" :y="278+Math.floor(i/2)*43" width="25" height="24" :opacity=".2+state.current.levels.street*.5"/><rect x="467" y="238" width="32" height="28" opacity=".6"/><rect x="517" y="292" width="25" height="30" opacity=".3"/></g>
        <rect x="197" y="346" width="326" height="91" :fill="palette[0]" :stroke="palette[1]" stroke-width="2"/><text x="360" y="407" text-anchor="middle" :fill="palette[2]" font-family="sans-serif" font-size="50" font-weight="800" letter-spacing="6">STARRY</text>
        <path d="M204 449h313l35 60H169Z" :fill="palette[1]" opacity=".26"/><path d="M115 536h490" :stroke="palette[2]" opacity=".4" stroke-width="2"/>
        <g class="ambient-rain" :opacity="state.current.levels.rain*.8" :stroke="palette[1]" stroke-width="2"><path v-for="i in 28" :key="i" :d="`M${119+(i*73)%480} ${144+(i*47)%370}l-8 24`"/></g>
        <text x="360" y="615" text-anchor="middle" :fill="palette[2]" font-family="sans-serif" :font-size="state.current.name.length>18?24:32" font-weight="600">{{state.current.name}}</text>
        <g v-for="(layer,index) in ambientLayers" :key="layer.id" :transform="`translate(60,${662+index*33})`"><text y="2" :fill="palette[1]" font-family="sans-serif" font-size="15">{{layer.label}}</text><path d="M130-4h410" :stroke="palette[1]" opacity=".25" stroke-width="4"/><path :d="`M130-4h${410*state.current.levels[layer.id]}`" :stroke="palette[2]" stroke-width="4"/></g>
        <text x="360" y="811" text-anchor="middle" :fill="palette[1]" font-family="monospace" font-size="10" letter-spacing="2">A LITTLE SPACE TO HEAR YOURSELF.</text>
      </svg>
      <div class="room-actions play-sticky-actions"><button v-if="!playing" id="ambient-play" type="button" class="primary" :disabled="starting" @click="play">{{starting?'准备声音…':'播放今晚的氛围'}}</button><button v-else id="ambient-stop" type="button" class="primary" @click="stop();message='已暂停，窗外的夜晚留在这里。'">暂停氛围</button><button type="button" :disabled="busy" @click="card">保存氛围卡 ↓</button></div>
    </div><div>
      <h3 class="play-subheading">从一个夜晚开始</h3><div class="play-toolbar"><button v-for="item in ambientPresets" :key="item.id" type="button" @click="preset(item)">{{item.name}}</button></div>
      <label class="room-field" for="ambient-name">这一段氛围的名字<input id="ambient-name" v-model="state.current.name" maxlength="28"></label>
      <div class="ambient-layer" v-for="layer in ambientLayers" :key="layer.id"><label :for="`ambient-${layer.id}`"><strong>{{layer.label}}</strong><span>{{Math.round(state.current.levels[layer.id]*100)}}%</span></label><input :id="`ambient-${layer.id}`" v-model.number="state.current.levels[layer.id]" class="play-range" type="range" min="0" max="1" step="0.01"><p>{{layer.hint}}</p></div>
      <label class="room-field" for="ambient-volume">音量 {{Math.round(audio.volume.value*200)}}%<input id="ambient-volume" class="play-range" type="range" min="0" max="0.5" step="0.01" :value="audio.volume.value" @input="audio.setVolume(Number($event.target.value))"></label>
      <h3 class="play-subheading">灯光，也换一种颜色</h3><div class="play-toolbar"><button v-for="[id,label] in [['violet','紫色深夜'],['amber','暖色门灯'],['blue','蓝色晚风']]" :key="id" type="button" :aria-pressed="state.current.light===id" @click="state.current.light=id">{{label}}</button></div>
      <button type="button" @click="saveScene">把当前氛围放进收藏 ＋</button><p class="room-status" role="status">{{message}}</p>
    </div></div>
    <div v-if="state.scenes.length" class="ambient-saved"><h3 class="play-subheading">你留下的声音 · {{state.scenes.length}} / 6</h3><div v-for="(scene,index) in state.scenes" :key="`${scene.name}-${index}`"><button type="button" @click="preset(scene)">{{scene.name}} →</button><button type="button" :aria-label="`移走${scene.name}`" @click="removeScene(index)">移走</button></div></div><button v-if="removed&&state.scenes.length<6" type="button" @click="state.scenes.push(removed);removed=null">撤销移走</button>
    <p class="play-footer-note">{{saved?'配方与收藏自动保存在这台设备。':'浏览器无法保存，可以下载氛围卡记录配方。'}} 全站音效开关也能暂停氛围；离开页面或切到后台会停止播放，返回后不会自动响起。</p>
  </section>
</template>
<style scoped>.ambient-preview{max-width:480px;width:100%;margin-inline:auto}.ambient-layer{margin:24px 0}.ambient-layer label{display:flex;justify-content:space-between;gap:20px}.ambient-layer p{font-size:11px;color:#94788a;margin:0}.ambient-layer input{margin:7px 0}.ambient-saved>div{display:flex;gap:8px;margin-bottom:8px}.ambient-saved>div>button:first-child{flex:1;justify-content:space-between}.ambient-rain{animation:rainfall 1.4s linear infinite;animation-play-state:paused}.ambient-preview[data-playing=true] .ambient-rain{animation-play-state:running}@keyframes rainfall{from{transform:translateY(-8px)}to{transform:translateY(8px)}}@media(prefers-reduced-motion:reduce){.ambient-rain{animation:none}}</style>
