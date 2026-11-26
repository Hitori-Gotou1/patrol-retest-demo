<script setup>
import {computed,ref} from 'vue';
import BandCardArtwork from './BandCardArtwork.vue';
import {cast} from '../../data/playroom.js';
import {bandCards,cardStages} from '../../data/playground.js';
import {newCardBattle,validateCardBattle,playBandCard,endCardTurn,cardIntent,cardBasic,bandCardCost} from '../../room/cardGame.js';
import {useLocalDraft} from '../../composables/useLocalDraft.js';
import {recordActivity} from '../../room/activityLog.js';
const validate=v=>{if(!v||v.version!==1)throw new Error();return {version:1,battle:validateCardBattle(v.battle),wins:Math.max(0,Math.min(99999,Math.floor(v.wins)||0))};};
const {state,saved}=useLocalDraft('hitori-room:cards:v1',{version:1,battle:newCardBattle(),wins:0},validate),message=ref('每回合有 3 个节奏点。不同成员接力，会多推进一点。');
const battle=computed(()=>state.value.battle),stage=computed(()=>cardStages[battle.value.stage]);
const card=id=>bandCards.find(c=>c.id===id),person=id=>cast.find(c=>c.id===id);
const asset=path=>`${import.meta.env.BASE_URL}${path}`;
function finish(previous){if(previous!=='won'&&battle.value.phase==='won'){state.value.wins++;recordActivity('cards',`${stage.value.name} · 第 ${battle.value.turn} 回合完成`,`${battle.value.seed}:${battle.value.stage}`);}}
function play(index){const previous=battle.value.phase,result=playBandCard(battle.value,index);state.value.battle=result.state;message.value=result.message;finish(previous);}
function basic(){const previous=battle.value.phase;state.value.battle=cardBasic(battle.value);finish(previous);message.value='稳住节奏，推进了 6。';}
function end(){state.value.battle=endCardTurn(battle.value);message.value=battle.value.phase==='lost'?'这一幕先休息一下，下一次还可以重新安排手牌。':'下一回合开始，抽到新的五张牌。';}
function next(){state.value.battle=newCardBattle(Date.now(),battle.value.stage+1,Math.min(100,battle.value.hp+15));message.value='开场前恢复了 15 点勇气，下一幕继续一起。';}
function reset(){state.value.battle=newCardBattle(Date.now());message.value='新的一场，从第一手牌开始。';}
</script>
<template><section class="room-panel cards-room" aria-labelledby="cards-title"><header class="activity-title"><p class="pg-kicker">STARRY 后台 · 乐队手牌</p><h2 id="cards-title">这一回合，换谁先开口？</h2><p class="room-intro">看谱架上谁来了，再决定下一张牌。</p></header><dl class="room-stats"><div><dt>勇气</dt><dd>{{battle.hp}} / 100</dd></div><div><dt>节奏点</dt><dd id="card-energy">{{battle.energy}} / 3</dd></div><div><dt>舞台进度</dt><dd>{{battle.progress}} / {{stage.target}}</dd></div><div><dt>回合</dt><dd>{{battle.turn}} / 8</dd></div></dl><div class="card-opponent" :data-act="battle.stage">
  <svg viewBox="0 0 250 112" class="card-act-art" aria-hidden="true">
    <g v-if="battle.stage===0" fill="none" stroke="#e7b6be" stroke-width="2"><rect x="113" y="17" width="113" height="81" rx="4"/><circle cx="165" cy="61" r="26"/><path d="M17 65h35l11-16 12 32 18-32 12 16h8m56 27q4 18 50 13"/></g>
    <g v-else-if="battle.stage===1" fill="none" stroke="#d9a8b9" stroke-width="2"><path d="M118 13h103v85H118Z"/><path d="M131 29h72m-72 15h72m-72 15h35m-35 19h72" stroke-dasharray="3 5"/><path d="M78 39q30-21 32 0-1 14-11 17v10m0 11v3"/></g>
    <g v-else fill="none" stroke="#edd2a1" stroke-width="2"><path d="M118 14h97q-17 69-7 84h-95q12-31 5-84ZM132 26h55m-55 10h55m-55 10h55m-55 10h55m-55 10h55"/><path d="M62 77q38 22 40-13l-5-15m5 15 14-9M144 53v-18l21-4v19"/><circle cx="139" cy="55" r="4"/><circle cx="160" cy="53" r="4"/></g>
  </svg>
  <div><h3>{{ stage.name }}</h3><p>接下来的紧张 {{ cardIntent(battle) }} · 本回合防护 {{ battle.block }}</p></div>
</div>
<div class="card-stands" aria-label="本回合登场谱架">
  <div v-for="member in cast" :key="member.id" class="card-stand" :class="{ 'is-present':battle.members.includes(member.id) }"
    :data-member="member.id" :data-onstage="battle.members.includes(member.id)">
    <svg viewBox="0 0 62 41" aria-hidden="true">
      <path d="M31 27v10m-10 2 10-5 10 5" fill="none" stroke="#6d5064" stroke-width="2"/>
      <path d="M13 4h36l4 23H9Z" :fill="battle.members.includes(member.id) ? member.color : '#ded0c3'" stroke="#72556b" stroke-width="2"/>
      <path v-if="battle.members.includes(member.id)" d="M21 16h19m-19 5h14m-11-9h7" stroke="#544353" stroke-width="1.8"/>
      <path v-else d="M24 16h14" stroke="#896f77" stroke-dasharray="3 3" stroke-width="1.6"/>
    </svg>
    <strong>{{ member.name }}</strong><span>{{ battle.members.includes(member.id) ? '已登场' : '等候' }}</span>
  </div>
