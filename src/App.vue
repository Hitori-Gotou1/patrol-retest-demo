<script setup>
import { defineAsyncComponent } from 'vue';
import SiteNavigation from './components/SiteNavigation.vue';
const RoomCompanion = defineAsyncComponent(() => import('./components/RoomCompanion.vue'));
</script>
<template><SiteNavigation /><RouterView /><RoomCompanion /></template>
