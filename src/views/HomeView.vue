<script setup>
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
const route = useRoute();
const targetIndex = computed(() => ['#home','#about','#theater','#gallery','#video'].indexOf(route.hash));
import HeroScene from '../components/HeroScene.vue';
import LazyScene from '../components/LazyScene.vue';
const character = () => import('../components/CharacterScene.vue');
const theater = () => import('../components/TheaterScene.vue');
const gallery = () => import('../components/GalleryScene.vue');
const media = () => import('../components/MediaScene.vue');
onMounted(() => { document.title = '一里小屋 · HITORI ROOM'; });
</script>
<template><main id="main" class="home-page" tabindex="-1"><HeroScene /><LazyScene :eager="targetIndex>=1" id="about" title="四种颜色，同一支乐队。" name="结束乐队" scene-class="character-scene" :loader="character" /><LazyScene :eager="targetIndex>=2" id="theater" title="嘘，纸箱里有人。" name="纸箱剧场" :loader="theater" min-height="125svh" /><LazyScene :eager="targetIndex>=3" id="gallery" title="把喜欢，贴在墙上。" name="心动收藏" scene-class="gallery-section" :loader="gallery" min-height="110svh" /><LazyScene :eager="targetIndex>=4" id="video" title="把灯调暗，再听一遍。" name="音乐放映室" :loader="media" min-height="110svh" /></main></template>
