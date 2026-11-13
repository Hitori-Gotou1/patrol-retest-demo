<script setup>
import {motionPreference as createMotionQuery} from '../../room/preferences.js';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { useInteractionAudio } from '../../composables/useInteractionAudio.js';
import { rhythmLevels, rhythmLanes, newRhythmRound, hitRhythmNote, expireRhythmNotes, rhythmResult } from '../../room/rhythm.js';
import { loadLocal, saveLocal } from '../../room/storage.js';
const audio = useInteractionAudio('rhythm-room');
const level = ref('normal'), phase = ref('ready'), elapsed = ref(0), round = ref(newRhythmRound('normal'));
const reduced = ref(false), starting = ref(false), notice = ref(''), activeLane = ref(-1);
const root = ref(null);
function focusGame() { nextTick(() => { if (alive) root.value?.focus({ preventScroll: true }); }); }
const best = ref(loadLocal('hitori-room:rhythm-best:v1', {}, value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  return Object.fromEntries(Object.keys(rhythmLevels).map(key => [key, Number.isSafeInteger(value[key]) && value[key] >= 0 ? value[key] : 0]));
}));
const result = computed(() => rhythmResult(round.value));
const visibleNotes = computed(() => round.value.notes.filter(note => !note.judgment && note.at >= elapsed.value - 180 && note.at < elapsed.value + 1600));
const countdown = computed(() => Math.max(0, Math.ceil((round.value.notes[0].at - elapsed.value) / (60000 / rhythmLevels[level.value].bpm))));
let frame, base = 0, lastBeat = -1, alive = true, media, generation = 0;
function finish() {
  phase.value = 'done'; audio.stop(); activeLane.value = -1;
  const score = result.value.score;
  if (score > (best.value[level.value] || 0)) {
    best.value = { ...best.value, [level.value]: score };
    if (!saveLocal('hitori-room:rhythm-best:v1', best.value)) notice.value = '本次成绩已显示，但浏览器未能保存最高分。';
  }
}
function tick(now) {
  if (phase.value !== 'running' || !alive) return;
  elapsed.value = now - base;
  round.value = expireRhythmNotes(round.value, elapsed.value);
  const beat = Math.floor(elapsed.value / (60000 / rhythmLevels[level.value].bpm));
  if (beat !== lastBeat) { lastBeat = beat; audio.play('hat'); }
  if (round.value.notes.every(note => note.judgment)) { finish(); return; }
  frame = requestAnimationFrame(tick);
}
async function start() {
  if (starting.value) return;
  const token = ++generation;
  starting.value = true; notice.value = '';
  const enabled = await audio.setEnabled(true);
  if (!alive || token !== generation) return;
  if (document.hidden) { starting.value = false; return; }
  starting.value = false;
  if (!enabled) notice.value = '音效暂未开启，仍可进行静音练习。';
  cancelAnimationFrame(frame); audio.stop(); round.value = newRhythmRound(level.value); elapsed.value = 0;
  base = performance.now(); lastBeat = -1; phase.value = 'running'; frame = requestAnimationFrame(tick);
  focusGame();
}
function pause(focus = true) { generation++; starting.value = false; if (phase.value !== 'running') return; elapsed.value = performance.now() - base; phase.value = 'paused'; cancelAnimationFrame(frame); audio.stop(); activeLane.value = -1; if (focus) focusGame(); }
async function resume() {
  if (starting.value || phase.value !== 'paused') return;
  const token = ++generation;
  starting.value = true; await audio.setEnabled(true);
  if (!alive || token !== generation) return;
  if (document.hidden) { starting.value = false; return; }
  starting.value = false; base = performance.now() - elapsed.value; phase.value = 'running'; frame = requestAnimationFrame(tick);
  focusGame();
}
function strike(index) {
  if (phase.value !== 'running') return;
  elapsed.value = performance.now() - base;
  round.value = hitRhythmNote(round.value, index, elapsed.value); activeLane.value = index;
  const lane = rhythmLanes[index]; audio.play(lane.sound, lane.frequency);
  if (round.value.notes.every(note => note.judgment)) finish();
}
function keydown(event) {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,select,textarea')) return;
  if (event.code === 'Space' && ['running', 'paused'].includes(phase.value)) { event.preventDefault(); phase.value === 'running' ? pause() : resume(); return; }
  const index = rhythmLanes.findIndex(lane => lane.key.toLowerCase() === event.key.toLowerCase());
  if (index >= 0 && phase.value === 'running') { event.preventDefault(); strike(index); }
}
function hidden() { if (document.hidden) pause(); }
function endRound() { pause(); phase.value = 'ready'; }
function motion() { reduced.value = media.matches; }
onMounted(() => { media = createMotionQuery(); motion(); media.addEventListener('change', motion); document.addEventListener('visibilitychange', hidden); });
onBeforeRouteLeave(() => pause(false));
onBeforeUnmount(() => { alive = false; generation++; cancelAnimationFrame(frame); audio.stop(); media?.removeEventListener('change', motion); document.removeEventListener('visibilitychange', hidden); });
</script>
<template>
  <section ref="root" class="room-panel" tabindex="-1" aria-labelledby="rhythm-title" @keydown="keydown">
    <h2 id="rhythm-title">跟上这一拍。</h2><p class="room-intro">D / F / J / K 或轻点四个按钮。落在线上时按下，空格暂停；切到后台会自动暂停。</p>
    <div class="room-fields"><label class="room-field" for="rhythm-level">练习难度<select id="rhythm-level" v-model="level" :disabled="phase === 'running' || phase === 'paused' || starting"><option v-for="(item,id) in rhythmLevels" :key="id" :value="id">{{ item.label }} · {{ item.bpm }} BPM</option></select></label><p class="room-hint">Perfect ±70ms / Great ±130ms / Good ±180ms。空拍会中断连击并影响准确率。</p></div>
    <dl class="room-stats"><div><dt>本次分数</dt><dd id="rhythm-score">{{ round.score }}</dd></div><div><dt>连击 / 最高连击</dt><dd>{{ round.combo }} / {{ round.maxCombo }}</dd></div><div><dt>本机最高分</dt><dd>{{ best[level] || 0 }}</dd></div></dl>
    <div class="rhythm-board" :data-phase="phase" aria-hidden="true"><div v-for="(lane,index) in rhythmLanes" :key="lane.key" class="rhythm-lane" :style="{ '--lane-color': lane.color }"><span>{{ lane.key }}</span><template v-if="!reduced"><i v-for="note in visibleNotes.filter(note => note.lane === index)" :key="note.id" class="rhythm-note" :style="{ top: `${(1 - (note.at - elapsed) / 1600) * 88}%` }"></i></template><strong v-else>{{ visibleNotes.some(note => note.lane === index && Math.abs(note.at - elapsed) < 180) ? '按下' : '·' }}</strong></div><div class="rhythm-hit-line"></div><div v-if="phase !== 'running' || countdown" class="rhythm-overlay">{{ phase === 'paused' ? '已暂停' : phase === 'done' ? `完成 · ${result.rank}` : phase === 'ready' ? '准备好，让第一拍响起' : countdown }}</div></div>
    <div class="rhythm-pads" role="group" aria-label="四个演奏按键"><button v-for="(lane,index) in rhythmLanes" :key="lane.key" type="button" :data-lane="index" :disabled="phase !== 'running'" :class="{ struck: activeLane === index }" :style="{ '--lane-color': lane.color }" @click="strike(index)"><strong>{{ lane.key }}</strong><span>{{ lane.label }}</span></button></div>
    <div class="room-actions"><button v-if="phase === 'ready' || phase === 'done'" id="rhythm-start" type="button" class="primary" :disabled="starting" @click="start">{{ starting ? '准备音效…' : phase === 'done' ? '再练一轮并开启音效' : '开始并开启互动音效' }}</button><button v-if="phase === 'running'" type="button" @click="pause">暂停</button><button v-if="phase === 'paused'" type="button" :disabled="starting" @click="resume">继续练习</button><button v-if="phase === 'paused'" type="button" @click="endRound">结束本轮</button></div>
    <p class="room-status" role="status">{{ notice || round.message }}</p><p v-if="phase === 'done'" id="rhythm-result" class="room-hint">评级 {{ result.rank }} · 准确率 {{ result.accuracy }}% · 最高连击 {{ result.maxCombo }}。未击中的音符按 Miss 计入。</p>
  </section>
