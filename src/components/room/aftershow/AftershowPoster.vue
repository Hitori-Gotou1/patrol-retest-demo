<script setup>
import { computed, defineComponent, h, useId } from 'vue';
import AftershowStageArt from './AftershowStageArt.vue';
import { aftershowArtwork, aftershowArtViews, aftershowInkColors, aftershowPaperGrain } from '../../../room/aftershowArt.js';

const props = defineProps({
  poster: { type: Object, required: true },
  candidate: { type: Object, default: null },
  guides: Boolean,
  plate: { type: String, default: '' },
});

const clip = `aftershow-frame-${useId()}`;
const art = computed(() => aftershowArtwork(props.poster.view, props.poster.beat));
const view = computed(() => aftershowArtViews[props.poster.view] || aftershowArtViews.audience);
const title = computed(() => props.poster.title?.trim() || '今晚的这一拍');
const beat = computed(() => String(props.poster.beat || 1).padStart(2, '0'));
function glyphWidth(char) {
  if (/[MWmw@]/u.test(char)) return 33;
  if (/[A-Z]/u.test(char)) return 26;
  if (/^[\u0020-\u007e]$/u.test(char)) return 20;
  return 34;
}
const titleLength = computed(() => [...title.value].reduce((width, char) => width + glyphWidth(char), 0));
const layers = computed(() => {
  if (props.plate) return [{ ink: props.plate, x: 0, y: 0, kind: 'plate' }];
  const impressions = (props.poster.impressions || []).map(layer => ({ ...layer, kind: 'fixed' }));
  if (props.candidate) impressions.push({ ...props.candidate, kind: 'candidate' });
  return impressions;
});
const inks = Object.keys(aftershowInkColors);
const printedInks = computed(() => new Set(layers.value.filter(layer => layer.kind === 'fixed').map(layer => layer.ink)));

const renderShape = ({ tag, attrs, children }) => h(tag, attrs, children?.map(renderShape));
const InkGeometry = defineComponent({
  props: { shapes: { type: Array, required: true } },
  setup: geometry => () => geometry.shapes.map(renderShape),
});
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="aftershow-poster"
    :viewBox="plate ? '26 155 428 342' : '0 0 480 620'"
    role="img"
    :aria-label="plate ? '色版图案' : `${title}，${view.label}，第${poster.beat}拍`"
    :data-poster-view="poster.view"
    :data-poster-beat="poster.beat"
    :data-poster-title="title"
  >
    <defs>
      <clipPath :id="clip">
        <rect x="36" y="165" width="408" height="323" />
      </clipPath>
    </defs>
    <g v-if="!plate" fill="#2b253a">
      <rect width="480" height="620" fill="#fbefd8" />
      <rect x="13" y="13" width="454" height="594" rx="1" fill="none" stroke="#baa585" stroke-width=".7" />
      <path :d="aftershowPaperGrain" fill="none" stroke="#72583c" stroke-opacity=".15" stroke-width=".9" />
      <g font-family="'PingFang SC','Noto Sans CJK SC','Microsoft YaHei',system-ui,sans-serif" font-size="14" font-weight="650">
        <text x="36" y="39" letter-spacing="1">下北泽 · STARRY</text>
        <text x="444" y="39" text-anchor="end">{{ view.label }} · 第 {{ beat }} 拍</text>
      </g>
      <path d="M36 50H444" fill="none" stroke="#2b253a" stroke-width=".9" />
      <text x="35" y="127" fill="#2a2438" font-size="88" font-weight="950" font-family="Impact,'Arial Black',Arial,sans-serif" textLength="409" lengthAdjust="spacingAndGlyphs">STARRY</text>
      <text x="37" y="151" font-family="'Courier New',monospace" font-weight="700" font-size="13.5" letter-spacing="4">AFTER THE SHOW</text>
      <text x="444" y="151" text-anchor="end" font-size="13.5" font-family="'PingFang SC','Noto Sans CJK SC','Microsoft YaHei',system-ui,sans-serif">{{ view.caption }}</text>
      <rect x="36" y="165" width="408" height="323" fill="#f6e7ca" />
      <path d="M36 518H444M36 584H444" fill="none" stroke="#2b253a" stroke-width=".9" />
      <text
        x="36" y="564" font-size="32" font-weight="780"
        font-family="'PingFang SC','Noto Sans CJK SC','Microsoft YaHei',system-ui,sans-serif"
        :textLength="titleLength > 402 ? 402 : undefined" lengthAdjust="spacingAndGlyphs"
      >{{ title }}</text>
      <text x="36" y="600" font-family="'Courier New',monospace" font-weight="700" font-size="10" letter-spacing="1.4">HITORI ROOM · STARRY</text>
      <circle v-for="(ink, index) in inks" :key="ink" :cx="389 + index * 17" cy="596" r="4" :fill="printedInks.has(ink) ? aftershowInkColors[ink] : 'none'" :stroke="aftershowInkColors[ink]" />
    </g>

    <g v-if="guides && !printedInks.size" data-editor-only="" data-contact-print="" opacity=".32">
      <AftershowStageArt :view="poster.view" :beat="poster.beat" x="36" y="165" width="408" height="323" aria-hidden="true" embedded />
    </g>
    <g :clip-path="`url(#${clip})`">
      <g
        v-for="layer in layers"
        :key="`${layer.kind}-${layer.ink}`"
        :transform="`translate(${layer.x || 0} ${layer.y || 0})`"
        :fill="aftershowInkColors[layer.ink]"
        :color="aftershowInkColors[layer.ink]"
        :opacity="layer.kind === 'candidate' ? .58 : layer.kind === 'plate' ? 1 : .92"
        :data-ink="layer.ink"
        :data-offset-x="layer.x || 0"
        :data-offset-y="layer.y || 0"
        :data-impression="layer.kind"
        :data-editor-only="layer.kind === 'candidate' ? '' : undefined"
      >
        <InkGeometry :shapes="art[layer.ink] || []" />
        <!-- Registration marks move on the plate while paper marks stay put. -->
        <path v-if="guides" d="M49 179H61M55 173V185M421 179H433M427 173V185M49 475H61M55 469V481M421 475H433M427 469V481" fill="none" stroke="currentColor" stroke-width="2" data-editor-only="" />
      </g>
    </g>

    <g v-if="!plate" fill="none" stroke="#2b253a">
      <rect x="36" y="165" width="408" height="323" stroke-width="1" />
      <path d="M25 165H32M36 154V161M448 165H455M444 154V161M25 488H32M36 492V499M448 488H455M444 492V499" stroke-width=".85" />
      <g v-if="guides" data-editor-only="" stroke="#463a4b" stroke-width=".9" stroke-opacity=".8">
        <path d="M46 179H64M55 170V188M418 179H436M427 170V188M46 475H64M55 466V484M418 475H436M427 466V484" />
        <circle cx="55" cy="179" r="5" /><circle cx="427" cy="179" r="5" />
        <circle cx="55" cy="475" r="5" /><circle cx="427" cy="475" r="5" />
      </g>
    </g>
  </svg>
</template>
