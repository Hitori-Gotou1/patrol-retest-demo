<script setup>
import { computed,ref } from 'vue';
import '../../styles/review-folio.css';
import EscapeClues from './EscapeClues.vue';
import { cast } from '../../data/playroom.js';
import { newEscape,validateEscape,escapeAction,allLights,solveLights } from '../../room/adventureGames.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { recordActivity } from '../../room/activityLog.js';
import { downloadStage } from '../../room/exportImage.js';
import RoomProp from './RoomProp.vue';
const {state,saved}=useLocalDraft('hitori-room:escape:v1',newEscape(),validateEscape),panel=ref(''),pin=ref(''),wires=ref(state.value.wired?['pink','blue','yellow']:['yellow','pink','blue']),message=ref('后台的灯熄了。先看看墙上的海报和地上的票根。'),hint=ref(-1),stage=ref(null),busy=ref(false),undo=ref(null);
const places=[{id:'poster',label:'墙上的海报',x:170,y:145},{id:'ticket',label:'地上的票根',x:270,y:430},{id:'case',label:'上锁的储物箱',x:555,y:415},{id:'power',label:'配电小箱',x:760,y:145},{id:'wires',label:'接线面板',x:775,y:350},{id:'desk',label:'灯光控制台',x:400,y:250},{id:'door',label:'舞台的门',x:535,y:110}];
const asset=path=>`${import.meta.env.BASE_URL}${path}`;
const deskPowered = computed(() => state.value.power && state.value.wired);
const lampCells = computed(() => Array.from({length:9},(_, index) => ({
  index, lit:deskPowered.value && Boolean(state.value.lights & (1 << index))
})));
const lightCount = computed(() => lampCells.value.filter(light => light.lit).length);
const deskPhase = computed(() => deskPowered.value ? 'connected' : state.value.power ? 'waiting' : 'off');
const deskStatus = computed(() => ({
  connected:`线路接通 · ${lightCount.value} / 9 盏灯亮起`,
  waiting:'工作灯已亮 · 控制台等待三条线路',
  off:'工作电源未恢复 · 控制台断电'
})[deskPhase.value]);
const canCompare = computed(() => ['poster','ticket'].every(id => state.value.inspected.includes(id)));
const cableColors = { pink:'#eaa0b7', blue:'#8cb5d3', yellow:'#d7bd75' };
const inventory=computed(()=>state.value.caseOpen?[state.value.power?'保险丝 · 已装好':'一枚保险丝',state.value.wired?'连接线 · 已接好':'一束连接线','接线便签']:[]);
function inspect(id){panel.value=id;if(!state.value.inspected.includes(id))state.value.inspected.push(id);hint.value=-1;}
function act(type,value){const previous=state.value.complete,next=escapeAction(state.value,type,value);state.value=next.state;message.value=next.message;hint.value=-1;if(!previous&&next.state.complete)recordActivity('escape',`点亮 STARRY · ${next.state.moves} 次操作`,String(next.state.id));}
function help(){state.value.hints++;if(!state.value.caseOpen){message.value=state.value.hints%2?'海报给的是颜色顺序，票根给的是每种颜色的数字。把它们放在一起读。':'按粉、黄、蓝、红的顺序，数字是 2、4、1、3。';panel.value='case';}else if(!state.value.power){panel.value='power';message.value='箱子里有一枚保险丝。把它装进配电小箱。';}else if(!state.value.wired){panel.value='wires';message.value='接线便签：吉他 → 粉色；贝斯 → 蓝色；鼓 → 黄色。';}else if(state.value.lights!==allLights){panel.value='desk';hint.value=solveLights(state.value.lights)[0]??-1;message.value='试试标出的小灯。每次按下，会切换它与相邻的灯。';}else{panel.value='door';message.value='所有灯都准备好了，现在可以推开舞台的门。';}}
function reset(){undo.value=validateEscape(state.value);state.value=newEscape();panel.value='';pin.value='';wires.value=['yellow','pink','blue'];message.value='新的一夜，先从海报上的线索开始。';}
function restore() {
  state.value=undo.value;
  undo.value=null;
  wires.value=state.value.wired ? ['pink','blue','yellow'] : ['yellow','pink','blue'];
  panel.value='desk';
  message.value='已恢复刚才的进度。';
}
async function exportCard(){busy.value=true;try{await downloadStage(stage.value,'starry-light-returned.png');message.value='灯亮起来的这一刻，已经留下来了。';}catch(e){message.value=e.message;}finally{busy.value=false;}}
</script>
<template><section class="room-panel review-folio escape-room" aria-labelledby="escape-title"><div class="play-heading"><div><p class="play-eyebrow">BRING BACK THE LIGHT / 幕布后的一场小冒险</p><h2 id="escape-title">开演前，灯突然灭了。</h2><p class="room-intro">检查后台、收集线索、组合道具，修好电源与线路，再让九盏灯一起亮起来。没有倒计时。</p></div></div>
  <div class="escape-workbench" :class="{ 'is-complete':state.complete }">
    <div class="escape-floor">
    <div class="escape-scene" :data-power="deskPhase"><svg ref="stage" viewBox="0 0 960 600" :role="state.complete?'img':'group'" :aria-label="state.complete?'重新亮起的四人舞台':'STARRY 后台。'+deskStatus"><rect width="960" height="600" :fill="state.power?'#4b4257':'#292838'"/><path d="M0 420h960v180H0Z" fill="#6c5968"/><path d="M20 20h920v560H20Z" fill="none" stroke="#aa90aa"/><path d="M60 420h840M60 500h840" stroke="#a18b9b" opacity=".4"/>
    <template v-if="!state.complete"><g transform="translate(170 165)"><RoomProp kind="poster"/></g><g transform="translate(555 420) scale(1.3)"><RoomProp kind="box"/></g><g transform="translate(160 390)"><RoomProp kind="amp" :lit="state.power"/></g><rect x="730" y="95" width="90" height="120" rx="4" fill="#7c7584" stroke="#bcacbc"/><circle cx="775" cy="132" r="10" :fill="state.power?'#efd47b':'#474455'"/><path d="M755 165h40m-40 16h40" stroke="#4a4253" stroke-width="5"/>
      <path d="M467 72h136v245H467Z" fill="#363044" stroke="#a28ba0" stroke-width="4"/><text x="535" y="118" text-anchor="middle" fill="#b7a2b8" font-family="monospace" font-size="16">STAGE</text><path d="M500 275h20" stroke="#d8bd84" stroke-width="6"/>
      <rect x="322" y="228" width="156" height="86" rx="5" fill="#86778b" stroke="#cfbdcb" stroke-width="3"/>
      <g v-for="cell in lampCells" :key="cell.index" :data-overview-light="cell.index" :data-lit="cell.lit">
        <circle :cx="351+cell.index%3*45" :cy="247+Math.floor(cell.index/3)*25" r="8"
          :fill="cell.lit?'#f7dd86':'#3f3548'" :stroke="cell.lit?'#fdf0b9':'#aa94ac'" stroke-width="2"/>
      </g><path d="M248 416h48v27h-48Z" fill="#d9b6c7"/><path d="M729 310h90v85h-90Z" fill="#a099ac"/><path d="M745 330h57M745 353h57M745 376h57" :stroke="state.wired?'#b8d4bd':'#71677d'" stroke-width="7"/>
      <g v-for="place in places" :key="place.id" :transform="`translate(${place.x},${place.y})`" class="escape-hotspot" role="button" tabindex="0" :aria-label="`检查${place.label}`" @click="inspect(place.id)" @keydown.enter.prevent="inspect(place.id)" @keydown.space.prevent="inspect(place.id)"><circle r="43" fill="transparent"/><circle cy="-42" r="16" :fill="state.inspected.includes(place.id)?'#8c6b86':'#e5c48b'"/><text y="-36" text-anchor="middle" fill="#fff5e4" font-family="sans-serif" font-size="18">{{state.inspected.includes(place.id)?'✓':'+'}}</text></g>
    </template>
    <template v-else><path d="M40 55 240 470M920 55 720 470M350 55 450 470M610 55 510 470" stroke="#e3b5d1" stroke-width="90" opacity=".12"/><g v-for="(person,index) in cast" :key="person.id"><circle :cx="180+index*200" cy="485" r="70" :fill="person.color" opacity=".25"/><image :href="asset(person.image)" :x="85+index*200" y="225" width="190" height="245" preserveAspectRatio="xMidYMid meet"/></g><text x="480" y="140" text-anchor="middle" font-family="sans-serif" font-size="54" font-weight="800" fill="#ecd08e">THE LIGHT IS BACK.</text><text x="480" y="530" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#e4bdcf">幕布后的小事，也有人一起完成。</text></template>
    <text x="40" y="575" fill="#e0bdd4" font-family="monospace" font-size="16" letter-spacing="3">STARRY / BACKSTAGE</text></svg></div>
    <div v-if="!state.complete" class="escape-places" role="group" aria-label="选择后台物品">
      <button v-for="place in places" :key="place.id" type="button" :data-place="place.id"
        :aria-pressed="panel===place.id" @click="inspect(place.id)">{{ state.inspected.includes(place.id) ? '✓ ' : '' }}{{ place.label }}</button>
    </div>
    </div>
    <div v-if="!state.complete" class="escape-clue" :data-closeup="panel">
      <template v-if="['poster','ticket','compare'].includes(panel)">
        <EscapeClues :view="panel" />
      </template>
      <template v-else-if="panel==='case'"><h3>{{state.caseOpen?'储物箱已经打开。':'储物箱上的四位密码。'}}</h3><template v-if="!state.caseOpen"><form @submit.prevent="act('case',pin)"><label class="room-field" for="escape-pin">转动密码锁<input id="escape-pin" v-model="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="四个数字" required></label><button type="submit" class="primary">试着打开储物箱</button></form></template><template v-else><div class="adventure-pills"><span v-for="item in inventory" :key="item">{{item}}</span></div><p>接线便签：吉他 → 粉色；贝斯 → 蓝色；鼓 → 黄色。</p></template></template>
      <template v-else-if="panel==='power'"><h3>配电小箱。</h3><p>{{state.power?'工作灯已经恢复。舞台还需要接线和灯光台。':'保险丝的位置空了，需要先从储物箱里找一枚。'}}</p><button type="button" :disabled="!state.caseOpen||state.power" @click="act('power')">{{state.power?'保险丝已装好':'装入找到的保险丝'}}</button></template>
      <template v-else-if="panel==='wires'">
        <h3>把三个接口接回去。</h3><p>先确认电源，再对照便签。</p>
        <div class="escape-cables" :data-connected="state.wired">
          <svg viewBox="0 0 330 125" role="img" :aria-label="state.wired?'三条线已接通':'三条线等候接通'">
            <rect x="1" y="1" width="328" height="123" rx="6" fill="#4a4151" stroke="#bda7ba"/>
            <g v-for="(wire,index) in wires" :key="index" :transform="`translate(0,${26+index*36})`">
              <circle cx="25" cy="0" r="8" fill="#2d2636" stroke="#cab2c7" stroke-width="2"/>
              <circle cx="304" cy="0" r="8" fill="#2d2636" stroke="#cab2c7" stroke-width="2"/>
              <path :d="`M25 0C92 -19 142 19 ${state.wired?304:277} 0`"
                :stroke="cableColors[wire]" :stroke-dasharray="state.wired?'none':'7 4'" stroke-width="4" stroke-linecap="round" fill="none"/>
            </g>
          </svg>
        </div>
        <div class="room-fields"><label v-for="(name,index) in ['吉他','贝斯','鼓']" :key="name" class="room-field">{{name}}接口<select v-model="wires[index]" :disabled="state.wired"><option value="pink">粉色</option><option value="blue">蓝色</option><option value="yellow">黄色</option></select></label></div>
        <button id="escape-wire" type="button" :disabled="!state.power||state.wired" @click="act('wires',wires)">{{state.wired?'三条线路已接好':'检查并接通线路'}}</button>
      </template>
      <template v-else-if="panel==='desk'">
        <div class="escape-console" :data-power="deskPhase">
          <header><h3>灯光控制台</h3><p class="desk-power" role="status"><i aria-hidden="true"></i>{{ deskStatus }}</p></header>
          <div class="escape-lights" role="group" aria-label="九格灯光机关">
            <button v-for="cell in lampCells" :key="cell.index" type="button" :data-light="cell.index"
              :aria-label="`切换第${cell.index+1}盏灯`" :aria-pressed="cell.lit" :disabled="!deskPowered"
              :class="{ 'is-hint':hint===cell.index }" @click="act('light',cell.index)">
              <span aria-hidden="true">{{ cell.lit ? '✦' : '○' }}</span><small aria-hidden="true">{{ cell.index+1 }}</small>
            </button>
          </div>
          <p>{{ deskPowered ? '按下一格，它和上下左右的灯会一起切换。' : '装好保险丝并接通三条线路后，九格才会亮起。' }}</p>
        </div>
      </template>
      <template v-else-if="panel==='door'"><h3>门后，是大家等待的舞台。</h3><div class="adventure-pills"><span>{{state.power?'✓':'○'}} 电源</span><span>{{state.wired?'✓':'○'}} 接线</span><span>{{lightCount===9?'✓':'○'}} 九盏灯</span></div><p>把所有准备接在一起，最后一步由你来完成。</p><button id="escape-door" type="button" class="primary" @click="act('door')">推开舞台的门</button></template>
      <template v-else><h3>先看看后台。</h3><p>海报贴在墙上，地上留了一张排练票。点图里的标记，或者从下面选择道具。</p></template>
      <button v-if="['poster','ticket','compare'].includes(panel)" type="button" class="escape-compare"
        :disabled="!canCompare" :aria-pressed="panel==='compare'" @click="panel='compare'">并排对照海报和票根</button>
    </div>
    <div v-else class="adventure-result"><span>✦</span><h3>灯亮了，可以开始了。</h3><p>{{state.moves}} 次小小的操作，接成了一次完整的开场。{{state.hints?'路上的提醒，也是一起完成这件事的一部分。':'这些线索，都被你认真接了起来。'}}</p><button type="button" class="primary" :disabled="busy" @click="exportCard">{{busy?'保存中…':'保存开灯纪念卡 ↓'}}</button></div>
  </div>
  <div v-if="!state.complete" class="room-actions"><button id="escape-hint" type="button" @click="help">给一点线索</button><span class="play-footer-note">已操作 {{state.moves}} 次 · 使用 {{state.hints}} 次线索</span></div>
  <div class="play-toolbar"><button type="button" @click="reset">开始新的一夜</button><button v-if="undo" type="button" @click="restore">撤销重置</button></div><p class="room-status" role="status">{{message}}</p><p class="play-footer-note">{{saved?'线索与机关进度自动保存在本机。':'当前浏览器无法保存，本次仍可继续解谜。'}} 剧情、后台场景和机关均为本站原创同人内容。</p>
