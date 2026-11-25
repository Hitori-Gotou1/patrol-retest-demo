<script setup>
import FestivalArt from './FestivalArt.vue';
import { deskArtwork } from '../../../room/festival/deskArt.js';
import { examplePatch, hoopArt } from '../../../room/festival/patch.js';
import './festival-entry.css';

import { computed } from 'vue';

const props = defineProps({ to: String, title: String });
const titleLines = computed(() => props.title.split(' '));

const tools = deskArtwork({ onDesk: true });
const halfSewn = examplePatch();
halfSewn.stitches = halfSewn.stitches.slice(0, 4);
const hoop = hoopArt(halfSewn, { onDesk: true, guide: true });
</script>

<template>
  <RouterLink :to="to" class="festival-entry" aria-labelledby="festival-entry-title" aria-describedby="festival-entry-description">
    <div class="festival-entry-art" aria-hidden="true">
      <FestivalArt class="flyer-film" :picture="tools.animation" />
      <FestivalArt class="flyer-zine" :picture="tools.zine" />
      <FestivalArt class="flyer-hoop" :picture="hoop" />
    </div>
    <div class="festival-entry-copy">
      <h3 id="festival-entry-title"><span v-for="line in titleLines" :key="line">{{ line }}</span></h3>
      <p id="festival-entry-description">缝布章、做手摇动画、听空场回声，再用一张纸折一本同人志。</p>
      <span aria-hidden="true">打开摊位桌面</span>
    </div>
  </RouterLink>
</template>
