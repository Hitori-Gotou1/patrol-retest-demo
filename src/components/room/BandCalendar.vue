<script setup>
import { computed, ref } from 'vue';
import CalendarSymbol from './CalendarSymbol.vue';
import { bandEvents, calendarChecked } from '../../data/calendar.js';
import { eventsInYear, makeIcal } from '../../room/calendar.js';
import { loadLocal, saveLocal } from '../../room/storage.js';
import { countEvent } from '../../services/analytics.js';

const kinds = ['生日', '演出', '发售', '纪念'];
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const year = ref(now.getFullYear());
const month = ref(now.getMonth() + 1);
const kind = ref('all');
const onlyMine = ref(false);
const message = ref('');
const chosenDate = ref('');
const following = ref(loadLocal('hitori-room:calendar-follow:v1', [], value => {
  if (!Array.isArray(value)) throw new Error();
  return value.filter(id => bandEvents.some(event => event.id === id));
}));
const validYear = computed(() => Number.isInteger(year.value) && year.value >= 2000 && year.value <= 2100);
const prefix = computed(() => `${year.value}-${String(month.value).padStart(2, '0')}-`);
const included = event => (kind.value === 'all' || event.kind === kind.value) && (!onlyMine.value || following.value.includes(event.id));
const monthly = computed(() => validYear.value ? eventsInYear(bandEvents, year.value).filter(event => event.date.startsWith(prefix.value) && included(event)) : []);
const activeDate = computed(() => {
  if (chosenDate.value.startsWith(prefix.value)) return chosenDate.value;
  return monthly.value[0]?.date || (today.startsWith(prefix.value) ? today : prefix.value + '01');
});
const agenda = computed(() => monthly.value.filter(event => event.date === activeDate.value));
const cells = computed(() => {
  if (!validYear.value) return [];
  const first = new Date(Date.UTC(year.value, month.value - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(year.value, month.value, 0)).getUTCDate();
  const days = Array.from({ length }, (_, index) => {
    const date = prefix.value + String(index + 1).padStart(2, '0');
    return { day: index + 1, date, events: monthly.value.filter(event => event.date === date) };
  });
  return [...Array(first).fill(null), ...days, ...Array((7 - (length + first) % 7) % 7).fill(null)];
});
const upcoming = computed(() => [...eventsInYear(bandEvents, now.getFullYear()), ...eventsInYear(bandEvents, now.getFullYear() + 1)]
  .filter(event => event.date >= today).slice(0, 7));

function navigate(delta) {
  const date = new Date(validYear.value ? year.value : now.getFullYear(), month.value - 1 + delta, 1);
  if (date.getFullYear() < 2000 || date.getFullYear() > 2100) return;
  year.value = date.getFullYear();
  month.value = date.getMonth() + 1;
  chosenDate.value = '';
}
function currentMonth() {
  year.value = now.getFullYear();
  month.value = now.getMonth() + 1;
  chosenDate.value = '';
}
function openUpcoming(event) {
  year.value = Number(event.date.slice(0, 4));
  month.value = Number(event.date.slice(5, 7));
  chosenDate.value = event.date;
  onlyMine.value = false;
  kind.value = 'all';
}
function follow(event) {
  const wasFollowing = following.value.includes(event.id);
  following.value = wasFollowing ? following.value.filter(id => id !== event.id) : [...following.value, event.id];
  if (!wasFollowing) countEvent('favorite', 'calendar');
  message.value = saveLocal('hitori-room:calendar-follow:v1', following.value) ? '关注已保存在本机。' : '本机暂不能保存，可导出日历。';
}
function exportCalendar() {
  try {
    const text = makeIcal(bandEvents.filter(included), year.value);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'hitori-band-calendar.ics' });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message.value = '日历已生成，可以导入日历应用。';
  } catch (error) {
    message.value = error.message;
  }
}
</script>

