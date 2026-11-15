<script setup>
import { defineAsyncComponent } from 'vue';
import AppRecovery from './components/AppRecovery.vue';
import SiteNavigation from './components/SiteNavigation.vue';
const DraftConflictNotice = defineAsyncComponent(() => import('./components/tools/DraftConflictNotice.vue'));
const RoomCompanion = defineAsyncComponent(() => import('./components/RoomCompanion.vue'));
</script>
<template><SiteNavigation /><AppRecovery><RouterView /></AppRecovery><RoomCompanion /><DraftConflictNotice /></template>
