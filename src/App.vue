<script setup>
import { defineAsyncComponent } from 'vue';
import PageTransition from './components/motion/PageTransition.vue';
import AppRecovery from './components/AppRecovery.vue';
import { useRoute } from 'vue-router';
const route = useRoute();
import SiteNavigation from './components/SiteNavigation.vue';
const DraftConflictNotice = defineAsyncComponent(() => import('./components/tools/DraftConflictNotice.vue'));
const RoomCompanion = defineAsyncComponent(() => import('./components/RoomCompanion.vue'));
</script>
<template><SiteNavigation /><AppRecovery><RouterView v-slot="{ Component }"><PageTransition><component :is="Component" :key="route.matched[0]?.path" /></PageTransition></RouterView></AppRecovery><RoomCompanion /><DraftConflictNotice /></template>
