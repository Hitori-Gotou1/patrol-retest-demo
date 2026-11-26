<script setup>
import { computed } from 'vue';
const props = defineProps({ light: { type: String, required: true } });
const moods = {
  warm: { wall: '#f6e4c3', corner: '#c59d83', floor: '#b99177', boards: '#84604f', sky: '#f7d6aa', skyline: '#b79d96', frame: '#906753', curtain: '#b97f78', rug: '#e9cfac', inside: '#5b3c36', lamp: '#f8deb1' },
  pink: { wall: '#e8c3d3', corner: '#9b6d90', floor: '#a37d91', boards: '#725269', sky: '#d3bdce', skyline: '#a28caa', frame: '#865e7f', curtain: '#b16893', rug: '#e0bad0', inside: '#563857', lamp: '#f5cce0' },
  night: { wall: '#6b607d', corner: '#3f3957', floor: '#48425f', boards: '#97849e', sky: '#292f4e', skyline: '#454668', frame: '#99839f', curtain: '#654e6c', rug: '#77617a', inside: '#f7ddc7', lamp: '#ffe1a0' }
};
const mood = computed(() => moods[props.light]);
</script>

<template>
  <g aria-hidden="true">
    <defs>
      <linearGradient id="room-wall-light" x1="0" y1="0" x2="1" y2=".58">
        <stop :stop-color="mood.wall"/><stop offset="1" :stop-color="mood.corner"/>
      </linearGradient>
      <linearGradient id="room-floor-light" x1="0" y1="0" x2=".8" y2="1">
        <stop :stop-color="mood.corner"/><stop offset="1" :stop-color="mood.floor"/>
      </linearGradient>
      <linearGradient id="room-direct-sun" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#fff4ba" stop-opacity=".92"/><stop offset="1" stop-color="#ffe7a9" stop-opacity=".29"/>
      </linearGradient>
      <radialGradient id="room-lamp-glow">
        <stop :stop-color="mood.lamp" stop-opacity=".7"/><stop offset=".58" :stop-color="mood.lamp" stop-opacity=".23"/><stop offset="1" :stop-color="mood.lamp" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="room-floor-contact">
        <stop stop-color="#25182e" stop-opacity=".57"/><stop offset="1" stop-color="#291929" stop-opacity="0"/>
      </radialGradient>
      <clipPath id="room-window-opening"><circle cx="264" cy="194" r="106"/></clipPath>
      <clipPath id="room-floor-area"><path d="M100 382h860v238H0V470Z"/></clipPath>
    </defs>
    <rect width="960" height="620" fill="url(#room-wall-light)"/>
    <path d="M0 0h100v382L0 470Z" fill="#382a44" opacity=".19"/>
    <path d="M100 382h860v238H0V470Z" fill="url(#room-floor-light)"/>
    <path d="M100 0v382H960" fill="none" :stroke="mood.frame" stroke-width="3"/>
    <path d="M100 374h860v8H100L0 470v-9Z" :fill="mood.boards" opacity=".52"/>
    <g :stroke="mood.boards" opacity=".43" stroke-width="1.5" fill="none">
      <path d="M0 470h960M0 540h960M210 382 60 620m290-238-84 238m204-238v238m142-238 62 238m46-238 140 238"/>
    </g>
    <path d="M42 79h107v254l-21 8-25-7-27 9-31-9Z" :fill="mood.curtain"/>
    <path d="M383 79h42v250l-22 10-20-6Z" :fill="mood.curtain"/>
    <path d="M65 84v249m35-249v251m26-253v251m280-251v250" :stroke="mood.frame" stroke-width="3" opacity=".62"/>
    <circle cx="264" cy="194" r="110" :fill="mood.sky" :stroke="mood.frame" stroke-width="5"/>
    <g clip-path="url(#room-window-opening)">
      <circle cx="312" cy="141" :r="light === 'night' ? '17' : '26'" :fill="light === 'night' ? '#f6dac8' : '#fff1ba'"/>
      <path d="M150 265q72-41 121-30t104-22v93H150Z" :fill="mood.skyline"/>
      <path d="M150 270h32v-12h26v18h44v-34h25v-8h17v34h19v-14h25v-37h26v57h27v40H150Z" :fill="mood.frame" opacity=".64"/>
      <g v-if="light === 'night'" fill="#e4c598">
        <rect x="190" y="265" width="7" height="4"/><rect x="261" y="251" width="7" height="4"/><rect x="340" y="243" width="10" height="5"/>
        <circle cx="228" cy="132" r="2"/><circle cx="278" cy="117" r="1.7"/><circle cx="207" cy="179" r="1.5"/>
      </g>
      <path d="M264 84v220M154 194h220" :stroke="mood.frame" stroke-width="6"/>
      <path d="M259 84v220M154 190h220" :stroke="light === 'night' ? '#c7abc0' : '#f9ebcb'" opacity=".65" stroke-width="2"/>
    </g>
    <path d="M140 301h248v13H140Z" :fill="mood.frame"/>
    <path d="M140 301h248" :stroke="mood.sky" stroke-width="4"/>
    <ellipse cx="510" cy="499" rx="224" ry="65" :fill="mood.rug"/>
    <ellipse cx="510" cy="499" rx="207" ry="53" :stroke="mood.frame" stroke-opacity=".69" stroke-dasharray="6 5" fill="none"/>
    <g v-if="light === 'warm'" clip-path="url(#room-floor-area)">
      <path d="m190 371 93 8 129 222-157-7Zm102 9 84 7 204 220-152-6Z" fill="url(#room-direct-sun)"/>
      <path d="m217 478 211 14 16 16-223-14Z" :fill="mood.floor" opacity=".86"/>
      <path d="m184 373 194 16" stroke="#fff2cb" stroke-width="3" opacity=".65"/>
    </g>
    <g v-if="light === 'pink'">
      <ellipse cx="768" cy="296" rx="259" ry="229" fill="url(#room-lamp-glow)"/>
      <path d="M100 374h860" fill="none" stroke="#f3c6de" stroke-width="3" opacity=".72"/>
      <path d="M385 81v248M41 81v251" fill="none" stroke="#f7c6da" stroke-width="3" opacity=".72"/>
    </g>
    <g v-else-if="light === 'night'">
      <ellipse cx="801" cy="305" rx="239" ry="244" fill="url(#room-lamp-glow)"/>
      <ellipse cx="808" cy="420" rx="173" ry="63" fill="url(#room-lamp-glow)" opacity=".69"/>
    </g>
    <g transform="translate(801 360)" :stroke="mood.inside" stroke-opacity=".55" stroke-width="2">
      <ellipse cy="79" rx="106" ry="13" fill="url(#room-floor-contact)" stroke="none"/>
      <path d="M-82 5v72M82 5v72" stroke-width="8" fill="none"/>
      <path d="M-100-11h200V8h-200Z" :fill="light === 'night' ? '#6b5064' : '#bf947d'"/>
      <path d="M-100-11h200" :stroke="mood.lamp" stroke-width="3"/>
      <path d="M-60-21h48v10h-48zM-56-32h45v10h-45Z" fill="#bda999"/>
      <path d="M37-13V-61m-16 48h32" :stroke="mood.frame" stroke-width="4"/>
      <path d="m20-90-12 31h58L54-90Z" :fill="mood.lamp"/>
      <path d="M10-60h55" :stroke="mood.lamp" stroke-width="4"/>
    </g>
  </g>
</template>
