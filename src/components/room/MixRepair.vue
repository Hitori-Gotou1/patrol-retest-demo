<script setup>
import { useMediaFocus } from '../../composables/useMediaFocus.js';
import {computed,ref,watch,onBeforeUnmount} from 'vue';
import {onBeforeRouteLeave} from 'vue-router';
import {mixTracks,mixChallenges} from '../../data/playground.js';
import {mixScore,validateMix} from '../../room/creativeTools.js';
import {createMixEngine,renderMixWav} from '../../audio/mixEngine.js';
import {useLocalDraft} from '../../composables/useLocalDraft.js';
import {useInteractionAudio} from '../../composables/useInteractionAudio.js';
import {recordActivity} from '../../room/activityLog.js';
const claimMedia=useMediaFocus('mix',stop);
const initial=()=>({version:1,task:0,channels:mixChallenges[0].initial.map(c=>({...c,mute:false,solo:false})),cleared:[]});
const {state,saved}=useLocalDraft('hitori-room:mix:v1',initial(),validateMix),audio=useInteractionAudio('mix'),playing=ref(false),reference=ref(false),busy=ref(false),message=ref('先听自己的版本，再切到参考。每关只需修复一类问题，达到 85 分即可完成。');
const task = computed(() => mixChallenges[state.value.task]);
const score = ref(null), hints = ref([]);
const panPercent = pan => (pan + 1) * 50;
const tonePercent = tone => (tone + 12) * 100 / 24;
const percent = volume => Math.round(volume * 100);
const panLabel = pan => pan === 0 ? '中 0' : `${pan < 0 ? '左' : '右'} ${Math.abs(pan).toFixed(2)}`;
const soloed = computed(() => channels.value.some(channel => channel.solo));
const toneLabel = tone => `${tone > 0 ? '+' : ''}${tone} dB`;
function setHint(index, taskId, event) {
  if (task.value?.id !== taskId) return;
  hints.value = hints.value.filter(i => i !== index);
  if (event.currentTarget.open) hints.value.push(index);
}
function jumpToTrack(index) {
  const track = document.getElementById('mix-track-' + index);
  const target = reference.value ? track : track?.querySelector('input');
  target?.focus({ preventScroll: true });
  track?.scrollIntoView({ block: 'center', behavior: 'instant' });
}
const engine=createMixEngine({createContext:()=>new (window.AudioContext||window.webkitAudioContext)(),isHidden:()=>document.hidden});let generation=0;
const channels=computed(()=>reference.value?task.value?.target.map(c=>({...c,mute:false,solo:false}))||state.value.channels:state.value.channels);
function stop(){generation++;engine.stop();playing.value=false;}
async function play(){stop();const token=++generation;if(!audio.enabled.value&&!await audio.setEnabled(true)){message.value='当前浏览器无法开启声音。';return;}if(token!==generation||document.hidden)return;const started = await engine.play(channels.value, audio.volume.value);
if (token !== generation) return;
playing.value = started;
if (started) {
  engine.update(channels.value);
  claimMedia();
}}
function select(i){stop();if (state.value.task !== i) hints.value=[];state.value.task=i;reference.value=false;score.value=null;state.value.channels=(mixChallenges[i]?.initial||mixChallenges[0].target).map(c=>({...c,mute:false,solo:false}));}
function check(){score.value=mixScore(task.value,state.value.channels);if(state.value.channels.some(c=>c.mute||c.solo)){score.value=0;message.value='先取消静音和独奏，让四条轨道一起参加核对。';return;}if(score.value>=85){if(!state.value.cleared.includes(state.value.task))state.value.cleared.push(state.value.task);message.value='声音重新站到一起了。这一关已完成。';recordActivity('mix',`${task.value.name} · ${score.value} 分`,task.value.id);}else message.value='再和参考轮流听一下，也可以对照小提示继续调整。';}
async function exportWav(){busy.value=true;try{const blob=await renderMixWav(state.value.channels,window.OfflineAudioContext||window.webkitOfflineAudioContext);const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hitori-my-mix.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message.value='8 秒立体声 WAV 已导出。';recordActivity('mix','导出自己的合奏混音');}catch{message.value='这台浏览器暂时无法导出 WAV。';}finally{busy.value=false;}}
watch(channels,()=>{if(playing.value)engine.update(channels.value);},{deep:true});watch(audio.enabled,value=>{if(!value)stop();});watch(audio.volume,value=>engine.volume(value));function hidden(){if(document.hidden)stop();}document.addEventListener('visibilitychange',hidden);onBeforeRouteLeave(stop);onBeforeUnmount(()=>{stop();engine.dispose();document.removeEventListener('visibilitychange',hidden);});
</script>
<template>
  <section class="room-panel mix-room" aria-labelledby="mix-title">
    <header class="activity-title">
      <p class="pg-kicker">STARRY 监听调音台</p>
      <h2 id="mix-title">让每一种声音，都有自己的位置。</h2>
      <p class="room-intro">看四条音轨在舞台上的位置，再用 A/B 对照自己的合奏。</p>
    </header>
    <div class="pg-toolbar mix-challenges" aria-label="选择混音任务">
      <button v-for="(challenge, i) in mixChallenges" :key="challenge.id" :aria-pressed="state.task === i" @click="select(i)">{{ state.cleared.includes(i) ? '✓ ' : '' }}{{ challenge.name }}</button>
      <button :aria-pressed="state.task === 3" @click="select(3)">自由混音</button>
    </div>
    <div class="mix-spread">
      <section class="mix-stage" aria-labelledby="mix-stage-title" :data-mode="reference ? 'B' : 'A'">
        <div class="mix-stage-head">
          <h3 id="mix-stage-title">舞台声像</h3>
          <span>{{ reference ? 'B · 参考版本' : 'A · 我的版本' }} · {{ playing ? '试听中' : '已停止' }}</span>
        </div>
        <div class="mix-stage-labels" aria-hidden="true">
          <span>音轨</span><span class="mix-pan-axis"><span>左</span><span>中</span><span>右</span></span><span>音量</span><span>高频 · 0 dB</span>
        </div>
        <div v-for="(track, i) in mixTracks" :key="track.id" class="mix-stage-row" :style="{ '--track-color': track.color }"
          :data-track="track.id" :data-pan="channels[i].pan" :data-volume="channels[i].volume" :data-tone="channels[i].tone">
          <button type="button" class="mix-track-link" :aria-label="'调节' + track.label" @click="jumpToTrack(i)">{{ track.label }} <span aria-hidden="true">↘</span></button>
          <div class="mix-pan">
            <span class="mix-mini-label">声像</span>
            <div class="mix-pan-rail" aria-hidden="true">
              <i class="mix-pan-dot" :style="{ left: panPercent(channels[i].pan) + '%' }"></i>
              <i v-if="task && hints.includes(i)" class="mix-reference-dot" :style="{ left: panPercent(task.target[i].pan) + '%' }"></i>
            </div>
            <span>{{ panLabel(channels[i].pan) }}</span>
          </div>
          <div class="mix-meter">
            <span class="mix-mini-label">音量</span>
            <span class="mix-volume-rail" aria-hidden="true"><i :style="{ width: percent(channels[i].volume) + '%' }"></i></span>
            <span>{{ percent(channels[i].volume) }}%</span>
          </div>
          <div class="mix-meter mix-treble">
            <span class="mix-mini-label">高频</span>
            <span class="mix-treble-rail" aria-hidden="true"><i :style="{ left: tonePercent(channels[i].tone) + '%' }"></i></span>
            <span>{{ toneLabel(channels[i].tone) }}</span>
          </div>
          <div v-if="channels[i].mute || channels[i].solo || (soloed && !channels[i].solo)" class="mix-track-state">
            <span v-if="channels[i].mute" class="mix-mute">静音</span><span v-if="channels[i].solo" class="mix-solo">独奏</span>
            <span v-else-if="!channels[i].mute" class="mix-dim">因独奏静音</span>
          </div>
        </div>
        <p v-if="task && hints.length" class="mix-reference-legend">○ 空心点是已展开音轨的参考声像</p>
        <div class="pg-toolbar mix-transport">
          <button id="mix-play" class="primary" :disabled="playing" @click="play">循环试听 ▶</button>
          <button :disabled="!playing" @click="stop">停止</button>
          <button v-if="task" id="mix-reference" :aria-pressed="reference" @click="reference = !reference">{{ reference ? '正在听参考 · 切回我的版本' : 'A/B · 听参考版本' }}</button>
        </div>
      </section>
      <div class="mix-side">
        <section class="mix-task">
          <h3>{{ task?.name || '自由混音' }}</h3>
          <p>{{ task?.text || '调整四条音轨，导出自己喜欢的版本。' }}</p>
        </section>
        <div class="mix-console">
          <fieldset v-for="(track, i) in mixTracks" :id="'mix-track-' + i" :key="track.id" :disabled="reference" tabindex="-1" :style="{ '--track-color': track.color }">
            <legend>{{ track.label }}</legend>
            <label>音量 · {{ percent(channels[i].volume) }}%<input :value="channels[i].volume" :data-mix-volume="i" type="range" min="0" max="1" step=".01" @input="state.channels[i].volume = $event.target.valueAsNumber"></label>
            <label>声像 · {{ panLabel(channels[i].pan) }}<input :value="channels[i].pan" :data-mix-pan="i" type="range" min="-1" max="1" step=".05" @input="state.channels[i].pan = $event.target.valueAsNumber"></label>
            <label>高频 · {{ toneLabel(channels[i].tone) }}<input :value="channels[i].tone" :data-mix-tone="i" type="range" min="-12" max="12" step=".5" @input="state.channels[i].tone = $event.target.valueAsNumber"></label>
            <div class="pg-checks">
              <label><input :checked="channels[i].mute" type="checkbox" @change="state.channels[i].mute = $event.target.checked">静音</label>
              <label><input :checked="channels[i].solo" type="checkbox" @change="state.channels[i].solo = $event.target.checked">独奏</label>
            </div>
            <details v-if="task" :key="task.id" @toggle="setHint(i, task.id, $event)">
              <summary>看一眼参考刻度</summary>
              <div>音量 {{ percent(task.target[i].volume) }}%<br>声像 {{ panLabel(task.target[i].pan) }}<br>高频 {{ toneLabel(task.target[i].tone) }}</div>
            </details>
          </fieldset>
        </div>
      </div>
    </div>
    <div class="pg-toolbar mix-results">
      <button v-if="task" id="mix-check" class="primary" :disabled="reference" @click="check">核对这一版</button>
      <span v-if="score !== null" class="pg-score">{{ score }} / 100</span>
      <button id="mix-export" :disabled="busy" @click="exportWav">{{ busy ? '正在渲染…' : '导出我的版本 WAV' }}</button>
    </div>
    <p class="pg-status" role="status">{{ message }}</p>
    <p class="pg-small">{{ saved ? '推子设置自动保存在本机。' : '本机存档暂不可用。' }} A/B 会保留你的推子设置。切换页面或关闭互动声音会停止试听。</p>
  </section>