</div>
<div class="card-hand" aria-label="当前手牌">
  <button v-for="(id,index) in battle.hand" :key="`${index}-${id}`" type="button" :data-card="id"
    :disabled="battle.phase!=='playing' || battle.energy<bandCardCost(id,battle)"
    :style="{ '--card-paper':person(card(id).member)?.color || '#d7adba' }" @click="play(index)">
    <span class="card-face-head">
      <span class="card-member"><img v-if="person(card(id).member)" :src="asset(person(card(id).member).image)" alt="" width="24" height="24">{{ card(id).member === 'band' ? '结束乐队' : person(card(id).member)?.name }}</span>
      <span class="card-cost" :data-cost="bandCardCost(id,battle)" aria-label="实付节奏点">{{ bandCardCost(id,battle) }}</span>
    </span>
    <BandCardArtwork :card="id"/>
    <strong>{{ card(id).name }}</strong><small>{{ card(id).text }}</small>
  </button>
</div>
  <div class="pg-toolbar"><button id="card-basic" type="button" :disabled="battle.phase!=='playing'||battle.basic||battle.energy<1" @click="basic">稳住节奏 · 1 点 / 推进 6</button><button id="card-end" type="button" class="primary" :disabled="battle.phase!=='playing'" @click="end">结束回合 →</button><span class="pg-small">牌库 {{battle.deck.length}} · 弃牌 {{battle.discard.length}} · 本幕用尽 {{battle.exhausted.length}}</span></div>
  <div v-if="battle.phase==='won'" class="pg-result"><span class="pg-score">✦</span><h3>{{battle.stage===2?'三幕都响起来了。':'这一幕，接住了。'}}</h3><p>{{battle.turn}} 回合完成，留下 {{battle.hp}} 点勇气。</p><button v-if="battle.stage<2" id="card-next" type="button" class="primary" @click="next">走向下一幕 →</button><button v-else type="button" class="primary" @click="reset">再组一场新的合奏</button></div><div v-if="battle.phase==='lost'" class="pg-result"><h3>先坐下来，整理一下手牌。</h3><button type="button" @click="state.battle=newCardBattle(Date.now(),battle.stage,80)">重试本幕</button></div><p class="pg-status" role="status">{{message}}</p><div class="pg-toolbar"><button type="button" @click="reset">从第一幕重新开始</button></div><p class="pg-small">{{saved?'当前手牌与回合会自动保存在本机。':'浏览器无法保存，本次仍可游玩。'}} 卡牌、技能与演出难题为本站原创同人设定。</p></section></template>
<style scoped>
.card-opponent { position:relative; isolation:isolate; overflow:hidden; display:grid; align-items:center; min-height:115px; color:#f9e4d7; background:#382b3d; border:1px solid #77566b; padding:12px 15px; }
.card-opponent[data-act="1"] { background:#493044; }
.card-opponent[data-act="2"] { background:#493749; }
.card-opponent h3 { margin:0 0 5px; }
.card-opponent p { margin:0; font-size:13px; }
.card-act-art { position:absolute; top:0; right:0; height:100%; width:min(56%,355px); opacity:.55; z-index:-1; }
.card-stands { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; margin:10px 0 12px; }
.card-stand { display:grid; justify-items:center; text-align:center; gap:1px; padding:5px 1px; background:#f5e7d4; border:1px solid #bba092; color:#664b58; font-size:10px; }
.card-stand.is-present { border-color:#865371; background:#ffe9cc; box-shadow:inset 0 -3px #997383; }
.card-stand strong { color:#50364d; font-size:12px; }
.card-stand svg { width:min(100%,61px); height:35px; }
.card-hand { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:8px; }
.card-hand>button { display:flex; flex-direction:column; align-items:stretch; justify-content:start; gap:5px; padding:5px; min-width:0; background:#fff6e8; border:1px solid #b79587; color:#4d344a; text-align:left; }
.card-hand>button:disabled { opacity:1; background:#eee3d9; border-style:dashed; color:#685262; }
.card-face-head { display:flex; justify-content:space-between; align-items:center; gap:2px; min-height:27px; }
.card-member { display:flex; align-items:center; gap:2px; font-size:10px; font-weight:700; white-space:nowrap; }
.card-member img { width:23px; height:23px; object-fit:contain; }
.card-cost { width:23px; height:23px; flex:0 0 23px; text-align:center; display:grid; place-items:center; border-radius:50%; font:700 14px var(--mono,monospace); color:#fff2e0; background:#6b4562; }
.card-scene { display:block; width:100%; height:auto; border:1px solid #b38c92; }
.card-hand strong { font-size:14px; line-height:1.4; }
.card-hand small { font-size:11px; line-height:1.55; overflow-wrap:anywhere; }
@media(max-width:930px) { .card-hand { grid-template-columns:repeat(4,minmax(0,1fr)); } }
@media(max-width:760px) {
  .card-hand { grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }
  .card-opponent { min-height:83px; padding:7px 9px; }
  .card-opponent h3 { font-size:15px; }
  .card-hand>button { padding:5px 4px; }
}
</style>
