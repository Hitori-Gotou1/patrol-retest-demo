<script setup>
import '../../styles/review-folio.css';
import PracticeLedger from './PracticeLedger.vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { recordActivity } from '../../room/activityLog.js';
import { onBeforeRouteLeave } from 'vue-router';
import { useInteractionAudio } from '../../composables/useInteractionAudio.js';
import { practiceKey, emptyPractice, validatePractice, startPractice, advancePractice, remainingPractice, pausePractice, resumePractice, practiceStreak, actualPracticeSeconds, finishPracticeEarly, editPracticeRecord } from '../../room/practice.js';
import { practiceTransaction } from '../../room/practiceTransaction.js';
import { loadLocal, saveLocal, downloadJson } from '../../room/storage.js';
const store = ref(loadLocal(practiceKey, emptyPractice, validatePractice));
const minutes = ref(25), breakMinutes = ref(5), alarm = ref(false), now = ref(Date.now()), message = ref(''), busy = ref(false);
const track = ref(''), goal = ref(''), reflection = ref(''), ending = ref(false), endPanel = ref(null), editing = ref(''), editReflection = ref('');
const audio = useInteractionAudio('practice-clock');
let timer, storageWorking = true, alive = true, leaving = false, endWasRunning = false;
const current = computed(() => store.value.current);
const remaining = computed(() => current.value ? Math.ceil(remainingPractice(current.value, now.value) / 1000) : (Number.isInteger(minutes.value) && minutes.value >= 1 && minutes.value <= 180 ? minutes.value * 60 : 0));
const clock = computed(() => `${String(Math.floor(remaining.value / 60)).padStart(2,'0')}:${String(remaining.value % 60).padStart(2,'0')}`);
const phaseLabel = computed(() => !current.value ? '准备开始' : ({ focus: '专注练习', break: '休息一下', 'paused-focus': '练习已暂停', 'paused-break': '休息已暂停' })[current.value.phase]);
const streak = computed(() => practiceStreak(store.value.records, now.value));
const recent = computed(() => store.value.records.slice().reverse().slice(0, 15));
const actual = computed(() => actualPracticeSeconds(current.value, now.value));
const duration = seconds => seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
const plan = computed(() => current.value ? current.value.minutes * 60 : remaining.value);
const worked = computed(() => current.value?.phase.endsWith('break') ? plan.value : actual.value);
function fresh() {
  if (!storageWorking) return store.value;
  try { const raw = localStorage.getItem(practiceKey); return raw ? validatePractice(JSON.parse(raw)) : structuredClone(emptyPractice); }
  catch { return store.value; }
}
async function transact(change) {
  if (busy.value) return false;
  busy.value = true;
  try {
    if (storageWorking) store.value = await practiceTransaction(change);
    else { store.value = validatePractice(change(store.value)); saveLocal(practiceKey, store.value); }
    return true;
  } catch (error) {
    let usable = false;
    try { localStorage.setItem(`${practiceKey}:probe`, '1'); localStorage.removeItem(`${practiceKey}:probe`); usable = true; } catch { /* In-memory timer remains available. */ }
    if (!usable) {
      storageWorking = false; store.value = validatePractice(change(store.value));
      message.value = '浏览器无法保存，计时仅在本页有效；离开前可导出练习记录。'; return true;
    }
    message.value = error.message || '记录未能保存，请稍后重试。'; return false;
  } finally { busy.value = false; }
}
async function update() {
  now.value = Date.now();
  if (busy.value || !current.value || current.value.phase.startsWith('paused-') || now.value < current.value.deadline) return;
  let completed = null;
  const ok = await transact(latest => {
    const next = advancePractice(latest, now.value);
    if (latest.current?.phase === 'focus' && next.records.some(record => record.id === latest.current.id) && !latest.records.some(record => record.id === latest.current.id)) completed = latest.current;
    return next;
  });
  if (!ok || !alive) return;
  if (completed) {
    recordActivity('practice', `认真练习了 ${completed.minutes} 分钟${completed.track ? ` · ${completed.track}` : ''}`, completed.id);
    message.value = storageWorking ? '这一轮练习已完成并记录，可以在近期记录补上心得。' : '练习已完成，记录仅本次有效，请导出。';
    if (completed.alarm && !leaving && !document.hidden && now.value - completed.deadline <= 2000) audio.play('chord');
  } else if (!current.value) message.value = '休息结束。准备好后，再开始下一轮。';
}
async function start() {
  leaving = false;
  const startedAt = Date.now();
  try {
    let created;
    const ok = await transact(latest => {
      if (latest.current) { message.value = '已恢复另一个标签页的当前计时。'; return latest; }
      const next = startPractice(latest, startedAt, minutes.value, breakMinutes.value, crypto.randomUUID(), { track: track.value, goal: goal.value, reflection: reflection.value });
      next.current.alarm = alarm.value; created = next.current; return next;
    });
    now.value = Date.now();
    if (ok && created) {
      if (storageWorking) message.value = '这一轮开始了，慢慢来。';
      if (alarm.value) audio.setEnabled(true).then(ready => { if (alive && current.value?.id === created.id && !ready) message.value = '计时已开始，浏览器暂未开启提示音。'; });
    }
  } catch (error) { message.value = error.message; }
}
async function act(change) {
  const id = current.value?.id;
  return transact(latest => {
    if (latest.current?.id !== id) { message.value = '已同步另一个标签页的计时。'; return latest; }
    return change(latest);
  });
}
async function pause() { const at = Date.now(); await update(); await act(latest => pausePractice(latest, at)); now.value = at; }
async function resume() { const at = Date.now(); await act(latest => resumePractice(latest, at)); now.value = at; }
async function askEnd() {
  endWasRunning = current.value && !current.value.phase.startsWith('paused-');
  await pause();
  if (!current.value) return;
  reflection.value = current.value.reflection || ''; ending.value = true;
  await nextTick(); endPanel.value?.focus();
}
async function end(saveActual) {
  const before = current.value, seconds = actual.value;
  if (await act(latest => finishPracticeEarly(latest, Date.now(), saveActual, reflection.value))) {
    audio.stop(); ending.value = false;
    if (saveActual && seconds > 0 && before?.phase.endsWith('focus')) {
      recordActivity('practice', `实际练习 ${duration(seconds)}${before.track ? ` · ${before.track}` : ''}`, before.id);
      message.value = `已保存实际练习 ${duration(seconds)}，计划 ${before.minutes} 分钟。`;
    } else message.value = '本轮已结束，未新增练习记录。';
  }
}
async function cancelEnd() { ending.value = false; if (endWasRunning) await resume(); }
function beginEdit(record) { editing.value = record.id; editReflection.value = record.reflection; }
async function saveReflection() { if (await transact(latest => editPracticeRecord(latest, editing.value, { reflection: editReflection.value }))) { editing.value = ''; message.value = '心得已收好。'; } }
function sync(event) {
  try { if (event.type === 'hitori:sync-applied' || (event.storageArea === localStorage && (event.key === practiceKey || event.key === null))) { store.value = fresh(); if (!current.value) ending.value = false; update(); } } catch { /* Keep the in-memory timer. */ }
}
onMounted(() => { update(); timer = setInterval(update, 500); window.addEventListener('storage', sync); window.addEventListener('hitori:sync-applied', sync); document.addEventListener('visibilitychange', update); });
onBeforeRouteLeave(() => { leaving = true; audio.stop(); });
onBeforeUnmount(() => { alive = false; clearInterval(timer); audio.stop(); window.removeEventListener('storage', sync); window.removeEventListener('hitori:sync-applied', sync); document.removeEventListener('visibilitychange', update); });
</script>
<template>
  <section class="room-panel review-folio practice-room" aria-labelledby="practice-title"><h2 id="practice-title">给今天，留一段练习。</h2><p class="room-intro">写下曲目和想练好的小事。暂停不计时，刷新后继续；同一浏览器的标签页共用一轮计时。</p>
    <div class="practice-session" :class="{ 'is-timing':current }"><div class="practice-setup"><div class="room-fields"><label class="room-field" for="practice-track">曲目或练习内容<input id="practice-track" v-model="track" maxlength="80" :disabled="Boolean(current)" placeholder="例如：第一次扫弦"></label><label class="room-field" for="practice-goal">今天的目标<input id="practice-goal" v-model="goal" maxlength="120" :disabled="Boolean(current)" placeholder="例如：把副歌慢速弹顺"></label><label class="room-field" for="focus-minutes">计划练习（分钟）<input id="focus-minutes" v-model.number="minutes" type="number" min="1" max="180" :disabled="Boolean(current)"></label><label class="room-field" for="break-minutes">休息（0 表示不休息）<input id="break-minutes" v-model.number="breakMinutes" type="number" min="0" max="60" :disabled="Boolean(current)"></label></div>
    <label class="room-check"><input v-model="alarm" type="checkbox" :disabled="Boolean(current)">本页结束提示音（开始时开启互动音效）</label></div>
    <div class="practice-clock">
      <p role="status">{{ phaseLabel }}</p>
      <strong id="practice-clock" role="timer">{{ clock }}</strong>
      <span v-if="current">{{ current.track || '今天的练习' }}<template v-if="current.goal"> · {{ current.goal }}</template></span>
      <label class="practice-meter">
        <span>已练 {{ duration(worked) }}</span><span>计划 {{ duration(plan) }}</span>
        <progress :max="Math.max(1,plan)" :value="worked" :aria-valuetext="`已练 ${duration(worked)}，计划 ${duration(plan)}`"></progress>
      </label>
    </div></div>
    <div class="room-actions"><button v-if="!current" id="practice-start" type="button" class="primary" :disabled="busy" @click="start">开始练习</button><button v-else-if="current.phase.startsWith('paused-')" type="button" class="primary" :disabled="busy || ending" @click="resume">继续计时</button><button v-else type="button" class="primary" :disabled="busy || ending" @click="pause">暂停计时</button><button v-if="current" type="button" :disabled="busy || ending" @click="askEnd">结束本轮</button><button type="button" @click="downloadJson(store,'hitori-room-practice.json')">导出练习记录</button></div>
    <div v-if="ending" ref="endPanel" class="practice-end" tabindex="-1" aria-labelledby="practice-end-title" @keydown.esc.prevent="cancelEnd"><h3 id="practice-end-title">今天先练到这里？</h3><template v-if="current?.phase.endsWith('focus')"><p>已暂停。计划 {{ current.minutes }} 分钟，实际完成 {{ duration(actual) }}。可以保存实际时长，也可以放弃本轮。</p><label class="room-field">简短心得<textarea v-model="reflection" maxlength="240" rows="2" placeholder="今天哪一点更顺手了？"></textarea></label><div class="room-actions"><button type="button" class="primary" :disabled="busy || actual < 1" @click="end(true)">保存实际时长并结束</button><button type="button" :disabled="busy" @click="end(false)">不记账，结束</button><button type="button" :disabled="busy" @click="cancelEnd">继续这一轮</button></div></template><template v-else><p>练习已经记录。现在结束休息不会重复记账。</p><div class="room-actions"><button type="button" :disabled="busy" @click="end(false)">结束休息</button><button type="button" @click="cancelEnd">继续休息</button></div></template></div>
    <dl class="room-stats"><div><dt>累计实际练习</dt><dd id="practice-total" :title="duration(store.totalSeconds)">{{ store.totalSeconds >= 60 ? store.totalMinutes + ' 分钟' : duration(store.totalSeconds) }}</dd></div><div><dt>已记录轮次</dt><dd>{{ store.totalSessions }}</dd></div><div><dt>近期连续练习</dt><dd>{{ streak }} 天</dd></div></dl>
    <p class="room-status" role="status">{{ message }}</p>
    <PracticeLedger :records="store.records" :now="now" />
    <h3>近期练习</h3><ol v-if="recent.length" class="practice-records"><li v-for="record in recent" :key="record.id"><div><time>{{ record.date }}</time><strong>{{ record.track || '今天的练习' }}</strong><span>实际 {{ duration(record.actualSeconds) }} / 计划 {{ record.plannedMinutes }} 分钟{{ record.endedEarly ? ' · 提前收工' : '' }}</span><p v-if="record.goal">目标：{{ record.goal }}</p><p v-if="record.reflection">心得：{{ record.reflection }}</p></div><button v-if="editing !== record.id" type="button" @click="beginEdit(record)">写心得</button><div v-else class="practice-reflection"><label class="room-field">这一轮的心得<textarea v-model="editReflection" maxlength="240" rows="2"></textarea></label><div class="room-actions"><button type="button" :disabled="busy" @click="saveReflection">收好心得</button><button type="button" @click="editing = ''">取消</button></div></div></li></ol><p v-else class="room-hint">还没有练习记录。今天先留一分钟，也很好。</p>
    <p class="room-hint">实际时长按秒保存，日期按设备本地时间。练习本保留最近 365 次明细，累计统计会继续保留。旧练习记录仍可读取，导出继续使用独立练琴 JSON。</p>
  </section>
