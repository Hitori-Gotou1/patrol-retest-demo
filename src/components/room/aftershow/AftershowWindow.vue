<script setup>
import { computed, useId } from 'vue';
import AftershowPoster from './AftershowPoster.vue';

const props = defineProps({ poster: Object, stop: String, progress: Number, reduced: Boolean });
const prefix = useId();
const paint = name => `url(#${prefix}-${name})`;
const displacement = computed(() => props.reduced ? 0 : (props.progress - (props.stop === 'station' ? 0 : props.stop === 'tunnel' ? 50 : 100)) * -2.2);
const platformBays = [47, 206, 365, 524, 683, 842];
const houses = [
  { x: -65, y: 174, w: 115, h: 125, roof: 35, paint: '#303853', windows: [true, false, true, true] },
  { x: 48, y: 203, w: 100, h: 96, roof: 26, paint: '#3b4260', windows: [false, true, true, false] },
  { x: 151, y: 168, w: 117, h: 131, roof: 33, paint: '#303b5d', windows: [true, true, false, true] },
  { x: 273, y: 193, w: 100, h: 106, roof: 37, paint: '#343c58', windows: [true, false, true, true] },
  { x: 384, y: 154, w: 144, h: 145, roof: 32, paint: '#35415c', windows: [true, false, false, true] },
  { x: 529, y: 188, w: 112, h: 111, roof: 30, paint: '#39405a', windows: [true, true, true, false] },
  { x: 653, y: 162, w: 114, h: 137, roof: 36, paint: '#384263', windows: [false, true, true, true] },
  { x: 762, y: 192, w: 100, h: 107, roof: 30, paint: '#35405f', windows: [false, true, true, false] },
];
const stars = [[20, 59], [91, 106], [131, 45], [204, 91], [240, 48], [311, 116], [350, 33], [436, 93], [482, 58], [546, 40], [616, 102], [683, 44], [698, 120]];
</script>

