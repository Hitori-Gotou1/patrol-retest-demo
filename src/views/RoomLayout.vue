<script setup>
import { nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import '../styles/room.css';
const route = useRoute();
const links = [ ['rhythm', '节奏练习'], ['stories', '分支剧场'], ['studio', '编曲台'], ['practice', '练琴计时'], ['notes', '站主手记'], ['guestbook', '留言与点歌'] ];
watch(() => route.path, async path => {
  const label = links.find(([id]) => path.startsWith(`/room/${id}`))?.[1] || '活动室';
  document.title = `${label} · 一里小屋`;
  await nextTick(); document.getElementById('room-heading')?.focus({ preventScroll: true });
}, { immediate: true });
</script>
<template>
  <main id="main" class="room-page" tabindex="-1">
    <header class="room-heading"><RouterLink :to="{ path: '/', hash: '#theater' }" class="room-back">← 回到小屋</RouterLink><p class="room-kicker">HITORI ROOM / AFTER SCHOOL</p><h1 id="room-heading" tabindex="-1">小屋活动室<span>。</span></h1><p>练一段节奏，接一个故事，也给今天留下一点声音。</p></header>
    <nav class="room-nav" aria-label="活动室导航"><RouterLink v-for="[path,label] in links" :key="path" :to="`/room/${path}`" :aria-current="route.path.startsWith(`/room/${path}`) ? 'page' : undefined">{{ label }}</RouterLink></nav>
    <RouterView />
    <footer class="room-footer">练习、成绩和剧情进度保存在当前浏览器。这里的短篇与音色为本站原创同人内容。</footer>
  </main>
</template>
