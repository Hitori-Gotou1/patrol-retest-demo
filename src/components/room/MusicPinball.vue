<script setup>
import {computed,shallowRef,ref} from 'vue';
import {newPinball,launchPinball,stepPinball,pinballBumpers,pinballFlippers,pinballNotes,pinballWalls,validatePinball} from '../../room/pinballGame.js';
import {useLocalDraft} from '../../composables/useLocalDraft.js';
import {useArcadeLoop} from '../../composables/useArcadeLoop.js';
import {useInteractionAudio} from '../../composables/useInteractionAudio.js';
import {recordActivity} from '../../room/activityLog.js';
const validate=v=>{if(!v||v.version!==1)throw new Error();return {version:1,round:validatePinball(v.round),best:Math.max(0,Math.floor(v.best)||0)};};
const {state,saved,persist}=useLocalDraft('hitori-room:pinball:v1',{version:1,round:newPinball(),best:0},validate),round=shallowRef(validatePinball(state.value.round)),audio=useInteractionAudio('pinball'),sound=ref(false),power=ref(0),charging=ref(false);
const controls={left:false,right:false,nudge:false},flippers=computed(()=>pinballFlippers(round.value));
let chargeAt=0;
const charge = () => Math.min(1, (performance.now() - chargeAt) / 900);
const springHead = computed(() => 756 + power.value * 68);
const spring = computed(() => {
  const travel = 861 - springHead.value;
  const teeth = Array.from({ length:16 }, (_, i) => `L${i % 2 ? 540 : 500} ${springHead.value + (i + 1) * travel / 17}`);
  return `M520 ${springHead.value}${teeth.join('')}L520 861`;
});
const hit = id => round.value.phase === 'playing' && round.value.elapsed - (round.value.hits[id] ?? -10) < .22;
function save(){state.value.round={...round.value,hits:{...round.value.hits},events:[]};state.value.best=Math.max(state.value.best,round.value.score);persist();}
function pause(){controls.left=false;controls.right=false;controls.nudge=false;charging.value=false;power.value=0;if(round.value.phase==='playing')round.value={...round.value,phase:'paused'};audio.stop();save();}
const loop=useArcadeLoop(dt=>{if(charging.value)power.value=charge();const previous=round.value;round.value=stepPinball(previous,controls,dt);controls.nudge=false;if(sound.value&&round.value.events.length)audio.play('guitar',pinballBumpers.find(b=>b.id===round.value.events[0])?.frequency||392);if(round.value.phase!==previous.phase){save();if(round.value.phase==='over'){recordActivity('pinball',`一局 ${round.value.score} 分`,`${Date.now()}:${round.value.score}`);loop.stop();}}},pause,key);
function hold(name, down) {
  if (name !== 'launch') { controls[name] = down; return; }
  if (down && !charging.value && ['ready','waiting'].includes(round.value.phase)) {
    charging.value = true; chargeAt = performance.now(); power.value = 0; loop.start();
  } else if (!down && charging.value) {
    round.value = launchPinball(round.value, charge());
    charging.value = false; power.value = 0; loop.start();
  }
}
function pointerHold(name, event, down) {
  event.preventDefault();
  if (down) event.currentTarget.setPointerCapture(event.pointerId);
  hold(name, down);
}
function cancel(name) {
  if (name==='launch') { charging.value=false; power.value=0; }
  else controls[name]=false;
}
function key(event) {
  const name = { ArrowLeft:'left', a:'left', A:'left', ArrowRight:'right', d:'right', D:'right', ' ':'launch', n:'nudge', N:'nudge' }[event.key];
  if (!name || event.repeat) return;
  event.preventDefault();
  hold(name, event.type === 'keydown');
}
function resume(){if(round.value.phase==='paused')round.value={...round.value,phase:'playing'};loop.start();}
function reset(){loop.stop();round.value=newPinball();save();}
async function toggle(){if(sound.value&&!await audio.setEnabled(true))sound.value=false;if(!sound.value)audio.stop();}
</script>
<template>
  <section class="room-panel pinball-room" aria-labelledby="pinball-title">
    <header class="activity-title">
      <p class="pg-kicker">STARRY 后台 · 音乐弹珠台</p>
      <h2 id="pinball-title">再接住一次，就能多响一拍。</h2>
      <p class="room-intro">按住压紧弹簧，松手发球。左右挡板接住小球。</p>
    </header>
    <div class="pinball-console">
      <div class="pinball-cabinet">
        <div class="pg-board pinball-board" tabindex="0" aria-label="弹珠台，左右键控制挡板，空格发球，N 轻推">
          <svg viewBox="0 0 600 880" role="img" aria-label="音乐弹珠台">
            <defs>
              <radialGradient id="pinball-glow"><stop stop-color="#55415b"/><stop offset="1" stop-color="#22212e"/></radialGradient>
              <linearGradient id="pinball-metal" x2=".7" y2="1"><stop stop-color="#f9e0b7"/><stop offset="1" stop-color="#9e6f8a"/></linearGradient>
              <clipPath v-for="bumper in pinballBumpers" :id="'pinball-clip-'+bumper.id" :key="bumper.id"><circle :r="bumper.r - 2"/></clipPath>
            </defs>
            <rect width="600" height="880" rx="31" fill="url(#pinball-glow)"/>
            <rect x="12" y="12" width="576" height="856" rx="26" fill="none" stroke="#715970" stroke-width="2"/>
            <path d="M76 210 130 171m338 0 56 39M80 495Q300 628 520 495" opacity=".58" fill="none" stroke="#9f7c96" stroke-width="3" stroke-dasharray="7 9"/>
            <text x="300" y="64" text-anchor="middle" fill="#f1cfd8" font-size="25" font-weight="800" letter-spacing="4">STARRY</text>
            <line v-for="([x1,y1,x2,y2], index) in pinballWalls" :key="index"
              :x1="x1" :y1="y1" :x2="x2" :y2="y2" stroke="url(#pinball-metal)" stroke-width="11" stroke-linecap="round"/>
            <g v-for="note in pinballNotes" :key="note.id" :transform="`translate(${note.x},${note.y})`" :data-target="note.id" :data-hit="hit(note.id)" class="pinball-note">
              <circle r="14" fill="#372b40" :stroke="hit(note.id) ? '#fff0aa' : '#d7b388'" :stroke-width="hit(note.id) ? 4 : 1.4"/>
              <text y="7" text-anchor="middle" :fill="hit(note.id) ? '#fff1bd' : '#ead19e'" font-size="22">♪</text>
            </g>
            <g v-for="bumper in pinballBumpers" :key="bumper.id" :transform="`translate(${bumper.x},${bumper.y})`"
              :data-target="bumper.id" :data-hit="hit(bumper.id)" class="pinball-target">
              <circle :r="bumper.r" :stroke="hit(bumper.id) ? '#fff2c0' : bumper.color" :stroke-width="hit(bumper.id) ? 5 : 2.5" fill="#292131"/>
              <g class="pinball-bumper-art" :class="{ 'bumper-hit':hit(bumper.id) }" :clip-path="`url(#pinball-clip-${bumper.id})`">
                <circle :r="bumper.r-2" :fill="bumper.color"/>
                <g v-if="bumper.id === 'guitar'">
                  <rect x="-29" y="-18" width="58" height="41" rx="7" fill="#994c71" stroke="#4d2d48" stroke-width="3"/>
                  <path d="M-26-13h52" stroke="#f2ccbd" stroke-width="2"/>
                  <path d="M-14-7q14-7 28 0 8 7-9 23-5 4-9 0Q-22 0-14-7Z" fill="#edc783" stroke="#68475b" stroke-width="2"/>
                </g>
                <g v-else-if="bumper.id === 'bass'">
                  <rect x="-31" y="-15" width="62" height="32" rx="7" fill="#374458" stroke="#634e5e" stroke-width="3"/>
                  <path d="M-34-24h68m-68 48h68" stroke="#e0d6c0" stroke-width="2"/>
                  <circle v-for="x in [-21,-7,7,21]" :key="x" :cx="x" cy="1" r="4.6" fill="#e2b685"/>
                </g>
                <g v-else>
                  <circle r="34" fill="#e9dcb7" stroke="#75575c" stroke-width="4"/>
                  <path d="M-24-11Q-13-34 14-22M13 25q12-6 13-18" fill="none" stroke="#faf0d5" stroke-width="3"/>
                  <circle v-for="a in [0,60,120,180,240,300]" :key="a" cx="0" cy="-37" r="3.2" :transform="`rotate(${a})`" fill="#634b56"/>
                </g>
              </g>
            </g>
            <g class="pinball-launcher" :data-power="power.toFixed(3)" :data-charging="charging">
              <path d="M484 750v106a14 14 0 0 0 14 14h42a14 14 0 0 0 14-14V748" fill="#362c3f" stroke="#97728a" stroke-width="3"/>
              <path d="M493 753v109m54-109v109" stroke="#6e536b" stroke-width="3" stroke-dasharray="4 5"/>
              <path :d="spring" fill="none" stroke="#f2cf8f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
              <path :d="`M505 ${springHead}h30`" stroke="#f3ddbd" stroke-width="5" stroke-linecap="round"/>
            </g>
            <text x="300" y="614" fill="#efd9d1" text-anchor="middle" font-size="25">{{ round.combo > 1 ? round.combo + ' 连击' : round.lives === 1 ? '最后一球' : '' }}</text>
            <line v-for="flipper in flippers" :key="flipper.side" :x1="flipper.x" :y1="flipper.y" :x2="flipper.ex" :y2="flipper.ey"
              :data-flipper="flipper.side" stroke="#eeb8cc" stroke-width="18" stroke-linecap="round"/>
            <circle v-if="round.lives" id="pinball-ball" :cx="round.x" :cy="round.y" r="10" fill="#fff0d4" stroke="#9f7180" stroke-width="1" :data-phase="round.phase"/>
            <text v-if="['paused','over'].includes(round.phase)" x="300" y="680" text-anchor="middle" fill="#fff1cf" font-size="26">{{ round.phase === 'over' ? '本局结束' : '已暂停' }}</text>
          </svg>
        </div>
        <div class="pinball-flipper-keys" aria-label="挡板控制">
          <button v-for="(name,index) in ['left','right']" :key="name" :data-control="name" type="button"
            @pointerdown="pointerHold(name,$event,true)" @pointerup="pointerHold(name,$event,false)" @pointercancel="cancel(name)" @lostpointercapture="cancel(name)"
            @keydown.space.stop.prevent="!$event.repeat && hold(name,true)" @keyup.space.stop.prevent="hold(name,false)">{{ index === 0 ? '左挡板' : '右挡板' }}</button>
        </div>
      </div>
      <div class="pinball-controls">
        <dl class="room-stats"><div><dt>得分</dt><dd id="pinball-score">{{ round.score }}</dd></div><div><dt>小球</dt><dd>{{ round.lives }} / 3</dd></div><div><dt>本机最高</dt><dd>{{ state.best }}</dd></div></dl>
        <div class="pg-touch-controls">
          <button class="primary" data-control="launch" type="button" :disabled="!['ready','waiting'].includes(round.phase)"
            @pointerdown="pointerHold('launch',$event,true)" @pointerup="pointerHold('launch',$event,false)"
            @pointercancel="cancel('launch')" @lostpointercapture="cancel('launch')"
            @keydown.space.stop.prevent="!$event.repeat && hold('launch',true)" @keyup.space.stop.prevent="hold('launch',false)"
            @keydown.enter.stop.prevent="!$event.repeat && hold('launch',true)" @keyup.enter.stop.prevent="hold('launch',false)">蓄力发射</button>
          <button data-control="nudge" type="button" @pointerdown="pointerHold('nudge',$event,true)" @pointerup="pointerHold('nudge',$event,false)" @pointercancel="cancel('nudge')" @lostpointercapture="cancel('nudge')">轻推</button>
        </div>
        <label class="pinball-power">发射蓄力 {{ Math.round(power*100) }}%<progress :value="power" max="1" aria-label="发射蓄力"></progress></label>
        <div class="pg-toolbar"><button v-if="round.phase==='paused'" id="pinball-resume" class="primary" @click="resume">继续这一球</button><button :disabled="round.phase!=='playing'" @click="loop.stop">暂停</button><button @click="reset">重新开一局</button></div>
        <div class="pg-checks"><label><input v-model="sound" type="checkbox" @change="toggle"> 碰撞音效</label></div>
        <p class="pg-legend">左右方向键 / A D 控制挡板。空格按住发球，N 轻推。连续碰撞两秒内续上连击。</p>
        <p class="pg-small">切换窗口会暂停。最高分和暂停的小球{{ saved ? '保存在本机。' : '暂时无法保存。' }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pinball-console { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(220px,.8fr); gap:clamp(12px,3vw,33px); align-items:start; }
.pinball-cabinet { max-width:445px; width:100%; margin:auto; background:#302535; border:1px solid #76566a; }
.pinball-board { padding:5px; border:0; background:#251e2a; touch-action:none; }
.pinball-board svg { width:100%; height:auto; display:block; }
.pinball-flipper-keys { display:flex; justify-content:space-between; gap:9px; padding:6px; }
.pinball-flipper-keys button { min-height:49px; flex:0 1 43%; background:#e8c3d0; color:#4e3248; touch-action:none; }
.pinball-controls { min-width:0; }
.pinball-controls .room-stats { margin-top:0; }
.pinball-controls button { touch-action:none; }
.pinball-power { display:grid; gap:5px; margin:9px 0; font-variant-numeric:tabular-nums; }
.pinball-power progress { width:100%; accent-color:#a66f89; }
.bumper-hit { animation:bumper-return .21s ease-out both; }
@keyframes bumper-return { 0% { transform:scale(.83); } 60% { transform:scale(.96); } 100% { transform:scale(1); } }
@media(max-width:760px) {
  .pinball-console { grid-template-columns:minmax(0,1fr); }
  .pinball-cabinet { width:min(100%,350px); }
  .pinball-board svg { max-height:49dvh; }
}
@media(prefers-reduced-motion:reduce) { .bumper-hit { animation:none; } }
</style>
