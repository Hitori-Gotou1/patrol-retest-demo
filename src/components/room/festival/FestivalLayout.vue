<script setup>
import { computed, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { festivalPath, festivalStations, festivalTitle } from '../../../data/festival.js';
import PageTransition from '../../motion/PageTransition.vue';
import '../../../styles/festival.css';

const route = useRoute();
const station = computed(() => festivalStations.find(item => item.path === route.path));
watch(() => route.path, async () => {
  await nextTick();
  document.getElementById('room-heading')?.focus({ preventScroll: true });
});
</script>

<template>
  <div class="fest-shell" :class="{ 'fest-home': !station }" :style="{ '--fest-accent': station?.color || '#eab478' }">
    <nav class="fest-breadcrumb" aria-label="文化祭位置">
      <RouterLink to="/room/play">活动室</RouterLink>
      <template v-if="station"><span aria-hidden="true">/</span><RouterLink :to="festivalPath">{{ festivalTitle }}</RouterLink></template>
    </nav>
    <header class="fest-heading">
      <div>
        <p v-if="station" class="fest-nameplate"><span></span>{{ station.english }}</p>
        <h1 id="room-heading" tabindex="-1">{{ station?.title || festivalTitle }}</h1>
      </div>
      <p v-if="station">{{ station.description }}</p>
      <p v-else class="fest-home-intro">缝一枚布章，摇一段片带，试一次声。把作品带进一本能折出来的小刊。</p>
    </header>
    <nav v-if="station" class="fest-station-nav" aria-label="文化祭展位">
      <RouterLink v-for="item in festivalStations" :key="item.id" :to="item.path" :aria-current="item.id === station.id ? 'page' : undefined">{{ item.short }}</RouterLink>
    </nav>
    <RouterView v-slot="{ Component }"><PageTransition><component :is="Component" :key="route.path" /></PageTransition></RouterView>
  </div>
</template>
