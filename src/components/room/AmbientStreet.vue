<script setup>
import { computed } from 'vue';
const props = defineProps({ light: { type: String, required: true }, levels: { type: Object, required: true } });
const palettes = {
  violet: { sky:'#3d3552', horizon:'#67506c', far:'#3a334d', front:'#312a3c', stone:'#716078', outline:'#a187a1', window:'#ecd1a0', door:'#dd99b1', rain:'#c9b1d8' },
  amber: { sky:'#54414b', horizon:'#966a63', far:'#483945', front:'#382b36', stone:'#866354', outline:'#bb8f7c', window:'#ffe1a2', door:'#efb275', rain:'#ebc4b1' },
  blue: { sky:'#2e435f', horizon:'#577780', far:'#324962', front:'#27364b', stone:'#607f88', outline:'#83a3aa', window:'#d8e8c5', door:'#8cbeca', rain:'#b0dce7' }
};
const palette = computed(() => palettes[props.light]);
const windowLight = computed(() => .15 + props.levels.street * .85);
const doorWidth = computed(() => 11 + props.levels.tuning * 92);
const windows = [[97, 288], [125, 288], [173, 251], [199, 251], [259, 305], [285, 305], [312, 305]];
const people = [
  [579, 479, .77], [608, 493, .94], [550, 488, .84], [642, 480, .74],
  [569, 517, 1.07], [620, 520, .97], [656, 510, .9], [525, 512, .88]
];
</script>

