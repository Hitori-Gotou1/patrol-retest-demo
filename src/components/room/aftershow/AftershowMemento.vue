<script setup>
import { computed } from 'vue';
import AftershowPoster from './AftershowPoster.vue';

const props = defineProps({ poster: Object, title: String, viewLabel: String });
const titleSize = computed(() => Math.min(28, 270 / Math.max(1, [...props.title].length)));
const punch = ['#eda6c3', '#e6c66f', '#8da8da', '#d48487'];
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720" width="960" height="720" data-memento-export font-family="sans-serif" aria-hidden="true">
    <rect width="960" height="720" fill="#151d34"/>
    <path d="M0 110Q460 30 960 80v245Q478 263 0 360z" fill="#212b46"/>
    <path d="M0 564Q460 486 960 522m-960 80q460-78 960-42" fill="none" stroke="#627389" stroke-opacity=".25" stroke-width="2"/>
    <rect x="30" y="30" width="900" height="660" rx="4" fill="none" stroke="#ac9b9a" stroke-opacity=".42"/>
    <path d="M30 60h17V30m883 30h-17V30M30 660h17v30m883-30h-17v30" fill="none" stroke="#debd9e" stroke-width="2"/>
    <text x="70" y="66" fill="#e0a8bf" font-family="monospace" font-size="13" letter-spacing="3">STARRY / AFTER SHOW</text>
    <text x="883" y="66" fill="#e2b798" text-anchor="end" font-family="monospace" font-size="13" letter-spacing="2">SHIMOKITAZAWA</text>
    <rect x="76" y="96" width="432" height="558" fill="#0b1223"/>
    <AftershowPoster :poster="poster" x="70" y="89" width="432" height="558" aria-hidden="true"/>
    <path d="M550 123h334v107q-14 0-14 14t14 14v323H550V258q14 0 14-14t-14-14z" fill="#e9d6ba"/>
    <path d="M560 133h314v93m-314 40v305h314V266m-310-22h306" fill="none" stroke="#8c7580" stroke-opacity=".66" stroke-width="1.4" stroke-dasharray="3 5"/>
    <path d="M550 123h334v12H550z" fill="#e9a6c1"/>
    <text x="578" y="180" fill="#2b2d45" font-size="27" font-weight="700">散场纪念车票</text>
    <text x="580" y="210" fill="#66546d" font-family="monospace" font-size="11" letter-spacing="3">LAST TRAIN HOME</text>
    <text x="580" y="302" fill="#66546d" font-size="13" letter-spacing="2">选中的一拍</text>
    <text x="579" y="340" fill="#2b2d45" font-size="22" font-weight="700">{{ viewLabel }} · 第 {{ poster.beat }} 拍</text>
    <text x="580" y="397" fill="#66546d" font-size="13" letter-spacing="2">随身海报</text>
    <text x="579" y="435" fill="#2b2d45" :font-size="titleSize" font-weight="700">{{ title }}</text>
    <path d="M580 490h273" stroke="#756779" stroke-dasharray="3 5"/>
    <circle v-for="(ink, index) in punch" :key="ink" :cx="587 + index * 19" cy="518" r="5.5" :fill="ink" stroke="#524963" stroke-width=".5"/>
    <text x="853" y="523" fill="#66546d" text-anchor="end" font-size="12">已到站</text>
    <text x="850" y="625" fill="#d4a8bd" text-anchor="end" font-size="16">一里小屋 · HITORI ROOM</text>
  </svg>
</template>
