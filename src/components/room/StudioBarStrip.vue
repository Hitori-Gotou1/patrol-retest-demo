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
const inks = ['#cc7496', '#638aa0', '#b78145', '#6a8b63'];
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
        <span class="studio-bar-name"><small>{{ String(index + 1).padStart(2,'0') }}</small>{{ bar.name }}</span>
        <svg viewBox="0 0 176 62" aria-hidden="true">
          <path d="M7 3v56m40-56v56m40-56v56m40-56v56m40-56v56" fill="none" stroke="#775a61" stroke-width="1.5" opacity=".68"/>
          <g v-for="(mask,row) in bar.masks" :key="row" :data-track="studioTracks[row].id" :data-mask="mask" :fill="inks[row]">
            <path :d="`M7 ${11 + row * 13}h160`" stroke="#c7ac9a" stroke-width=".6"/>
            <circle v-for="n in 16" :key="n" :cx="12 + (n-1)*10" :cy="11 + row*13"
              :r="mask & (1 << (n-1)) ? 3.15 : .8" :data-beat="Boolean(mask & (1 << (n-1)))"/>
          </g>
          <rect v-if="playing === index && step >= 0" class="studio-playline" :data-step="step + 1"
            :x="11.1 + step * 10" y="2" width="1.8" height="58" fill="#312638"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.studio-ribbon { padding:10px 13px 8px; background:#eedac8; border-bottom:1px solid #bf9f9b; min-width:0; }
.studio-ribbon-header { display:flex; align-items:center; justify-content:space-between; gap:5px 12px; flex-wrap:wrap; margin:0 0 5px; color:#583b4d; }
.studio-ribbon-header h3 { margin:0; font-size:14px; }
.studio-ribbon-header span { font-size:11px; }
.studio-ribbon .bar-tabs { position:relative; display:flex; flex-wrap:nowrap; gap:6px; overflow-x:auto; margin:0; padding:4px 2px 6px; scrollbar-width:thin; }
.studio-ribbon .studio-bar { position:relative; flex:0 0 clamp(132px,17%,180px); min-width:0; display:grid; justify-items:stretch; color:#543447; background:#fff4de; border:1px solid #b89b8e; padding:5px 7px; text-align:start; gap:1px; }
.studio-ribbon .studio-bar[aria-pressed=true] { outline:2px solid #72405f; outline-offset:-3px; color:#473045; background:#fae4d2; }
.studio-ribbon .studio-bar:focus-visible { outline:3px solid #4a2944; outline-offset:-1px; }
.studio-bar-name { display:flex; align-items:baseline; gap:5px; font-weight:700; padding-inline:4px; line-height:1.28; overflow-wrap:anywhere; }
.studio-bar-name small { font:11px var(--mono,monospace); }
.studio-ribbon .studio-bar svg { display:block; width:100%; height:auto; }
.studio-bar[data-loop-start=true]::before,.studio-bar[data-loop-end=true]::after { content:""; position:absolute; top:19px; bottom:5px; width:6px; border:2px solid #a16655; pointer-events:none; }
.studio-bar[data-loop-start=true]::before { left:3px; border-right:0; }
.studio-bar[data-loop-end=true]::after { right:3px; border-left:0; }
@media(max-width:760px) {
  .studio-ribbon { padding:6px 7px 3px; }
  .studio-ribbon .studio-bar { flex-basis:117px; padding:4px 5px; }
}
</style>
