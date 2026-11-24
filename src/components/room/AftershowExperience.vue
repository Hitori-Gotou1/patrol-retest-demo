<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { useInteractionAudio } from '../../composables/useInteractionAudio.js';
import { useMediaFocus } from '../../composables/useMediaFocus.js';
import { useSoundPreferences } from '../../composables/useSoundPreferences.js';
import { motionPreference } from '../../room/preferences.js';
import { downloadStage } from '../../room/exportImage.js';
import {
  aftershowDraftKey, aftershowTitle, aftershowViews, defaultAftershowDraft, defaultTrainPoster,
  inkOrder, newPoster, nextUnprintedInk, plateOffset, validateAftershowDraft
} from '../../room/aftershow.js';
import AftershowStage from './aftershow/AftershowStage.vue';
import AftershowPress from './aftershow/AftershowPress.vue';
import AftershowTrain from './aftershow/AftershowTrain.vue';
import '../../styles/aftershow.css';

const steps = [
  { id: 'stage', label: '选一拍' },
  { id: 'press', label: '四色套印' },
  { id: 'train', label: '坐末班车' }
];
const { state, saved, persist } = useLocalDraft(aftershowDraftKey, defaultAftershowDraft, validateAftershowDraft, { validateOnSave: true });
const sound = useInteractionAudio('aftershow');
const { preferences } = useSoundPreferences();
const motion = motionPreference();
const reduced = ref(motion.matches);
const experience = ref(null), panel = ref(null), confirmation = ref(null);
const playing = ref(false), busy = ref(false), exporting = ref(false), notice = ref('');
const confirmAction = ref('');
const poster = computed(() => state.value.poster);
const activeInk = computed(() => poster.value.activeInk);
const hasImpressions = computed(() => poster.value.impressions.length > 0);
const hasPosterChanges = computed(() => hasImpressions.value || poster.value.title.trim() ||
  inkOrder.some(ink => poster.value.offsets[ink].x || poster.value.offsets[ink].y));
const trainPoster = computed(() => hasImpressions.value ? poster.value : defaultTrainPoster);
let playbackTimer, pressTimer, pressedPoster, returnFocus;
let soundGeneration = 0;
let disposed = false;

function updateMotion() {
  reduced.value = motion.matches;
}

function canPlaySound() {
  return !disposed && preferences.effectsEnabled && !preferences.muted && !document.hidden;
}

async function cue(type, frequency) {
  if (!canPlaySound()) return;
  const generation = soundGeneration;
  if (!sound.enabled.value && !await sound.setEnabled(true)) return;
  if (generation === soundGeneration && canPlaySound()) await sound.play(type, frequency);
}

function playBeat(beat) {
  if (beat <= 4) cue('hat');
  if (beat === 6) cue('snare');
  if (beat === 7) cue('bass', 82.41);
  if (beat === 8) cue('chord');
}

function pause() {
  clearTimeout(playbackTimer);
  playing.value = false;
  soundGeneration++;
  sound.stop();
}

const claimMedia = useMediaFocus('aftershow', pause);

function nextPlaybackBeat() {
  if (!playing.value || disposed || document.hidden || state.value.phase !== 'stage') return pause();
  if (state.value.beat === 8) {
    playing.value = false;
    return;
  }
  state.value.beat += 1;
  playBeat(state.value.beat);
  playbackTimer = setTimeout(nextPlaybackBeat, 660);
}

function togglePlayback() {
  if (playing.value) return pause();
  if (document.hidden) return;
  if (state.value.beat === 8) state.value.beat = 1;
  if (canPlaySound()) claimMedia();
  playing.value = true;
  playBeat(state.value.beat);
  playbackTimer = setTimeout(nextPlaybackBeat, 660);
}

function selectBeat(beat) {
  if (!Number.isInteger(beat) || beat < 1 || beat > 8) return;
  pause();
  state.value.beat = beat;
}

