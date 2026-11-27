<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { dateKey } from '../../room/practice.js';

const props = defineProps({ records:{ type:Array, required:true }, now:{ type:Number, required:true } });
const range = ref('week');
const offset = ref(0);
const chosen = ref('');
const strip = ref(null);
const today = computed(() => dateKey(props.now));
const recordsByDate = computed(() => {
  const groups = new Map();
  for (const record of props.records) {
    if (!groups.has(record.date)) groups.set(record.date, []);
    groups.get(record.date).push(record);
  }
  return groups;
});
const from = computed(() => {
  const date = new Date(today.value + 'T12:00:00');
  if (range.value === 'month') date.setMonth(date.getMonth() + offset.value, 1);
  else date.setDate(date.getDate() - 6 + offset.value * 7);
  return date;
});
const days = computed(() => {
  const start = from.value;
  const length = range.value === 'month' ? new Date(start.getFullYear(),start.getMonth() + 1,0).getDate() : 7;
  return Array.from({ length }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    const key = dateKey(date);
    const records = recordsByDate.value.get(key) || [];
    return { key, records, seconds:records.reduce((sum, record) => sum + record.actualSeconds, 0) };
  });
});
const total = computed(() => days.value.reduce((sum, date) => sum + date.seconds,0));
const limit = computed(() => Math.max(60,...days.value.map(day => day.seconds)));
const selected = computed(() => days.value.find(day => day.key === chosen.value));
const label = computed(() => range.value === 'month'
  ? from.value.toLocaleDateString('zh-CN',{ year:'numeric',month:'long' })
  : `${days.value[0].key.slice(5)} 至 ${days.value.at(-1).key.slice(5)}`);
const exact = seconds => seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;