</template>

<style scoped>
.mix-challenges { margin-bottom:12px; }
.mix-challenges button { min-height:44px; }
.mix-spread { display:grid; grid-template-columns:minmax(0,1.23fr) minmax(0,1fr); gap:clamp(12px,2.4vw,26px); align-items:start; }
.mix-stage { --mix-grid:minmax(78px,.9fr) minmax(112px,1.7fr) minmax(53px,.72fr) minmax(52px,.7fr); position:sticky; top:100px; min-width:0; background:#2c2532; color:#f9eadb; border:1px solid #665264; padding:13px; }
.mix-stage-head { display:flex; flex-wrap:wrap; justify-content:space-between; gap:6px 10px; align-items:baseline; padding-bottom:7px; border-bottom:1px solid #74616f; }
.mix-stage-head h3 { margin:0; color:#fff1dd; font-size:19px; }
.mix-stage-head span { color:#f7ddc0; font-size:12px; }
.mix-stage[data-mode='B'] .mix-stage-head span { color:#fde5af; text-decoration:underline; text-underline-offset:4px; }
.mix-stage-labels,.mix-stage-row { display:grid; grid-template-columns:var(--mix-grid); gap:7px; }
.mix-stage-labels { font-size:10px; color:#f1d6d5; padding:4px 0; }
.mix-pan-axis { display:flex; justify-content:space-between; }
.mix-stage-row { align-items:center; padding:6px 0; border-top:1px solid #675667; font-variant-numeric:tabular-nums; }
.mix-stage .mix-track-link { padding:3px 1px; min-height:44px; text-align:left; background:none; border:0; color:var(--track-color); font-weight:700; font-size:12px; }
.mix-stage .mix-track-link:focus-visible { outline-color:#f3d6a0; }
.mix-pan,.mix-meter { display:grid; gap:4px; font-size:10px; color:#f7e4dc; min-width:0; }
.mix-pan-rail,.mix-volume-rail,.mix-treble-rail { position:relative; display:block; height:8px; margin-inline:5px; background:#514452; border:1px solid #a08a99; }
.mix-pan-rail { background:linear-gradient(90deg,#594354,#3d3446 48%,#68596f 49%,#68596f 51%,#3d3446 52%,#594354); }
.mix-pan-rail::before,.mix-treble-rail::before { content:""; position:absolute; left:50%; top:-3px; bottom:-3px; border-left:1px solid #cab1bf; }
.mix-pan-dot,.mix-reference-dot,.mix-treble-rail i { position:absolute; top:50%; transform:translate(-50%,-50%); border-radius:50%; }
.mix-pan-dot { height:10px; width:10px; background:var(--track-color); box-shadow:0 0 0 1px #38283b; }
.mix-reference-dot { width:17px; height:17px; border:1px dashed #fff0db; box-shadow:0 0 0 1px #38283b; }
.mix-volume-rail i { display:block; height:100%; background:var(--track-color); }
.mix-treble-rail i { width:6px; height:11px; border-radius:0; background:#f4d3a5; }
.mix-meter .mix-volume-rail,.mix-meter .mix-treble-rail { margin-inline:3px; }
.mix-track-state { grid-column:2/-1; font-size:10px; }
.mix-track-state span { display:inline-block; border:1px solid #927d89; border-radius:3px; padding:1px 5px; margin-right:4px; }
.mix-solo { color:#f9dfa8; }
.mix-mute,.mix-dim { border-style:dashed; }
.mix-mini-label { display:none; }
.mix-reference-legend { color:#f9e2ca; margin:6px 0 0; font-size:11px; }
.mix-transport { margin-top:9px; align-items:center; }
.mix-transport button { min-height:44px; }
.mix-task { margin-bottom:7px; color:#5d4650; }
.mix-task h3 { margin:0; font-size:17px; }
.mix-task p { margin:2px 0; font-size:12px; }
.mix-console { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.mix-console fieldset { min-width:0; border:1px solid #a3818e; border-top:4px solid var(--track-color); padding:7px; display:grid; gap:5px; background:#f5e8dc; }
.mix-console legend { padding:1px 4px; font-size:12px; font-weight:700; }
.mix-console fieldset>label { display:grid; font-size:11px; }
.mix-console input[type=range] { width:100%; padding:0; border:0; min-height:32px; accent-color:#8a5673; }
.mix-console .pg-checks label { display:flex; min-height:32px; align-items:center; gap:3px; font-size:11px; }
.mix-console details { font-size:11px; line-height:1.75; }
.mix-console summary { cursor:pointer; min-height:36px; padding:7px 0; }
.mix-results { margin-top:13px; }
@media(max-width:950px) { .mix-spread { grid-template-columns:minmax(0,1fr); } .mix-stage { position:static; } }
@media(max-width:600px) {
  .mix-stage { --mix-grid:minmax(69px,.9fr) minmax(67px,1.25fr) minmax(44px,.7fr) minmax(45px,.7fr); padding:8px; }
  .mix-stage-labels,.mix-stage-row { gap:4px; }
  .mix-challenges { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px; }
  .mix-challenges button { font-size:12px; padding:5px; }
  .mix-console fieldset { padding:5px 7px; }
}
</style>