</section></template>
<style scoped>
.escape-workbench { display:grid; grid-template-columns:minmax(0,1.3fr) minmax(0,1fr); align-items:start; gap:clamp(10px,2vw,20px); }
.escape-workbench.is-complete { grid-template-columns:minmax(0,1fr); }
.escape-floor { min-width:0; }
.escape-scene>svg { display:block; width:100%; height:auto; border:1px solid #ad93a7; }
.escape-hotspot { cursor:pointer; outline:none; }
.escape-hotspot:focus-visible>circle:first-child { stroke:#f0d3a4; stroke-width:4; }
.escape-places { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
.escape-places button { padding-inline:9px; font-size:12px; }
.escape-places button[aria-pressed=true] { background:#e6cad7; border-color:#87647c; }
.escape-clue { min-width:0; padding:12px; background:#efdfd0; border:1px solid #bfa6aa; }
.escape-clue h3 { margin-top:0; overflow-wrap:anywhere; font-size:22px; }
.escape-clue p { font-size:13px; }
.escape-clue form>button,.escape-compare { margin-top:9px; }
.escape-cables svg { display:block; width:100%; max-height:132px; }
.escape-console { color:#ffe8d4; background:#382f40; border:1px solid #79657e; padding:13px; }
.escape-console header { display:flex; align-items:baseline; justify-content:space-between; gap:5px 10px; flex-wrap:wrap; }
.escape-console h3,.escape-console p { color:inherit; margin:0 0 4px; }
.escape-console p { font-size:12px; line-height:1.55; }
.desk-power { display:flex; align-items:center; gap:6px; }
.desk-power i { display:block; width:9px; height:9px; border:1px solid #edcbd5; border-radius:50%; }
.escape-console:not([data-power=off]) .desk-power i { background:#e4be76; }
.escape-lights { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; max-width:238px; margin:10px auto; }
.escape-lights button { display:grid; justify-items:center; align-content:center; height:55px; padding:3px; border:1px solid #a08fa3; background:#514458; color:#e1d1df; font-size:24px; line-height:1; }
.escape-lights button:disabled { opacity:1; color:#bca8be; }
.escape-lights button small { font-size:10px; margin-top:4px; }
.escape-lights button[aria-pressed=true] { background:#ecd08b; color:#594435; border-color:#fbefbc; }
.escape-lights .is-hint { outline:3px dashed #efbad0; outline-offset:-5px; }
@media(max-width:760px) {
  .escape-workbench { grid-template-columns:minmax(0,1fr); }
  .escape-places { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); }
  .escape-places button { line-height:1.25; padding:4px; font-size:11px; }
  .escape-clue { padding:8px; }
}
</style>