<template>
  <svg class="aftershow-window-art" viewBox="0 0 720 365" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <clipPath :id="`${prefix}-pane`"><rect x="21" y="21" width="678" height="322" rx="19"/></clipPath>
      <linearGradient :id="`${prefix}-edge`" x2="0" y2="1"><stop stop-color="#60687b"/><stop offset=".47" stop-color="#252d44"/><stop offset="1" stop-color="#747b8a"/></linearGradient>
      <linearGradient :id="`${prefix}-night`" x2="0" y2="1"><stop stop-color="#202940"/><stop offset="1" stop-color="#63576a"/></linearGradient>
      <linearGradient :id="`${prefix}-tunnel`" x2="1" y2="1"><stop stop-color="#0a1024"/><stop offset=".66" stop-color="#141c31"/><stop offset="1" stop-color="#222d41"/></linearGradient>
      <linearGradient :id="`${prefix}-glass`" x2="0" y2="1"><stop stop-color="#b2cee7" stop-opacity=".20"/><stop offset=".44" stop-color="#b2cee7" stop-opacity="0"/><stop offset=".9" stop-color="#c0cbe8" stop-opacity=".055"/><stop offset="1" stop-color="#080e1a" stop-opacity=".4"/></linearGradient>
      <radialGradient :id="`${prefix}-warm`"><stop stop-color="#ffc989" stop-opacity=".65"/><stop offset="1" stop-color="#e3ac8d" stop-opacity="0"/></radialGradient>
      <radialGradient :id="`${prefix}-moon`"><stop stop-color="#f8d2a8" stop-opacity=".32"/><stop offset="1" stop-color="#f8d2a8" stop-opacity="0"/></radialGradient>
    </defs>

    <rect width="720" height="365" rx="34" fill="#0b1327"/>
    <rect x="5" y="5" width="710" height="355" rx="30" :fill="paint('edge')"/>
    <rect x="13" y="13" width="694" height="339" rx="23" fill="#10172b" stroke="#8998ac" stroke-opacity=".4"/>
    <g :clip-path="paint('pane')">
      <rect x="21" y="21" width="678" height="322" fill="#13192c"/>

      <g :class="['aftershow-window-scene', { visible: stop === 'station' }]">
        <rect width="720" height="365" :fill="paint('night')"/>
        <path d="M0 139h720v77H0z" fill="#24243a"/>
        <path d="M0 56h720v81H0z" fill="#2a2a3f"/>
        <path d="M0 56L720 40V24L0 41z" fill="#57566a"/>
        <path d="M0 62h720m-720 11h720M0 133h720M0 145h720" fill="none" stroke="#a4858f" stroke-opacity=".55"/>
        <path d="M0 208l720 15v63H0z" fill="#575262"/>
        <path d="M0 246l720 8v17L0 265z" fill="#cb9e68"/>
        <path d="M0 261l720 6v19H0z" fill="#302d42"/>
        <path d="M0 294l720 2m-720 20h720" stroke="#7a7581" stroke-width="5"/>
        <path d="M0 302l720 2m-720 20h720" stroke="#181827" stroke-width="9"/>
        <g :transform="`translate(${displacement} 0)`">
          <g v-for="x in platformBays" :key="x" :transform="`translate(${x} 0)`">
            <path d="M0 228l56 2 111 35h-85z" :fill="paint('warm')" opacity=".7"/>
            <path d="M32 139h110v65H32z" fill="#3c354b" stroke="#6a5865"/>
            <path d="M32 173h110m-55-34v65" stroke="#8d7078" stroke-opacity=".6"/>
            <path d="M0 74h13v166H0z" fill="#887b88"/>
            <path d="M9 74h4v167H9z" fill="#57566a"/>
            <path d="M20 80h105v6H20z" fill="#fbd3a4"/>
            <ellipse cx="72" cy="94" rx="104" ry="38" :fill="paint('warm')"/>
            <path d="M20 250h126m-16-3 5 7m-16-7 5 7m-16-7 5 7m-16-7 5 7" stroke="#daaf76" stroke-width="2" opacity=".37"/>
          </g>
          <path d="M256 112h156v49H256z" fill="#e0c6ba" stroke="#262737" stroke-width="2"/>
          <path d="M256 146h156v15H256z" fill="#855d80"/>
          <text x="334" y="138" text-anchor="middle" fill="#2b2d42" font-family="sans-serif" font-size="19" font-weight="700">下 北 沢</text>
          <text x="334" y="156" text-anchor="middle" fill="#f5e6dd" font-family="monospace" font-size="8" letter-spacing="2">SHIMOKITAZAWA</text>
          <path d="M498 191h93v12h-93zM505 202v27m78-27v27" fill="#776170" stroke="#5c4859" stroke-width="4"/>
          <path d="M451 220c0-16 2-24 7-35l-4 35zm10-38a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm3 4 8 15-3 20h-4l-1-17-4 17h-5l2-25z" fill="#2e2b40"/>
          <path d="M680 190v15m-35-91v45" stroke="#e5b187" stroke-opacity=".6"/>
        </g>
      </g>

      <g :class="['aftershow-window-scene', { visible: stop === 'tunnel' }]">
        <path d="M0 0h720v365H0z" :fill="paint('tunnel')"/>
        <g :transform="`translate(${displacement} 0)`" fill="none">
          <path d="M-100 84h930m-930 17h930m-930 152h930m-930 13h930" stroke="#47546d" stroke-opacity=".32"/>
          <path d="M-100 227C90 229 222 190 374 190h345M-100 239c180 0 329-37 472-39h346" stroke="#9fc1df" stroke-opacity=".24"/>
          <path d="M-100 295h930m-930 16h930" stroke="#465376" stroke-opacity=".4" stroke-width="3"/>
          <path d="M69 5l-31 360m163-360-28 360m166-360-28 360m168-360-24 360m164-360-19 360m164-360-13 360" stroke="#3c4763" stroke-opacity=".28" stroke-width="5"/>
          <path d="M77 64h34m246 0h46m203 0h36" stroke="#8d8da5" stroke-opacity=".36" stroke-width="2" stroke-linecap="round"/>
        </g>
        <g v-if="stop === 'tunnel'" data-train-reflection="true" opacity=".44">
          <path d="M16 63h630l55 14H16z" fill="#d6c0a3" opacity=".27"/>
          <path d="M69 74v248m186-247v221m401-229v268" stroke="#a7b4d0" stroke-opacity=".46" stroke-width="3"/>
          <path d="M125 71v20l-6 8h15l-5-8V71m71 0v21l-6 8h15l-5-8V71" fill="none" stroke="#dbc0a1" stroke-width="2" stroke-opacity=".63"/>
          <g transform="translate(602 37) scale(-1 1) rotate(8)">
            <AftershowPoster :poster="poster" x="14" y="13" width="148" height="192" aria-hidden="true"/>
          </g>
          <path d="M0 274q49-31 112-8l58 54H0m720-104q-42-20-86 10l-63 98h149" fill="#875c80" opacity=".38"/>
        </g>
      </g>

      <g :class="['aftershow-window-scene', { visible: stop === 'homes' }]">
        <rect width="720" height="365" :fill="paint('night')"/>
        <circle cx="507" cy="79" r="72" :fill="paint('moon')"/>
        <path d="M504 70a12 12 0 1 1-12 17 10 10 0 0 0 12-17z" fill="#ebd1ad"/>
        <circle v-for="[cx, cy] in stars" :key="cx" :cx="cx" :cy="cy" :r="cx % 3 === 0 ? 1.6 : .9" fill="#e4c3aa" opacity=".7"/>
        <path d="M0 238v-51h32v-15h42v34h17v-79h36v20h20v21h33v-24h38v37h31v-61h55v74h38v-30h63v-37h22v26h44v-42h27v13h30v53h32v-44h46v29h31v-48h37v32h16v39h30v67z" fill="#3f4864"/>
        <path d="M37 201h11m70-42h5m14 30h13m112-38h14m8 35h9m128-15h6m143 14h10m90-30h8" stroke="#bea481" stroke-opacity=".8" stroke-width="4"/>
        <g :transform="`translate(${displacement} 0)`">
          <path d="M0 282h720v62H0z" fill="#292c47"/>
          <g v-for="house in houses" :key="house.x" :transform="`translate(${house.x} ${house.y})`">
            <path :d="`M0 0h${house.w}v${house.h}H0z`" :fill="house.paint"/>
            <path :d="`M-6 1 ${house.w * .5} ${-house.roof} ${house.w + 8} 1z`" fill="#2a304b" stroke="#727085" stroke-opacity=".52" stroke-width="2"/>
            <path :d="`M-6 0h${house.w + 14}m-8 56h${house.w + 14}`" stroke="#716482" stroke-opacity=".62"/>
            <g v-for="(lit, index) in house.windows" :key="index" :transform="`translate(${18 + (index % 2) * (house.w / 2 - 5)} ${19 + Math.floor(index / 2) * 45})`">
              <circle v-if="lit" cx="13" cy="10" r="29" :fill="paint('warm')"/>
              <rect width="25" height="22" rx="1" :fill="lit ? '#ebbd8d' : '#232c44'" stroke="#9e7681" stroke-opacity=".65"/>
              <path d="M12 0v22M0 10h25" fill="none" :stroke="lit ? '#a47d72' : '#424a62'"/>
              <path v-if="lit && index % 2 === 0" d="M2 3h8l-3 16H2zm21 0h-8l3 16h5z" fill="#f2d3a6" opacity=".7"/>
            </g>
          </g>
          <path d="M0 128q114 53 220 47t253-27 247 9" fill="none" stroke="#161e36" stroke-width="2"/>
          <path d="M112 100v210m-16-192h39m424-11v199m-14-179h37" fill="none" stroke="#242c45" stroke-width="4"/>
          <path d="M0 333q274-28 720-2v26H0z" fill="#22283e"/>
          <path d="M5 301h710" stroke="#a9878c" stroke-opacity=".4" stroke-width="3"/>
        </g>
      </g>

      <rect x="21" y="21" width="678" height="322" :fill="paint('glass')"/>
      <path d="M553 23h55L376 341h-54zM622 23h19L410 341h-18z" fill="#ebedf1" opacity=".046"/>
      <path d="M26 44q0-18 18-18h626M25 317q0 21 23 21h623" fill="none" stroke="#b1bad0" stroke-opacity=".26"/>
    </g>
    <circle v-for="[cx, cy] in [[30, 12], [690, 12], [30, 352], [690, 352]]" :key="`${cx}-${cy}`" :cx="cx" :cy="cy" r="2.2" fill="#a6a5ac"/>
  </svg>
</template>

<style scoped>
.aftershow-window-art { display: block; width: 100%; height: 100%; }
.aftershow-window-scene { opacity: 0; transition: opacity 240ms ease; }
.aftershow-window-scene.visible { opacity: 1; }
[data-motion='reduce'] .aftershow-window-scene { transition: none; }
@media (prefers-reduced-motion: reduce) { .aftershow-window-scene { transition: none; } }
</style>
