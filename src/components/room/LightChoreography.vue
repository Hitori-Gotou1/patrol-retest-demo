<script setup>
import { computed, nextTick, ref, shallowRef, watch, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import EditorWorkspace from '../tools/EditorWorkspace.vue';
import TemplateLibrary from '../tools/TemplateLibrary.vue';
import { newLightShow, validateLightShow, lightFrame } from '../../room/creativeTools.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { useInteractionAudio } from '../../composables/useInteractionAudio.js';
import { defaultPattern, validatePattern, patternSounds, arrangementPosition } from '../../room/pattern.js';
import { loadLocal, downloadJson } from '../../room/storage.js';
import { downloadStage } from '../../room/exportImage.js';
import { cast } from '../../data/playroom.js';
import { recordActivity } from '../../room/activityLog.js';

const { state, saved } = useLocalDraft('hitori-room:lights:v1', newLightShow(), validateLightShow);
const audio = useInteractionAudio('lights');
const svg = ref(null);
const track = ref(0);
const step = ref(0);
const playhead = ref(0);
const fraction = ref(0);
const playing = ref(false);
const sync = ref(false);
const message = ref('');
const background = shallowRef('');
const timelineSegment = ref(0);
const cue = computed(() => state.value.cues[track.value][step.value]);
const lights = computed(() => lightFrame(state.value, playing.value ? playhead.value : step.value, fraction.value));
const pattern = ref(loadLocal('hitori-room:studio:v1', defaultPattern, validatePattern));
const asset = path => `${import.meta.env.BASE_URL}${path}`;
const scoreColumn = s => ({ '--cue-col': s + 2, '--cue-mobile-col': s % 4 + 2 });
const spot = c => ({ x: 10 + (c.x - 50) / 20, y: 32 - (c.x - 50) / 64, r: 2 + c.intensity * 6 });
const visibleInSegment = s => Math.floor(s / 4) === timelineSegment.value;

try {
  const value = localStorage.getItem('hitori-room:stage-background:v1');
  if (value?.length < 1500000 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)) background.value = value;
} catch {}

function transitions(row, s) {
  const current = spot(row[s]);
  const previous = row[(s + 15) % 16];
  const following = spot(row[(s + 1) % 16]);
  const incoming = previous.fade ? `M0 ${(spot(previous).y + current.y) / 2}L${current.x} ${current.y}` : '';
  const outgoing = row[s].fade ? `M${current.x} ${current.y}L60 ${(current.y + following.y) / 2}` : '';
  return incoming + outgoing;
}

let frame = 0, start = 0, generation = 0;
function stop() {
  generation++;
  cancelAnimationFrame(frame);
  frame = 0;
  playing.value = false;
  fraction.value = 0;
  audio.stop();
}
function playNotes(s, elapsed) {
  if (!sync.value) return;
  const bar = arrangementPosition(elapsed, pattern.value).bar;
  for (const sound of patternSounds(pattern.value, s, bar)) audio.play(sound.sound, sound.frequency);
}
function tick(now) {
  const beat = 60000 / state.value.bpm / 4;
  const elapsed = Math.max(0, now - start);
  const next = Math.floor(elapsed / beat) % 16;
  fraction.value = (elapsed % beat) / beat;
  if (next !== playhead.value) {
    playhead.value = next;
    timelineSegment.value = Math.floor(next / 4);
    playNotes(next, elapsed);
  }
  frame = requestAnimationFrame(tick);
}
async function play() {
  stop();
  const token = ++generation;
  pattern.value = loadLocal('hitori-room:studio:v1', defaultPattern, validatePattern);
  if (sync.value) {
    if (!await audio.setEnabled(true)) {
      message.value = '声音暂不可用，可以关闭同步后预览灯光。';
      return;
    }
    if (token !== generation || document.hidden) return;
    state.value.bpm = pattern.value.bpm;
  }
  if (token !== generation || document.hidden) return;
  playhead.value = 0;
  timelineSegment.value = 0;
  playing.value = true;
  start = performance.now();
  playNotes(0, 0);
  frame = requestAnimationFrame(tick);
}
function select(t, s) {
  stop();
  track.value = t;
  step.value = s;
  timelineSegment.value = Math.floor(s / 4);
}
function timelineKey(event, t, s) {
  const steps = { ArrowLeft: (s + 15) % 16, ArrowRight: (s + 1) % 16, Home: 0, End: 15 };
  const tracks = { ArrowUp: Math.max(0, t - 1), ArrowDown: Math.min(2, t + 1) };
  if (!(event.key in steps) && !(event.key in tracks)) return;
  event.preventDefault();
  select(tracks[event.key] ?? t, steps[event.key] ?? s);
  nextTick(() => document.querySelector(`[data-light-cue="${track.value}-${step.value}"]`)?.focus());
}
function chooseSegment(part) {
  stop();
  timelineSegment.value = part;
}
function loadShow(show) {
  select(0, 0);
  state.value = show;
}
async function png() {
  try {
    await downloadStage(svg.value, 'hitori-light-stage.png');
    recordActivity('lights', state.value.name);
    message.value = '这一束光，已经导出成图片。';
  } catch {
    message.value = '图片导出失败，请再试一次。';
  }
}
function json() {
  downloadJson(validateLightShow(state.value), 'hitori-lights.json');
  recordActivity('lights', state.value.name);
}
async function upload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  stop();
  try {
    if (file.size > 32768) throw new Error('灯光文件不能超过 32 KiB。');
    loadShow(validateLightShow(JSON.parse(await file.text())));
    message.value = '灯光编排已读入。';
  } catch (error) {
    message.value = error.message || '文件无法读取，原编排还在。';
  } finally {
    event.target.value = '';
  }
}
function hidden() { if (document.hidden) stop(); }
document.addEventListener('visibilitychange', hidden);
onBeforeRouteLeave(stop);
onBeforeUnmount(() => {
  stop();
  document.removeEventListener('visibilitychange', hidden);
});
watch(audio.enabled, value => { if (!value && sync.value) stop(); });
</script>

