<script setup>
import FestivalArt from './FestivalArt.vue';
import { art, circle, rect, registration, text, weft } from '../../../room/festival/art.js';
import './festival-entry.css';

defineProps({ to: String, title: String });

const ticket = art(540, 240,
  rect(0, 0, 540, 240, '#352238') + weft(540, 240, '#b76d86', 8)
  + '<g transform="translate(117 34) rotate(-12 140 90)"><rect x="10" y="11" width="305" height="160" rx="3" fill="#1c1423" opacity=".64"/>'
  + rect(0, 0, 305, 160, '#e9b990', 'rx="3"')
  + rect(12, 12, 281, 136, 'none', 'rx="2" stroke="#935969" stroke-width="1" stroke-dasharray="3 4"')
  + text(154, 82, 'STARRY', 46, '#4d2e46', 'text-anchor="middle" letter-spacing="5" font-weight="900"')
  + text(154, 115, '地下文化祭', 22, '#4d2e46', 'text-anchor="middle" letter-spacing="6" font-weight="800"')
  + circle(2, 80, 9, '#352238') + circle(304, 80, 9, '#352238') + '</g>'
  + '<path d="M414 140Q461 120 468 87Q475 47 448 57Q429 65 444 86Q471 122 512 107" fill="none" stroke="#e7a859" stroke-width="2.5"/>'
  + registration(56, 58, '#bd7a7e') + registration(481, 196, '#bd7a7e'));
</script>

<template>
  <RouterLink :to="to" class="festival-entry" aria-labelledby="festival-entry-title" aria-describedby="festival-entry-description">
    <div class="festival-entry-art"><FestivalArt :picture="ticket" fill /></div>
    <div class="festival-entry-copy">
      <h3 id="festival-entry-title">{{ title }}</h3>
      <p id="festival-entry-description">缝布章、做手摇动画、听空场回声，再用一张纸折一本同人志。</p>
      <span aria-hidden="true">打开摊位桌面</span>
    </div>
  </RouterLink>
</template>
