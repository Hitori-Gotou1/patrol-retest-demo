<script setup>
import { computed, nextTick, ref } from 'vue';
import { gsap } from 'gsap';
import { reducedMotion } from '../../../room/preferences.js';
import { festivalStations } from '../../../data/festival.js';
import { editionLabel, newId, snapshot, useFestivalDraft, useFestivalEditions } from '../../../room/festival/drafts.js';
import { caseArt, caseBox, casePosition, edges, hoopArt, hoopBox, initialPatchDraft, needlePaths, patchCardArt, positionedMount, removeStitch, sewingPoints, stitchCrossings, templates, threadColors } from '../../../room/festival/patch.js';
import FestivalArt from './FestivalArt.vue';
import FestivalExport from './FestivalExport.vue';
import FestivalStorage from './FestivalStorage.vue';

const { state, status, edit } = useFestivalDraft('patch', initialPatchDraft);
const editions = useFestivalEditions('patch');
const piece = computed(() => state.value.pieces[state.value.active]);
const phase = computed(() => state.value.phase);
const selected = ref('');
const listPin = ref('');
const latest = ref(null);
const side = ref('front');
const peeled = ref(false);
const redoStitch = ref(null);
const segmentToRemove = ref('');
const notice = ref('');
const board = ref(null);
const mountPreview = ref(null);
let drag;
const viewPiece = computed(() => mountPreview.value ? { ...piece.value, mount: mountPreview.value } : piece.value);
const crossings = computed(() => stitchCrossings(piece.value));
const paths = computed(() => needlePaths(piece.value));
const pins = computed(() => templates[piece.value.template].pins);
const picture = computed(() => phase.value === 'mount'
  ? caseArt(viewPiece.value, { peeled: peeled.value, editor: true })
  : hoopArt(piece.value, { side: side.value, guide: phase.value === 'sew', latest: latest.value, showCrossings: phase.value === 'turn' }));
const changingPiece = update => edit(draft => update(draft.pieces[draft.active]));
const pinStyle = (point, box) => ({ left: `${point.x / box.width * 100}%`, top: `${point.y / box.height * 100}%` });
const describe = stitch => `${threadColors[stitch.color].name} ${stitch.from} → ${stitch.to}`;

function choosePhase(value) {
  selected.value = '';
  peeled.value = false;
  side.value = 'front';
  edit(draft => { draft.phase = value; });
}

function chooseTemplate(value) {
  selected.value = '';
  listPin.value = '';
  segmentToRemove.value = '';
  latest.value = null;
  redoStitch.value = null;
  notice.value = '';
  edit(draft => { draft.active = value; });
}

async function pullThread(id) {
  latest.value = id;
  if (reducedMotion()) return;
  await nextTick();
  for (const line of board.value?.querySelectorAll('[data-latest-thread] line') || []) {
    const length = line.getTotalLength();
    gsap.fromTo(line, { strokeDasharray: `${length} ${length}`, strokeDashoffset: length }, {
      strokeDashoffset: 0, duration: .23, ease: 'power2.out', clearProps: 'strokeDasharray,strokeDashoffset'
    });
  }
}

function choosePin(id) {
  if (!selected.value || selected.value === id) {
    selected.value = selected.value === id ? '' : id;
    return;
  }
  if (piece.value.stitches.length >= 80) {
    notice.value = '这块布已缝 80 针，拆一针就能继续。';
    return;
  }
  const stitch = { id: newId(), color: state.value.color, from: selected.value, to: id };
  changingPiece(current => { current.stitches.push(stitch); });
  notice.value = `缝了 ${describe(stitch)}`;
  selected.value = '';
  redoStitch.value = null;
  void pullThread(stitch.id);
}

