<script setup>
import { computed, ref } from 'vue';
import { cast, concertEvents, concertOptions } from '../../data/playroom.js';
import { clamp, concertBudget, concertCost, defaultConcert, resolveConcert, shuffled, validateConcert } from '../../room/playroom.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { downloadStage } from '../../room/exportImage.js';
const initial={version:1,phase:'plan',plan:defaultConcert,eventId:'rain',choiceId:'',history:[]};
function validate(v){
  if(!v||v.version!==1)throw new Error('invalid concert');
  const plan=validateConcert(v.plan),eventId=concertEvents.some(e=>e.id===v.eventId)?v.eventId:'rain';
  const phase=['plan','event','result'].includes(v.phase)?v.phase:'plan';
  if(phase==='result')resolveConcert(plan,eventId,v.choiceId);
  return {version:1,phase,plan,eventId,choiceId:String(v.choiceId||''),history:(Array.isArray(v.history)?v.history:[]).slice(0,5).filter(x=>x&&typeof x.name==='string'&&typeof x.grade==='string').map(x=>({name:x.name.slice(0,28),grade:x.grade.slice(0,28),audience:Math.round(clamp(x.audience,0,100)),quality:Math.round(clamp(x.quality,0,100))}))};
}
const {state,saved}=useLocalDraft('hitori-room:concert:v1',initial,validate);
const message=ref('先决定预算怎么花，再迎接开演前的小插曲。'),stage=ref(null),busy=ref(false);
const cost=computed(()=>concertCost(state.value.plan));
const remaining=computed(()=>concertBudget-cost.value);
const event=computed(()=>concertEvents.find(e=>e.id===state.value.eventId));
const result=computed(()=>state.value.phase==='result'?resolveConcert(state.value.plan,state.value.eventId,state.value.choiceId):null);
const palette=computed(()=>state.value.plan.lights==='warm'?['#3f3443','#f0cf89','#dfb2ba']:state.value.plan.lights==='colors'?['#352e49','#e4aac5','#a2c9d7']:['#242b45','#afbeda','#d5bd8c']);
const asset=path=>`${import.meta.env.BASE_URL}${path}`;
function launch(){if(!state.value.plan.name.trim()){message.value='先给今晚的演出取个名字吧。';return;}state.value.eventId=shuffled(concertEvents,Date.now())[0].id;state.value.phase='event';state.value.choiceId='';message.value='开演之前，还需要你做一个决定。';}
function decide(choice){try{const outcome=resolveConcert(state.value.plan,state.value.eventId,choice.id);state.value.choiceId=choice.id;state.value.phase='result';state.value.history.unshift({name:outcome.name,grade:outcome.grade,audience:outcome.audience,quality:outcome.quality});state.value.history=state.value.history.slice(0,5);message.value=outcome.ending;}catch(e){message.value=e.message;}}
function again(){state.value.phase='plan';state.value.choiceId='';message.value='下一场，想试试怎样的安排？上次的海报记录还留着。';}
async function poster(){busy.value=true;try{await downloadStage(stage.value,'our-starry-live-poster.png');message.value='今晚的演出海报已生成。';}catch(e){message.value=e.message;}finally{busy.value=false;}}
</script>
<template>
  <section class="room-panel" aria-labelledby="concert-title"><div class="play-heading"><div><p class="play-eyebrow">ONE NIGHT LIVE / 今晚，你是筹备人</p><h2 id="concert-title">让这一晚，响起来。</h2><p class="room-intro">1800 元虚拟预算，三个筹备决定，一次临场应对。每一种安排，都有自己的小小结局。</p></div><span class="play-number" aria-hidden="true">05</span></div>
    <ol class="concert-steps" aria-label="筹备进度"><li :aria-current="state.phase==='plan'?'step':undefined">01 安排筹备</li><li :aria-current="state.phase==='event'?'step':undefined">02 开演之前</li><li :aria-current="state.phase==='result'?'step':undefined">03 散场以后</li></ol>
    <template v-if="state.phase==='plan'">
      <label class="room-field" for="concert-name">给今晚的演出命名<input id="concert-name" v-model="state.plan.name" maxlength="28"></label>
      <dl class="room-stats"><div><dt>筹备总预算</dt><dd>¥ {{concertBudget}}</dd></div><div><dt>已安排</dt><dd>¥ {{cost}}</dd></div><div><dt>留给临场的小意外</dt><dd>¥ {{remaining}}</dd></div></dl>
      <div v-for="(group,key) in concertOptions" :key="key" class="concert-option"><h3>{{group.label}}</h3><div role="group" :aria-label="group.label"><button v-for="option in group.choices" :key="option.id" type="button" :aria-pressed="state.plan[key]===option.id" @click="state.plan[key]=option.id"><span>{{option.label}}</span><strong>¥ {{option.cost}}</strong><small>{{key==='sound'?'让声音更踏实':key==='promo'?'让更多人听见':'给舞台一种心情'}}</small></button></div></div>
      <label class="room-field" for="concert-setlist">演出的心情<select id="concert-setlist" v-model="state.plan.setlist"><option value="together">四个人的合奏 · 默契优先</option><option value="quiet">安静的不插电 · 慢慢开口</option><option value="energy">热烈的安可 · 让气氛亮起来</option></select></label>
      <div class="room-actions"><button id="concert-launch" type="button" class="primary" @click="launch">方案就绪，准备开演 →</button></div>
    </template>
    <div v-else-if="state.phase==='event'" class="concert-event"><span class="play-badge">距离开演，还有十分钟</span><h3>{{event.title}}</h3><p>{{event.text}}</p><p class="play-footer-note">剩余应急预算：¥ {{remaining}}。免费方案也能把故事继续下去。</p><div class="concert-event-choices"><button v-for="choice in event.choices" :key="choice.id" type="button" :disabled="choice.cost>remaining" @click="decide(choice)"><span>{{choice.label}}</span><small>{{choice.cost>remaining?'剩余预算不足':choice.cost?`花费 ¥ ${choice.cost}`:'不增加花费'}}</small></button></div><button type="button" @click="state.phase='plan'">← 返回修改筹备方案</button></div>
    <div v-else-if="result" class="play-split concert-result">
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
      <div><span class="play-badge">散场以后</span><h3>{{result.grade}}</h3><p>{{result.ending}}</p><dl class="room-stats"><div><dt>到场的虚拟观众</dt><dd>{{result.audience}} 人</dd></div><div><dt>舞台完成度</dt><dd>{{result.quality}} / 100</dd></div><div><dt>本场总花费</dt><dd>¥ {{result.spent}}</dd></div></dl><p class="room-intro">无论这一晚是否完美，四个人都站上了舞台。下次，再把某一个小地方做得更好。</p><div class="room-actions"><button type="button" class="primary" :disabled="busy" @click="poster">{{busy?'印制中…':'保存演出海报 ↓'}}</button><button type="button" @click="again">筹备下一场</button></div></div>
    </div>
    <p class="room-status" role="status">{{message}}</p>
    <div v-if="state.history.length" class="concert-history"><h3 class="play-subheading">小小演出档案 · 最近五场</h3><ul><li v-for="(record,index) in state.history" :key="index"><strong>{{record.name}}</strong><span>{{record.grade}} · {{record.audience}} 人 · {{record.quality}} 分</span></li></ul></div>
    <p class="play-footer-note">{{saved?'筹备进度与最近五场结果保存在这台设备。':'浏览器无法保存，本次仍可完成筹备并导出海报。'}} 所有预算、观众与演出结果均为游戏设定；不产生真实交易。</p>
  </section>