</template>
<style scoped>
.practice-session { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,1fr); gap:12px; align-items:stretch; margin:18px 0 12px; }
.practice-setup { min-width:0; display:grid; align-content:center; }
.practice-setup :is(input,textarea) { min-width:0; }
.practice-clock { display:grid; align-content:center; padding:16px; text-align:center; background:#f2dece; border:1px solid #c29c9b; color:#513b4c; }
.practice-clock>p { font-size:13px; margin:0; }
.practice-clock>strong { font:600 clamp(45px,9vw,83px)/1.25 var(--mono,monospace); letter-spacing:-.06em; }
.practice-clock>span { font-size:13px; overflow-wrap:anywhere; }
.practice-meter { display:grid; grid-template-columns:1fr 1fr; gap:6px 11px; margin-top:10px; font-size:12px; color:inherit; text-align:left; font-variant-numeric:tabular-nums; }
.practice-meter span:nth-child(2) { text-align:right; }
.practice-meter progress { grid-column:1/-1; width:100%; height:11px; border:1px solid #8d677a; border-radius:1px; appearance:none; background:#fdf2e3; color:#8f5275; }
.practice-meter progress::-webkit-progress-bar { background:#fdf2e3; }
.practice-meter progress::-webkit-progress-value { background:#8f5275; }
.practice-meter progress::-moz-progress-bar { background:#8f5275; }
.practice-end { border:1px solid #ac829b; padding:18px; background:#f7e9ec; margin:15px 0; }
.practice-end h3 { margin-top:0; }.practice-end p { font-size:13px; line-height:1.8; }
.practice-records { list-style:none; margin:0; padding:0; }
.practice-records li { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-start; gap:12px; border-top:1px solid #dcc7cf; padding:16px 0; }
.practice-records li>div:first-child { display:grid; gap:5px; min-width:0; flex:1; overflow-wrap:anywhere; }
.practice-records time,.practice-records span,.practice-records p { font-size:12px; margin:0; }
.practice-records time { color:#795367; }.practice-records strong { font-size:15px; }.practice-reflection { flex-basis:100%; }
@media(max-width:720px) {
  .practice-session { grid-template-columns:minmax(0,1fr); }
  .practice-session.is-timing .practice-clock { order:-1; }
}
</style>
