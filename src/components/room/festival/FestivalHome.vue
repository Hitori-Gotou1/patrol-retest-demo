<script setup>
import { festivalStations } from '../../../data/festival.js';
import { deskArtwork } from '../../../room/festival/deskArt.js';
import FestivalArt from './FestivalArt.vue';

const artwork = deskArtwork();
</script>

<template>
  <section class="fest-desk" aria-label="文化祭摊位桌面">
    <div class="fest-desk-heading">
      <p>从桌上选件工具开工。四个摊位可以按自己的顺序逛。</p>
      <span>STARRY / WORKTABLE</span>
    </div>
    <div class="fest-desk-grid">
      <RouterLink v-for="station in festivalStations" :key="station.id" :to="station.path" class="fest-desk-card" :style="{ '--station-color': station.color }">
        <FestivalArt :picture="artwork[station.id]" fill />
        <div class="fest-desk-card-copy"><div><h2>{{ station.title }}</h2><p>{{ station.description }}</p></div><span aria-hidden="true">+</span></div>
      </RouterLink>
    </div>
  </section>
</template>