<template>
  <section class="room-panel calendar-room" aria-labelledby="calendar-title">
    <header class="activity-title">
      <p class="play-eyebrow">结束乐队挂历</p>
      <h2 id="calendar-title">下一次相遇，在什么时候？</h2>
      <p class="room-intro">公开演出、发售日和角色纪念日。日程核对于 {{ calendarChecked }}，变动请查看官方来源。</p>
    </header>
    <div class="calendar-spread">
      <div class="calendar-sheet">
        <div class="calendar-binding" aria-hidden="true"><span v-for="ring in 7" :key="ring"></span></div>
        <div class="calendar-controls">
          <button aria-label="上个月" type="button" @click="navigate(-1)">←</button>
          <strong aria-live="polite">{{ validYear ? year + ' 年 ' + month + ' 月' : '请选择年份' }}</strong>
          <button aria-label="下个月" type="button" @click="navigate(1)">→</button>
          <button type="button" class="calendar-today" @click="currentMonth">回到本月</button>
        </div>
        <div v-if="validYear" class="calendar-month">
          <span v-for="day in ['日','一','二','三','四','五','六']" :key="day" class="calendar-weekday">{{ day }}</span>
          <template v-for="(cell, index) in cells" :key="index">
            <span v-if="!cell" class="calendar-cell-empty" aria-hidden="true"></span>
            <button v-else class="calendar-date" type="button" :aria-pressed="activeDate === cell.date"
              :aria-label="`${month} 月 ${cell.day} 日${cell.events.length ? '，' + cell.events.map(e => e.title).join('、') : ''}`"
              :aria-current="cell.date === today ? 'date' : undefined" @click="chosenDate = cell.date">
              <strong>{{ cell.day }}</strong>
              <span v-if="cell.events.length" class="calendar-cell-events">
                <span class="calendar-cell-icon" :data-kind="cell.events[0].kind"><CalendarSymbol :kind="cell.events[0].kind"/></span>
                <span v-if="cell.events.length > 1" class="calendar-count">{{ cell.events.length }}</span>
                <span v-if="cell.events.some(event => following.includes(event.id))" class="calendar-bookmark" aria-label="已关注"></span>
                <span class="calendar-label">{{ cell.events[0].title }}</span>
              </span>
            </button>
          </template>
        </div>
        <p v-else class="calendar-invalid">年份范围为 2000 至 2100 年。</p>
        <ul class="calendar-legend">
          <li v-for="type in kinds" :key="type" :data-kind="type"><CalendarSymbol :kind="type"/>{{ type }}</li>
          <li><span class="calendar-bookmark"></span>已关注</li>
        </ul>
      </div>
      <div class="calendar-side">
        <div class="calendar-filters">
          <label class="room-field">年份<input v-model.number="year" type="number" min="2000" max="2100" @input="chosenDate = ''"></label>
          <label class="room-field">类型<select v-model="kind"><option value="all">全部类型</option><option v-for="type in kinds" :key="type">{{ type }}</option></select></label>
          <label class="room-check"><input v-model="onlyMine" type="checkbox">只看我关注的日程</label>
        </div>
        <section v-if="validYear" class="calendar-agenda" aria-labelledby="calendar-agenda-title">
          <h3 id="calendar-agenda-title">{{ month }} 月 {{ Number(activeDate.slice(8)) }} 日的日程</h3>
          <p v-if="!agenda.length" class="calendar-empty" role="status">{{ monthly.length ? '这一天没有收录相应日程。' : '这个月暂时没有收录相应日程。' }}</p>
          <article v-for="event in agenda" :id="'event-' + event.id" :key="event.id" class="calendar-event">
            <p class="calendar-event-kind" :data-kind="event.kind"><CalendarSymbol :kind="event.kind"/>{{ event.kind }} <span v-if="event.date < today">· 已过去</span></p>
            <h4>{{ event.title }}</h4>
            <p>{{ event.description }}</p>
            <div class="resource-actions">
              <button type="button" :aria-pressed="following.includes(event.id)" @click="follow(event)">{{ following.includes(event.id) ? '已关注 ✓' : '关注这一天 ＋' }}</button>
              <a :href="event.source" target="_blank" rel="noopener noreferrer">官方来源 ↗</a>
            </div>
          </article>
        </section>
        <div class="room-actions"><button id="calendar-export" type="button" @click="exportCalendar">导出{{ onlyMine ? '关注' : '本年' }}日历 ICS ↓</button></div>
        <p class="room-status" role="status">{{ message }}</p>
      </div>
    </div>
    <section class="calendar-upcoming">
      <h3>接下来的日子</h3>
      <ul><li v-for="event in upcoming" :key="event.id + event.date"><button type="button" @click="openUpcoming(event)">{{ event.date }} · {{ event.title }}</button></li></ul>
    </section>
  </section>
</template>

