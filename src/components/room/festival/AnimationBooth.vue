<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { gsap } from 'gsap';
import { festivalStations } from '../../../data/festival.js';
import { reducedMotion } from '../../../room/preferences.js';
import { editionLabel, newId, snapshot, useFestivalDraft, useFestivalEditions } from '../../../room/festival/drafts.js';
import { betweenFrames, copyFrame, draggedAngle, expandFrames, filmStripArt, initialAnimation, maxFrames, maxHold, poseArt, poseBox, poseGeometry, puppets } from '../../../room/festival/animation.js';
import { clamp } from '../../../room/festival/art.js';
import FestivalArt from './FestivalArt.vue';
import FestivalExport from './FestivalExport.vue';
import FestivalStorage from './FestivalStorage.vue';

const { state, status, edit } = useFestivalDraft('animation', initialAnimation);
const patches = useFestivalEditions('patch');
const editions = useFestivalEditions('animation');
const patchChoice = ref('');
const ghosts = ref(true);
const notice = ref('');
const board = ref(null);
const anglePreview = ref(null);
let dragJoint;
const staticOpen = ref(false);
const playing = ref(false);
const playPosition = ref(0);
const crankAngle = ref(0);
const dial = ref(null);
let playingTimer;
let crankDrag;
let draggedCrank = false;

const frames = computed(() => state.value.frames);
const selected = computed(() => Math.max(0, frames.value.findIndex(frame => frame.id === state.value.selected)));
const current = computed(() => frames.value[selected.value]);
const pose = computed(() => anglePreview.value || current.value.pose);
const joints = computed(() => poseGeometry(pose.value));
const expanded = computed(() => expandFrames(frames.value));
const onScreen = computed(() => expanded.value[playPosition.value] || expanded.value[0]);
const picture = computed(() => state.value.phase === 'play'
  ? poseArt(state.value, onScreen.value.frame.pose)
  : poseArt(state.value, pose.value, {
    guides: true,
    previous: ghosts.value ? frames.value[selected.value - 1]?.pose : null,
    next: ghosts.value ? frames.value[selected.value + 1]?.pose : null
  }));
const film = computed(() => staticOpen.value ? filmStripArt(state.value) : null);
const jointStyle = point => ({ left: `${point.x / poseBox.width * 100}%`, top: `${point.y / poseBox.height * 100}%` });

function select(index) {
  const frame = frames.value[index];
  if (frame) edit(draft => { draft.selected = frame.id; });
}

function setPhase(phase) {
  pause();
  if (phase === 'play') playPosition.value = Math.max(0, expanded.value.findIndex(item => item.frame.id === current.value.id));
  edit(draft => { draft.phase = phase; });
}

function editFrame(update) {
  const id = current.value.id;
  edit(draft => { const frame = draft.frames.find(item => item.id === id); if (frame) update(frame); });
}

function adjust(joint, value) {
  editFrame(frame => { frame.pose[joint] = clamp(value, -100, 85); });
}