function undo() {
  const stitch = piece.value.stitches.at(-1);
  if (!stitch) return;
  redoStitch.value = {
    stitch: snapshot(stitch),
    crossings: Object.fromEntries(Object.entries(piece.value.crossings).filter(([key]) => key.split(':').includes(stitch.id)))
  };
  changingPiece(current => removeStitch(current, stitch.id));
  selected.value = '';
  notice.value = `已撤销 ${describe(stitch)}`;
}

function redo() {
  const { stitch, crossings: order } = redoStitch.value;
  changingPiece(current => { current.stitches.push(stitch); Object.assign(current.crossings, order); });
  redoStitch.value = null;
  notice.value = `已重做 ${describe(stitch)}`;
  void pullThread(stitch.id);
}

function detachSegment() {
  if (!segmentToRemove.value) return;
  changingPiece(current => removeStitch(current, segmentToRemove.value));
  redoStitch.value = null;
  segmentToRemove.value = '';
  notice.value = '已拆除所选线段';
}

function setTop(crossing, id) {
  changingPiece(current => { current.crossings[crossing.id] = id; });
  notice.value = `${threadColors[[crossing.first, crossing.second].find(stitch => stitch.id === id).color].name}在该交叉点上层`;
}

function toggleSewPoint(index) {
  peeled.value = false;
  changingPiece(current => {
    const list = current.mount.pins;
    current.mount.pins = list.includes(index) ? list.filter(value => value !== index) : [...list, index];
  });
}

function moveMount(dx, dy) {
  changingPiece(current => { current.mount = positionedMount(current.mount, current.mount.x + dx, current.mount.y + dy); });
}

