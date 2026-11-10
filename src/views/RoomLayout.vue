<script setup>
import { nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import '../styles/room.css';
import '../styles/playroom.css';
import '../styles/adventures.css';
import '../styles/playground.css';
import { playroomCards } from '../data/playroom.js';
import { adventureCards } from '../data/adventures.js';
import { playgroundCards } from '../data/playground.js';
const route = useRoute();
const links = [ ['rhythm', '节奏练习'], ['stories', '分支剧场'], ['studio', '编曲台'], ['practice', '练琴计时'], ['notes', '站主手记'], ['guestbook', '留言与点歌'] ];
const playLinks = [['play','活动室首页'],...playroomCards.map(c=>[c.id,{'photobooth':'拍贴机','decorate':'布置小屋','walk':'散步地图','search':'排练室寻物','concert':'演出筹备','ambient':'雨夜 STARRY'}[c.id]])];
const adventureLinks = adventureCards.map(c=>[c.id,c.short]);
const playgroundLinks = playgroundCards.map(c=>[c.id,c.short]);
watch(() => route.path, async path => {
  const label = [...links,...playLinks,...adventureLinks,...playgroundLinks].find(([id]) => path.startsWith(`/room/${id}`))?.[1] || '活动室';
  document.title = `${label} · 一里小屋`;
  await nextTick(); document.getElementById('room-heading')?.focus({ preventScroll: true });
  const active=document.querySelector('.room-nav [aria-current="page"]');
  if(active&&active.parentElement.scrollWidth>active.parentElement.clientWidth){const list=active.parentElement;list.scrollLeft+=active.getBoundingClientRect().left-list.getBoundingClientRect().left-12;}
}, { immediate: true });
</script>
<template>
  <main id="main" class="room-page" :class="{'room-page-compact':route.path!=='/room/play'}" tabindex="-1">
    <header class="room-heading"><RouterLink :to="{ path: '/', hash: '#theater' }" class="room-back">← 回到小屋</RouterLink><p class="room-kicker">HITORI ROOM / AFTER SCHOOL</p><h1 id="room-heading" tabindex="-1">小屋活动室<span>。</span></h1><p>练一段节奏，接一个故事，也给今天留下一点声音。</p></header>
    <nav class="room-nav playroom-nav" aria-label="活动室导航"><div class="room-nav-group"><span>游乐与创作</span><div><RouterLink v-for="[path,label] in playgroundLinks" :key="path" :to="`/room/${path}`" :aria-current="route.path.startsWith(`/room/${path}`) ? 'page' : undefined">{{label}}</RouterLink></div></div><div class="room-nav-group"><span>新的冒险</span><div><RouterLink v-for="[path,label] in adventureLinks" :key="path" :to="`/room/${path}`" :aria-current="route.path.startsWith(`/room/${path}`) ? 'page' : undefined">{{label}}</RouterLink></div></div><div class="room-nav-group"><span>玩一会儿</span><div><RouterLink v-for="[path,label] in playLinks" :key="path" :to="`/room/${path}`" :aria-current="route.path.startsWith(`/room/${path}`) ? 'page' : undefined">{{label}}</RouterLink></div></div><div class="room-nav-group"><span>练习与手记</span><div><RouterLink v-for="[path,label] in links" :key="path" :to="`/room/${path}`" :aria-current="route.path.startsWith(`/room/${path}`) ? 'page' : undefined">{{ label }}</RouterLink></div></div></nav>
    <RouterView />
    <footer class="room-footer">作品、练习和探索进度保存在当前浏览器。这里的短篇、场景与音色为本站原创同人内容。</footer>
  </main>
</template>
