<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { recordActivity } from '../../room/activityLog.js';
import { onBeforeRouteLeave } from 'vue-router';
import { useInteractionAudio } from '../../composables/useInteractionAudio.js';
import { practiceKey, emptyPractice, validatePractice, startPractice, advancePractice, remainingPractice, pausePractice, resumePractice, practiceStreak } from '../../room/practice.js';
import { loadLocal, saveLocal, downloadJson } from '../../room/storage.js';
const store = ref(loadLocal(practiceKey, emptyPractice, validatePractice));
const minutes = ref(25), breakMinutes = ref(5), alarm = ref(false), now = ref(Date.now()), message = ref('');
const audio = useInteractionAudio('practice-clock');
let timer, storageWorking = true, alive = true, leaving = false;
const current = computed(() => store.value.current);
const remaining = computed(() => current.value ? Math.ceil(remainingPractice(current.value, now.value) / 1000) : (Number.isInteger(minutes.value) && minutes.value >= 1 && minutes.value <= 180 ? minutes.value * 60 : 0));
const clock = computed(() => `${String(Math.floor(remaining.value / 60)).padStart(2,'0')}:${String(remaining.value % 60).padStart(2,'0')}`);
const phaseLabel = computed(() => !current.value ? '准备开始' : ({ focus: '专注练习', break: '休息一下', 'paused-focus': '练习已暂停', 'paused-break': '休息已暂停' })[current.value.phase]);
const streak = computed(() => practiceStreak(store.value.records, now.value));
function fresh() {
  if (!storageWorking) return store.value;
  try { const raw = localStorage.getItem(practiceKey); return raw ? validatePractice(JSON.parse(raw)) : structuredClone(emptyPractice); }
  catch { storageWorking = false; return store.value; }
}
function commit(value) {
  store.value = value;
  storageWorking = saveLocal(practiceKey, value);
  if (!storageWorking) message.value = '当前浏览器无法保存记录，刷新前可导出本次记录。';
}
function update() {
  now.value = Date.now();
  const next = advancePractice(store.value, now.value);
  if (next === store.value) return;
  const latest = fresh();
  if (latest.current?.id !== store.value.current?.id) { store.value = latest; return; }
  const completed = latest.current?.phase === 'focus';
  const sound = latest.current?.alarm;
  commit(advancePractice(latest, now.value));
  if (completed) {
    recordActivity('practice',`认真练习了 ${latest.current.minutes} 分钟`,latest.current.id);
    message.value = storageWorking ? '这一轮练习已完成并记录。' : '练习已完成，记录仅本次有效，请导出备份。';
    if (sound && !leaving && !document.hidden && now.value - latest.current.deadline <= 2000) audio.play('chord');
  } else message.value = '休息结束。准备好后，再开始下一轮。';
}
function start() {
  leaving = false;
  try {
    const latest = fresh();
    if (latest.current) { store.value = latest; message.value = '已恢复另一个标签页的当前计时。'; return; }
    const next = startPractice(latest, Date.now(), minutes.value, breakMinutes.value, crypto.randomUUID());
    next.current.alarm = alarm.value;
    now.value = Date.now(); next.current.deadline = now.value + next.current.minutes * 60000;
    commit(next); if (storageWorking) message.value = '这一轮开始了，慢慢来。';
    if (alarm.value) audio.setEnabled(true).then(ready => { if (alive && current.value?.id === next.current.id && !ready) message.value = '计时已开始，浏览器暂未开启提示音。'; });
  } catch (error) { message.value = error.message; }
}
function act(change) {
  const latest = fresh();
  if (latest.current?.id !== current.value?.id) { store.value = latest; message.value = '已同步另一个标签页的计时。'; return false; }
  commit(change(latest)); return true;
}
function pause() { update(); act(latest => pausePractice(latest, Date.now())); }
function resume() { act(latest => resumePractice(latest, Date.now())); now.value = Date.now(); }
function end() { if (act(latest => ({ ...latest, current: null }))) { audio.stop(); message.value = '本轮已结束，未完成的练习不会计入累计时间。'; } }
function sync(event) {
  try { if (event.storageArea === localStorage && (event.key === practiceKey || event.key === null)) { store.value = fresh(); update(); } } catch { /* Keep the current in-memory timer. */ }
}
onMounted(() => { update(); timer = setInterval(update, 500); window.addEventListener('storage', sync); document.addEventListener('visibilitychange', update); });
onBeforeRouteLeave(() => { leaving = true; audio.stop(); });
onBeforeUnmount(() => { alive = false; clearInterval(timer); audio.stop(); window.removeEventListener('storage', sync); document.removeEventListener('visibilitychange', update); });
</script>
<template>
  <section class="room-panel" aria-labelledby="practice-title"><h2 id="practice-title">给今天，留一段练习。</h2><p class="room-intro">练习、休息，各自有一段时间。刷新或暂时离开后，计时会按真实经过的时间恢复。</p>
    <div class="room-fields"><label class="room-field" for="focus-minutes">练习时长（分钟）<input id="focus-minutes" v-model.number="minutes" type="number" min="1" max="180" :disabled="Boolean(current)"></label><label class="room-field" for="break-minutes">休息时长（0 表示不休息）<input id="break-minutes" v-model.number="breakMinutes" type="number" min="0" max="60" :disabled="Boolean(current)"></label></div>
    <label class="room-check"><input v-model="alarm" type="checkbox" :disabled="Boolean(current)">本页结束提示音（开始时开启互动音效）</label>
    <div class="practice-clock"><p role="status">{{ phaseLabel }}</p><strong id="practice-clock" role="timer">{{ clock }}</strong><span>后台不补放声音；休息后不会自动开始下一轮。</span></div>
    <div class="room-actions"><button v-if="!current" id="practice-start" type="button" class="primary" @click="start">开始练习</button><button v-else-if="current.phase.startsWith('paused-')" type="button" class="primary" @click="resume">继续计时</button><button v-else type="button" class="primary" @click="pause">暂停计时</button><button v-if="current" type="button" @click="end">结束本轮（未完成不计入）</button><button type="button" @click="downloadJson(store,'hitori-room-practice.json')">导出练习记录</button></div>
    <dl class="room-stats"><div><dt>累计完成练习</dt><dd id="practice-total">{{ store.totalMinutes }} 分钟</dd></div><div><dt>完成轮次</dt><dd>{{ store.totalSessions }}</dd></div><div><dt>近期连续练习</dt><dd>{{ streak }} 天</dd></div></dl>
    <p class="room-status" role="status">{{ message }}</p><p class="room-hint">完整完成的练习才计入统计，日期按当前设备计算。同一浏览器的标签页共享当前计时；本机保留最近 365 次明细，连续天数按这些明细计算，累计统计继续保留。</p>
  </section>
</template>
<style scoped>.practice-clock { text-align: center; padding: 30px 0; }.practice-clock p { font-size: 15px; color: #8c6076; }.practice-clock strong { display: block; font: 600 clamp(54px,12vw,100px) var(--mono,monospace); letter-spacing: -.07em; }.practice-clock span { display: block; margin-top: 15px; color: #816958; font-size: 12px; }</style>
