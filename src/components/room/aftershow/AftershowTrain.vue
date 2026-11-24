<script setup>
import { computed } from 'vue';
import AftershowPoster from './AftershowPoster.vue';
import AftershowWindow from './AftershowWindow.vue';
import AftershowMemento from './AftershowMemento.vue';

const props = defineProps({ poster: Object, progress: Number, flipped: Boolean, reduced: Boolean });
const emit = defineEmits(['progress', 'flip', 'back', 'export']);
const stops = [
  { id: 'station', progress: 0, label: '离开站台', detail: '站台灯一盏一盏向后退。' },
  { id: 'tunnel', progress: 50, label: '穿过隧道', detail: '玻璃映出车厢和刚印好的海报。' },
  { id: 'homes', progress: 100, label: '居民窗灯', detail: '出隧道了，远处还有几扇亮着的窗。' },
];
const viewLabels = { audience: '观众席', guitar: '吉他位', drums: '鼓位', wing: '舞台侧面' };
const stop = computed(() => stops[props.progress < 32 ? 0 : props.progress < 72 ? 1 : 2]);
const previous = computed(() => stops.findLast(node => node.progress < props.progress));
const next = computed(() => stops.find(node => node.progress > props.progress));
const arrived = computed(() => props.progress >= 100);
const title = computed(() => props.poster.title || '今晚的这一拍');
const viewLabel = computed(() => viewLabels[props.poster.view] || viewLabels.audience);
</script>

<template>
  <section class="aftershow-train" aria-labelledby="aftershow-train-title" :data-train-stop-current="stop.id" :data-motion="reduced ? 'reduce' : undefined">
    <header class="aftershow-train-header">
      <div>
        <p class="aftershow-train-eyebrow">LAST TRAIN / 下北泽</p>
        <h2 id="aftershow-train-title">末班车的车窗</h2>
      </div>
      <span class="aftershow-train-location">{{ arrived ? '已到站' : stop.label }}</span>
    </header>

    <div class="aftershow-carriage">
      <div class="aftershow-carriage-seam" aria-hidden="true"><i></i><i></i><i></i></div>
      <figure class="aftershow-carriage-window">
        <AftershowWindow :poster="poster" :stop="stop.id" :progress="progress" :reduced="reduced" />
        <figcaption>{{ stop.detail }}</figcaption>
      </figure>
      <figure class="aftershow-train-paper" data-train-poster>
        <div class="aftershow-train-paper-frame">
          <AftershowPoster :poster="poster" aria-hidden="true" />
        </div>
        <figcaption>{{ title }}</figcaption>
      </figure>
    </div>

    <div class="aftershow-ticket-zone">
      <div class="aftershow-travel-controls">
        <div class="aftershow-progress-label">
          <label for="aftershow-ticket-progress">拖动车票</label>
          <span aria-hidden="true">{{ arrived ? '已到站' : `${progress}%` }}</span>
        </div>
        <input id="aftershow-ticket-progress" class="aftershow-ticket-range" type="range" min="0" max="100" step="1" data-train-progress :value="progress" :aria-valuetext="`${stop.label}，${progress}%`" :style="{'--ticket-position': `${progress}%`}" @input="emit('progress', Number($event.target.value))">
        <div class="aftershow-ticket-stops" aria-label="车窗节点">
          <button v-for="node in stops" :key="node.id" type="button" :data-train-stop="node.id" :aria-current="stop.id === node.id ? 'step' : undefined" @click="emit('progress', node.progress)"><span aria-hidden="true"></span>{{ node.label }}</button>
        </div>
        <div class="aftershow-train-step-buttons">
          <button type="button" :disabled="!previous" @click="previous && emit('progress', previous.progress)">← 上一站</button>
          <button type="button" :disabled="!next" @click="next && emit('progress', next.progress)">下一站 →</button>
        </div>
      </div>
      <div class="aftershow-ticket" :class="{ 'is-flipped': flipped }">
        <div class="aftershow-ticket-face" :aria-hidden="flipped || undefined">
          <p>下北泽末班车</p>
          <strong>{{ arrived ? '已到站' : '散场车票' }}</strong>
          <span>STARRY → HOME</span>
        </div>
        <div class="aftershow-ticket-face aftershow-ticket-back" data-train-ticket-back :aria-hidden="!flipped || undefined">
          <p>{{ viewLabel }} · 第 {{ poster.beat }} 拍</p>
          <strong>{{ title }}</strong>
          <span>今晚的散场纪念</span>
        </div>
        <button v-if="arrived" type="button" class="aftershow-ticket-flip" data-train-flip :aria-pressed="flipped" @click="emit('flip')">{{ flipped ? '翻回正面' : '翻过车票' }} <span aria-hidden="true">↻</span></button>
      </div>
    </div>

    <footer class="aftershow-train-actions">
      <button type="button" @click="emit('back')">← 回套印台</button>
      <button v-if="arrived" type="button" class="aftershow-train-download" @click="emit('export')">保存散场纪念图</button>
    </footer>
    <div hidden><AftershowMemento :poster="poster" :title="title" :view-label="viewLabel" /></div>
  </section>
