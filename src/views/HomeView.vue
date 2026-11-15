<script setup>
import { onMounted } from 'vue';
import HeroScene from '../components/HeroScene.vue';
import LazyScene from '../components/LazyScene.vue';
const character = () => import('../components/CharacterScene.vue');
const theater = () => import('../components/TheaterScene.vue');
const gallery = () => import('../components/GalleryScene.vue');
const media = () => import('../components/MediaScene.vue');
onMounted(() => { document.title = '一里小屋 · HITORI ROOM'; });
</script>
<template><main id="main" tabindex="-1"><HeroScene /><LazyScene id="about" title="四种颜色，同一支乐队。" name="结束乐队" scene-class="character-scene" :loader="character" /><LazyScene id="theater" title="嘘，纸箱里有人。" name="纸箱剧场" :loader="theater" min-height="125svh" /><LazyScene id="gallery" title="把喜欢，贴在墙上。" name="心动收藏" scene-class="gallery-section" :loader="gallery" min-height="110svh" /><LazyScene id="video" title="把灯调暗，再听一遍。" name="音乐放映室" :loader="media" min-height="110svh" /></main></template>
