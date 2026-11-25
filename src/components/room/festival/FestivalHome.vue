<script setup>
import { festivalStations } from '../../../data/festival.js';
import { deskArtwork } from '../../../room/festival/deskArt.js';
import FestivalArt from './FestivalArt.vue';

const artwork = deskArtwork({ onDesk: true });
const closeups = deskArtwork({ onDesk: true });
</script>

<template>
  <div class="fest-desk-view">
    <section class="fest-desk" aria-label="文化祭摊位桌面">
      <div class="fest-desk-grid">
        <RouterLink v-for="station in festivalStations" :key="station.id" :to="station.path"
          class="fest-desk-card" :data-tool="station.id" :style="{ '--station-color': station.color }">
          <FestivalArt :picture="artwork[station.id]" />
          <h2>{{ station.title }}</h2>
        </RouterLink>
      </div>
    </section>
    <section class="fest-desk-details" aria-label="摊位近景">
      <RouterLink v-for="station in festivalStations" :key="station.id" :to="station.path"
        class="fest-desk-detail" :data-tool="station.id" :style="{ '--station-color': station.color }">
        <FestivalArt :picture="closeups[station.id]" />
        <div><h2>{{ station.title }}</h2><p>{{ station.description }}</p><span>进展位</span></div>
      </RouterLink>
    </section>
  </div>
</template>