function selectView(view) {
  if (aftershowViews.includes(view)) state.value.view = view;
}

function settlePress() {
  clearTimeout(pressTimer);
  if (pressedPoster && pressedPoster === poster.value) pressedPoster.activeInk = nextUnprintedInk(pressedPoster);
  pressedPoster = undefined;
  busy.value = false;
}

async function goTo(phase) {
  if (state.value.phase === phase) return;
  pause();
  settlePress();
  notice.value = '';
  state.value.phase = phase;
  persist();
  await nextTick();
  if (disposed || state.value.phase !== phase) return;
  panel.value?.focus({ preventScroll: true });
  experience.value?.scrollIntoView({ block: 'start', behavior: 'instant' });
}

function showConfirmation(action) {
  returnFocus = document.activeElement;
  confirmAction.value = action;
  confirmation.value.showModal();
}

function dismissConfirmation(restore = true) {
  confirmation.value?.close();
  confirmAction.value = '';
  if (restore) returnFocus?.focus({ preventScroll: true });
  returnFocus = undefined;
}

function useFrame() {
  pause();
  const { view, beat } = state.value;
  if (poster.value.view === view && poster.value.beat === beat) return goTo('press');
  if (hasPosterChanges.value) return showConfirmation('replace');
  replaceFrame(view, beat);
}

function replaceFrame(view, beat) {
  state.value.poster = newPoster(view, beat);
  state.value.progress = 0;
  state.value.flipped = false;
  void goTo('press');
}

function confirmChange() {
  const action = confirmAction.value;
  dismissConfirmation(false);
  if (action === 'replace') {
    replaceFrame(state.value.view, state.value.beat);
  } else if (action === 'reset') {
    state.value.poster = newPoster(poster.value.view, poster.value.beat);
    state.value.progress = 0;
    state.value.flipped = false;
    persist();
    panel.value?.focus({ preventScroll: true });
  }
}

function keepPoster() {
  dismissConfirmation(false);
  void goTo('press');
}

function selectInk(ink) {
  if (!busy.value && inkOrder.includes(ink)) poster.value.activeInk = ink;
}

function movePlate(offset) {
  if (busy.value || poster.value.impressions.some(layer => layer.ink === activeInk.value)) return;
  poster.value.offsets[activeInk.value] = plateOffset(offset);
}

function stamp() {
  const ink = activeInk.value;
  if (busy.value || poster.value.impressions.some(layer => layer.ink === ink)) return;
  busy.value = true;
  notice.value = '';
  pressedPoster = poster.value;
  poster.value.impressions.push({ ink, ...plateOffset(poster.value.offsets[ink]) });
  if (poster.value.impressions.length === 1) {
    state.value.progress = 0;
    state.value.flipped = false;
  }
  cue('kick');
  persist();
  // Keep the action locked for one press even when motion is reduced.
  pressTimer = setTimeout(settlePress, reduced.value ? 280 : 400);
}

function undo() {
  if (busy.value) return;
  const layer = poster.value.impressions.pop();
  if (!layer) return;
  poster.value.activeInk = layer.ink;
  persist();
}

function resetPoster() {
  if (!busy.value && hasPosterChanges.value) showConfirmation('reset');
}

function setTitle(value) {
  poster.value.title = aftershowTitle(value);
}

function setProgress(value) {
  if (!Number.isFinite(value)) return;
  state.value.progress = Math.round(Math.min(100, Math.max(0, value)));
  if (state.value.progress < 100) state.value.flipped = false;
}

function flipTicket() {
  if (state.value.progress === 100) state.value.flipped = !state.value.flipped;
}

