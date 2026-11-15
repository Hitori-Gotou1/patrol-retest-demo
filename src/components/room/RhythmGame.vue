<script setup>
import {motionPreference as createMotionQuery} from '../../room/preferences.js';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { useInteractionAudio } from '../../composables/useInteractionAudio.js';
import { rhythmLevels, rhythmLanes, newRhythmRound, hitRhythmNote, expireRhythmNotes, rhythmResult, rhythmPreferencesKey, defaultRhythmPreferences, validateRhythmPreferences, calibrationOffset } from '../../room/rhythm.js';
import { loadLocal, saveLocal } from '../../room/storage.js';
const audio = useInteractionAudio('rhythm-room');
const level = ref('normal'), phase = ref('ready'), elapsed = ref(0), round = ref(newRhythmRound('normal'));
const reduced = ref(false), starting = ref(false), notice = ref(''), activeLane = ref(-1);
const root = ref(null);
const preferences = ref(loadLocal(rhythmPreferencesKey, defaultRhythmPreferences, validateRhythmPreferences));
const editedKeys = ref([...preferences.value.keys]), editedOffset = ref(preferences.value.offsetMs);
const calibration = ref('idle'), calibrationSamples = ref([]), calibrationBeat = ref(-1), calibrationNotice = ref('');
const setupOpen = ref(false);
const calibrationEstimate = computed(() => calibrationSamples.value.length >= 4 ? calibrationOffset(calibrationSamples.value.map(item => item.offset)) : null);
const locked = computed(() => ['running', 'paused'].includes(phase.value) || starting.value || calibration.value === 'running');
let calibrationFrame, calibrationOrigin = 0, calibrationSoundBeat = -1;
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
  round.value = expireRhythmNotes(round.value, elapsed.value - preferences.value.offsetMs);
  const beat = Math.floor(elapsed.value / (60000 / rhythmLevels[level.value].bpm));
  if (beat !== lastBeat) { lastBeat = beat; audio.play('hat'); }
  if (round.value.notes.every(note => note.judgment)) { finish(); return; }
  frame = requestAnimationFrame(tick);
}
async function start() {
  if (starting.value || calibration.value === 'running') return;
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
  round.value = hitRhythmNote(round.value, index, elapsed.value, preferences.value.offsetMs); activeLane.value = index;
  const lane = rhythmLanes[index]; audio.play(lane.sound, lane.frequency);
  if (round.value.notes.every(note => note.judgment)) finish();
}
function keydown(event) {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,select,textarea')) return;
  if (calibration.value === 'running' && event.code === 'Space') { event.preventDefault(); tapCalibration(); return; }
  if (event.code === 'Space' && ['running', 'paused'].includes(phase.value)) { event.preventDefault(); phase.value === 'running' ? pause() : resume(); return; }
  const index = preferences.value.keys.indexOf(event.key.toLowerCase());
  if (index >= 0 && phase.value === 'running') { event.preventDefault(); strike(index); }
}
function hidden() { if (document.hidden) { pause(); stopCalibration(); } }
function endRound() { pause(); phase.value = 'ready'; }
function savePreferences(offset = editedOffset.value) {
  if (locked.value) return;
  try {
    const next = validateRhythmPreferences({ version: 1, offsetMs: Number(offset), keys: editedKeys.value });
    preferences.value = next; editedOffset.value = next.offsetMs;
    notice.value = saveLocal(rhythmPreferencesKey, next) ? '校准和键位已保存，下一轮会使用这些设置。' : '设置本次有效；浏览器暂时无法保存。';
  } catch (error) { notice.value = error.message; }
}
function stopCalibration() {
  cancelAnimationFrame(calibrationFrame);
  if (calibration.value === 'running') { calibration.value = 'done'; calibrationNotice.value = '校准已停止。至少四次有效点击后可以保存估计值。'; }
  audio.stop();
}
function calibrationTick(now) {
  if (!alive || calibration.value !== 'running') return;
  const beat = Math.floor((now - calibrationOrigin) / 600);
  calibrationBeat.value = beat;
  if (beat >= 0 && beat < 8 && beat !== calibrationSoundBeat) { calibrationSoundBeat = beat; audio.play('hat'); }
  if (now >= calibrationOrigin + 8 * 600 - 250) {
    stopCalibration(); calibrationNotice.value = calibrationEstimate.value == null ? '有效点击不足四次，可以再试一次。' : '校准完成。确认估计值后再应用到练习。'; return;
  }
  calibrationFrame = requestAnimationFrame(calibrationTick);
}
async function beginCalibration() {
  if (locked.value) return;
  const token = ++generation; starting.value = true;
  const enabled = await audio.setEnabled(true);
  if (!alive || token !== generation || document.hidden) { starting.value = false; return; }
  starting.value = false; calibrationSamples.value = []; calibrationSoundBeat = -1; calibrationBeat.value = -1;
  calibrationOrigin = performance.now() + 1000; calibration.value = 'running';
  calibrationNotice.value = enabled ? '跟着闪光和节拍轻点八次；也可以按空格。' : '音效未能开启，仍可跟着闪光做输入校准。';
  calibrationFrame = requestAnimationFrame(calibrationTick); focusGame();
}
function tapCalibration() {
  if (calibration.value !== 'running') return;
  const now = performance.now(), beat = Math.round((now - calibrationOrigin) / 600);
  if (beat < 0 || beat >= 8 || calibrationSamples.value.some(item => item.beat === beat)) return;
  const offset = now - (calibrationOrigin + beat * 600);
  if (Math.abs(offset) <= 300) calibrationSamples.value.push({ beat, offset });
}
function applyCalibration() { if (calibrationEstimate.value != null) { editedOffset.value = calibrationEstimate.value; savePreferences(calibrationEstimate.value); } }
function resetCalibration() { editedOffset.value = 0; calibrationSamples.value = []; calibration.value = 'idle'; calibrationNotice.value = ''; savePreferences(0); }
function syncPreferences(event) {
  if (locked.value || (event.type === 'storage' && event.key !== rhythmPreferencesKey && event.key !== null)) return;
  preferences.value = loadLocal(rhythmPreferencesKey, preferences.value, validateRhythmPreferences);
  editedKeys.value = [...preferences.value.keys]; editedOffset.value = preferences.value.offsetMs;
}
function motion() { reduced.value = media.matches; }
onMounted(() => { media = createMotionQuery(); motion(); media.addEventListener('change', motion); document.addEventListener('visibilitychange', hidden); window.addEventListener('storage', syncPreferences); window.addEventListener('hitori:sync-applied', syncPreferences); });
onBeforeRouteLeave(() => { pause(false); stopCalibration(); });
onBeforeUnmount(() => { alive = false; generation++; cancelAnimationFrame(frame); cancelAnimationFrame(calibrationFrame); audio.stop(); media?.removeEventListener('change', motion); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('storage', syncPreferences); window.removeEventListener('hitori:sync-applied', syncPreferences); });
</script>
<template>
  <section ref="root" class="room-panel" tabindex="-1" aria-labelledby="rhythm-title" @keydown="keydown">
    <h2 id="rhythm-title">跟上这一拍。</h2><p class="room-intro">{{ preferences.keys.map(key => key.toUpperCase()).join(' / ') }} 或轻点四个按钮。落在线上时按下，空格暂停；切到后台会自动暂停。</p>
    <div class="room-fields"><label class="room-field" for="rhythm-level">练习难度<select id="rhythm-level" v-model="level" :disabled="phase === 'running' || phase === 'paused' || starting"><option v-for="(item,id) in rhythmLevels" :key="id" :value="id">{{ item.label }} · {{ item.bpm }} BPM</option></select></label><p class="room-hint">Perfect ±70ms / Great ±130ms / Good ±180ms。空拍会中断连击并影响准确率。</p></div>
    <button type="button" class="rhythm-setup-toggle" :aria-expanded="setupOpen" aria-controls="rhythm-setup" @click="setupOpen = !setupOpen">校准与键位 · {{ preferences.offsetMs > 0 ? '+' : '' }}{{ preferences.offsetMs }}ms</button>
    <div v-show="setupOpen" id="rhythm-setup" class="rhythm-setup"><h3>先找到这台设备的节拍</h3><p class="room-hint">蓝牙音频、屏幕与输入都会带来延迟。校准估计的是设备与这次点击共同产生的偏差，不是对能力的判断。换耳机后可重试；正值会把晚到的输入向前补偿。</p><div class="rhythm-key-fields"><label v-for="(lane,index) in rhythmLanes" :key="lane.key" class="room-field">{{ lane.label }}<input v-model="editedKeys[index]" :disabled="locked" maxlength="1" autocapitalize="none" autocomplete="off" spellcheck="false" :aria-label="lane.label + '键位'"></label></div><label class="room-field">输入补偿（毫秒，−300～300）<input v-model.number="editedOffset" type="number" min="-300" max="300" step="1" :disabled="locked"></label><div class="room-actions"><button type="button" :disabled="locked" @click="savePreferences()">保存键位与补偿</button><button type="button" :disabled="locked" @click="beginCalibration">开始八拍校准</button><button type="button" :disabled="locked" @click="resetCalibration">重置校准</button><button v-if="calibration === 'running'" type="button" @click="stopCalibration">停止校准</button></div><div v-if="calibration !== 'idle'" class="calibration-card"><span class="calibration-pulse" :class="{ active: calibration === 'running' && calibrationBeat >= 0 }" :key="calibrationBeat" aria-hidden="true">{{ calibrationBeat < 0 ? '准备' : Math.min(8, calibrationBeat + 1) }}</span><button type="button" :disabled="calibration !== 'running'" @pointerdown.prevent="tapCalibration" @click="event => { if (event.detail === 0) tapCalibration(); }">跟着节拍轻点 / 空格</button><p role="status">{{ calibrationNotice }} 已收集 {{ calibrationSamples.length }} 次。</p><p v-if="calibrationEstimate != null">估计补偿 {{ calibrationEstimate > 0 ? '+' : '' }}{{ calibrationEstimate }}ms <button type="button" :disabled="calibration === 'running'" @click="applyCalibration">应用本次校准</button></p></div></div>
    <dl class="room-stats"><div><dt>本次分数</dt><dd id="rhythm-score">{{ round.score }}</dd></div><div><dt>连击 / 最高连击</dt><dd>{{ round.combo }} / {{ round.maxCombo }}</dd></div><div><dt>本机最高分</dt><dd>{{ best[level] || 0 }}</dd></div></dl>
    <div class="rhythm-board" :data-phase="phase" aria-hidden="true"><div v-for="(lane,index) in rhythmLanes" :key="lane.key" class="rhythm-lane" :style="{ '--lane-color': lane.color }"><span>{{ preferences.keys[index].toUpperCase() }}</span><template v-if="!reduced"><i v-for="note in visibleNotes.filter(note => note.lane === index)" :key="note.id" class="rhythm-note" :style="{ top: `${(1 - (note.at - elapsed) / 1600) * 88}%` }"></i></template><strong v-else>{{ visibleNotes.some(note => note.lane === index && Math.abs(note.at - elapsed) < 180) ? '按下' : '·' }}</strong></div><div class="rhythm-hit-line"></div><div v-if="phase !== 'running' || countdown" class="rhythm-overlay">{{ phase === 'paused' ? '已暂停' : phase === 'done' ? `完成 · ${result.rank}` : phase === 'ready' ? '准备好，让第一拍响起' : countdown }}</div></div>
    <div class="rhythm-pads" role="group" aria-label="四个演奏按键"><button v-for="(lane,index) in rhythmLanes" :key="lane.key" type="button" :data-lane="index" :disabled="phase !== 'running'" :class="{ struck: activeLane === index }" :style="{ '--lane-color': lane.color }" @pointerdown.prevent="strike(index)" @click="event => { if (event.detail === 0) strike(index); }"><strong>{{ preferences.keys[index].toUpperCase() }}</strong><span>{{ lane.label }}</span></button></div>
    <div class="room-actions"><button v-if="phase === 'ready' || phase === 'done'" id="rhythm-start" type="button" class="primary" :disabled="starting || calibration === 'running'" @click="start">{{ starting ? '准备音效…' : phase === 'done' ? '再练一轮并开启音效' : '开始并开启互动音效' }}</button><button v-if="phase === 'running'" type="button" @click="pause">暂停</button><button v-if="phase === 'paused'" type="button" :disabled="starting" @click="resume">继续练习</button><button v-if="phase === 'paused'" type="button" @click="endRound">结束本轮</button></div>
    <p class="room-status" role="status">{{ notice || round.message }}</p><p v-if="phase === 'done'" id="rhythm-result" class="room-hint">评级 {{ result.rank }} · 准确率 {{ result.accuracy }}% · 最高连击 {{ result.maxCombo }}。未击中的音符按 Miss 计入。输入补偿 {{ preferences.offsetMs }}ms。</p>
    <div v-if="phase === 'done'" class="rhythm-review" aria-label="本轮偏差复盘"><h3>这一轮，落点在哪里</h3><p>早按 {{ result.early }} 次 · 落点附近 {{ result.centered }} 次 · 晚按 {{ result.late }} 次<span v-if="result.meanDeviation != null"> · 平均偏差 {{ result.meanDeviation > 0 ? '+' : '' }}{{ result.meanDeviation }}ms</span></p><ul><li v-for="bucket in result.distribution" :key="bucket.label"><span>{{ bucket.label }}</span><meter min="0" :max="Math.max(1,result.deviations.length)" :value="bucket.count" :aria-label="bucket.label + '：' + bucket.count + ' 次'"></meter><strong>{{ bucket.count }}</strong></li></ul><p class="room-hint">偏差基于本轮补偿后的输入；±15ms 作为落点附近。少量晚按也可能来自设备、音频或触控延迟，可以调整校准后再比较。空拍与 Miss 没有可比较的输入偏差。</p></div>
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
.rhythm-pads strong { font-size: 19px; }.rhythm-pads span { font-size: 12px; }
@media(max-width:500px) { .rhythm-pads { gap: 5px; }.rhythm-pads span { font-size: 11px; }.rhythm-board { height: 230px; } }
.rhythm-setup-toggle{margin:10px 0;min-height:44px}.rhythm-setup{padding:16px;border:1px solid #cfb4c4;background:#f6edf1;margin:8px 0 18px}.rhythm-setup h3{margin-top:0}.rhythm-key-fields{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.rhythm-key-fields input{min-width:0;width:100%;text-align:center;text-transform:uppercase;font-size:18px}.calibration-card{padding:16px;border:1px dashed #b38aa4;text-align:center;line-height:1.8}.calibration-card p{font-size:13px}.calibration-pulse{display:grid;place-items:center;width:68px;height:68px;border-radius:50%;margin:5px auto 16px;background:#d8d2e7;border:3px solid #9a839f;font-size:20px}.calibration-pulse.active{animation:calibration-flash .6s ease-out}.rhythm-review{margin-top:20px;padding:18px;background:#f3e9eb;border:1px solid #d2b7c7}.rhythm-review p{font-size:13px;line-height:1.8}.rhythm-review ul{list-style:none;padding:0;margin:12px 0}.rhythm-review li{display:grid;grid-template-columns:minmax(105px,1fr) 2fr 24px;gap:10px;align-items:center;font-size:12px;margin:8px 0}.rhythm-review meter{width:100%;accent-color:#b783a1}.rhythm-pads button{touch-action:manipulation;min-height:64px}.rhythm-setup button{min-height:44px}@keyframes calibration-flash{from{background:#f6d68d;box-shadow:0 0 0 8px #d4abcf70}to{background:#d8d2e7;box-shadow:0 0 0 0 transparent}}@media(prefers-reduced-motion:reduce){.calibration-pulse.active{animation:none;background:#f6d68d}}@media(max-width:420px){.rhythm-key-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.rhythm-setup,.rhythm-review{padding:12px}}
</style>