function startJoint(event, joint) {
  dragJoint = { joint, box: board.value.getBoundingClientRect() };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function dragPose(event) {
  if (!dragJoint) return;
  const { joint, box } = dragJoint;
  const point = { x: (event.clientX - box.left) / box.width * poseBox.width, y: (event.clientY - box.top) / box.height * poseBox.height };
  anglePreview.value = { ...current.value.pose, [joint]: draggedAngle(current.value.pose, joint, point) };
}

function finishJoint(commit) {
  if (commit && anglePreview.value) {
    const result = anglePreview.value;
    editFrame(frame => { frame.pose = result; });
  }
  dragJoint = null;
  anglePreview.value = null;
}

function insertFrame(copy) {
  if (frames.value.length >= maxFrames) return;
  edit(draft => {
    const index = draft.frames.findIndex(item => item.id === current.value.id);
    const frame = draft.frames[index];
    const following = draft.frames[index + 1] || frame;
    const added = copy ? copyFrame(frame, newId()) : betweenFrames(frame, following, newId());
    draft.frames.splice(index + 1, 0, added);
    draft.selected = added.id;
  });
  notice.value = copy ? '已复制一帧，可独立修改它。' : '已插入一帧';
}

function removeFrame() {
  if (frames.value.length <= 2) return;
  edit(draft => {
    const index = draft.frames.findIndex(frame => frame.id === current.value.id);
    draft.frames.splice(index, 1);
    draft.selected = draft.frames[Math.min(index, draft.frames.length - 1)].id;
  });
}

function moveFrame(offset) {
  edit(draft => {
    const index = draft.frames.findIndex(frame => frame.id === current.value.id);
    const [frame] = draft.frames.splice(index, 1);
    draft.frames.splice(index + offset, 0, frame);
  });
}

function addRebound() {
  if (frames.value.length >= maxFrames) return;
  const hit = frames.value.at(-1);
  edit(draft => {
    const bounce = copyFrame(hit, newId());
    bounce.hold = 1;
    bounce.pose.shoulder = clamp(hit.pose.shoulder + 13, -100, 85);
    bounce.pose.elbow = clamp(hit.pose.elbow + 8, -100, 85);
    draft.frames.splice(-1, 0, bounce);
    draft.selected = bounce.id;
  });
  notice.value = '已在落点前插入较低的一帧，回到落点时会向上回弹。';
}

function holdBeforeEnd() {
  edit(draft => {
    const before = draft.frames.at(-2);
    before.hold = 3;
    draft.selected = before.id;
  });
  notice.value = '落点前的姿势现在停三格。';
}

function usePatch() {
  const edition = patches.state.value.items.find(item => item.id === patchChoice.value);
  if (!edition) return;
  edit(draft => { draft.patch = snapshot(edition); });
  notice.value = `已挂上 ${editionLabel('patch', edition)}`;
}

function step(amount, turn = true) {
  const total = expanded.value.length;
  playPosition.value = ((playPosition.value + amount) % total + total) % total;
  if (!turn) return;
  crankAngle.value += amount * 40;
  const needle = dial.value?.querySelector('span');
  if (needle) gsap.to(needle, { rotation: crankAngle.value, duration: reducedMotion() ? 0 : .18, overwrite: true, ease: 'power2.out' });
}

function pause() {
  clearInterval(playingTimer);
  playing.value = false;
}

function togglePlaying() {
  if (playing.value) { pause(); return; }
  playing.value = true;
  playingTimer = setInterval(() => step(1, false), 165);
}

function pointerAngle(event, element) {
  const bounds = element.getBoundingClientRect();
  return Math.atan2(event.clientY - bounds.y - bounds.height / 2, event.clientX - bounds.x - bounds.width / 2) * 180 / Math.PI;
}

function startCrank(event) {
  pause();
  draggedCrank = false;
  crankDrag = { angle: pointerAngle(event, event.currentTarget), remainder: 0 };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function turnCrank(event) {
  if (!crankDrag) return;
  const angle = pointerAngle(event, event.currentTarget);
  crankDrag.remainder += (angle - crankDrag.angle + 540) % 360 - 180;
  crankDrag.angle = angle;
  const steps = Math.trunc(crankDrag.remainder / 38);
  if (!steps) return;
  draggedCrank = true;
  crankDrag.remainder -= steps * 38;
  step(steps);
}

function clickCrank() {
  if (!draggedCrank) step(1);
  draggedCrank = false;
}

function saveEdition() {
  const { edition, saved } = editions.add(state.value, `${puppets[state.value.puppet].name} · ${expanded.value.length} 格`);
  notice.value = `${saved ? '已放入文化祭选稿架' : '已放入本次选稿架'} · ${editionLabel('animation', edition)}`;
}

watch(expanded, next => { playPosition.value = clamp(playPosition.value, 0, next.length - 1); });
onBeforeUnmount(pause);
</script>

<template>
  <div class="fest-station fest-animation">
    <div class="fest-modebar" aria-label="动画工序">
      <button type="button" :aria-pressed="state.phase === 'pose'" @click="setPhase('pose')">透光台摆姿</button>
      <button type="button" :aria-pressed="state.phase === 'frames'" @click="setPhase('frames')">逐格工作台</button>
      <button type="button" :aria-pressed="state.phase === 'play'" @click="setPhase('play')">手摇放映</button>
    </div>
    <div class="fest-workbench">
      <section class="fest-surface" aria-label="动画画面">
        <div class="fest-surface-label"><span>{{ state.phase === 'play' ? 'STARRY / FILM VIEWER' : 'STARRY / LIGHT TABLE' }}</span><span>{{ puppets[state.puppet].name }} · {{ expanded.length }} 格</span></div>
        <div ref="board" class="fest-overlay fest-pose-board" :class="{ 'fest-projector-window': state.phase === 'play' }">
          <FestivalArt :picture="picture" :label="state.phase === 'play' ? `放映第 ${onScreen.slot} 格` : `第 ${selected + 1} 帧的纸偶`" />
          <template v-if="state.phase !== 'play'">
            <button v-for="joint in [{ key: 'shoulder', label: '肩', point: joints.elbow }, { key: 'elbow', label: '肘', point: joints.end }]"
              :key="joint.key" class="fest-joint" type="button" :style="jointStyle(joint.point)" :aria-label="`拖动${joint.label}关节；左右方向键调角度`"
              @pointerdown="startJoint($event, joint.key)" @pointermove="dragPose" @pointerup="finishJoint(true)" @pointercancel="finishJoint(false)"
              @keydown.left.prevent="adjust(joint.key, pose[joint.key] - 5)" @keydown.right.prevent="adjust(joint.key, pose[joint.key] + 5)">{{ joint.label }}</button>
          </template>
        </div>
        <div v-if="state.phase === 'play'" class="fest-crank-row">
          <output class="fest-counter" aria-live="off">第 {{ onScreen.slot }} / {{ expanded.length }} 格 <span>帧 {{ onScreen.frameIndex + 1 }} · 停留 {{ onScreen.repeat + 1 }}/{{ onScreen.frame.hold }}</span></output>
          <button ref="dial" type="button" class="fest-crank" aria-label="手柄，顺时针拖动前进，逆时针后退"
            @pointerdown="startCrank" @pointermove="turnCrank" @pointerup="crankDrag = null"
            @pointercancel="crankDrag = null; draggedCrank = false" @click="clickCrank"
            @keydown.left.prevent="pause(); step(-1)" @keydown.right.prevent="pause(); step(1)"><span aria-hidden="true"></span></button>
        </div>
        <p v-else class="fest-surface-note">{{ ghosts ? '粉色是前一帧，蓝色是后一帧。拖动关节可改当前帧。' : '拖动关节可改当前帧，也可用右侧的角度按钮。' }}</p>
        <div v-if="state.phase !== 'pose'" class="fest-button-row fest-surface-buttons" aria-label="放映控制">
          <template v-if="state.phase === 'play'">
            <button type="button" @click="pause(); step(-1)">上一格</button><button type="button" @click="pause(); step(1)">下一格</button>
            <button type="button" class="fest-primary" @click="togglePlaying">{{ playing ? '暂停' : '播放' }}</button>
          </template>
          <template v-else>
            <button type="button" :disabled="selected === 0" @click="select(selected - 1)">上一帧</button><button type="button" :disabled="selected === frames.length - 1" @click="select(selected + 1)">下一帧</button>
          </template>
        </div>
      </section>

      <div class="fest-controls">
        <section v-if="state.phase !== 'play'" class="fest-panel">
          <h2>{{ state.phase === 'pose' ? '给纸偶摆两个姿势' : '给每帧一点时间' }}</h2>
          <template v-if="state.phase === 'pose'">
            <label class="fest-field">纸偶<select :value="state.puppet" @change="edit(draft => { draft.puppet = $event.target.value; })"><option v-for="(puppet, key) in puppets" :key="key" :value="key">{{ puppet.name }}</option></select></label>
            <div class="fest-button-row">
              <button type="button" :aria-pressed="selected === 0" @click="select(0)">起始姿势</button>
              <button type="button" :aria-pressed="selected === frames.length - 1" @click="select(frames.length - 1)">落点</button>
            </div>
          </template>
          <template v-else>
            <div class="fest-frame-buttons" aria-label="选择要编辑的帧">
              <button v-for="(frame, index) in frames" :key="frame.id" type="button" :aria-label="`第 ${index + 1} 帧`" :aria-pressed="selected === index" @click="select(index)">{{ index + 1 }} <span>×{{ frame.hold }}</span></button>
            </div>
            <label class="fest-field">第 {{ selected + 1 }} 帧停留格数
              <select :value="current.hold" @change="editFrame(frame => { frame.hold = Number($event.target.value); })"><option v-for="count in maxHold" :key="count" :value="count">{{ count }} 格</option></select>
            </label>
            <div class="fest-button-row">
              <button type="button" :disabled="frames.length >= maxFrames" @click="insertFrame(false)">在后面插入</button>
              <button type="button" :disabled="frames.length >= maxFrames" @click="insertFrame(true)">复制本帧</button>
              <button type="button" :disabled="frames.length <= 2" @click="removeFrame">删除本帧</button>
              <button type="button" :disabled="selected === 0" @click="moveFrame(-1)">前移本帧</button>
              <button type="button" :disabled="selected === frames.length - 1" @click="moveFrame(1)">后移本帧</button>
            </div>
            <div class="fest-button-row">
              <button type="button" @click="holdBeforeEnd">落棒前停三格</button>
              <button type="button" :disabled="frames.length >= maxFrames" @click="addRebound">加入回弹姿势</button>
            </div>
          </template>
          <div v-for="joint in [{ key: 'shoulder', name: '肩关节' }, { key: 'elbow', name: '肘关节' }]" :key="joint.key" class="fest-angle-row">
            <span>{{ joint.name }} <b>{{ pose[joint.key] }}°</b></span>
            <button type="button" :aria-label="`${joint.name}减 5 度`" @click="adjust(joint.key, pose[joint.key] - 5)">−5°</button>
            <button type="button" :aria-label="`${joint.name}加 5 度`" @click="adjust(joint.key, pose[joint.key] + 5)">+5°</button>
          </div>
          <label class="fest-check"><input v-model="ghosts" type="checkbox">显示前后帧参考</label>
        </section>
        <section v-else class="fest-panel">
          <h2>转动手柄</h2>
          <p class="fest-hint">顺时针前进，逆时针后退。慢慢拨过一个位置，就停在下一格。</p>
          <button type="button" :aria-expanded="staticOpen" @click="staticOpen = !staticOpen">{{ staticOpen ? '收起静态逐格页' : '打开静态逐格页' }}</button>
        </section>

        <section v-if="state.phase === 'pose'" class="fest-panel">
          <h2>挂上布章</h2>
          <p v-if="state.patch" class="fest-hint">纸偶上是 {{ editionLabel('patch', state.patch) }}。</p>
          <div v-if="patches.state.value.items.length" class="fest-field-row">
            <label>选择布章版本<select v-model="patchChoice"><option value="">挑一版布章</option><option v-for="edition in patches.state.value.items" :key="edition.id" :value="edition.id">{{ editionLabel('patch', edition) }}</option></select></label>
            <button type="button" :disabled="!patchChoice" @click="usePatch">挂到纸偶</button>
          </div>
          <RouterLink v-else :to="festivalStations[0].path">去布章社缝一枚布章</RouterLink>
          <button v-if="state.patch" type="button" @click="edit(draft => { draft.patch = null; })">取下布章</button>
        </section>

        <section class="fest-panel fest-output">
          <h2>保留这段动画</h2>
          <FestivalStorage :status="status" />
          <div class="fest-button-row">
            <button type="button" class="fest-primary" @click="saveEdition">保存为一版动画</button>
            <RouterLink :to="festivalStations[3].path">去编辑部选稿</RouterLink>
          </div>
          <FestivalExport v-slot="{ download, busy }">
            <button type="button" :disabled="busy" @click="download(() => filmStripArt(state), 'STARRY-编号动画帧条.png', 2)">下载编号帧条 PNG</button>
          </FestivalExport>
          <p v-if="notice" class="fest-status" role="status">{{ notice }}</p>
        </section>
      </div>
    </div>
    <section v-if="staticOpen && state.phase === 'play'" class="fest-panel fest-static-film" aria-label="静态逐格页">
      <h2>静态逐格页</h2>
      <div tabindex="0"><FestivalArt :picture="film" :label="`依编号排列的 ${expanded.length} 格动画`" /></div>
    </section>
  </div>
</template>