</template>
<style scoped>.concert-steps{display:flex;list-style:none;padding:0;gap:20px;border-bottom:1px solid #d9c8bd;margin:0 0 25px;font-size:12px;color:#967c88}.concert-steps li{padding:10px 0}.concert-steps [aria-current]{border-bottom:2px solid #95657f;color:#6b435f}.concert-option{margin:25px 0}.concert-option>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.concert-option button{display:flex;flex-direction:column;align-items:start;text-align:left;gap:10px;padding:18px}.concert-option strong{font:22px var(--mono,monospace)}.concert-option small,.concert-event-choices small{font-size:11px;color:#816958}.concert-event{padding:24px;background:#f0e4dc;border:1px dashed #bb9da7}.concert-event h3{font-size:26px;margin-top:25px}.concert-event-choices{display:grid;gap:12px;margin:25px 0}.concert-event-choices button{flex-direction:column;align-items:start;padding:18px;text-align:left}.concert-result>svg{width:100%;height:auto;max-width:480px}.concert-result h3{font-size:28px;margin-top:22px}.concert-history ul{list-style:none;padding:0}.concert-history li{display:flex;justify-content:space-between;gap:14px;border-bottom:1px solid #dfd0c4;padding:12px 0;font-size:12px}.concert-history span{color:#816958}@media(max-width:600px){.concert-option>div{grid-template-columns:1fr}.concert-option button{display:grid;grid-template-columns:1fr auto;gap:6px;padding:15px}.concert-option small{grid-column:1/-1}.concert-steps{gap:12px;font-size:11px}.concert-history li{flex-direction:column;gap:5px}.concert-event{padding:18px}.concert-event h3{font-size:22px}}</style>