<template>
  <g aria-hidden="true">
    <defs>
      <clipPath id="ambient-street-frame"><rect x="29" y="94" width="662" height="477" rx="5"/></clipPath>
      <clipPath id="ambient-side-door"><rect :x="525 - doorWidth" y="305" :width="doorWidth" height="167"/></clipPath>
      <linearGradient id="ambient-night-sky" x2="0" y2="1">
        <stop :stop-color="palette.sky"/><stop offset="1" :stop-color="palette.horizon"/>
      </linearGradient>
      <linearGradient id="ambient-door-spill" x2="0" y2="1">
        <stop :stop-color="palette.door" stop-opacity=".62"/><stop offset="1" :stop-color="palette.door" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g clip-path="url(#ambient-street-frame)">
      <rect x="29" y="94" width="662" height="477" fill="url(#ambient-night-sky)"/>
      <path d="M29 288h52v-39h71v-26h84v49h37v-31h61v37h44v125H29Z" :fill="palette.far"/>
      <path d="M39 266h41m64-31h94m14 35h31m-199 66h258" :stroke="palette.outline" opacity=".61" stroke-width="2"/>
      <path d="M52 105h338M48 139h169M258 154h129" stroke="#f0d8de" opacity=".12" stroke-width="4"/>
      <path d="M29 353h330v35H29Zm28-6h227v49H57Z" :fill="palette.far"/>
      <g :opacity="windowLight" data-layer="street">
        <rect x="65" y="356" width="218" height="31" rx="2" :fill="palette.window"/>
        <path d="M81 356v31m36-31v31m36-31v31m36-31v31m36-31v31m36-31v31" :stroke="palette.front" stroke-width="6"/>
        <g v-for="[x, y] in windows" :key="x">
          <rect :x="x" :y="y" width="17" height="22" rx="1" :fill="palette.window"/>
          <path :d="`M${x+8} ${y}v22`" :stroke="palette.far" stroke-width="3"/>
        </g>
        <path d="m115 401 35-1-66 96h-61zm88 0 26 1 24 53-67-2Z" :fill="palette.window" opacity=".23"/>
      </g>
      <path d="M29 407 367 374l324 38v159H29Z" :fill="palette.stone"/>
      <path d="M29 406 366 374l325 38m-662 55 337-75 325 75M43 571l327-176m276 176L370 395" :stroke="palette.outline" stroke-opacity=".64" stroke-width="2" fill="none"/>
      <path d="M29 522q66-18 133-19m-84 46q72-8 144-10m-6-89 95-20m219 112h140" :stroke="palette.window" stroke-opacity=".3" stroke-width="2" fill="none"/>
      <path d="M320 219 690 171v278H356l-36-35Z" :fill="palette.front" :stroke="palette.outline" stroke-width="3"/>
      <path d="M333 237 690 190v28l-348 45Z" :fill="palette.stone"/>
      <path d="M351 269 686 230m-342 36 19 163m28-174 10 175" :stroke="palette.outline" opacity=".57" stroke-width="3"/>
      <path d="M414 272h126v27H414Z" :fill="palette.front" :stroke="palette.window" stroke-width="1.5"/>
      <text x="477" y="291" text-anchor="middle" :fill="palette.window" font-family="sans-serif" font-size="18" font-weight="800" letter-spacing="3">STARRY</text>
      <path d="M417 303h117v168H417Z" fill="#211b2a" :stroke="palette.outline" stroke-width="3"/>
      <g data-layer="tuning">
        <rect :x="525 - doorWidth" y="305" :width="doorWidth" height="167" :fill="palette.door" :opacity=".11 + levels.tuning * .83"/>
        <g v-if="levels.tuning > 0" clip-path="url(#ambient-side-door)" :opacity=".56 + levels.tuning * .44">
          <path d="m420 458 101-110 8 7-104 112Z" fill="#3c293f"/>
          <path d="m441 437 79-85m-71 85 76-81m-70 67 12 10m-3-20 11 11m-1-22 10 11m0-21 9 11m0-20 10 9" stroke="#fce1bc" stroke-width="2" fill="none"/>
          <path d="m511 357 11-20 10-5 9 13-12 17-11 5Z" fill="#ecd1ad" stroke="#472f46" stroke-width="2"/>
        </g>
        <path :d="`M${525 - doorWidth} 473H525l${9 + 39 * levels.tuning} 53H${516 - doorWidth * 1.66}Z`"
          fill="url(#ambient-door-spill)" :opacity="levels.tuning"/>
      </g>
      <path d="M551 292h106v177H551Z" fill="#241d2b" :stroke="palette.outline" stroke-width="4"/>
      <path d="M560 301h88v168h-88Z" :fill="palette.door" opacity=".32"/>
      <path d="M549 291h110m-108 179h105m-104 6h105" :stroke="palette.outline" stroke-width="4"/>
      <rect x="580" y="315" width="48" height="18" rx="2" :fill="palette.window"/>
      <text x="604" y="328" text-anchor="middle" fill="#433142" font-family="sans-serif" font-size="10" font-weight="800">EXIT</text>
      <g data-layer="crowd">
        <g v-for="([x, y, scale], index) in people.slice(0, Math.ceil(levels.crowd * people.length))" :key="x"
          :transform="`translate(${x},${y}) scale(${scale})`">
          <ellipse cy="1" rx="17" ry="5" fill="#231e2e" opacity=".55"/>
          <path d="M-12-26q2-13 12-13t12 13l5 18H9L7 0H-7l-2-8h-8Z" :fill="index % 2 ? palette.front : '#272230'" :stroke="palette.outline" stroke-width="1.4"/>
          <circle cy="-47" r="8" :fill="palette.front" :stroke="palette.outline" stroke-width="1.4"/>
        </g>
      </g>
      <path d="M29 94h662v19L328 157 29 127Z" :fill="palette.front" :stroke="palette.outline" stroke-width="3"/>
      <path d="M29 127 328 157l363-44" :stroke="palette.stone" stroke-width="7" fill="none"/>
      <g class="ambient-rain" data-layer="rain" :stroke="palette.rain" :opacity=".49 + .4 * levels.rain" stroke-width="2" stroke-linecap="round">
        <path v-for="n in Math.ceil(levels.rain * 56)" :key="n"
          :d="`M${42 + (n * 89) % 326} ${160 + (n * 71) % 355}l${-4 - n % 6} ${16 + n % 18}`"/>
      </g>
      <path d="M30 557h659v14H30Z" :fill="palette.front"/>
    </g>
    <rect x="29" y="94" width="662" height="477" rx="5" fill="none" :stroke="palette.outline" stroke-width="2.5"/>
  </g>
</template>

<style scoped>
.ambient-rain { animation:ambient-fall 1.5s linear infinite paused; }
[data-playing=true] .ambient-rain { animation-play-state:running; }
@keyframes ambient-fall { from { transform:translateY(-6px); } to { transform:translateY(7px); } }
@media(prefers-reduced-motion:reduce) { .ambient-rain { animation:none; } }
</style>
