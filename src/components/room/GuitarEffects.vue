<script setup>
import { nextTick,onBeforeUnmount,onMounted,ref,watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { useInteractionAudio } from '../../composables/useInteractionAudio.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { defaultTone,tonePresets,effectNames,validateTone,moveEffect,guitarToneKey,parseToneFile } from '../../room/effects.js';
import { createGuitarEffectsEngine,renderToneWav } from '../../audio/guitarEffectsEngine.js';
import { saveLocal,downloadJson } from '../../room/storage.js';
import { recordActivity } from '../../room/activityLog.js';
const {state,saved}=useLocalDraft('hitori-room:effects-draft:v1',defaultTone,validateTone),audio=useInteractionAudio('guitar-effects');
const active=ref(-1),ready=ref(false),busy=ref(false),exporting=ref(false),message=ref('先拨一根弦，再慢慢找到自己的声音。'),dragged=ref(''),fileInput=ref(null);
let alive=true,generation=0,flashTimer,importRevision=0;
const engine=createGuitarEffectsEngine({createContext:()=>{const Audio=window.AudioContext||window.webkitAudioContext;return new Audio();},isHidden:()=>document.hidden});
const strings=[{name:'E₂',hz:82.41},{name:'A₂',hz:110},{name:'D₃',hz:146.83},{name:'G₃',hz:196},{name:'B₃',hz:246.94},{name:'E₄',hz:329.63}];
watch(state,value=>engine.setPreset(value),{deep:true,immediate:true});watch(audio.volume,value=>engine.setVolume(value),{immediate:true});watch(audio.enabled,value=>{if(!value)stop();});
function stop(){generation++;ready.value=false;busy.value=false;engine.stop();active.value=-1;clearTimeout(flashTimer);}
async function sound(index=-1){if(busy.value)return;const token=generation;if(!ready.value){busy.value=true;const [enabled,unlocked]=await Promise.all([audio.setEnabled(true),engine.unlock()]);if(!alive||token!==generation)return;busy.value=false;ready.value=enabled&&unlocked;}if(!ready.value){message.value='声音暂时没有准备好，请再试一次。';return;}if(index<0)strings.forEach((s,i)=>engine.play(s.hz,i*.022));else engine.play(strings[index].hz);active.value=index;clearTimeout(flashTimer);flashTimer=setTimeout(()=>active.value=-1,250);message.value=index<0?'六根弦，一起响起。':`拨响了 ${strings[index].name}，可以边听边调整旋钮。`;}
function shift(id, offset) {
  state.value = moveEffect(state.value, id, offset);
  nextTick(() => {
    const pedal = document.querySelector(`.effect-pedal[data-effect="${id}"]`);
    (pedal?.querySelector(`[data-move="${offset}"]:enabled`) || pedal?.querySelector('[data-move]:enabled'))?.focus({ preventScroll: true });
  });
}
function drop(id){if(!dragged.value||dragged.value===id)return;const order=[...state.value.order],from=order.indexOf(dragged.value),to=order.indexOf(id);order.splice(to,0,...order.splice(from,1));state.value.order=order;dragged.value='';}
function save(){if(!state.value.name.trim()){message.value='先给这个音色起个名字吧。';return;}const tone=validateTone(state.value);message.value=saveLocal(guitarToneKey,tone)?'音色已保存。编曲台勾选「使用我的吉他音色」即可试听。':'浏览器无法保存，可导出音色 JSON 备份。';recordActivity('effects',tone.name,JSON.stringify(tone));}
async function importTone(event){const file=event.target.files?.[0];if(!file)return;const revision=++importRevision;try{if(file.size>16384)throw new Error('音色文件不能超过 16 KiB。');const tone=parseToneFile(await file.text());if(!alive||revision!==importRevision)return;stop();state.value=tone;message.value='已打开导入的音色。点击保存后才会用于编曲台。';}catch(e){if(alive&&revision===importRevision)message.value=e.message;}finally{if(alive)event.target.value='';}}
async function wav(){if(exporting.value)return;exporting.value=true;message.value='正在生成六秒试听，不会自动播放。';try{const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Offline)throw new Error('当前浏览器不支持离线生成，可以先导出音色 JSON。');const blob=await renderToneWav(state.value,Offline);if(!alive)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='hitori-guitar-tone.wav';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);message.value='六秒 WAV 试听已生成。';}catch(e){if(alive)message.value=e.message;}finally{if(alive)exporting.value=false;}}
function keyboard(event){if(event.repeat||event.ctrlKey||event.metaKey||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)||event.target.isContentEditable||event.target.closest?.('.room-companion'))return;const index=Number(event.key)-1;if(index>=0&&index<6){event.preventDefault();sound(index);}}
function hidden(){if(document.hidden){stop();message.value='离开页面时已停止试音，返回后可重新拨弦。';}}
onBeforeRouteLeave(stop);
onMounted(()=>{window.addEventListener('keydown',keyboard);window.addEventListener('hitori:audio-device-change',stop);document.addEventListener('visibilitychange',hidden);});onBeforeUnmount(()=>{alive=false;stop();engine.dispose();window.removeEventListener('keydown',keyboard);window.removeEventListener('hitori:audio-device-change',stop);document.removeEventListener('visibilitychange',hidden);});
</script>
<template>
  <section class="room-panel effects-room" aria-labelledby="effects-title">
    <header class="activity-title">
      <p class="play-eyebrow">STARRY 试音 · 吉他踏板板</p>
      <h2 id="effects-title">这一根弦，有自己的性格。</h2>
      <p class="room-intro">拨弦试听。交换踏板，看看信号从哪里进、往哪里走。</p>
    </header>
    <div class="effects-board">
      <div class="effects-input">
        <div class="tone-strings" role="group" aria-label="六根吉他弦">
          <button v-for="(string, index) in strings" :key="string.name" type="button" :class="{ 'is-plucked': active === index }"
            :aria-label="`拨响${string.name}弦，按键${index + 1}`" :disabled="busy" @click="sound(index)">
            <span>{{ index + 1 }}</span><i :style="{ height:`${6 - index * .7}px` }"></i><strong>{{ string.name }}</strong>
          </button>
        </div>
        <div class="effect-transport">
          <button id="effects-strum" type="button" class="primary" :disabled="busy" @click="sound()">{{ busy ? '准备音效…' : '扫一下六根弦' }}</button>
          <button type="button" @click="stop(); message = '试音已停止。'">停止试音</button>
          <span>键盘 1–6 拨弦</span>
        </div>
      </div>
      <div class="effects-rack">
        <p class="effect-chain" aria-label="效果器连接顺序">
          <span>吉他</span>
          <span v-for="id in state.order" :key="id">→ {{ effectNames[id] }}</span>
          <span>→ 音箱</span>
        </p>
        <div class="effect-pedals">
          <div v-for="(id, index) in state.order" :key="id" class="effect-slot">
            <article class="effect-pedal" :data-effect="id" :class="{ 'is-on':state.enabled[id] }" @dragover.prevent @drop.prevent="drop(id)">
              <header draggable="true" @dragstart="dragged = id" @dragend="dragged = ''">
                <span>{{ index + 1 }} / {{ id.toUpperCase() }}</span>
                <h3>{{ effectNames[id] }}</h3>
              </header>
              <div class="effect-signal" aria-hidden="true">
                <span class="effect-jack-label">输入</span>
                <svg viewBox="0 0 118 26" preserveAspectRatio="none" fill="none">
                  <path v-if="state.enabled[id]" d="M0 13h32l12-10 14 20 14-20 13 10h33" stroke="currentColor" stroke-width="2"/>
                  <path v-else d="M0 13h110m-9-5 9 5-9 5" stroke="currentColor" stroke-width="2"/>
                </svg>
                <span class="effect-jack-label">输出</span>
              </div>
              <span class="effect-jack jack-in" data-port="输入" aria-hidden="true"></span>
              <span class="effect-jack jack-out" data-port="输出" aria-hidden="true"></span>
              <div class="effect-parameters">
                <label v-if="id === 'drive'" class="effect-knob">
                  <span>失真强度 <b>{{ Math.round(state.drive * 100) }}%</b></span>
                  <span class="effect-dial" aria-hidden="true" :style="{ '--dial-angle': `${-130 + state.drive * 260}deg` }"><i></i></span>
                  <input id="tone-drive" v-model.number="state.drive" class="play-range" type="range" min="0" max="1" step="0.01">
                </label>
                <template v-if="id === 'delay'">
                  <label><span>回声间隔 <b>{{ Math.round(state.delayTime * 1000) }} ms</b></span><input v-model.number="state.delayTime" aria-label="回声间隔" class="play-range" type="range" min="0.08" max="0.65" step="0.01"></label>
                  <label><span>反馈 <b>{{ Math.round(state.feedback * 100) }}%</b></span><input v-model.number="state.feedback" class="play-range" type="range" min="0" max="0.65" step="0.01"></label>
                  <label><span>混合 <b>{{ Math.round(state.delayMix * 100) }}%</b></span><input v-model.number="state.delayMix" class="play-range" type="range" min="0" max="0.65" step="0.01"></label>
                </template>
                <label v-if="id === 'reverb'" class="effect-knob">
                  <span>空间感 <b>{{ Math.round(state.reverbMix * 100) }}%</b></span>
                  <span class="effect-dial" aria-hidden="true" :style="{ '--dial-angle': `${-130 + state.reverbMix / .75 * 260}deg` }"><i></i></span>
                  <input v-model.number="state.reverbMix" class="play-range" type="range" min="0" max="0.75" step="0.01">
                </label>
              </div>
              <button type="button" class="effect-bypass" :aria-pressed="state.enabled[id]" @click="state.enabled[id] = !state.enabled[id]">
                <span class="effect-footswitch" aria-hidden="true"></span>{{ state.enabled[id] ? '已接入' : '已旁通' }}
              </button>
              <div class="effect-reorder">
                <button type="button" data-move="-1" :disabled="index === 0" :aria-label="`把${effectNames[id]}向前移动`" @click="shift(id, -1)">前移</button>
                <button type="button" data-move="1" :disabled="index === 2" :aria-label="`把${effectNames[id]}向后移动`" @click="shift(id, 1)">后移</button>
              </div>
            </article>
            <div v-if="index < 2" class="effect-jumper" :data-from="id" :data-to="state.order[index + 1]" aria-hidden="true">
              <svg viewBox="0 0 50 24" preserveAspectRatio="none"><path d="M0 12c16 0 12 9 25 9s9-9 25-9" stroke="#d5b998" fill="none" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>
            </div>
          </div>
        </div>
      </div>
    </div>
    <p class="room-status" role="status">{{ message }}</p>
    <p class="adventure-hint">踏板前移、后移也可用键盘。桌面可拖动踏板标题。旁通与重新接线会清掉旧的余音。</p>
    <div class="play-toolbar" aria-label="音色预设"><button v-for="preset in tonePresets" :key="preset.name" type="button" @click="state = validateTone(preset)">{{ preset.name }}</button></div>
    <label class="room-field" for="tone-name">给这个音色命名<input id="tone-name" v-model="state.name" maxlength="32"></label>
    <div class="room-actions">
      <button id="tone-save" type="button" class="primary" @click="save">保存音色供编曲使用</button>
      <RouterLink to="/room/studio" class="room-button">去编曲台试听 ↗</RouterLink>
      <button type="button" @click="downloadJson(validateTone(state), 'hitori-guitar-tone.json')">导出音色 JSON</button>
      <button type="button" @click="fileInput.click()">导入音色 JSON</button>
      <input ref="fileInput" type="file" hidden accept=".json,application/json" aria-label="选择音色 JSON 文件" @change="importTone">
      <button id="tone-wav" type="button" :disabled="exporting" @click="wav">{{ exporting ? '生成中…' : '导出 6 秒试听 WAV ↓' }}</button>
    </div>
    <p class="play-footer-note">{{ saved ? '旋钮与连接顺序自动保存在本机。' : '可以导出音色配置或 WAV。' }} 全站音效开关和音量对试音同样有效。切后台或离页会停止声音。</p>
  </section>