<template>
  <section class="room-panel lights-room" aria-labelledby="lights-title">
    <header class="activity-title">
      <p class="pg-kicker">STARRY 灯光谱</p>
      <h2 id="lights-title">今晚的舞台，由你点亮。</h2>
      <p class="room-intro">给三盏灯安排十六步。点选一格，在舞台上对光。</p>
    </header>
    <EditorWorkspace title="灯光编舞" save-label="导出舞台 PNG" @save="png">
      <template #overview>
        <div class="light-score">
          <div class="light-score-head">
            <h3>十六步灯光谱</h3>
            <div class="light-legend" aria-label="灯光谱图例"><span>左 ◉ 右 · 落点</span><span>● 大小 · 亮度</span><span>─ 连线 · 平滑过渡</span></div>
          </div>
          <div class="light-mobile-segments" aria-label="手机时间轴分段">
            <button v-for="part in 4" :key="part" type="button" :aria-pressed="timelineSegment === part - 1" @click="chooseSegment(part - 1)">
              {{ (part - 1) * 4 + 1 }}–{{ part * 4 }} 步
            </button>
          </div>
          <div class="light-timeline" aria-label="灯光时间轴" :data-playhead="playing ? playhead + 1 : null">
            <span class="light-step-label">步</span>
            <span v-for="s in 16" :key="s" class="light-step-number" :class="{ 'mobile-step-hidden': !visibleInSegment(s - 1) }"
              :style="scoreColumn(s - 1)">{{ String(s).padStart(2, '0') }}</span>
            <template v-for="(row, t) in state.cues" :key="t">
              <span class="light-track-label" :style="{ gridRow: t + 2 }">灯 {{ t + 1 }}</span>
              <button v-for="(c, s) in row" :key="s" type="button"
                :aria-label="`灯 ${t + 1} 第 ${s + 1} 步`" :aria-pressed="t === track && s === step"
                :data-light-cue="`${t}-${s}`" :aria-description="`落点 ${Math.round(c.x)} · 亮度 ${Math.round(c.intensity * 100)}% · ${c.fade ? '平滑过渡' : '硬切'}`"
                :class="{ 'light-playing': playing && s === playhead, 'mobile-step-hidden': !visibleInSegment(s) }"
                :style="{ ...scoreColumn(s), gridRow: t + 2 }" :data-position="Math.round(c.x)" @click="select(t, s)" @keydown="timelineKey($event, t, s)">
                <svg viewBox="0 0 60 54" aria-hidden="true" preserveAspectRatio="none">
                  <path d="M4 42h52M30 39v6" fill="none" stroke="#80778a" stroke-width="1" vector-effect="non-scaling-stroke"/>
                  <path :d="transitions(row, s)" fill="none" stroke="#e5c6dc" stroke-width="1.3" vector-effect="non-scaling-stroke"/>
                  <circle :cx="spot(c).x" :cy="spot(c).y" :r="spot(c).r + 2" fill="none" :stroke="c.color" stroke-opacity=".65"/>
                  <circle :cx="spot(c).x" :cy="spot(c).y" :r="spot(c).r" :fill="c.color" stroke="#fff9f1" stroke-opacity=".65" stroke-width=".6"/>
                </svg>
              </button>
            </template>
            <div v-if="playing" class="light-cursor" :style="scoreColumn(playhead)" aria-hidden="true"></div>
          </div>
          <p class="light-score-note">断线是硬切 · 第 16 步接回第 1 步</p>
        </div>
      </template>
      <template #canvas>
        <div class="pg-board">
          <svg ref="svg" viewBox="0 0 900 520" role="img" aria-label="灯光舞台预览">
            <defs>
              <linearGradient v-for="(light, i) in lights" :id="`stage-beam-${i}`" :key="i" x2="0" y2="1">
                <stop :stop-color="light.color" stop-opacity=".65"/><stop offset="1" :stop-color="light.color" stop-opacity=".13"/>
              </linearGradient>
              <pattern id="light-stage-treads" width="40" height="13" patternUnits="userSpaceOnUse">
                <path d="M0 0h40" stroke="#c4a5b5" opacity=".24"/>
              </pattern>
            </defs>
            <rect width="900" height="520" fill="#211d2a"/>
            <image v-if="state.background && background" :href="background" width="900" height="445" preserveAspectRatio="xMidYMid slice" opacity=".65"/>
            <path d="M0 20Q120 104 235 34Q350 84 450 42Q550 84 665 34Q780 104 900 20V0H0Z" fill="#504053"/>
            <path d="M0 415h900v50H0z" fill="#554651"/>
            <path d="M0 415h900v50H0z" fill="url(#light-stage-treads)"/>
            <rect y="465" width="900" height="55" fill="#322837"/>
            <g v-for="(light, i) in lights" :key="i" :opacity="light.intensity" :data-stage-position="Math.round(light.x)">
              <path :d="`M${150 + i * 300} 35L${light.x - 162} 431L${light.x + 162} 431Z`" :fill="`url(#stage-beam-${i})`"/>
              <ellipse :cx="light.x" cy="431" rx="162" ry="21" :fill="light.color" opacity=".53"/>
            </g>
            <g v-for="(light, i) in lights" :key="i" :transform="`translate(${150 + i * 300},29)`">
              <path d="M-24-15h48l-6 23h-37Z" fill="#25202e" stroke="#8b778a" stroke-width="3"/>
              <path d="M-16 8h32" :stroke="light.color" stroke-width="4"/>
            </g>
            <image v-for="(member, i) in cast" :key="member.id" :href="asset(member.image)" :x="150 + i * 170" y="275" width="110" height="165"/>
            <text x="450" y="499" text-anchor="middle" fill="#f4ded8" :font-size="state.name.length > 35 ? 12 : state.name.length > 28 ? 16 : 20" letter-spacing="2">{{ state.name || 'TONIGHT AT STARRY' }}</text>
          </svg>
        </div>
      </template>
      <template #actions>
        <div class="pg-toolbar light-transport">
          <button id="lights-play" class="primary" :disabled="playing" @click="play">预览十六步 ↻</button>
          <button :disabled="!playing" @click="stop(); timelineSegment = Math.floor(step / 4)">停止</button>
          <span class="pg-small">{{ playing ? '播放' : '编辑' }} · 第 {{ (playing ? playhead : step) + 1 }} / 16 步</span>
          <label class="pg-small"><input v-model="sync" type="checkbox" :disabled="playing"> 同步本机编曲与声音</label>
        </div>
      </template>
      <template #tools>
        <fieldset class="pg-settings" :disabled="playing">
          <legend>正在编辑 · 灯 {{ track + 1 }} / 第 {{ step + 1 }} 步</legend>
          <label>落点 · {{ Math.round(cue.x) }}<input id="light-position" v-model.number="cue.x" type="range" min="50" max="850"></label>
          <label>亮度 · {{ Math.round(cue.intensity * 100) }}%<input id="light-intensity" v-model.number="cue.intensity" type="range" min="0" max="1" step=".05"></label>
          <label>颜色<input v-model="cue.color" type="color"></label>
          <label><input v-model="cue.fade" type="checkbox"> 平滑过渡到下一格的位置与亮度</label>
          <button @click="state.cues[track] = state.cues[track].map(() => ({ ...cue }))">复制这一格到整束灯</button>
        </fieldset>
        <div class="pg-settings pg-surface">
          <label>作品名称<input v-model="state.name" maxlength="60"></label>
          <label>速度 · {{ state.bpm }} BPM<input v-model.number="state.bpm" type="range" min="60" max="180" :disabled="playing"></label>
          <label><input v-model="state.background" type="checkbox" :disabled="!background"> 使用涂鸦墙保存的背景</label>
          <p class="pg-small">{{ background ? '已读取本机的舞台背景。' : '到涂鸦墙画一张，再选择「用作舞台背景」。' }}</p>
        </div>
        <div class="pg-toolbar">
          <button id="lights-png" @click="png">导出舞台 PNG</button>
          <button @click="json">导出编排 JSON</button>
          <label class="room-file-button">导入 JSON<input type="file" accept="application/json,.json" @change="upload"></label>
          <button @click="loadShow(newLightShow())">恢复最初的光</button>
        </div>
      </template>
    </EditorWorkspace>
    <TemplateLibrary tool="lights" :current="state" @apply="loadShow"/>
    <p class="pg-status" role="status">{{ message }}</p>
    <p class="pg-small">{{ saved ? '编排自动保存在本机。' : '存档暂不可用。' }} 切到其他页面或窗口时，预览和声音会停止。</p>
  </section>
