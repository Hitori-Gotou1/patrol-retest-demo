<script setup>
import { recordActivity } from '../../room/activityLog.js';
import { computed, ref } from 'vue';
import { cast, concertEvents, concertOptions } from '../../data/playroom.js';
import { concertBudget, concertCost, defaultConcert, resolveConcert, shuffled, validateConcertDraft } from '../../room/playroom.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { downloadStage } from '../../room/exportImage.js';
const initial={version:1,phase:'plan',plan:defaultConcert,eventId:'rain',choiceId:'',history:[]};
const {state,saved}=useLocalDraft('hitori-room:concert:v1',initial,validateConcertDraft);
const message=ref('先决定预算怎么花，再迎接开演前的小插曲。'),stage=ref(null),busy=ref(false);
const cost=computed(()=>concertCost(state.value.plan));
const remaining=computed(()=>concertBudget-cost.value);
const lines = computed(() => Object.entries(concertOptions).map(([key, group]) => ({
  key, label:group.label, choices:group.choices, item:group.choices.find(item => item.id === state.value.plan[key])
})));
const event=computed(()=>concertEvents.find(e=>e.id===state.value.eventId));
const result=computed(()=>state.value.phase==='result'?resolveConcert(state.value.plan,state.value.eventId,state.value.choiceId):null);
const palette=computed(()=>state.value.plan.lights==='warm'?['#3f3443','#f0cf89','#dfb2ba']:state.value.plan.lights==='colors'?['#352e49','#e4aac5','#a2c9d7']:['#242b45','#afbeda','#d5bd8c']);
const asset=path=>`${import.meta.env.BASE_URL}${path}`;
function launch(){if(!state.value.plan.name.trim()){message.value='先给今晚的演出取个名字吧。';return;}state.value.eventId=shuffled(concertEvents,Date.now())[0].id;state.value.phase='event';state.value.choiceId='';message.value='开演之前，还需要你做一个决定。';}
function decide(choice){if(state.value.phase !== 'event') return;try{const outcome=resolveConcert(state.value.plan,state.value.eventId,choice.id);state.value.choiceId=choice.id;state.value.phase='result';state.value.history.unshift({name:outcome.name,grade:outcome.grade,audience:outcome.audience,quality:outcome.quality});state.value.history=state.value.history.slice(0,5);message.value=outcome.ending;recordActivity('concert',outcome.name,JSON.stringify(outcome));}catch(e){message.value=e.message;}}
function again(){state.value.phase='plan';state.value.choiceId='';message.value='下一场，想试试怎样的安排？上次的海报记录还留着。';}
async function poster(){busy.value=true;try{await downloadStage(stage.value,'our-starry-live-poster.png');message.value='今晚的演出海报已生成。';}catch(e){message.value=e.message;}finally{busy.value=false;}}
</script>
<template>
  <section class="room-panel concert-room" aria-labelledby="concert-title">
    <header class="activity-title">
      <p class="play-eyebrow">STARRY 演出场务单</p>
      <h2 id="concert-title">让这一晚，响起来。</h2>
      <p class="room-intro">从试音到散场，费用都记在这张单上。</p>
    </header>
    <div class="concert-book">
      <header class="concert-budget">
        <div><span>本场虚拟预算</span><strong>¥ {{ concertBudget }}</strong></div>
        <div><span>筹备已安排</span><b>¥ {{ cost }}</b></div>
        <div><span>应急余额</span><b data-budget-remaining>¥ {{ remaining }}</b></div>
      </header>
      <label v-if="state.phase === 'plan'" class="room-field concert-name" for="concert-name">给今晚的演出命名<input id="concert-name" v-model="state.plan.name" maxlength="28"></label>
      <h3 v-else class="concert-name">{{ state.plan.name }}</h3>
      <div class="concert-lines">
        <fieldset v-for="line in lines" :key="line.key" class="concert-option">
          <legend>{{ line.label }}</legend>
          <div class="concert-line-entry"><strong>{{ line.item.label }}</strong><b>¥ {{ line.item.cost }}</b></div>
          <div v-if="state.phase === 'plan'" class="concert-choices" role="group" :aria-label="line.label">
            <button v-for="item in line.choices" :key="item.id" :data-option="item.id" type="button"
              :aria-pressed="state.plan[line.key] === item.id" @click="state.plan[line.key] = item.id">
              <span>{{ item.label }}</span><b>¥ {{ item.cost }}</b>
            </button>
          </div>
        </fieldset>
      </div>
      <div v-if="state.phase === 'plan'" class="concert-runup">
        <label class="room-field" for="concert-setlist">演出的心情<select id="concert-setlist" v-model="state.plan.setlist"><option value="together">四个人的合奏 · 默契优先</option><option value="quiet">安静的不插电 · 慢慢开口</option><option value="energy">热烈的安可 · 让气氛亮起来</option></select></label>
        <button id="concert-launch" type="button" class="primary" @click="launch">方案就绪，准备开演 →</button>
      </div>
      <div v-else-if="state.phase === 'event'" class="concert-event">
        <span class="concert-urgent-label">急件 · 距离开演十分钟</span>
        <h3>{{ event.title }}</h3><p>{{ event.text }}</p>
        <div class="concert-event-choices">
          <button v-for="choice in event.choices" :key="choice.id" type="button"
            :data-response="choice.id" :disabled="choice.cost > remaining" @click="decide(choice)">
            <span>{{ choice.label }}</span><b>¥ {{ choice.cost }}</b>
            <small v-if="choice.cost > remaining">应急余额不足</small><small v-else-if="!choice.cost">免费方案</small>
          </button>
        </div>
        <button type="button" @click="state.phase = 'plan'">← 返回修改筹备方案</button>
      </div>
    </div>
    <div v-if="result" class="concert-result">
      <svg ref="stage" viewBox="0 0 720 920" role="img" aria-label="今晚演出的纪念海报">
        <rect width="720" height="920" :fill="palette[0]"/><rect x="24" y="24" width="672" height="872" fill="none" :stroke="palette[1]"/>
        <text x="52" y="69" :fill="palette[1]" font-family="monospace" font-size="13" letter-spacing="4">HITORI ROOM PRESENTS</text><text x="52" y="171" :fill="palette[1]" font-family="sans-serif" font-size="88" font-weight="800">ONE NIGHT.</text><text x="52" y="256" :fill="palette[2]" font-family="sans-serif" font-size="75" font-weight="800">FOUR COLORS.</text>
        <circle cx="360" cy="485" r="204" fill="none" :stroke="palette[2]" opacity=".4"/><circle cx="360" cy="485" r="174" fill="none" :stroke="palette[1]" opacity=".3"/>
        <path d="M50 320 250 666M670 320 470 666" :stroke="palette[1]" stroke-width="100" opacity=".07"/>
        <image v-for="(person,index) in cast" :key="person.id" :href="asset(person.image)" :x="40+index*159" :y="385+(index%2)*22" width="165" height="230" preserveAspectRatio="xMidYMid meet"/>
        <text x="360" y="706" text-anchor="middle" :fill="palette[1]" font-family="sans-serif" :font-size="result.name.length>18?23:31" font-weight="700">{{result.name}}</text>
        <text x="360" y="755" text-anchor="middle" :fill="palette[2]" font-family="sans-serif" font-size="23">{{result.grade}}</text><path d="M52 794h616" :stroke="palette[1]"/>
        <text x="52" y="836" :fill="palette[1]" font-family="monospace" font-size="14">STARRY / ORIGINAL FAN EXPERIENCE</text><text x="52" y="867" :fill="palette[2]" font-family="sans-serif" font-size="15">{{result.audience}} 位虚拟观众 · 舞台完成度 {{result.quality}} / 100</text>
      </svg>
      <div class="concert-settlement">
        <span class="concert-urgent-label">散场 · 结算联</span><h3>{{ result.grade }}</h3><p>{{ result.ending }}</p>
        <dl>
          <div><dt>筹备费用</dt><dd>¥ {{ cost }}</dd></div>
          <div><dt>急件费用</dt><dd>¥ {{ result.spent - cost }}</dd></div>
          <div class="concert-total"><dt>本场实际花费</dt><dd data-concert-spent>¥ {{ result.spent }}</dd></div>
          <div><dt>到场人数</dt><dd>{{ result.audience }} 人</dd></div>
          <div><dt>舞台完成度</dt><dd>{{ result.quality }} / 100</dd></div>
        </dl>
        <div class="room-actions">
          <button type="button" class="primary" :disabled="busy" @click="poster">{{ busy ? '印制中…' : '保存演出海报 ↓' }}</button>
          <button type="button" @click="again">筹备下一场</button>
        </div>
      </div>
    </div>
    <p class="room-status" role="status">{{message}}</p>
    <div v-if="state.history.length" class="concert-history"><h3 class="play-subheading">小小演出档案 · 最近五场</h3><ul><li v-for="(record,index) in state.history" :key="index"><strong>{{record.name}}</strong><span>{{record.grade}} · {{record.audience}} 人 · {{record.quality}} 分</span></li></ul></div>
    <p class="play-footer-note">{{saved?'筹备进度与最近五场结果保存在这台设备。':'浏览器无法保存，本次仍可完成筹备并导出海报。'}} 所有预算、观众与演出结果均为游戏设定；不产生真实交易。</p>
  </section>