</template>

<style scoped>
.effects-board { --pedal-gap:30px; display:grid; grid-template-columns:minmax(146px,.83fr) minmax(0,3.2fr); min-width:0; gap:22px; background:#2a262d; border:1px solid #594656; border-radius:5px; padding:18px; }
.effects-input { padding-top:35px; min-width:0; }
.tone-strings { border:1px solid #9b756b; padding:2px 9px; background:repeating-linear-gradient(90deg,#473739 0 17px,#684d48 18px 19px,#473739 20px 36px); }
.tone-strings button { display:flex; align-items:center; width:100%; min-height:35px; gap:6px; padding:4px 0; border:0; color:#ffebc9; background:transparent; }
.tone-strings button:focus-visible { outline-color:#f7e0a9; }
.tone-strings span,.tone-strings strong { font:700 11px var(--mono,monospace); white-space:nowrap; }
.tone-strings strong { min-width:22px; }
.tone-strings i { min-width:11px; flex:1; background:linear-gradient(#f2ddad,#a88966); border-radius:4px; }
.tone-strings .is-plucked i { background:#ffdcd9; box-shadow:0 0 9px #f6b4d5; }
.effect-transport { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
.effect-transport button { min-height:44px; }
.effect-transport span { color:#e3ccbd; font-size:12px; align-self:center; }
.effect-chain { color:#f8e3cc; display:flex; flex-wrap:wrap; gap:4px 9px; margin:0 0 10px; font-size:12px; }
.effect-pedals { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--pedal-gap); align-items:stretch; }
.effect-slot { position:relative; min-width:0; }
.effect-pedal { --pedal:#d9a5b6; position:relative; display:flex; flex-direction:column; height:100%; min-width:0; padding:12px 11px 11px; border:2px solid #e6c2ae; border-radius:5px; background:linear-gradient(175deg,#fff3d72b,transparent 32%),var(--pedal); box-shadow:inset 0 -6px #34253628,0 5px 0 #1e1923; color:#352836; }
.effect-pedal[data-effect=delay] { --pedal:#b6cbd9; }
.effect-pedal[data-effect=reverb] { --pedal:#debf8e; }
.effect-pedal header { cursor:grab; touch-action:pan-y; height:60px; }
.effect-pedal header:active { cursor:grabbing; }
.effect-pedal header>span { font:700 10px var(--mono,monospace); letter-spacing:.07em; }
.effect-pedal h3 { margin:2px 0 0; font-size:clamp(16px,2vw,22px); }
.effect-jack { position:absolute; top:81px; width:14px; height:14px; z-index:1; border:2px solid #e0c19c; border-radius:50%; background:#251e2a; box-shadow:0 0 0 1px #523c48; }
.jack-in { left:-8px; } .jack-out { right:-8px; }
.effect-signal { height:28px; display:flex; align-items:center; gap:3px; font-size:10px; font-weight:700; }
.effect-signal svg { min-width:0; flex:1; height:23px; color:#664c63; }
.is-on .effect-signal svg { color:#493046; }
.effect-jumper { position:absolute; top:77px; left:calc(100% + 5px); width:calc(var(--pedal-gap) - 10px); height:25px; pointer-events:none; }
.effect-jumper svg { display:block; width:100%; height:100%; }
.effect-parameters { flex:1; display:grid; align-content:center; gap:3px; min-height:160px; margin-top:6px; border-top:1px solid #523a4f63; }
.effect-parameters label { min-width:0; display:grid; gap:1px; color:#412c42; font-size:11px; }
.effect-parameters label>span:first-child { display:flex; justify-content:space-between; gap:3px; }
.effect-parameters input[type=range] { width:100%; min-width:0; min-height:32px; }
.effect-parameters .effect-knob { align-content:center; gap:4px; }
.effect-dial { display:grid; place-items:center; width:63px; height:63px; border-radius:50%; margin:4px auto; background:repeating-conic-gradient(from -133deg,#523f4c 0deg 2deg,transparent 2deg 21deg); }
.effect-dial i { width:51px; height:51px; border-radius:50%; background:radial-gradient(circle at 35% 27%,#6f5f6d,#292331 76%); border:2px solid #957989; position:relative; transform:rotate(var(--dial-angle)); }
.effect-dial i::after { content:""; position:absolute; left:calc(50% - 1px); top:2px; width:3px; height:11px; background:#f3d7a6; }
.effect-pedal .effect-bypass { display:flex; justify-content:center; align-items:center; min-height:46px; padding:5px; gap:5px; border-color:#5c465d; background:#4b3b4e; color:#fff0df; font-size:12px; font-weight:650; }
.effect-pedal .effect-bypass[aria-pressed=true] { background:#302a39; border-color:#573953; color:#fff2dd; }
.effect-footswitch { width:20px; height:20px; display:block; border:3px solid #d2b4b4; border-radius:50%; background:#463341; box-shadow:0 2px 0 #1f1722; }
.is-on .effect-footswitch { background:#ffdfaa; box-shadow:0 0 0 2px #584555; }
.effect-reorder { display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:6px; }
.effect-reorder button { min-width:0; min-height:44px; padding:4px 3px; font-size:12px; }
@media(max-width:920px) { .effects-board { grid-template-columns:minmax(0,1fr); gap:12px; } .effects-input { padding-top:0; } .tone-strings { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1px 10px; } }
@media(max-width:650px) {
  .effects-board { --pedal-gap:14px; padding:10px; }
  .tone-strings button { min-height:44px; }
  .effect-pedals { grid-template-columns:minmax(0,1fr); margin-right:25px; }
  .effect-pedal { padding:8px 12px 9px; }
  .effect-pedal header { height:49px; }
  .effect-jack-label:first-child { order:2; }
  .effect-signal svg { order:3; flex:.4; }
  .effect-jack-label:last-child { order:4; }
  .effect-parameters { min-height:104px; }
  .effect-knob { grid-template-columns:minmax(0,1fr) 61px; }
  .effect-knob .effect-dial { grid-column:2; grid-row:1/3; margin:0; }
  .effect-knob input { grid-column:1; }
  .effect-pedal .jack-in { left:auto; right:-8px; top:62px; }
  .effect-pedal .jack-out { top:auto; bottom:71px; }
  .effect-jack::after { content:attr(data-port); position:absolute; top:50%; right:14px; transform:translateY(-50%); white-space:nowrap; font-size:10px; font-weight:700; color:#3f3041; background:var(--pedal); padding:1px 4px; border-radius:2px; }
  .effect-jumper { top:calc(100% - 80px); left:calc(100% + 5px); width:17px; height:calc(150px + var(--pedal-gap)); border:3px solid #d5b998; border-left:0; border-radius:0 10px 10px 0; }
  .effect-jumper svg { display:none; }
}
</style>
