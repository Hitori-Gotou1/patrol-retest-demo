<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { useInteractionAudio } from '../../composables/useInteractionAudio.js';
import { defaultPattern, studioTracks, validatePattern, patternSounds, encodePattern, decodePattern, parsePatternFile, sequencerStep } from '../../room/pattern.js';
import { loadLocal, saveLocal, downloadJson } from '../../room/storage.js';
const key = 'hitori-room:studio:v1', route = useRoute(), router = useRouter();
const pattern = ref(loadLocal(key, defaultPattern, validatePattern));
const shared = ref(false), playing = ref(false), starting = ref(false), currentStep = ref(-1), message = ref(''), shareLink = ref(''), shareInput = ref(null), fileInput = ref(null);
const audio = useInteractionAudio('room-studio');
let frame, base = 0, previousStep = -1, alive = true, importRevision = 0, generation = 0;
const error = computed(() => { try { validatePattern(pattern.value); return ''; } catch (error) { return error.message; } });
function stop() { generation++; starting.value = false; playing.value = false; cancelAnimationFrame(frame); audio.stop(); currentStep.value = -1; }
function persist() { message.value = saveLocal(key, validatePattern(pattern.value)) ? '编排已保存到本机。' : '当前浏览器无法保存，请导出编排备份。'; }
function tick(now) {
  if (!playing.value || !alive) return;
  const absolute = Math.floor((now - base) / (60000 / pattern.value.bpm / 4));
  const step = sequencerStep(now - base, pattern.value.bpm);
  if (absolute !== previousStep) { currentStep.value = step; previousStep = absolute; for (const track of patternSounds(pattern.value, step)) audio.play(track.sound, track.frequency); }
  frame = requestAnimationFrame(tick);
}
async function play() {
  if (starting.value || error.value) return;
  stop(); const token = ++generation;
  starting.value = true;
  const enabled = await audio.setEnabled(true);
  if (!alive || token !== generation) return;
  if (document.hidden) { stop(); return; }
  starting.value = false; if (!enabled) message.value = '音效暂未开启，可以先查看节拍落点。';
  base = performance.now(); previousStep = -1; playing.value = true; frame = requestAnimationFrame(tick);
}
function toggle(track, step) { pattern.value.masks[track] ^= 1 << step; }
watch(pattern, () => {
  shareLink.value = '';
  if (error.value) { stop(); return; }
  if (!shared.value) persist();
}, { deep: true });
watch(() => pattern.value.bpm, stop);
watch(() => route.query.pattern, raw => {
  stop(); shareLink.value = '';
  if (raw == null) { shared.value = false; pattern.value = loadLocal(key, defaultPattern, validatePattern); return; }
  try { const decoded = decodePattern(raw); shared.value = true; pattern.value = decoded; message.value = '正在试听分享的编排；保存后才会替换本机编排。'; }
  catch (error) { message.value = error.message; }
}, { immediate: true });
async function saveShared() {
  if (error.value) return;
  if (!saveLocal(key, validatePattern(pattern.value))) { message.value = '当前浏览器无法保存，请导出编排备份。'; return; }
  shared.value = false;
  await router.replace({ path: '/room/studio' });
  message.value = '这段编排已保存到本机。';
}
async function restore() { stop(); shared.value = false; pattern.value = loadLocal(key, defaultPattern, validatePattern); await router.replace('/room/studio'); message.value = '已恢复本机编排。'; }
function exportPattern() { if (!error.value) { downloadJson(validatePattern(pattern.value), 'hitori-room-pattern.json'); message.value = '已导出编排 JSON，不包含录音文件。'; } }
async function importPattern(event) {
  const file = event.target.files?.[0]; if (!file) return;
  const revision = ++importRevision;
  try {
    if (file.size > 16384) throw new Error('编排文件不能超过 16 KiB。');
    const decoded = parsePatternFile(await file.text());
    if (!alive || revision !== importRevision) return;
    stop(); shared.value = true; pattern.value = decoded; message.value = '已打开导入的编排；确认保存后才会替换本机编排。';
  } catch (error) { if (alive && revision === importRevision) message.value = error.message; }
  finally { if (alive) event.target.value = ''; }
}
async function copy() {
  if (error.value) return;
  const url = new URL(router.resolve({ path: '/room/studio', query: { pattern: encodePattern(pattern.value) } }).href, window.location.href);
  url.search = ''; shareLink.value = url.href;
  try { await navigator.clipboard.writeText(url.href); if (alive) message.value = '编排链接已复制。'; }
  catch { if (!alive) return; message.value = '请选中下方链接复制。'; await nextTick(); shareInput.value?.focus(); shareInput.value?.select(); }
}
function hidden() { if (document.hidden) { stop(); message.value = '已暂停播放，返回后可从头播放。'; } }
onMounted(() => document.addEventListener('visibilitychange', hidden));
onBeforeRouteLeave(stop);
onBeforeUnmount(() => { alive = false; importRevision++; stop(); document.removeEventListener('visibilitychange', hidden); });
</script>
<template>
  <section class="room-panel" aria-labelledby="studio-title"><h2 id="studio-title">把四种声音，排成一句。</h2><p class="room-intro">每行十六步，每四步是一拍。点亮格子，再听它们一起走一圈。</p>
    <div class="room-fields"><label class="room-field" for="pattern-name">给这段合奏取个名字<input id="pattern-name" v-model="pattern.name" maxlength="60"></label><label class="room-field" for="pattern-bpm">速度 BPM<input id="pattern-bpm" v-model.number="pattern.bpm" type="number" min="60" max="180" step="1"></label></div>
    <p v-if="shared" class="room-status">分享／导入预览中，本机原编排仍保留。</p>
    <div class="studio-grid" aria-label="四轨十六步编排"><div v-for="(track,index) in studioTracks" :key="track.id" class="studio-track"><strong>{{ track.label }}</strong><div role="group" :aria-label="`${track.label}轨道`"><button v-for="step in 16" :key="step" type="button" :data-track="index" :data-step="step-1" :aria-label="`${track.label}第${step}步`" :aria-pressed="Boolean(pattern.masks[index] & (1 << (step-1)))" :class="{ 'is-current': currentStep === step-1, 'is-beat': (step-1)%4 === 0 }" @click="toggle(index,step-1)">{{ step }}</button></div></div></div>
    <div class="room-actions"><button v-if="!playing" type="button" class="primary" :disabled="Boolean(error) || starting" @click="play">{{ starting ? '准备音效…' : '播放并开启音效' }}</button><button v-else type="button" class="primary" @click="stop">停止播放</button><button v-if="shared" type="button" :disabled="Boolean(error)" @click="saveShared">保存为本机编排</button><button v-if="shared" type="button" @click="restore">恢复本机编排</button><button type="button" :disabled="Boolean(error)" @click="copy">分享这段合奏</button><button type="button" :disabled="Boolean(error)" @click="exportPattern">导出编排 JSON</button><button type="button" @click="fileInput.click()">导入编排</button><input ref="fileInput" type="file" hidden accept=".json,application/json" aria-label="选择编排文件" @change="importPattern"></div>
    <div v-if="shareLink" class="room-share"><label class="room-field" for="pattern-share">合奏分享链接<input id="pattern-share" ref="shareInput" :value="shareLink" readonly @focus="$event.target.select()"></label></div>
    <p class="room-status" role="status">{{ error || message }}</p><p class="room-hint">本机编排在编辑时自动保存。导入或打开分享不会自动覆盖本机编排。所有音色均为本站合成示范音色。</p>
  </section>
</template>
<style scoped>
.studio-track { margin-block: 18px; }.studio-track > strong { display: block; font-size: 13px; margin-bottom: 9px; }.studio-track > div { display: grid; grid-template-columns: repeat(16,minmax(0,1fr)); gap: 5px; }.studio-track button { padding: 8px 0; min-width: 0; font-size: 11px; }.studio-track button.is-beat { border-left: 3px solid #9b7a65; }.studio-track button.is-current { outline: 2px solid #493b47; outline-offset: -4px; }
@media(max-width:650px) { .studio-track > div { grid-template-columns: repeat(8,minmax(0,1fr)); gap: 6px; }.studio-track button { min-height: 44px; } }
@media(max-width:420px) { .studio-track > div { grid-template-columns: repeat(4,minmax(0,1fr)); } }
</style>
