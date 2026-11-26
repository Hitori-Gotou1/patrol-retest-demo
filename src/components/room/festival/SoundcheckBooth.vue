<script setup>
import { computed, nextTick, onMounted, onScopeDispose, ref, watch } from 'vue';
import { gsap } from 'gsap';
import { festivalStations } from '../../../data/festival.js';
import { useMediaFocus } from '../../../composables/useMediaFocus.js';
import { useSoundPreferences } from '../../../composables/useSoundPreferences.js';
import { reducedMotion } from '../../../room/preferences.js';
import { editionLabel, snapshot, useFestivalDraft, useFestivalEditions } from '../../../room/festival/drafts.js';
import { createDrumPlayer } from '../../../room/festival/drumAudio.js';
import { initialRoom, initialSoundDraft, mapPoint, milliseconds, percentage, placePoint, pointAlongRoute, readings, roomArt, roomBox, roomDepthLimits, routes, routeSwatch, seatName, seats, soundReportArt, soundTasks, taskResults, timeRulerArt } from '../../../room/festival/soundcheck.js';
import FestivalArt from './FestivalArt.vue';
import FestivalExport from './FestivalExport.vue';
import FestivalStorage from './FestivalStorage.vue';

const { state, status, edit } = useFestivalDraft('soundcheck', initialSoundDraft);
const editions = useFestivalEditions('soundcheck');
const { effective, preferences, update } = useSoundPreferences();
const gain = effective('effects');
const player = createDrumPlayer();
const claim = useMediaFocus('festival-soundcheck', player.stop);
const audible = ref(false);
const board = ref(null);
const moving = ref(null);
const notice = ref('');
const audioNotice = ref('');
const pulse = ref(false);
const positionPreview = ref(null);
const hoveredPath = ref('');
const focusedPath = ref('');
const pinnedPath = ref('');
const highlighted = computed(() => hoveredPath.value || focusedPath.value || pinnedPath.value);
const swatches = Object.fromEntries(Object.keys(routes).map(id => [id, routeSwatch(id)]));

function choosePath(id) {
  pinnedPath.value = pinnedPath.value === id ? '' : id;
}
let drag, wave, pulseTimer, strikeSequence = 0;

const comparing = computed(() => state.value.comparison === 'before' && state.value.baseline);
const room = computed(() => {
  const current = comparing.value || state.value.current;
  return positionPreview.value ? { ...current, [positionPreview.value.key]: positionPreview.value.point } : current;
});
const paths = computed(() => readings(room.value));
const report = computed(() => ({ before: state.value.baseline || initialRoom(), after: state.value.current, task: state.value.task }));
const objectives = computed(() => taskResults(state.value.task, state.value.current));
const currentRoom = computed(() => state.value.current);
const map = computed(() => roomArt(room.value, paths.value, { highlighted: highlighted.value }));
const ruler = computed(() => timeRulerArt(paths.value, highlighted.value));

function changeRoom(updateRoom) {
  edit(draft => {
    updateRoom(draft.current);
    draft.comparison = 'after';
  });
  notice.value = '';
}

function changeSeat(key) {
  changeRoom(current => { current.seat = key; current.listener = { x: seats[key].x, y: seats[key].y }; });
}

function changeDepth(event) {
  const value = Number(event.target.value);
  changeRoom(current => {
    current.depth = value;
    current.source = placePoint(current, current.source.x, current.source.y);
    current.listener = placePoint(current, current.listener.x, current.listener.y);
  });
}

function movePoint(key, x, y) {
  changeRoom(current => {
    current[key] = placePoint(current, x, y);
    if (key === 'listener') current.seat = 'custom';
  });
}

function nudgePoint(key, dx, dy) {
  const point = currentRoom.value[key];
  movePoint(key, point.x + dx, point.y + dy);
}

function pointStyle(point) {
  const { x, y } = mapPoint(point);
  return { left: `${x / roomBox.width * 100}%`, top: `${y / roomBox.height * 100}%` };
}

