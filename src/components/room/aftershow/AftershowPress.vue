<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { aftershowTitle, plateOffset, titleLimit } from '../../../room/aftershow.js';
import AftershowPoster from './AftershowPoster.vue';

const props = defineProps({
  poster: { type: Object, required: true },
  activeInk: { type: String, required: true },
  offsets: { type: Object, required: true },
  busy: Boolean,
  reduced: Boolean,
  exporting: Boolean,
});

const emit = defineEmits([
  'select-ink', 'offset', 'stamp', 'undo', 'reset', 'title', 'export', 'train', 'back',
]);

const inks = [
  { id: 'pink', name: '粉版', color: '#d35f93', pale: '#f5d5e4' },
  { id: 'yellow', name: '黄版', color: '#ad791b', pale: '#f5e2b5' },
  { id: 'blue', name: '蓝版', color: '#456ba0', pale: '#dce6f1' },
  { id: 'red', name: '红版', color: '#ae4e4b', pale: '#f2d6ca' },
];

const directions = [
  { id: 'left', label: '向左移动', symbol: '←', x: -2, y: 0, key: 'ArrowLeft' },
  { id: 'up', label: '向上移动', symbol: '↑', x: 0, y: -2, key: 'ArrowUp' },
  { id: 'down', label: '向下移动', symbol: '↓', x: 0, y: 2, key: 'ArrowDown' },
  { id: 'right', label: '向右移动', symbol: '→', x: 2, y: 0, key: 'ArrowRight' },
];

const paper = ref(null);
const drag = ref(null);
const pressedInk = ref(null);
const activePlate = computed(() => inks.find(ink => ink.id === props.activeInk) || inks[0]);
const impressed = computed(() => new Set(props.poster.impressions.map(entry => entry.ink)));
const printed = computed(() => impressed.value.has(props.activeInk));
const offset = computed(() => props.offsets[props.activeInk] || { x: 0, y: 0 });
const canMove = computed(() => !props.busy && !printed.value);
const candidate = computed(() =>
  printed.value ? null : { ink: props.activeInk, ...offset.value },
);
const inkStyle = computed(() => ({
  '--plate-color': activePlate.value.color,
  '--plate-pale': activePlate.value.pale,
  '--pressure-color': pressedInk.value?.color || activePlate.value.color,
}));
const canFinish = computed(() => impressed.value.size > 0 && !props.busy);
const status = computed(() => {
  const count = impressed.value.size;
  if (props.busy) return '正在压印，等这一版抬起。';
  if (count === inks.length) return '四色已印好。';
  return count
    ? `纸上已有 ${count} 色，可以接着印。`
    : '拖动色版，让十字对齐。也可以直接压印。';
});

function offsetPlate(x, y) {
  if (!canMove.value) return;
  const next = plateOffset({ x, y });
  if (next.x !== offset.value.x || next.y !== offset.value.y) emit('offset', next);
}

function nudge(direction, step = 1) {
  offsetPlate(offset.value.x + direction.x * step, offset.value.y + direction.y * step);
}

function onPlateKeys(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const direction = directions.find(item => item.key === event.key);
  if (!direction || !canMove.value) return;
  event.preventDefault();
  nudge(direction, event.shiftKey ? 2 : 1);
}

function startDrag(event) {
  if (!canMove.value || drag.value || !event.isPrimary || event.button !== 0) return;
  const surface = event.currentTarget;
  const paperWidth = paper.value.clientWidth;
  const paperHeight = paper.value.clientHeight;
  const inverse = surface === paper.value
    ? new DOMMatrixReadOnly(getComputedStyle(paper.value).transform).inverse()
    : null;
  drag.value = {
    id: event.pointerId,
    surface,
    startX: event.clientX,
    startY: event.clientY,
    originalX: offset.value.x,
    originalY: offset.value.y,
    horizontalScale: 480 / paperWidth,
    verticalScale: 620 / paperHeight,
    inverse,
  };
  surface.setPointerCapture?.(event.pointerId);
}

function moveDrag(event) {
  const start = drag.value;
  if (event.pointerId !== start?.id) return;
  const screenDelta = new DOMPoint(event.clientX - start.startX, event.clientY - start.startY);
  const delta = start.inverse ? screenDelta.matrixTransform(start.inverse) : screenDelta;
  offsetPlate(start.originalX + delta.x * start.horizontalScale, start.originalY + delta.y * start.verticalScale);
}

function stopDrag(event) {
  const start = drag.value;
  if (!start || (event && event.pointerId !== start.id)) return;
  drag.value = null;
  if (start.surface.hasPointerCapture?.(start.id)) start.surface.releasePointerCapture(start.id);
}

watch(() => [props.activeInk, props.busy], () => stopDrag());
onBeforeUnmount(() => stopDrag());

function stamp() {
  if (!canMove.value) return;
  stopDrag();
  pressedInk.value = activePlate.value;
  emit('stamp');
}

