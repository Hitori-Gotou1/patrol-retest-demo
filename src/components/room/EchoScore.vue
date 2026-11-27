<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { echoNotes } from '../../data/adventures.js';

const props = defineProps({
  beats:{ type:Number,required:true },
  answers:{ type:Array,required:true },
  original:{ type:Array,default:null },
  active:{ type:Number,default:-1 }
});
const compact = ref(false);
let media;
function resize() { compact.value = media.matches; }
onMounted(() => {
  media = matchMedia('(max-width:680px)');
  resize();
  media.addEventListener('change',resize);
});
onBeforeUnmount(() => media?.removeEventListener('change',resize));
const groups = computed(() => {
  const perLine = compact.value ? 5 : props.beats;
  const beats = Array.from({ length:props.beats }, (_, i) => ({
    i, original:props.original?.[i], answer:props.answers[i]
  }));
  return Array.from({ length:Math.ceil(beats.length/perLine) }, (_, index) => beats.slice(index*perLine,(index+1)*perLine));
});
const pitch = value => 88 - value*16;
const noteName = value => echoNotes[value]?.label || '';
function beatLabel(beat) {
  const heard = beat.original == null ? '' : '，原音 ' + noteName(beat.original);
  const answer = beat.answer == null ? '，还未输入' : '，回声 ' + noteName(beat.answer);
  const difference = beat.original == null || beat.answer == null ? ''
    : beat.answer === beat.original ? '，相同' : beat.answer > beat.original ? '，偏高' : '，偏低';
  return `第 ${beat.i+1} 拍${heard}${answer}${difference}`;
}
</script>

<template>
  <div class="echo-score">
    <div class="echo-legend">
      <span v-if="original"><i class="echo-solid"></i> 听见的旋律</span>
      <span><i class="echo-ring"></i> 你的回声</span>
    </div>
    <div v-for="group in groups" :key="group[0]?.i" class="echo-line"
      :style="{ '--beats':group.length }" role="group" :aria-label="`第 ${group[0]?.i+1} 至 ${group.at(-1)?.i+1} 拍`">
      <div class="echo-scale" aria-hidden="true"><span>拍</span>
        <div><small v-for="note in echoNotes.slice().reverse()" :key="note.key">{{ note.label }}</small></div>
      </div>
      <div v-for="beat in group" :key="beat.i" class="echo-beat" :class="{ 'is-current':active===beat.i }"
        :data-beat="beat.i+1" :data-playing="active===beat.i" role="img" :aria-label="beatLabel(beat)">
        <strong aria-hidden="true">{{ beat.i+1 }}</strong>
        <svg viewBox="0 0 40 96" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path v-if="beat.original!=null && beat.answer!=null && beat.original!==beat.answer"
            :d="`M20 ${pitch(beat.original)}V${pitch(beat.answer)}`" stroke="#795971" stroke-width="2"/>
          <circle v-if="beat.original!=null" :cy="pitch(beat.original)" cx="20" r="4.4" fill="#59394f" class="echo-heard" :data-note="beat.original"/>
          <circle v-if="beat.answer!=null" :cy="pitch(beat.answer)" cx="20" r="7" fill="none"
            :stroke="beat.answer===beat.original?'#59394f':'#88506f'" stroke-width="2" class="echo-played" :data-note="beat.answer"/>
        </svg>
        <div class="echo-beat-names" aria-hidden="true">
          <span v-if="original">{{ noteName(beat.original) }}</span><span>{{ noteName(beat.answer) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.echo-score { min-width:0; text-align:center; color:#584356; }
.echo-legend { display:flex; justify-content:flex-start; flex-wrap:wrap; gap:7px 18px; margin:7px 0; font-size:12px; }
.echo-legend span { display:flex; align-items:center; gap:6px; }
.echo-legend i { width:11px; height:11px; display:inline-block; border-radius:50%; border:2px solid #835572; }
.echo-legend .echo-solid { background:#5d3d53; border-color:#5d3d53; }
.echo-line { display:grid; grid-template-columns:36px repeat(var(--beats),minmax(0,1fr)); margin:0 0 7px; min-width:0; border:1px solid #bda3ad; background:#fff7e6; }
.echo-scale,.echo-beat { display:grid; grid-template-rows:22px 96px auto; justify-items:stretch; min-width:0; }
.echo-scale { background:#eedfcf; color:#62465b; }
.echo-scale>span,.echo-beat>strong { border-bottom:1px solid #c5acb3; padding-top:2px; font-size:11px; }
.echo-scale>div { display:grid; grid-template-rows:repeat(6,1fr); align-items:center; font:10px var(--mono,monospace); }
.echo-beat { border-left:1px solid #d6c0c4; }
.echo-beat svg { width:100%; height:96px; display:block; background:repeating-linear-gradient(0deg,transparent 0 7px,#bdabb4 7px 8px,transparent 8px 16px); }
.echo-beat.is-current { box-shadow:inset 0 0 0 2px #875674; background:#efd7dc; }
.echo-beat-names { display:grid; grid-auto-rows:minmax(15px,auto); place-items:center; min-height:15px; font:10px var(--mono,monospace); background:#ead4df55; overflow-wrap:anywhere; }
.echo-beat-names span:first-child { font-weight:700; }
@media(max-width:680px) {
  .echo-line { grid-template-columns:31px repeat(var(--beats),minmax(0,1fr)); }
}
</style>