</template>
<style scoped>
.rhythm-board { height: 260px; display: grid; grid-template-columns: repeat(4,1fr); background: #29222f; position: relative; overflow: hidden; color: #f7ecdf; }
.rhythm-lane { position: relative; border-right: 1px solid #79657966; text-align: center; }
.rhythm-lane > span { display: block; margin-top: 12px; opacity: .6; font: 16px monospace; }
.rhythm-lane > strong { position: absolute; top: 65%; left: 0; right: 0; color: var(--lane-color); font-size: 22px; }
.rhythm-note { position: absolute; height: 16px; left: 20%; right: 20%; background: var(--lane-color); }
.rhythm-hit-line { position: absolute; left: 0; right: 0; top: 88%; border-top: 2px solid #e9cd9d; pointer-events: none; }
.rhythm-overlay { position: absolute; left: 5%; right: 5%; top: 40%; padding: 12px; text-align: center; background: #29222fe6; font-size: 17px; }
.rhythm-pads { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; margin-top: 12px; }
.rhythm-pads button { display: grid; gap: 6px; padding: 13px 3px; border-top: 4px solid var(--lane-color); }
.rhythm-pads button.struck { background: #e8d6df; }
.rhythm-pads strong { font-size: 19px; }.rhythm-pads span { font-size: 11px; }
@media(max-width:500px) { .rhythm-pads { gap: 5px; }.rhythm-pads span { font-size: 10px; }.rhythm-board { height: 230px; } }
</style>
