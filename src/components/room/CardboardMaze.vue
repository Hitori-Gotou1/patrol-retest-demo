<script setup>
import { computed,onBeforeUnmount,onMounted,ref } from 'vue';
import MazeBoardArt from './MazeBoardArt.vue';
import { mazeLevels } from '../../data/adventures.js';
import { newMaze,validateMaze,moveMaze,mazeHazards,mazeTiles,canHide } from '../../room/maze.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { recordActivity } from '../../room/activityLog.js';
const validate=v=>{if(!v||v.version!==1)throw new Error('invalid maze save');return {version:1,unlocked:Math.max(0,Math.min(2,Math.floor(v.unlocked)||0)),round:validateMaze(v.round),best:(Array.isArray(v.best)?v.best:[]).slice(0,3).map(n=>Number.isInteger(n)&&n>0?n:null)};};
const {state,saved}=useLocalDraft('hitori-room:maze:v1',{version:1,unlocked:0,round:newMaze(),best:[null,null,null]},validate);
const message=ref('方向键或 WASD 移动。每走一步，巡逻也会向前一步。'),board=ref(null);
const round=computed(()=>state.value.round),level=computed(()=>mazeLevels[round.value.level]),tiles=computed(()=>mazeTiles(round.value.level)),hazards=computed(()=>mazeHazards(round.value));
function act(action){const before=round.value,next=moveMaze(before,action);state.value.round=next.state;message.value=next.message;if(before.phase!=='won'&&next.state.phase==='won'){const index=next.state.level;state.value.unlocked=Math.min(2,Math.max(state.value.unlocked,index+1));state.value.best[index]=Math.min(state.value.best[index]||Infinity,next.state.steps);recordActivity('maze',`${mazeLevels[index].name} · ${next.state.steps} 步抵达舞台`,`${index}:${next.state.steps}`);}}
function start(index){if(index>state.value.unlocked)return;state.value.round=newMaze(index);message.value=mazeLevels[index].note;}
function keyboard(event){if(event.altKey||event.ctrlKey||event.metaKey||event.repeat||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)||event.target.isContentEditable||event.target.closest?.('.room-companion'))return;const action={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',' ':'hide','.':'wait'}[event.key];if(action){event.preventDefault();act(action);}}
onMounted(()=>window.addEventListener('keydown',keyboard));onBeforeUnmount(()=>window.removeEventListener('keydown',keyboard));
</script>
<template><section class="room-panel" aria-labelledby="maze-title"><header class="activity-title"><p class="play-eyebrow">STARRY 后台 · 纸箱迷宫</p><h2 id="maze-title">从纸箱，到舞台的那条路。</h2><p class="room-intro">找钥匙、推纸箱。看清灯照过的格子，再迈下一步。</p></header>
  <div class="play-toolbar" role="group" aria-label="选择迷宫关卡"><button v-for="(item,index) in mazeLevels" :key="item.name" type="button" :aria-pressed="round.level===index" :disabled="index>state.unlocked" @click="start(index)">{{index+1}} / {{index>state.unlocked?'尚未解锁':item.name.split(' · ')[1]}}</button></div>
  <div class="maze-topline"><strong>{{level.name}}</strong><span>钥匙 {{round.hasKey?'✓ 已找到':'○ 还没找到'}} · {{round.steps}} 步</span></div><label class="maze-energy">社交电量 {{round.energy}} / 100 <meter min="0" max="100" :value="round.energy"></meter></label>
  <div ref="board" class="maze-board maze-art-board" role="group" aria-label="迷宫棋盘，使用方向键或下方按钮移动" tabindex="0"
    :data-phase="round.phase" :data-position="`${round.x},${round.y}`" :data-turn="round.turn">
    <MazeBoardArt :round="round" :tiles="tiles" :hazards="hazards"/>
  </div>
  <div class="maze-legend"><span>浅色光带 · 受照格</span><span>封箱 · 可以推，能挡光</span><span>人形 · 巡逻</span><span>钥匙 · 打开通往 EXIT 的门</span></div>
  <div class="maze-controls"><div class="maze-dpad" role="group" aria-label="迷宫方向控制"><button type="button" class="maze-up" aria-label="向上走" :disabled="round.phase!=='playing'" @click="act('up')">↑</button><button type="button" aria-label="向左走" :disabled="round.phase!=='playing'" @click="act('left')">←</button><button type="button" aria-label="向下走" :disabled="round.phase!=='playing'" @click="act('down')">↓</button><button type="button" aria-label="向右走" :disabled="round.phase!=='playing'" @click="act('right')">→</button></div><div class="play-toolbar"><button id="maze-hide" type="button" :disabled="round.phase!=='playing'||(!round.hidden&&!canHide(round))" @click="act('hide')">{{round.hidden?'从纸箱里出来':'躲进旁边的纸箱'}}</button><button id="maze-wait" type="button" :disabled="round.phase!=='playing'" @click="act('wait')">等一拍</button><button type="button" @click="start(round.level)">本关重新开始</button></div></div>
  <div v-if="round.phase==='won'" class="adventure-result"><span>✦</span><h3>{{round.level===2?'三段小路，都走过来了。':'抵达舞台，下一关见。'}}</h3><p>本关用了 {{round.steps}} 步，保留了 {{round.energy}} 格勇气。最佳记录：{{state.best[round.level]}} 步。</p><button v-if="round.level<2" type="button" class="primary" @click="start(round.level+1)">走向下一幕 →</button><RouterLink v-else to="/room/companion" class="room-button">把这件小事告诉伙伴 ↗</RouterLink></div>
  <p class="room-status" role="status">{{message}}</p><p class="play-footer-note">{{level.note}} 方向键 / WASD 移动，空格躲藏，句号等一拍。{{saved?'关卡和进度自动保存在本机。':'浏览器无法保存，本次仍可游玩。'}}</p>
</section></template>

<style scoped>
.maze-art-board { display:block; border-color:#5b4657; }
.maze-legend { color:#59434f; font-size:12px; }
</style>