</template>

<style scoped>
.aftershow-train {
  --train-ink: #f3e7e7;
  --train-muted: #c0bdd1;
  --train-line: #4d5774;
  --train-paper: #eddecd;
  color: var(--train-ink);
  padding: clamp(16px, 4vw, 48px);
  border: 1px solid #525775;
  background: radial-gradient(ellipse at 30% 3%, #333853 0%, transparent 63%), #141b31;
}
.aftershow-train-header { display: flex; gap: 12px; align-items: end; justify-content: space-between; margin-bottom: 21px; }
.aftershow-train-eyebrow { margin: 0 0 7px; font: 600 .72rem/1.4 var(--mono, monospace); letter-spacing: .13em; color: #e3a9bf; }
.aftershow-train h2 { margin: 0; color: inherit; font-size: clamp(1.38rem, 3.5vw, 2.45rem); letter-spacing: .025em; line-height: 1.14; }
.aftershow-train-location { color: #edc4a7; border-bottom: 1px solid #896e79; font-size: .8rem; padding: 4px 0; white-space: nowrap; }
.aftershow-carriage {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(110px, 19%);
  gap: clamp(7px, 2vw, 26px);
  align-items: center;
  padding: clamp(8px, 2.1vw, 24px);
  border: 1px solid #424c65;
  border-radius: 6px;
  background: linear-gradient(176deg, #303651 0%, #222b44 47%, #333951 48%, #252b45 66%, #1d253e 67%, #1c233a 100%);
  box-shadow: inset 0 1px #68708a67, inset 0 -9px #151c30a6, 0 13px 29px #0f14274f;
}
.aftershow-carriage-seam { position: absolute; inset: 9px 20px auto; display: flex; gap: 5px; }
.aftershow-carriage-seam i { width: 3px; height: 3px; border-radius: 50%; background: #68788f; }
.aftershow-carriage-window, .aftershow-train-paper { margin: 0; min-width: 0; }
.aftershow-carriage-window :deep(.aftershow-window-art) { aspect-ratio: 720 / 365; height: auto; border-radius: clamp(9px, 2vw, 32px); }
.aftershow-carriage-window figcaption { color: var(--train-muted); margin-top: 9px; font-size: .83rem; line-height: 1.55; }
.aftershow-train-paper { width: 100%; max-width: 153px; margin-inline: auto; }
.aftershow-train-paper-frame { position: relative; transform: rotate(-3deg); background: #d3b99e; border: 1px solid #dbb699; box-shadow: 0 5px 15px #0a1025aa; }
.aftershow-train-paper-frame::before {
  content: '';
  position: absolute;
  z-index: 1;
  top: -3px;
  left: 32%;
  width: 35%;
  height: 9px;
  background: #d0b486b0;
  transform: rotate(3deg);
}
.aftershow-train-paper-frame :deep(svg) { display: block; width: 100%; height: auto; }
.aftershow-train-paper figcaption { text-align: center; color: #f1d5d6; overflow-wrap: anywhere; line-height: 1.35; font-size: .8rem; margin-top: 8px; font-weight: 650; }
.aftershow-ticket-zone { display: grid; grid-template-columns: minmax(0, 1fr) minmax(190px, 32%); gap: clamp(16px, 3vw, 30px); align-items: start; margin-top: 26px; }
.aftershow-travel-controls { min-width: 0; }
.aftershow-progress-label { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 3px; font-size: .83rem; font-weight: 650; }
.aftershow-progress-label span { color: #edc4a7; font: .75rem var(--mono, monospace); }
#aftershow-ticket-progress {
  appearance: none;
  display: block;
  width: 100%;
  height: 42px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ew-resize;
  touch-action: pan-y;
}
#aftershow-ticket-progress::-webkit-slider-runnable-track { background: linear-gradient(90deg, #ddaf97 0 var(--ticket-position), #4b5273 var(--ticket-position) 100%); height: 4px; border-radius: 5px; }
#aftershow-ticket-progress::-moz-range-track { background: linear-gradient(90deg, #ddaf97 0 var(--ticket-position), #4b5273 var(--ticket-position) 100%); height: 4px; border-radius: 5px; }
#aftershow-ticket-progress::-webkit-slider-thumb { appearance: none; width: 25px; height: 19px; margin-top: -8px; border: 1px solid #9d7d77; border-radius: 3px; background: linear-gradient(90deg, #f5d2ba 57%, #9d7d77 57% 62%, #f5d2ba 62%); box-shadow: 0 2px 6px #0a1025; }
#aftershow-ticket-progress::-moz-range-thumb { width: 25px; height: 19px; border: 1px solid #9d7d77; border-radius: 3px; background: linear-gradient(90deg, #f5d2ba 57%, #9d7d77 57% 62%, #f5d2ba 62%); box-shadow: 0 2px 6px #0a1025; }
.aftershow-ticket-stops { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; }
.aftershow-train button { min-height: 44px; }
.aftershow-ticket-stops button { display: flex; align-items: center; justify-content: center; gap: 5px; padding: 3px; background: transparent; border-color: transparent; color: var(--train-muted); font-size: .74rem; overflow-wrap: anywhere; }
.aftershow-ticket-stops button:first-child { justify-content: start; }
.aftershow-ticket-stops button:last-child { justify-content: end; }
.aftershow-ticket-stops button span { width: 6px; height: 6px; border: 1px solid currentColor; border-radius: 50%; flex: none; }
.aftershow-ticket-stops button[aria-current='step'] { color: #f5d1ba; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.aftershow-ticket-stops button[aria-current='step'] span { background: currentColor; }
.aftershow-train-step-buttons, .aftershow-train-actions { display: flex; gap: 8px; justify-content: space-between; }
.aftershow-train-step-buttons button, .aftershow-train-actions button { color: var(--train-ink); background: #262f4a; border-color: #596483; font-size: .82rem; }
.aftershow-train button:disabled { opacity: .48; cursor: default; }
.aftershow-ticket {
  display: grid;
  align-items: start;
  isolation: isolate;
  position: relative;
  min-width: 0;
  background: var(--train-paper);
  border-radius: 3px;
  color: #302942;
  padding: 15px 16px;
  box-shadow: 2px 4px 0 #0b1428, inset 0 0 0 1px #bb9a8d;
  perspective: 700px;
}
.aftershow-ticket::before, .aftershow-ticket::after { content: ''; position: absolute; top: 31px; width: 11px; height: 11px; background: #171f35; border-radius: 50%; }
.aftershow-ticket::before { left: -6px; }
.aftershow-ticket::after { right: -6px; }
.aftershow-ticket-face {
  grid-area: 1 / 1;
  min-width: 0;
  padding: 4px 0 12px;
  backface-visibility: hidden;
  transform: rotateY(0);
  transition: transform 320ms cubic-bezier(.24,.73,.24,1);
}
.aftershow-ticket-back { transform: rotateY(-180deg); }
.aftershow-ticket.is-flipped .aftershow-ticket-face:not(.aftershow-ticket-back) { transform: rotateY(180deg); }
.aftershow-ticket.is-flipped .aftershow-ticket-back { transform: rotateY(0); }
.aftershow-ticket-face p { margin: 0 0 8px; color: #65536b; font-size: .72rem; }
.aftershow-ticket-face strong { display: block; font-size: 1rem; line-height: 1.4; margin-bottom: 5px; overflow-wrap: anywhere; }
.aftershow-ticket-face > span { color: #693f56; font-size: .72rem; letter-spacing: .06em; }
.aftershow-ticket-flip { color: #3d2b41; background: transparent; border: 0; border-top: 1px dashed #977782; justify-self: stretch; margin: 0; padding: 7px 0 0; text-align: start; font-size: .81rem; }
.aftershow-ticket-flip span { float: right; }
.aftershow-train-actions { flex-wrap: wrap; padding-top: 17px; margin-top: 21px; border-top: 1px solid #454d68; }
.aftershow-train-actions .aftershow-train-download { background: #e6b0c8; border-color: #edc6d6; color: #302238; font-weight: 700; }
.aftershow-train :is(button, input):focus-visible { outline: 2px solid #ebbbd1; outline-offset: 3px; }
.aftershow-train .aftershow-ticket-flip:focus-visible { outline-color: #77607f; }
.aftershow-train[data-motion='reduce'] .aftershow-ticket-face { transition: none; }
@media (prefers-reduced-motion: reduce) { .aftershow-ticket-face { transition: none; } }
@media (max-width: 620px) {
  .aftershow-train { padding: 13px; }
  .aftershow-train-header { margin-bottom: 12px; }
  .aftershow-carriage { grid-template-columns: minmax(0, 1fr) minmax(62px, 24%); padding: 8px; }
  .aftershow-carriage-window :deep(.aftershow-window-art) { aspect-ratio: 1.53; }
  .aftershow-carriage-window figcaption, .aftershow-train-paper figcaption { font-size: .72rem; }
  .aftershow-ticket-zone { grid-template-columns: 1fr; gap: 18px; }
  .aftershow-ticket { max-width: 100%; }
}
</style>