function reveal() {
  nextTick(() => {
    const row = strip.value;
    const day = row?.querySelector('[aria-pressed="true"]');
    if (!day) return;
    const left = day.offsetLeft;
    if (left < row.scrollLeft) row.scrollLeft = left;
    else if (left + day.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = left + day.offsetWidth - row.clientWidth;
  });
}
watch(days, value => {
  if (!value.some(day => day.key === chosen.value)) {
    chosen.value = (value.find(day => day.key === today.value)
      || value.findLast(day => day.seconds) || value.at(-1)).key;
  }
  reveal();
}, { immediate:true });
watch(chosen,reveal);

function changeRange() {
  offset.value = 0;
  chosen.value = '';
}
function turn(amount) {
  offset.value = Math.min(0,offset.value + amount);
  chosen.value = '';
}
</script>

<template>
  <section class="practice-trend" aria-labelledby="practice-ledger-title">
    <header class="ledger-head">
      <div><h3 id="practice-ledger-title">练习本</h3><p>{{ label }} · 实际练习 {{ exact(total) }}</p></div>
      <div class="ledger-controls">
        <label>查看 <select v-model="range" @change="changeRange"><option value="week">最近一周</option><option value="month">按月查看</option></select></label>
        <div class="ledger-turn">
          <button type="button" :aria-label="range==='month' ? '上个月' : '上一周'" @click="turn(-1)">←</button>
          <button type="button" :aria-label="range==='month' ? '下个月' : '下一周'" :disabled="offset===0" @click="turn(1)">→</button>
        </div>
      </div>
    </header>
    <div class="ledger-content">
      <div class="ledger-plot">
        <div ref="strip" class="ledger-dates" :class="{ 'is-month':range==='month' }" role="group" :aria-label="label + '练习日期'">
          <button v-for="day in days" :key="day.key" type="button" class="ledger-day" :data-date="day.key"
            :aria-pressed="chosen===day.key" :data-seconds="day.seconds"
            :aria-label="`${day.key}，${day.records.length ? day.records.length + ' 次，' + exact(day.seconds) : '无练习记录'}`"
            @click="chosen=day.key">
            <time :datetime="day.key">{{ range==='month' ? Number(day.key.slice(-2)) : day.key.slice(5).replace('-','/') }}</time>
            <span class="date-tick" aria-hidden="true"></span>
            <span class="day-notes" aria-hidden="true">
              <i v-if="day.seconds" :style="{ height:Math.max(5, day.seconds/limit*61)+'px' }"></i>
            </span>
            <span v-if="day.seconds" class="trend-value">{{ day.seconds < 60 ? day.seconds+' 秒' : Math.floor(day.seconds/60)+' 分' }}</span>
          </button>
        </div>
      </div>
      <div v-if="selected" class="ledger-detail" aria-live="polite">
        <h4><time :datetime="selected.key">{{ selected.key }}</time></h4>
        <p v-if="selected.records.length"><strong>{{ selected.records.length }} 次 · {{ exact(selected.seconds) }}</strong></p>
        <p v-else>这天没有留下练习记录。</p>
        <ol v-if="selected.records.length">
          <li v-for="record in selected.records.slice().reverse()" :key="record.id">
            <strong>{{ record.track || '今天的练习' }}</strong><span>{{ exact(record.actualSeconds) }}</span>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<style scoped>
.practice-trend { --ledger-ink:#513c47; --ledger-line:#c5a99e; margin:24px 0; min-width:0; border:1px solid var(--ledger-line); background:#fff5df; color:var(--ledger-ink); }
.ledger-head { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; padding:13px 17px; border-bottom:1px solid var(--ledger-line); background:#efdeca; }
.ledger-head h3,.ledger-detail h4 { margin:0; line-height:1.35; color:inherit; }
.ledger-head p,.ledger-detail p { margin:4px 0 0; color:inherit; font-size:13px; }
.ledger-controls,.ledger-controls label,.ledger-turn { display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:12px; }
.ledger-controls select,.ledger-turn button { min-height:44px; }
.ledger-turn button { min-width:44px; padding:3px 8px; }
.ledger-content { display:grid; grid-template-columns:minmax(0,1.9fr) minmax(190px,.72fr); }
.ledger-plot { min-width:0; padding:8px; }
.ledger-dates { position:relative; display:grid; grid-auto-flow:column; grid-auto-columns:minmax(37px,1fr); overflow:auto hidden; scrollbar-width:thin; padding:3px 2px 6px; }
.ledger-dates.is-month { grid-auto-columns:minmax(45px,1fr); }
.ledger-day { display:grid; grid-template-rows:21px 6px 62px 20px; align-items:center; justify-items:center; color:var(--ledger-ink); padding:5px 1px; min-width:0; min-height:108px; text-align:center; background:transparent; border:1px solid transparent; font:12px var(--mono,monospace); }
.ledger-day[aria-pressed="true"] { background:#ead4da; border-color:#926c80; }
.ledger-day:focus-visible { outline:2px solid #61374e; outline-offset:-2px; }
.ledger-day time { white-space:nowrap; }
.date-tick { width:100%; height:6px; position:relative; background:linear-gradient(to bottom,transparent 4px,var(--ledger-line) 4px,var(--ledger-line) 5px,transparent 5px); }
.date-tick:after { content:''; position:absolute; top:0; border-left:1px solid #8e7080; height:6px; }
.day-notes { width:100%; height:100%; display:grid; align-items:start; justify-items:center; }
.day-notes i { width:45%; max-width:20px; display:block; background:#8c526e; border-radius:0 0 3px 3px; }
.trend-value { font-size:11px; white-space:nowrap; }
.ledger-detail { min-width:0; border-left:1px solid var(--ledger-line); padding:13px; background:#fffaf0; overflow-wrap:anywhere; }
.ledger-detail ol { display:grid; gap:6px; list-style:none; margin:8px 0 0; padding:0; }
.ledger-detail li { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:baseline; gap:6px; border-top:1px solid #dac7bd; padding-top:5px; font-size:12px; }
.ledger-detail li span { font-variant-numeric:tabular-nums; }
@media(max-width:720px) {
  .ledger-content { grid-template-columns:minmax(0,1fr); }
  .ledger-detail { border-left:0; border-top:1px solid var(--ledger-line); }
  .ledger-head { padding:9px 10px; }
  .ledger-plot { padding:4px; }
  .ledger-day { grid-template-rows:22px 6px 52px 20px; font-size:11px; }
  .day-notes i { max-height:52px; }
}
</style>