async function saveImage(type) {
  if (exporting.value || busy.value) return;
  if (type === 'poster' && !hasImpressions.value) return;
  exporting.value = true;
  notice.value = '';
  const svg = type === 'poster'
    ? experience.value?.querySelector('[data-aftershow-poster-export] svg')
    : experience.value?.querySelector('svg[data-memento-export]');
  try {
    await downloadStage(svg, type === 'poster' ? 'STARRY-四色海报.png' : 'STARRY-散场纪念.png', { scale: 2 });
    if (!disposed) notice.value = 'PNG 已生成。';
  } catch (error) {
    if (!disposed) notice.value = error instanceof Error ? error.message : '图片未能生成，请再试一次。';
  } finally {
    exporting.value = false;
  }
}

function backgrounded() {
  pause();
  settlePress();
}

function visibilityChanged() {
  if (document.hidden) backgrounded();
}

watch(() => state.value.phase, (phase) => { if (phase !== 'stage') pause(); });
onMounted(() => {
  motion.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', visibilityChanged);
  window.addEventListener('pagehide', backgrounded);
});
onBeforeUnmount(() => {
  disposed = true;
  backgrounded();
  motion.removeEventListener('change', updateMotion);
  document.removeEventListener('visibilitychange', visibilityChanged);
  window.removeEventListener('pagehide', backgrounded);
});
</script>

<template>
  <section ref="experience" class="aftershow-experience" :data-phase="state.phase" :data-reduced="reduced" :data-playing="playing" aria-label="STARRY 散场以后">
    <nav class="aftershow-steps" aria-label="散场进度">
      <button v-for="step in steps" :key="step.id" type="button" :data-aftershow-step="step.id"
        :aria-current="state.phase === step.id ? 'step' : undefined" @click="goTo(step.id)">{{ step.label }}</button>
    </nav>
    <div ref="panel" class="aftershow-panel" tabindex="-1" :aria-label="steps.find(step => step.id === state.phase).label" role="region">
      <AftershowStage v-if="state.phase === 'stage'" :view="state.view" :beat="state.beat" :playing="playing" :reduced="reduced"
        @select-view="selectView" @select-beat="selectBeat" @toggle-play="togglePlayback" @print="useFrame" />
      <AftershowPress v-else-if="state.phase === 'press'" :poster="poster" :active-ink="activeInk" :offsets="poster.offsets"
        :busy="busy" :reduced="reduced" :exporting="exporting" @select-ink="selectInk" @offset="movePlate" @stamp="stamp"
        @undo="undo" @reset="resetPoster" @title="setTitle" @export="saveImage('poster')" @train="goTo('train')" @back="goTo('stage')" />
      <AftershowTrain v-else :poster="trainPoster" :progress="state.progress" :flipped="state.flipped" :reduced="reduced"
        :exporting="exporting" @progress="setProgress" @flip="flipTicket" @back="goTo('press')" @export="saveImage('memento')" />
    </div>
    <p v-if="state.phase === 'press' && !hasImpressions" class="aftershow-alternate">
      <button type="button" @click="goTo('train')">带默认海报坐末班车 →</button>
    </p>
    <p v-if="notice" class="aftershow-notice" role="status">{{ notice }}</p>
    <p v-if="!saved" class="aftershow-notice" role="status">这台设备暂时存不下草稿。你仍可以继续并保存 PNG。</p>
    <dialog ref="confirmation" class="aftershow-dialog" aria-labelledby="aftershow-confirm" @cancel.prevent="dismissConfirmation()">
      <h2 id="aftershow-confirm">{{ confirmAction === 'reset' ? '换一张干净的纸？' : '把海报换成这次选的分镜？' }}</h2>
      <p>{{ confirmAction === 'reset' ? '这张纸上的印色、色版位置和标题会清空。' : '换分镜会清空已有印色、色版位置和标题。' }}</p>
      <div class="aftershow-dialog-actions">
        <button type="button" autofocus @click="dismissConfirmation()">取消</button>
        <button v-if="confirmAction === 'replace'" type="button" @click="keepPoster">保留原海报，去套印台</button>
        <button type="button" class="primary" @click="confirmChange">{{ confirmAction === 'reset' ? '重新开始' : '换成新分镜' }}</button>
      </div>
    </dialog>
  </section>
</template>