function startMove(event, key) {
  if (comparing.value) return;
  const bounds = board.value.getBoundingClientRect();
  const point = currentRoom.value[key];
  drag = { key, bounds, x: event.clientX, y: event.clientY, point };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function previewMove(event) {
  if (!drag) return;
  const { key, bounds, point } = drag;
  const x = point.x + (event.clientX - drag.x) / bounds.width * roomBox.width / roomBox.scaleX;
  const y = point.y + (event.clientY - drag.y) / bounds.height * roomBox.height / roomBox.scaleY;
  positionPreview.value = { key, point: placePoint(currentRoom.value, x, y) };
}

function finishMove(commit) {
  if (commit && positionPreview.value) {
    const { key, point } = positionPreview.value;
    movePoint(key, point.x, point.y);
  }
  drag = null;
  positionPreview.value = null;
}

function pinBaseline() {
  edit(draft => { draft.baseline = snapshot(draft.current); draft.comparison = 'after'; });
  notice.value = `已固定「调整前」· ${seatName(currentRoom.value)}`;
}

function markArrival(pathsToAnimate) {
  wave?.kill();
  clearTimeout(pulseTimer);
  pulse.value = true;
  pulseTimer = setTimeout(() => { pulse.value = false; }, reducedMotion() ? 230 : 1300);
  if (reducedMotion()) return;
  const dots = moving.value?.querySelectorAll('circle');
  if (!dots) return;
  wave = gsap.timeline();
  pathsToAnimate.forEach((route, index) => {
    const dot = dots[index], counter = { progress: 0 };
    const setPosition = () => {
      const point = mapPoint(pointAlongRoute(route, counter.progress));
      dot.setAttribute('cx', point.x);
      dot.setAttribute('cy', point.y);
    };
    setPosition();
    gsap.set(dot, { opacity: 1 });
    wave.to(counter, {
      progress: 1, duration: Math.max(.12, route.ms * (state.value.slow ? .036 : .012)),
      ease: 'none', onUpdate: setPosition
    }, 0).to(dot, { opacity: 0, duration: .31 }, '>');
  });
}

async function strike() {
  const token = ++strikeSequence;
  player.stop();
  const currentPaths = paths.value;
  const canHear = audible.value && gain.value > 0 && preferences.effectsEnabled;
  const playing = canHear ? player.play(currentPaths, gain.value, claim) : Promise.resolve(false);
  markArrival(currentPaths);
  audioNotice.value = canHear ? '鼓点已敲下，读数为实际传播时间。' : '静音试听 · 可从路径和时间尺查看抵达先后。';
  if (canHear && !await playing && strikeSequence === token && audible.value && gain.value > 0) {
    audioNotice.value = '如未听见，请重新敲鼓并检查声音设置。';
  }
}

function toggleSound() {
  audible.value = !audible.value;
  if (audible.value) {
    if (!preferences.effectsEnabled) update({ effectsEnabled: true });
    void strike();
  } else {
    player.stop();
    audioNotice.value = '已切回静音试听。';
  }
}

function sendReport() {
  const { edition, saved } = editions.add(report.value, `${seatName(report.value.after)} · ${soundTasks[report.value.task].name}`);
  notice.value = `${saved ? '已放入文化祭选稿架' : '已放入本次选稿架'} · ${editionLabel('soundcheck', edition)}`;
}

function hide() { if (document.hidden) player.stop(); }
watch([gain, () => preferences.effectsEnabled], ([volume, enabled], [previousVolume, wasEnabled]) => {
  if (volume !== previousVolume || (!enabled && wasEnabled)) player.stop();
}, { flush: 'sync' });
watch(room, async () => {
  player.stop();
  wave?.kill();
  pulse.value = false;
  await nextTick();
  moving.value?.querySelectorAll('circle').forEach(dot => gsap.set(dot, { opacity: 0 }));
});
onMounted(() => document.addEventListener('visibilitychange', hide));
onScopeDispose(() => {
  player.dispose();
  wave?.kill();
  clearTimeout(pulseTimer);
  document.removeEventListener('visibilitychange', hide);
});
</script>

<template>
  <div class="fest-station fest-sound">
    <div class="fest-modebar" aria-label="试声对照">
      <button type="button" :aria-pressed="!comparing" @click="edit(draft => { draft.comparison = 'after'; })">当前试声</button>
      <button type="button" :aria-pressed="!!comparing" :disabled="!state.baseline" @click="edit(draft => { draft.comparison = 'before'; })">查看调整前</button>
      <button type="button" @click="pinBaseline">{{ state.baseline ? '更新调整前' : '固定为调整前' }}</button>
    </div>
    <div class="fest-workbench">
      <section class="fest-surface fest-sound-surface" aria-label="座席图与时间尺">
        <div class="fest-surface-label"><span>现场座席图</span><span>{{ comparing ? '调整前' : '当前' }} · {{ seatName(room) }}</span></div>
        <div class="fest-sound-board">
          <div ref="board" class="fest-overlay fest-room-map">
            <FestivalArt :picture="map" label="直达声、左墙反射、后墙反射的座席线路图" />
            <svg ref="moving" class="fest-sound-pulse" :viewBox="`0 0 ${roomBox.width} ${roomBox.height}`" aria-hidden="true">
              <circle v-for="path in paths" :key="path.id" r="6" :fill="path.color" opacity="0" />
            </svg>
            <button v-for="handle in [{ key: 'source', label: '声源', short: '鼓' }, { key: 'listener', label: '听者', short: '听' }]" :key="handle.key"
              class="fest-map-handle" :class="`fest-map-${handle.key}`" type="button" :style="pointStyle(room[handle.key])" :disabled="!!comparing"
              :aria-label="`拖动${handle.label}或用方向键移动`"
              @pointerdown="startMove($event, handle.key)" @pointermove="previewMove" @pointerup="finishMove(true)" @pointercancel="finishMove(false)"
              @keydown.left.prevent="nudgePoint(handle.key, -.5, 0)" @keydown.right.prevent="nudgePoint(handle.key, .5, 0)"
              @keydown.up.prevent="nudgePoint(handle.key, 0, -.5)" @keydown.down.prevent="nudgePoint(handle.key, 0, .5)">{{ handle.short }}</button>
          </div>
          <table class="fest-readings">
            <caption class="visually-hidden">{{ comparing ? '调整前' : '当前' }}试声读数</caption>
            <thead><tr><th scope="col">声音</th><th scope="col">抵达</th><th scope="col">强度</th></tr></thead>
            <tbody>
              <tr v-for="path in paths" :key="path.id" :data-reading="path.id" :data-highlighted="highlighted === path.id"
                @pointerenter="$event.pointerType === 'mouse' && (hoveredPath = path.id)" @pointerleave="hoveredPath = ''"
                @click="choosePath(path.id)">
                <th scope="row">
                  <button type="button" :aria-pressed="pinnedPath === path.id"
                    @focus="focusedPath = $event.target.matches(':focus-visible') ? path.id : ''" @blur="focusedPath = ''">
                    <FestivalArt :picture="swatches[path.id]" />{{ path.name }}
                  </button>
                </th>
                <td>{{ milliseconds(path.ms) }}</td><td>{{ percentage(path.relative) }}</td>
              </tr>
            </tbody>
          </table>
          <FestivalArt class="fest-time-ruler" :picture="ruler" label="时间尺，三条线路的抵达刻度。毫秒读数见表。" />
        </div>
        <div class="fest-button-row fest-surface-buttons">
          <button type="button" class="fest-primary" :class="{ 'fest-struck': pulse }" @click="strike">敲鼓试声</button>
          <button type="button" :aria-pressed="audible" @click="toggleSound">{{ audible ? '静音试听' : '开启试听声音' }}</button>
          <button type="button" :aria-pressed="state.slow" @click="edit(draft => { draft.slow = !draft.slow; })">慢放路径</button>
        </div>
        <p v-if="audioNotice" class="fest-surface-note" role="status">{{ audioNotice }}</p>
      </section>
      <div class="fest-controls">
        <section class="fest-panel">
          <h2>换座与挂帘</h2>
          <div class="fest-button-row" aria-label="换座">
            <button v-for="(seat, key) in seats" :key="key" type="button" :aria-pressed="currentRoom.seat === key" @click="changeSeat(key)">{{ seat.name }}</button>
          </div>
          <label class="fest-field">后墙位置 · {{ currentRoom.depth.toFixed(1) }} m
            <input type="range" :min="roomDepthLimits[0]" :max="roomDepthLimits[1]" step=".5" :value="currentRoom.depth" @input="changeDepth">
          </label>
          <div class="fest-button-row">
            <button v-for="wall in [{ id: 'left', name: '左墙' }, { id: 'rear', name: '后墙' }]" :key="wall.id" type="button" :aria-pressed="currentRoom.curtains[wall.id]"
              @click="changeRoom(current => { current.curtains[wall.id] = !current.curtains[wall.id]; })">{{ currentRoom.curtains[wall.id] ? `${wall.name}撤帘` : `${wall.name}挂帘` }}</button>
          </div>
          <p class="fest-hint">拖动图上的「鼓」和「听」，或聚焦后按方向键。挪墙和换座会改变距离，挂帘会降低对应反射。</p>
        </section>
        <section class="fest-panel">
          <h2>试声委托</h2>
          <div class="fest-task-cards" aria-label="选择试声委托">
            <button v-for="(task, key) in soundTasks" :key="key" type="button" :aria-label="task.name" :aria-pressed="state.task === key"
              @click="edit(draft => { draft.task = key; })"><strong>{{ task.name }}</strong><span>{{ task.goal }}</span></button>
          </div>
          <p class="fest-hint">{{ soundTasks[state.task].hint }}</p>
          <ul class="fest-objectives">
            <li v-for="objective in objectives" :key="objective.label"><span>{{ objective.label }}<b>{{ objective.value }}</b></span><strong :class="{ done: objective.done }">{{ objective.done ? '达标' : '待调整' }}</strong></li>
          </ul>
          <p v-if="objectives.every(objective => objective.done)" class="fest-status" role="status">委托完成，可以留下试声单。</p>
        </section>
        <section class="fest-panel fest-output">
          <h2>保留试声单</h2>
          <p class="fest-hint">{{ state.baseline ? `对照的是你固定的「调整前」 · ${seatName(state.baseline)}。` : '还未固定「调整前」，试声单会以初始前排读数作对照。' }}</p>
          <FestivalStorage :status="status" />
          <div class="fest-button-row">
            <button type="button" class="fest-primary" @click="sendReport">保存为一版试声单</button>
            <RouterLink :to="festivalStations[3].path">去编辑部选稿</RouterLink>
          </div>
          <FestivalExport v-slot="{ download, busy }">
            <button type="button" :disabled="busy" @click="download(() => soundReportArt(report), 'STARRY-空场试声单.png', 2)">下载试声单 PNG</button>
          </FestivalExport>
          <p v-if="notice" class="fest-status" role="status">{{ notice }}</p>
        </section>
        <p class="fest-model-note">简化二维演示。以 343 m/s 计算直达与两面墙的各一次镜面反射，强度相对各次直达声。慢放只改变画面速度。</p>
      </div>
    </div>
  </div>
</template>
