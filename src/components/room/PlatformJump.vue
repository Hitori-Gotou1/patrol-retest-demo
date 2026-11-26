<script setup>
import {computed,onBeforeUnmount,shallowRef,ref} from 'vue';
import {platformLevels,platformRects,newPlatform,stepPlatform,validatePlatform,platformCheckpoint,platformGoal,platformPassNotes} from '../../room/platformGame.js';
import {useLocalDraft} from '../../composables/useLocalDraft.js';
import {useArcadeLoop} from '../../composables/useArcadeLoop.js';
import {recordActivity} from '../../room/activityLog.js';
import RooftopScene from './RooftopScene.vue';
import {cast} from '../../data/playroom.js';
const validate=v=>{if(!v||v.version!==1)throw new Error();return {version:1,round:validatePlatform(v.round),unlocked:Math.max(0,Math.min(2,Math.floor(v.unlocked)||0)),best:Array.from({length:3},(_,i)=>Number.isFinite(v.best?.[i])?Math.max(0,v.best[i]):null)};};
const {state,saved,persist}=useLocalDraft('hitori-room:platform:v1',{version:1,round:newPlatform(),unlocked:0,best:[null,null,null]},validate),round=shallowRef(validatePlatform(state.value.round));
const controls={left:false,right:false,charge:false,jump:false,dash:false},message=ref('先按开始。左右移动，按住跳跃蓄力，松开起跳；空中还能补跳一次。');
const phone = matchMedia('(max-width:760px)');
const compact = ref(phone.matches);
const resize = event => { compact.value = event.matches; };
phone.addEventListener('change',resize);
onBeforeUnmount(() => phone.removeEventListener('change',resize));
const windowWidth = computed(() => compact.value ? 650 : 900);
const camera = computed(() => Math.max(0,Math.min(1835-windowWidth.value,round.value.x-(compact.value ? 215 : 280))));
const platforms = computed(() => platformRects(round.value.level,round.value.elapsed));
const rails = computed(() => platformLevels[round.value.level].platforms.filter(([, , ,travel]) => travel));
const gateOpen = computed(() => round.value.notes.length >= platformPassNotes);
const deckColors = ['#d6b798','#c1d2ce','#eac595'];
const supportColors = ['#73586d','#425363','#5a4159'];
const image=`${import.meta.env.BASE_URL}${cast[0].image}`;
function snapshot(){state.value.round={...round.value,notes:[...round.value.notes]};persist();}
function clear(){Object.keys(controls).forEach(k=>controls[k]=false);if(round.value.phase==='playing')round.value={...round.value,phase:'paused',charge:0};snapshot();}
const loop=useArcadeLoop(dt=>{const old=round.value,next=stepPlatform(old,controls,dt);controls.jump=false;controls.dash=false;round.value=next;if(next.checkpoint!==old.checkpoint||next.notes.length!==old.notes.length)snapshot();if(next.phase==='won'&&old.phase!=='won'){state.value.unlocked=Math.max(state.value.unlocked,Math.min(2,next.level+1));const best=state.value.best[next.level];state.value.best[next.level]=best==null?next.elapsed:Math.min(best,next.elapsed);message.value='到达屋顶了！今天的音符，也跟着你一起到了。';snapshot();recordActivity('platform',`${platformLevels[next.level].name} · ${next.notes.length} 个音符`,`${next.level}:${Math.floor(next.elapsed)}`);loop.stop();}},clear,key);
function start(){if(round.value.phase==='won')return;round.value={...round.value,phase:'playing'};loop.start();}
function level(index){loop.stop();round.value=newPlatform(index);snapshot();}
function hold(name,event,pressed){event.preventDefault();if(pressed)event.currentTarget.setPointerCapture(event.pointerId);if(name==='jump'){if(pressed)controls.charge=true;else if(controls.charge){controls.charge=false;controls.jump=true;}}else controls[name]=pressed;}
function cancel(name){if(name==='jump'){controls.charge=false;}else controls[name]=false;}
function key(e){const name={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',' ':'jump',j:'dash',J:'dash'}[e.key];if(!name||round.value.phase!=='playing')return;e.preventDefault();const down=e.type==='keydown';if(name==='jump'){if(down&&!e.repeat)controls.charge=true;if(!down&&controls.charge){controls.charge=false;controls.jump=true;}}else if(!e.repeat)controls[name]=down;}
</script>
<template><section class="room-panel platform-room" aria-labelledby="platform-title"><header class="activity-title"><p class="pg-kicker">下北泽 · 屋顶跳跃</p><h2 id="platform-title">再往前一点，舞台就在那边。</h2><p class="room-intro">收集三个音符，右侧旗门就会打开。</p></header><div class="pg-toolbar"><button v-for="(l,i) in platformLevels" :key="l.name" :disabled="i>state.unlocked" :aria-pressed="round.level===i" @click="level(i)">第 {{i+1}} 段{{i>state.unlocked?' · 待解锁':''}}</button></div><dl class="room-stats"><div><dt>音符</dt><dd>{{round.notes.length}} / 5</dd></div><div><dt>时间</dt><dd>{{round.elapsed.toFixed(1)}}s</dd></div><div><dt>回到起点</dt><dd>{{round.deaths}}</dd></div><div><dt>最快记录</dt><dd>{{state.best[round.level]?.toFixed(1)||'—'}}s</dd></div></dl>
<div class="pg-board platform-board" tabindex="0" :data-phase="round.phase" :data-level="round.level" :data-time="round.elapsed"
  aria-label="横版跳跃游戏，方向键移动，空格蓄力后松开跳跃，J 冲刺">
  <svg :viewBox="`0 0 ${windowWidth} 520`" role="img" aria-label="屋顶平台与音符">
    <RooftopScene :level="round.level" :width="windowWidth" :camera="camera"/>
    <g :transform="`translate(${-camera},0)`">
      <g v-for="[x,y,w,travel] in rails" :key="x" class="platform-rail">
        <path :d="`M${x+7} ${y-travel-12}V${y+travel+27}m${w-14} 0V${y-travel-12}`" fill="none" stroke="#312d43" stroke-width="8"/>
        <path :d="`M${x+7} ${y-travel-12}V${y+travel+27}m${w-14} 0V${y-travel-12}`" fill="none" stroke="#ebd8b8" stroke-width="3" stroke-dasharray="5 4"/>
      </g>
      <g v-for="platform in platforms" :key="platform.id" :data-platform="platform.id" :data-surface="platform.y">
        <rect :x="platform.x" :y="platform.y" :width="platform.w" :height="platform.h" :fill="deckColors[round.level]"/>
        <path :d="`M${platform.x+1} ${platform.y+2}h${platform.w-2}`" stroke="#fff4d7" stroke-width="2" fill="none"/>
        <path :d="`M${platform.x} ${platform.y+platform.h}h${platform.w}v90h-${platform.w}Z`" :fill="supportColors[round.level]"/>
        <path :d="`M${platform.x+10} ${platform.y+24}v74m${platform.w-20} 0v-74`" stroke="#c39ba7" opacity=".65" stroke-width="4" fill="none"/>
      </g>
      <g v-for="([x,y],index) in platformLevels[round.level].notes" v-show="!round.notes.includes(index)" :key="index">
        <circle :cx="x" :cy="y" r="15" fill="#3d334d" stroke="#eed1a1" stroke-width="2"/>
        <text :x="x" :y="y+8" fill="#ffe3a5" font-size="24" text-anchor="middle">♪</text>
      </g>
      <g :transform="`translate(${platformCheckpoint},430)`" :data-checkpoint="round.checkpoint === platformCheckpoint">
        <path d="M0 0v-73" stroke="#ede0c7" stroke-width="5"/>
        <path d="M-3-76h63l-8 17 8 15H-3Z" :fill="round.checkpoint === platformCheckpoint ? '#dcbb72' : '#5d4e63'" stroke="#f1d9b1" stroke-width="2"/>
        <text x="23" y="-54" text-anchor="middle" :fill="round.checkpoint === platformCheckpoint ? '#463341' : '#fff0db'" font-size="12" font-weight="750">检查点</text>
      </g>
      <g :transform="`translate(${platformGoal},430)`" class="platform-gate" :data-open="gateOpen">
        <path d="M0 0v-114h84V0" fill="none" :stroke="gateOpen ? '#f2d8a2' : '#c9a9be'" stroke-width="6"/>
        <path d="M0-114h84l-8-38H9Z" :fill="gateOpen ? '#587a69' : '#563d55'" stroke="#efcda7" stroke-width="3"/>
        <g v-for="n in platformPassNotes" :key="n" :data-gate-note="round.notes.length >= n">
          <circle :cx="5+n*19" cy="-134" r="7.5" :fill="round.notes.length >= n ? '#f0d89c' : '#31283e'" stroke="#e5bda7" stroke-width="1.4"/>
          <text :x="5+n*19" y="-131" font-size="10" text-anchor="middle" :fill="round.notes.length >= n ? '#493747' : '#e5c5ca'">♪</text>
        </g>
        <path v-if="!gateOpen" d="M4-44h76" stroke="#e9b3b6" stroke-width="5" stroke-dasharray="8 4"/>
        <text x="42" y="-64" text-anchor="middle" fill="#fff2dc" font-size="13" font-weight="750">{{ gateOpen ? '入口已开' : '还需 '+ (platformPassNotes-round.notes.length) +' 枚' }}</text>
      </g>
      <image id="jump-player" :href="image" :x="round.x-10" :y="round.y-16" width="48" height="56" preserveAspectRatio="xMidYMax meet" :data-x="round.x" :data-y="round.y"/>
      <text :x="round.x+14" :y="round.y-25" fill="#ffdc9e" font-size="14" text-anchor="middle">{{ round.charge>.05 ? '蓄力 '+Math.round(round.charge/.7*100)+'%' : '' }}</text>
    </g>
    <text v-if="round.phase!=='playing'" :x="windowWidth/2" y="177" text-anchor="middle" fill="#fff0df" font-size="25" font-weight="700">{{ round.phase==='won' ? '到达屋顶！' : round.phase==='paused' ? '先停在这里' : '准备好了吗？' }}</text>
  </svg>
</div>
<div class="pg-toolbar platform-transport"><button v-if="round.phase!=='won'" id="platform-start" class="primary" :disabled="round.phase==='playing'" @click="start">{{round.phase==='paused'?'继续跳跃':'开始跳跃'}}</button><button :disabled="round.phase!=='playing'" @click="loop.stop">暂停</button><button @click="level(round.level)">重来本段</button><button v-if="round.phase==='won'&&round.level<2" class="primary" @click="level(round.level+1)">下一段 →</button></div>
<div class="pg-touch-controls"><button v-for="(label,name) in {left:'←',right:'→',jump:'蓄力 / 跳',dash:'冲刺'}" :key="name" :data-control="name" @pointerdown="hold(name,$event,true)" @pointerup="hold(name,$event,false)" @pointercancel="cancel(name)" @lostpointercapture="cancel(name)">{{label}}</button></div><p class="pg-status" role="status">{{message}}</p><p class="pg-small">{{platformLevels[round.level].name}} · 方向键 / A D 移动，空格松开起跳，J 冲刺。点击游戏画面后可用键盘。切换窗口会暂停，检查点和音符{{saved?'自动保存在本机':'暂时无法保存'}}。</p></section></template>
<style scoped>.platform-board{touch-action:none;outline-offset:4px}.platform-board svg{max-height:520px}.pg-touch-controls button:nth-child(3){font-size:13px;min-width:100px}.platform-board { padding:0; background:#3b3049; border:5px solid #59465f; }
.platform-board svg { display:block; width:100%; height:auto; }
.platform-room .pg-touch-controls button { min-height:48px; }
@media(max-width:760px) { .platform-board { border-width:3px; } .platform-room .room-stats { gap:4px 12px; } }
</style>