function startMountDrag(event) {
  const box = board.value.getBoundingClientRect();
  drag = { x: event.clientX, y: event.clientY, box, mount: snapshot(piece.value.mount) };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function previewDrag(event) {
  if (!drag) return;
  mountPreview.value = positionedMount(drag.mount,
    drag.mount.x + (event.clientX - drag.x) / drag.box.width * caseBox.width,
    drag.mount.y + (event.clientY - drag.y) / drag.box.height * caseBox.height);
}

function finishDrag(commit) {
  if (commit && mountPreview.value) {
    const mount = mountPreview.value;
    changingPiece(current => { current.mount = mount; });
  }
  drag = null;
  mountPreview.value = null;
}

function saveEdition() {
  const { edition, saved } = editions.add(piece.value, templates[piece.value.template].name);
  notice.value = `${saved ? '已放入文化祭选稿架' : '已放入本次选稿架'} · ${editionLabel('patch', edition)}`;
}
</script>

<template>
  <div class="fest-station fest-patch">
    <div class="fest-modebar" aria-label="布章工序">
      <button type="button" :aria-pressed="phase === 'sew'" @click="choosePhase('sew')">针孔打样</button>
      <button type="button" :aria-pressed="phase === 'turn'" @click="choosePhase('turn')">正反面穿线</button>
      <button type="button" :aria-pressed="phase === 'mount'" @click="choosePhase('mount')">装到琴盒上</button>
    </div>
    <div class="fest-workbench">
      <section class="fest-surface" aria-label="布章画面">
        <div class="fest-surface-label"><span>STARRY / NEEDLEWORK</span><span>{{ templates[piece.template].name }} · {{ piece.stitches.length }} 针</span></div>
        <div ref="board" class="fest-overlay fest-patch-board" :class="{ 'fest-hoop-board': phase !== 'mount' }">
          <FestivalArt :picture="picture" :label="phase === 'mount' ? '琴盒和摆在上面的布章' : side === 'back' ? '布章背面针路' : '布章正面针路'" />
          <template v-if="phase === 'sew'">
            <button v-for="pin in pins" :key="pin.id" type="button" class="fest-needle-pin"
              :class="{ 'fest-needle-grid': piece.template === 'blank' }"
              :style="pinStyle({ x: hoopBox.x + pin.x, y: hoopBox.y + pin.y }, hoopBox)" :aria-label="`针孔 ${pin.id}`"
              :aria-pressed="selected === pin.id" @click="choosePin(pin.id)">{{ pin.id }}</button>
          </template>
          <template v-if="phase === 'mount'">
            <button type="button" class="fest-patch-drag" :style="pinStyle(viewPiece.mount, caseBox)" aria-label="拖动布章或用方向键移动"
              @pointerdown="startMountDrag" @pointermove="previewDrag" @pointerup="finishDrag(true)" @pointercancel="finishDrag(false)"
              @keydown.left.prevent="moveMount(-10, 0)" @keydown.right.prevent="moveMount(10, 0)"
              @keydown.up.prevent="moveMount(0, -10)" @keydown.down.prevent="moveMount(0, 10)">挪动</button>
            <button v-for="(point, index) in sewingPoints" :key="index" type="button" class="fest-attach-pin"
              :style="pinStyle(casePosition(viewPiece.mount, point), caseBox)" :aria-label="`缝点 ${index + 1}`"
              :aria-pressed="piece.mount.pins.includes(index)" @click="toggleSewPoint(index)">{{ index + 1 }}</button>
          </template>
        </div>
        <p class="fest-surface-note">
          <template v-if="phase === 'sew'">{{ selected ? `起针在 ${selected}，再选一个孔。` : '点第一个孔起针，再点第二个孔收针。' }}</template>
          <template v-else-if="phase === 'turn'">{{ side === 'front' ? '交叉点的编号与右侧选项对应。' : '从布背看，左右镜像；同色线在相邻针脚之间绕回。' }}</template>
          <template v-else>{{ piece.mount.pins.length ? `已固定 ${piece.mount.pins.length} 个缝点。` : '布章还没有固定。选缝点把它缝到琴盒上。' }}</template>
        </p>
      </section>

      <div class="fest-controls">
        <section v-if="phase === 'sew'" class="fest-panel">
          <h2>选底样与线色</h2>
          <div class="fest-button-row" aria-label="底样">
            <button v-for="(template, key) in templates" :key="key" type="button" :aria-pressed="piece.template === key" @click="chooseTemplate(key)">{{ template.name }}</button>
          </div>
          <p v-if="piece.template === 'pick'" class="fest-hint">练习拨片轮廓。依次缝 A—B、B—C、C—D、D—E、E—F、F—A。</p>
          <div class="fest-button-row fest-thread-options" aria-label="线色">
            <button v-for="(color, key) in threadColors" :key="key" type="button" :aria-pressed="state.color === key"
              @click="edit(draft => { draft.color = key; })"><i :style="{ background: color.body }" aria-hidden="true"></i>{{ color.name }}</button>
          </div>
          <div class="fest-button-row">
            <button type="button" :disabled="!piece.stitches.length" @click="undo">撤销一针</button>
            <button type="button" :disabled="!redoStitch" @click="redo">重做一针</button>
          </div>
          <details class="fest-intake-details">
            <summary>用列表选孔</summary>
            <div class="fest-field-row">
              <label>针孔<select v-model="listPin"><option value="">选择针孔</option><option v-for="pin in pins" :key="pin.id" :value="pin.id">{{ pin.id }}</option></select></label>
              <button type="button" :disabled="!listPin" @click="choosePin(listPin); listPin = ''">点这个孔</button>
            </div>
          </details>
          <div v-if="paths.front.length" class="fest-field-row">
            <label>拆除哪一针
              <select v-model="segmentToRemove"><option value="">选择线段</option><option v-for="(stitch, index) in paths.front" :key="stitch.id" :value="stitch.id">第 {{ index + 1 }} 针 · {{ describe(stitch) }}</option></select>
            </label>
            <button type="button" :disabled="!segmentToRemove" @click="detachSegment">拆除</button>
          </div>
        </section>

        <section v-else-if="phase === 'turn'" class="fest-panel">
          <h2>检查同一条线的去向</h2>
          <div class="fest-button-row" aria-label="布章正反面">
            <button type="button" :aria-pressed="side === 'front'" @click="side = 'front'">看正面</button>
            <button type="button" :aria-pressed="side === 'back'" @click="side = 'back'">翻到背面</button>
          </div>
          <template v-if="side === 'front'">
            <p v-if="!crossings.length" class="fest-hint">还没有交叉。可以在打样时用蓝线缝 A—D，再用黄线缝 B—E。</p>
            <label v-for="(crossing, index) in crossings" :key="crossing.id" class="fest-field">
              交叉点 {{ index + 1 }} · 哪条线在上层
              <select :value="crossing.top.id" @change="setTop(crossing, $event.target.value)">
                <option :value="crossing.first.id">{{ describe(crossing.first) }}</option>
                <option :value="crossing.second.id">{{ describe(crossing.second) }}</option>
              </select>
            </label>
          </template>
          <template v-else>
            <p v-if="!paths.back.length" class="fest-hint">没有跨孔的回线。用同色线完成两针，第二针的起点与上一针的终点不同，就能看到背面的回线。</p>
            <ul v-else class="fest-path-list"><li v-for="stitch in paths.back" :key="stitch.id">{{ describe(stitch) }}</li></ul>
          </template>
        </section>

        <section v-else class="fest-panel">
          <h2>摆好再固定</h2>
          <div class="fest-range-pair">
            <label>布章边形<select :value="piece.edge" @change="changingPiece(current => { current.edge = $event.target.value; })"><option v-for="(edge, key) in edges" :key="key" :value="key">{{ edge.name }}</option></select></label>
            <label>锁边针距<select :value="piece.spacing" @change="changingPiece(current => { current.spacing = Number($event.target.value); })"><option :value="3">密针 · 3</option><option :value="5">常规 · 5</option><option :value="8">宽针 · 8</option></select></label>
            <label>大小 · {{ Math.round(piece.mount.scale * 100) }}%<input type="range" min=".4" max=".85" step=".05" :value="piece.mount.scale" @input="changingPiece(current => { current.mount.scale = Number($event.target.value); })"></label>
            <label>角度 · {{ piece.mount.angle }}°<input type="range" min="-60" max="60" step="1" :value="piece.mount.angle" @input="changingPiece(current => { current.mount.angle = Number($event.target.value); })"></label>
          </div>
          <div class="fest-button-row" aria-label="移动布章">
            <button type="button" @click="moveMount(-12, 0)">左移</button><button type="button" @click="moveMount(12, 0)">右移</button>
            <button type="button" @click="moveMount(0, -12)">上移</button><button type="button" @click="moveMount(0, 12)">下移</button>
          </div>
          <div class="fest-button-row">
            <button type="button" :aria-pressed="peeled" @click="peeled = !peeled">{{ peeled ? '放下布角' : '揭起一角' }}</button>
            <button type="button" :disabled="!piece.mount.pins.length" @click="changingPiece(current => { current.mount.pins = []; }); peeled = false">拆下重放</button>
          </div>
        </section>

        <section class="fest-panel fest-output">
          <h2>保留布章</h2>
          <FestivalStorage :status="status" />
          <div class="fest-button-row">
            <button type="button" class="fest-primary" :disabled="!piece.stitches.length" @click="saveEdition">保存为一版布章</button>
            <RouterLink :to="festivalStations[1].path">带去动画柜</RouterLink>
          </div>
          <FestivalExport v-slot="{ download, busy }">
            <div class="fest-button-row">
              <button type="button" :disabled="busy || !piece.mount.pins.length" @click="download(() => caseArt(piece), 'STARRY-琴盒实装.png', 3)">下载琴盒 PNG</button>
              <button type="button" :disabled="busy" @click="download(() => patchCardArt(piece), 'STARRY-布章工艺卡.png')">下载正反面工艺卡</button>
            </div>
          </FestivalExport>
          <p v-if="notice" class="fest-status" role="status">{{ notice }}</p>
        </section>
      </div>
    </div>
  </div>
</template>