</template>

<style scoped>
.light-score { background:#25232d; color:#f5eae5; min-width:0; padding:14px 15px 10px; }
.light-score-head { display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:4px 12px; margin-bottom:7px; }
.light-score h3 { font-size:15px; margin:0; }
.light-legend { display:flex; flex-wrap:wrap; gap:0 12px; font-size:11px; color:#f0dbdf; }
.light-score-note { font-size:11px; color:#f2dce0; margin:7px 0 0; }
.light-mobile-segments { display:none; }
.light-timeline { display:grid; grid-template-columns:42px repeat(16,minmax(0,1fr)); grid-template-rows:24px repeat(3,50px); gap:2px; isolation:isolate; }
.light-step-number,.light-step-label,.light-track-label { display:grid; place-content:center; margin:0; font-size:12px; }
.light-step-number,.light-step-label { grid-row:1; font-variant-numeric:tabular-nums; color:#ecdce1; }
.light-step-label,.light-track-label { grid-column:1; }
.light-step-number,.light-timeline button,.light-cursor { grid-column:var(--cue-col); }
.light-timeline button { display:grid; place-items:stretch; width:100%; min-width:0; padding:0; border:1px solid #66576a; background:#362e3e; position:relative; border-radius:2px; }
.light-timeline button:hover { background:#493c50; }
.light-timeline button[aria-pressed=true] { background:#554057; color:#ffefdc; border-color:#e4bc99; outline:2px solid #ffe1ac; outline-offset:-3px; }
.light-timeline button:focus-visible { outline:3px solid #fff; outline-offset:-1px; z-index:3; }
.light-timeline svg { display:block; width:100%; height:100%; pointer-events:none; }
.light-cursor { grid-row:1/5; position:relative; z-index:2; pointer-events:none; }
.light-cursor::before { content:""; display:block; width:2px; position:absolute; top:22px; bottom:0; left:50%; background:#f8e8d9; box-shadow:0 0 4px #432a39; }
.light-cursor::after { content:""; position:absolute; top:15px; left:calc(50% - 4px); border:4px solid transparent; border-top-color:#fff0df; }
fieldset { min-width:0; border:1px solid #a78b9e; padding:12px 14px; }
legend { font-size:13px; font-weight:700; }
input[type=color] { height:40px; min-width:65px; }
.pg-settings label:has(input[type=checkbox]),.light-transport label { display:flex; gap:8px; align-items:center; }
.light-transport { align-items:center; gap:6px; }
.lights-room :deep(.editor-workspace.is-fullscreen) .light-score { flex-shrink:0; }
.lights-room :deep(.editor-workspace-canvas) { position:static; }
@media(max-width:760px) {
  .light-score { padding:8px; }
  .lights-room :deep(.editor-workspace-bar strong) { display:none; }
  .light-legend { gap:0 8px; font-size:10px; }
  .light-mobile-segments { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; margin:7px 0 2px; }
  .light-mobile-segments button { min-height:44px; padding:4px; background:#39323e; border-color:#796b79; color:#f0e1e5; }
  .light-mobile-segments button[aria-pressed=true] { background:#f4d4bb; color:#372738; border-color:#f4d4bb; }
  .light-timeline { grid-template-columns:31px repeat(4,minmax(0,1fr)); grid-template-rows:20px repeat(3,44px); }
  .light-step-number,.light-timeline button,.light-cursor { grid-column:var(--cue-mobile-col); }
  .light-timeline .mobile-step-hidden { display:none; }
  .light-cursor::before { top:17px; }
  .light-cursor::after { top:12px; }
  .light-transport { width:100%; }
  .light-transport label { min-height:38px; }
}
</style>