<style scoped>
.calendar-spread { display:grid; grid-template-columns:minmax(0,1.8fr) minmax(250px,1fr); gap:clamp(12px,2.7vw,30px); align-items:start; }
.calendar-sheet { min-width:0; position:relative; background:#fffbf0; border:1px solid #c0aa91; padding:22px 12px 9px; box-shadow:2px 4px 0 #ded1b9,4px 8px 0 #e9dbc5; }
.calendar-binding { display:grid; grid-template-columns:repeat(7,1fr); position:absolute; top:-8px; inset-inline:6%; justify-items:center; }
.calendar-binding span { display:block; width:8px; height:19px; border:2px solid #806454; background:#d4bc97; border-radius:8px; box-shadow:1px 1px #92765b; }
.calendar-controls { display:grid; grid-template-columns:44px minmax(0,1fr) 44px auto; align-items:center; gap:5px; margin:0 0 8px; }
.calendar-controls strong { font-size:clamp(17px,3vw,27px); color:#44323c; text-align:center; }
.calendar-controls button { min-height:44px; padding:4px 8px; }
.calendar-month { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:0; border-left:1px solid #cdbca4; border-top:1px solid #cdbca4; }
.calendar-weekday { text-align:center; color:#6d554b; padding:5px 0; font-size:11px; background:#f4e7d0; }
.calendar-weekday,.calendar-cell-empty,.calendar-month .calendar-date { border:0; border-right:1px solid #cdbca4; border-bottom:1px solid #cdbca4; }
.calendar-cell-empty { background:#f4ebd9; }
.calendar-month .calendar-date { min-height:66px; min-width:0; background:transparent; padding:5px; display:grid; grid-template-rows:auto 1fr; justify-items:start; align-items:start; text-align:left; color:#493845; }
.calendar-date strong { font-size:21px; line-height:1.08; font-variant-numeric:tabular-nums; }
.calendar-month .calendar-date[aria-pressed=true] { background:#f5e2d1; box-shadow:inset 0 0 0 2px #915c59; }
.calendar-date:focus-visible { z-index:1; }
.calendar-cell-events { display:flex; flex-wrap:wrap; align-items:center; gap:1px 4px; width:100%; min-width:0; margin-top:4px; }
.calendar-symbol { width:19px; height:19px; flex:0 0 auto; vertical-align:middle; }
.calendar-count { font-size:11px; font-weight:700; }
.calendar-bookmark { display:inline-block; width:8px; height:12px; background:#7b435f; clip-path:polygon(0 0,100% 0,100% 100%,50% 75%,0 100%); }
.calendar-label { font-size:10px; line-height:1.28; width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
[data-kind='生日'] { color:#913f58; } [data-kind='发售'] { color:#42657d; }
[data-kind='演出'] { color:#85502e; } [data-kind='纪念'] { color:#42694e; }
.calendar-legend { display:flex; flex-wrap:wrap; gap:4px 12px; padding:0; list-style:none; margin:9px 0 0; font-size:11px; }
.calendar-legend li { display:flex; align-items:center; gap:3px; }
.calendar-legend .calendar-symbol { width:15px; height:15px; }
.calendar-filters { display:grid; grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr); align-items:start; gap:7px; }
.calendar-filters .room-field { margin:0; }
.calendar-filters .room-check { grid-column:1/-1; min-height:38px; align-items:center; }
.calendar-agenda { background:#fff9eb; border-left:3px solid #99687c; padding:10px 13px 12px; margin-top:8px; }
.calendar-agenda h3 { font-size:16px; margin:0 0 7px; }
.calendar-empty,.calendar-invalid { font-size:13px; margin:0; }
.calendar-agenda .calendar-event { padding:8px 0 0; margin:0; background:none; border:0; border-top:1px solid #d9c5ad; }
.calendar-event h4 { font-size:17px; margin:5px 0; line-height:1.45; overflow-wrap:anywhere; }
.calendar-event p { font-size:13px; margin:3px 0; }
.calendar-event-kind { display:flex; align-items:center; gap:5px; }
.calendar-event .resource-actions { margin:6px 0 0; }
.calendar-upcoming { border-top:1px solid #c8b49e; padding:8px 0 0; margin-top:20px; }
.calendar-upcoming h3 { margin:3px 0 8px; }
.calendar-upcoming ul { padding:0; list-style:none; display:flex; flex-wrap:wrap; gap:6px; }
.calendar-upcoming button { min-height:44px; text-align:left; overflow-wrap:anywhere; }
@media(max-width:760px) {
  .calendar-spread { grid-template-columns:minmax(0,1fr); }
  .calendar-sheet { padding-inline:4px; }
  .calendar-controls { gap:2px; }
  .calendar-controls button { font-size:11px; }
  .calendar-month .calendar-date { min-height:48px; padding:3px 2px; place-items:center; }
  .calendar-date strong { font-size:16px; }
  .calendar-cell-events { width:auto; justify-content:center; gap:1px 2px; margin-top:1px; }
  .calendar-cell-icon .calendar-symbol { width:15px; height:15px; }
  .calendar-label { display:none; }
  .calendar-legend { gap:3px 7px; justify-content:center; }
  .calendar-side { display:flex; flex-direction:column; }
  .calendar-agenda { order:-1; margin:4px 0 10px; }
}
</style>