</template>
<style scoped>
.concert-book { background:#f8efda; border:1px solid #b89c83; padding:clamp(11px,2.6vw,27px); box-shadow:0 4px 0 #e4cfb6; }
.concert-budget { display:grid; grid-template-columns:minmax(0,1.3fr) repeat(2,minmax(0,1fr)); gap:7px; padding:12px; background:#372c3e; color:#fff0dc; }
.concert-budget div { min-width:0; display:grid; align-content:start; gap:4px; padding:0 7px; border-right:1px dashed #a0808b; }
.concert-budget div:last-child { border-right:0; }
.concert-budget span { font-size:12px; color:#f0d4ca; }
.concert-budget :is(b,strong) { font:700 clamp(15px,2.3vw,31px) var(--mono,monospace); white-space:nowrap; }
.concert-budget strong { color:#ffdba4; }
.concert-name { margin:14px 0; }
.concert-lines { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; }
.concert-option { margin:2px 0 0; border:1px solid #bda18b; background:#fffaed; padding:9px; min-width:0; }
.concert-option legend { color:#724153; padding:0 5px; font-size:13px; font-weight:700; }
.concert-line-entry { display:flex; align-items:start; justify-content:space-between; gap:7px; border-bottom:1px dashed #cbb4a3; padding:3px 0 7px; margin-bottom:4px; }
.concert-line-entry :is(strong,b) { font-size:13px; overflow-wrap:anywhere; }
.concert-line-entry b,.concert-choices b,.concert-event-choices b { white-space:nowrap; }
.concert-choices { display:grid; gap:4px; }
.concert-choices button,.concert-event-choices button { display:grid; grid-template-columns:1fr auto; gap:4px; align-items:center; justify-items:start; text-align:left; padding:5px 7px; min-height:44px; }
.concert-runup { display:flex; align-items:end; gap:9px; flex-wrap:wrap; margin-top:10px; }
.concert-runup label { flex:1 0 min(100%,240px); }
.concert-event { margin:15px 0 0; border:1px solid #aa776f; border-left:5px solid #a4565f; background:#f3dfd3; padding:12px; }
.concert-event h3 { margin:6px 0 2px; }
.concert-event p { margin:4px 0; }
.concert-urgent-label { color:#74384f; font-size:12px; font-weight:750; }
.concert-event-choices { display:grid; gap:5px; margin:8px 0; }
.concert-event-choices small { grid-column:1/-1; color:#71414b; font-size:11px; }
.concert-event-choices button:disabled { opacity:1; background:#e0cfc4; color:#5e5054; border-style:dashed; }
.concert-result { margin-top:19px; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.23fr); gap:clamp(10px,3vw,28px); align-items:start; }
.concert-result>svg { display:block; width:min(100%,380px); height:auto; }
.concert-settlement { background:#fff6df; border:1px solid #b69a80; padding:clamp(10px,2vw,26px); }
.concert-settlement h3 { margin:6px 0; }
.concert-settlement dl>div { display:flex; justify-content:space-between; gap:5px; padding:6px 0; border-bottom:1px solid #d7bf9d; }
.concert-settlement dd { margin:0; font:700 15px var(--mono,monospace); }
.concert-settlement .concert-total { border-bottom:2px solid #a36d7f; font-weight:750; }
.concert-history ul { list-style:none; padding:0; }
.concert-history li { display:flex; justify-content:space-between; flex-wrap:wrap; gap:5px 14px; border-bottom:1px solid #cfbaa4; padding:8px 0; font-size:13px; overflow-wrap:anywhere; }
.concert-history span { color:#674e55; }
@media(max-width:760px) {
  .concert-lines,.concert-result { grid-template-columns:minmax(0,1fr); }
  .concert-budget { padding:8px 4px; }
  .concert-budget div { padding:0 3px; }
  .concert-budget span { font-size:11px; }
  .concert-settlement { grid-row:1; }
  .concert-choices { grid-template-columns:repeat(3,minmax(0,1fr)); }
  .concert-choices button { grid-template-columns:minmax(0,1fr); gap:4px; font-size:11px; }
}
</style>
