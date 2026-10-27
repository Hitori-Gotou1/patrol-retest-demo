<script setup>
import { onMounted } from 'vue';
import HeroScene from '../components/HeroScene.vue';
import CharacterScene from '../components/CharacterScene.vue';
import TheaterScene from '../components/TheaterScene.vue';
import GalleryScene from '../components/GalleryScene.vue';
import MediaScene from '../components/MediaScene.vue';
onMounted(() => { document.title = '一里小屋 · HITORI ROOM'; });
</script>
<template><main id="main" tabindex="-1"><HeroScene /><CharacterScene /><TheaterScene /><GalleryScene /><MediaScene /></main></template>
