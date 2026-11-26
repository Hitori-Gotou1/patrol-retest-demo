<script setup>
import { computed } from 'vue';
import { shopTuningTolerance } from '../../room/shopGame.js';

const props = defineProps({ cents:Number, note:String, phase:String });
const point = (cents, radius) => {
  const angle = cents / 30 * Math.PI / 3;
  return { x:140 + Math.sin(angle) * radius, y:113 - Math.cos(angle) * radius };
};
const arc = (a,b,radius) => {
  const start = point(a,radius), end = point(b,radius);
  return `M${start.x} ${start.y}A${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
};
const pin = computed(() => point(props.cents,76));
const valid = computed(() => Math.abs(props.cents) <= shopTuningTolerance);
const phaseLabel = computed(() => ({ ready:'待营业',serving:'正在校弦',paused:'营业暂停',closed:'今日停业' }[props.phase]));
const reading = computed(() => props.phase === 'closed' ? '—' : (props.cents > 0 ? '+' : '') + props.cents);
</script>

<template>
  <figure class="shop-meter" :data-phase="phase" :data-cents="cents" :data-in-tune="phase !== 'closed' && valid">
    <svg viewBox="0 0 280 144" role="img" :aria-label="`${phaseLabel} · ${note || '测试弦'} · ${reading} 音分`">
      <rect x="3" y="3" width="274" height="138" rx="7" fill="#faebd2" stroke="#987165" stroke-width="2"/>
      <path :d="arc(-30,30,87)" stroke="#6e5357" stroke-width="2" fill="none"/>
      <path :d="arc(-shopTuningTolerance,shopTuningTolerance,89)" stroke="#577b64" stroke-width="8" fill="none"/>
      <path :d="arc(-shopTuningTolerance,shopTuningTolerance,93)" stroke="#364f43" stroke-width="1.4" fill="none"/>
      <line v-for="tick in [-30,-24,-18,-12,-6,-3,0,3,6,12,18,24,30]" :key="tick"
        :x1="point(tick,89).x" :y1="point(tick,89).y" :x2="point(tick,tick%10===0 ? 75 : 80).x" :y2="point(tick,tick%10===0 ? 75 : 80).y"
        stroke="#6c4f56" :stroke-width="tick===0 ? 2.5 : 1.25"/>
      <g fill="#815d58" font-family="monospace" font-size="12" text-anchor="middle">
        <text x="46" y="79">−30</text><text x="140" y="17">0</text><text x="232" y="79">+30</text>
      </g>
      <g v-if="phase !== 'closed'">
        <path class="shop-needle" :d="`M140 102L${pin.x} ${pin.y}`" :stroke="valid ? '#35654c' : '#903c5c'" stroke-width="3.4" stroke-linecap="round"/>
        <circle cx="140" cy="102" r="5.5" fill="#563e46"/>
      </g>
      <text x="140" y="130" text-anchor="middle" fill="#513647" font-size="21" font-weight="750">{{ phase === 'closed' ? '休息中' : note }}</text>
    </svg>
    <figcaption><span>{{ phaseLabel }}</span><strong>{{ reading }} 音分</strong><span>合格 ±{{ shopTuningTolerance }}</span></figcaption>
  </figure>
</template>

<style scoped>
.shop-meter { margin:4px 0 7px; }
.shop-meter svg { display:block; width:min(100%,320px); height:auto; margin:auto; }
.shop-meter figcaption { display:flex; justify-content:space-between; gap:4px; font-size:12px; color:#684b58; margin:4px 0; }
.shop-meter figcaption strong { color:#503447; font-variant-numeric:tabular-nums; }
</style>