function chooseInk(ink) {
  if (props.busy) return;
  emit('select-ink', ink);
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function updateTitle(event) {
  if (event.isComposing) return;
  const input = event.target;
  const title = aftershowTitle(input.value);
  if (title !== input.value) input.value = title;
  emit('title', title);
}
</script>

<template>
  <section
    class="aftershow-press"
    :class="{ 'is-pressing': busy && !reduced }"
    :style="inkStyle"
    aria-labelledby="aftershow-press-title"
  >
    <header class="press-heading">
      <div>
        <h2 id="aftershow-press-title">STARRY 四色套印台</h2>
      </div>
      <button type="button" class="press-back" @click="emit('back')">← 返回舞台</button>
    </header>

    <div class="press-grid">
      <div class="press-board">
        <div class="press-board-edge" aria-hidden="true">
          <span class="press-register-mark">+</span>
          <span class="press-register-mark">+</span>
        </div>
        <div
          ref="paper"
          class="press-paper"
          :class="{ 'can-drag': canMove, 'is-dragging': drag }"
          data-press-paper
          @pointerdown="startDrag"
          @pointermove="moveDrag"
          @pointerup="stopDrag"
          @pointercancel="stopDrag"
          @lostpointercapture="stopDrag"
        >
          <AftershowPoster :poster="poster" :candidate="candidate" guides />
          <div v-if="busy && !reduced" class="press-platen" aria-hidden="true">
            <AftershowPoster :poster="poster" :plate="pressedInk?.id || activeInk" />
          </div>
        </div>
        <div class="press-board-edge press-board-bottom" aria-hidden="true">
          <span class="press-register-mark">+</span>
          <span class="press-register-mark">+</span>
        </div>
      </div>

      <div class="press-controls">
        <div class="press-control-title">
          <h3>四色版</h3>
          <span aria-live="polite">{{ impressed.size }} / {{ inks.length }} 色</span>
        </div>
        <div class="press-plates" role="group" aria-label="选择色版">
          <button
            v-for="ink in inks"
            :key="ink.id"
            type="button"
            class="press-plate"
            :style="{ '--ink': ink.color, '--ink-pale': ink.pale }"
            :aria-pressed="activeInk === ink.id"
            :aria-disabled="busy || undefined"
            :data-press-ink="ink.id"
            @click="chooseInk(ink.id)"
          >
            <span class="press-plate-art" aria-hidden="true">
              <AftershowPoster :poster="poster" :plate="ink.id" />
            </span>
            <span class="press-plate-label">
              {{ ink.name }}<span v-if="impressed.has(ink.id)" class="press-printed" aria-label="已印">✓</span>
            </span>
          </button>
        </div>

        <div class="press-adjust">
          <div
            v-if="!printed"
            class="press-drag-pad"
            :class="{ 'can-drag': canMove, 'is-dragging': drag }"
            tabindex="0"
            role="group"
            :aria-label="`拖动${activePlate.name}，也可按方向键微调`"
            data-press-drag
            @keydown="onPlateKeys"
            @pointerdown="startDrag"
            @pointermove="moveDrag"
            @pointerup="stopDrag"
            @pointercancel="stopDrag"
            @lostpointercapture="stopDrag"
          >
            <span class="press-cross" aria-hidden="true">+</span>
            <span
              class="press-ink-cross"
              :style="{ transform: `translate(${offset.x}px, ${offset.y / 2}px)` }"
              aria-hidden="true"
            >+</span>
            <span class="press-adjust-label">拖动{{ activePlate.name }}</span>
          </div>
          <div v-else class="press-fixed-pad">
            <span aria-hidden="true">✓</span>
            {{ activePlate.name }}已压印
          </div>
          <div class="press-adjust-controls">
            <output class="press-offset" :aria-label="`${activePlate.name}当前偏移`">
              <span>X {{ signed(offset.x) }}</span><span>Y {{ signed(offset.y) }}</span>
            </output>
            <button
              type="button"
              class="press-align"
              :disabled="!canMove"
              data-press-align
              @click="offsetPlate(0, 0)"
            >⊕ 对齐色版</button>
            <div class="press-direction" role="group" aria-label="微调当前色版">
              <button
                v-for="direction in directions"
                :key="direction.id"
                type="button"
                :aria-label="direction.label"
                :disabled="!canMove"
                :data-press-offset="direction.id"
                @click="nudge(direction)"
              >{{ direction.symbol }}</button>
            </div>
          </div>
        </div>

        <div class="press-actions">
          <button
            type="button"
            class="press-stamp"
            :aria-disabled="!canMove || undefined"
            data-press-stamp
            @click="stamp"
          >
            {{ busy ? '正在压印' : printed ? '已压印' : '压印' }}<span aria-hidden="true">↓</span>
          </button>
          <div class="press-history">
            <button
              type="button"
              :disabled="!impressed.size || busy"
              data-press-undo
              @click="emit('undo')"
            >撤销上一次</button>
            <button type="button" :disabled="busy" data-press-reset @click="emit('reset')">
              重新开始
            </button>
          </div>
        </div>
        <p class="press-status" role="status">{{ status }}</p>

        <label class="press-title">
          <span>海报标题 <small>最多 {{ titleLimit }} 字</small></span>
          <input
            :value="poster.title"
            :maxlength="titleLimit * 2"
            placeholder="给海报取个名字"
            data-press-title
            @input="updateTitle"
            @compositionend="updateTitle"
          >
        </label>
        <div class="press-finish">
          <button type="button" :disabled="!canFinish || exporting" data-press-export @click="emit('export')">
            {{ exporting ? '生成中…' : '保存海报 PNG' }}
          </button>
          <button type="button" :disabled="!canFinish" data-press-train @click="emit('train')">
            带上末班车 <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>

    <div hidden data-aftershow-poster-export>
      <AftershowPoster :poster="poster" />
    </div>
  </section>
</template>

<style scoped src="./aftershow-press.css"></style>
