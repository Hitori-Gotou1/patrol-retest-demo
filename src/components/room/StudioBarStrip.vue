<script setup>
import { nextTick, ref, watch } from 'vue';
import { studioTracks } from '../../room/pattern.js';

const props = defineProps({
  bars: { type: Array, required: true },
  range: { type: Object, required: true },
  selected: { type: Number, required: true },
  playing: { type: Number, required: true },
  step: { type: Number, required: true }
});
const emit = defineEmits(['select']);
const ribbon = ref(null);
const inks = ['#ac839a', '#829eac', '#ae9479', '#8e9e83'];
function reveal(index) {
  if (index < 0) return;
  nextTick(() => {
    const strip = ribbon.value;
    const tab = strip?.children[index];
    if (!tab) return;
    const left = tab.offsetLeft, right = left + tab.offsetWidth;
    if (left < strip.scrollLeft) strip.scrollLeft = left;
    if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth;
  });
}
watch(() => props.selected, reveal);
watch(() => props.playing, reveal);

function scoreLabel(bar) {
  return studioTracks.map((track, row) => {
    const enabled = Array.from({ length:16 }, (_, index) => index + 1)
      .filter(step => bar.masks[row] & (1 << (step - 1)));
    return `${track.label} ${enabled.join('、') || '休止'}`;
  }).join('，');
}
</script>

<template>
  <div class="studio-ribbon">
    <div class="studio-ribbon-header"><h3>小节谱带</h3><span>［ ］ 循环首尾 · 每四步一拍</span></div>
    <div ref="ribbon" class="bar-tabs" role="group" aria-label="当前编辑小节">
      <button v-for="(bar,index) in bars" :key="bar.id" type="button" class="studio-bar"
        :aria-pressed="selected === index" :aria-label="`第 ${index + 1} 小节 · ${bar.name}`" :aria-description="scoreLabel(bar)"
        :data-bar="bar.id" :data-loop-start="range.start === index" :data-loop-end="range.end === index"
        :class="{ 'bar-playing':playing === index }" @click="emit('select',index)">
        <span class="studio-bar-name"><small>{{ String(index + 1).padStart(2,'0') }}</small><span>{{ bar.name }}</span></span>
        <svg viewBox="0 0 176 62" aria-hidden="true">
          <path d="M7 3v56m40-56v56m40-56v56m40-56v56m40-56v56" fill="none" stroke="#8b7a89" stroke-width="1.5" opacity=".68"/>
          <g v-for="(mask,row) in bar.masks" :key="row" :data-track="studioTracks[row].id" :data-mask="mask" :fill="inks[row]">
            <path :d="`M7 ${11 + row * 13}h160`" stroke="#796b79" stroke-width=".6"/>
            <circle v-for="n in 16" :key="n" :cx="12 + (n-1)*10" :cy="11 + row*13"
              :r="mask & (1 << (n-1)) ? 3.15 : .8" :data-beat="Boolean(mask & (1 << (n-1)))"/>
          </g>
          <rect v-if="playing === index && step >= 0" class="studio-playline" :data-step="step + 1"
            :x="11.1 + step * 10" y="2" width="1.8" height="58"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.studio-ribbon { padding: .55rem clamp(.55rem, 1.6vw, 1.15rem) .25rem; border-bottom: 1px solid var(--room-console-edge); min-width: 0; }
.studio-ribbon-header { display: flex; align-items: baseline; justify-content: space-between; gap: .15rem .75rem; flex-wrap: wrap; color: var(--room-console-muted); }
.studio-ribbon-header h3 { margin: 0; font-size: .875rem; }
.studio-ribbon-header span { font-size: .75rem; }
.studio-ribbon .bar-tabs { position: relative; display: flex; gap: .42rem; overflow-x: auto; margin: 0; padding: .3rem .15rem .42rem; scrollbar-width: thin; }
.studio-ribbon .studio-bar { position: relative; flex: 0 0 clamp(7.5rem, 15%, 9.5rem); min-width: 0; display: grid; justify-items: stretch; color: var(--room-console-muted); background: #302a35; border: 1px solid var(--room-console-top); padding: .25rem .38rem; text-align: start; gap: 1px; }
.studio-ribbon .studio-bar[aria-pressed='true'] { color: var(--room-console-ink); background: #4c3e4d; border-color: #ae94a9; }
.studio-ribbon .studio-bar:focus-visible { outline-offset: -2px; }
.studio-bar-name { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: baseline; gap: .3rem; font-weight: 700; padding-inline: .24rem; line-height: 1.3; overflow-wrap: anywhere; }
.studio-bar-name small { font: .6875rem var(--mono, monospace); font-variant-numeric: tabular-nums; }
.studio-ribbon .studio-bar svg { display:block; width:100%; height:auto; }
.studio-bar[data-loop-start=true]::before,.studio-bar[data-loop-end=true]::after { content:""; position:absolute; top:19px; bottom:5px; width:6px; border:1px solid #ab91a5; pointer-events:none; }
.studio-bar[data-loop-start=true]::before { left:3px; border-right:0; }
.studio-bar[data-loop-end=true]::after { right:3px; border-left:0; }
.studio-playline { fill: var(--room-berry-light); }
.studio-ribbon .studio-bar.bar-playing { border-color: var(--room-berry-light); }
</style>
