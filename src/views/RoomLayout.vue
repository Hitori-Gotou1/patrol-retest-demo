<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import '../styles/room.css';
import '../styles/playroom.css';
import '../styles/adventures.css';
import '../styles/playground.css';
import '../styles/room-discovery.css';
import { activityCatalog, activityGroups, findActivity, nextActivities } from '../data/activityCatalog.js';
import { rememberVisit } from '../room/recentVisits.js';
import SaveWorkButton from '../components/room/SaveWorkButton.vue';
const route = useRoute(), directoryOpen = ref(false);
const active = computed(() => findActivity(route.path));
const suggestions = computed(() => (nextActivities[active.value?.id] || []).map(id => activityCatalog.find(card => card.id === id)));
watch(() => route.path, async path => {
  directoryOpen.value = false;
  rememberVisit(path);
  document.title = `${path === '/room/works' ? '我的作品架' : findActivity(path)?.title || '小屋活动室'} · 一里小屋`;
  await nextTick(); document.getElementById('room-heading')?.focus({ preventScroll: true });
}, { immediate: true });
</script>
<template>
  <main id="main" class="room-page room-refresh" :class="{'room-page-compact':route.path!=='/room/play'}" tabindex="-1">
    <header class="room-heading room-heading-refresh">
      <RouterLink :to="{ path: '/', hash: '#theater' }" class="room-back">← 回到小屋</RouterLink>
      <div class="room-heading-line"><div><p class="room-kicker">放学后的小屋</p><h1 id="room-heading" tabindex="-1">{{route.path==='/room/play'?'今天，想做点什么':'小屋活动室'}}<span>。</span></h1></div><RouterLink to="/room/works" class="room-shelf-link">我的作品架 <span aria-hidden="true">↗</span></RouterLink></div>
    </header>
    <nav class="room-nav room-quick-nav" aria-label="活动室导航">
      <RouterLink to="/room/play" :aria-current="route.path==='/room/play'?'page':undefined">活动室首页</RouterLink>
      <RouterLink v-if="active" :to="active.path" aria-current="page">{{active.short}}</RouterLink>
      <RouterLink v-if="route.path==='/room/works'" to="/room/works" aria-current="page">我的作品架</RouterLink>
      <RouterLink v-if="route.params.slug" to="/room/notes" aria-current="page">小屋手记</RouterLink>
      <button type="button" :aria-expanded="directoryOpen" aria-controls="room-directory" @click="directoryOpen=!directoryOpen">{{directoryOpen?'收起目录 −':'全部玩法 ＋'}}</button>
    </nav>
    <div v-if="directoryOpen" id="room-directory" class="room-directory">
      <section v-for="group in activityGroups" :key="group.id"><h2>{{group.title}}</h2><div><RouterLink v-for="card in activityCatalog.filter(card=>card.group===group.id)" :key="card.id" :to="card.path">{{card.short}}</RouterLink></div></section>
    </div>
    <SaveWorkButton v-if="active" :key="route.path" :activity="active" />
    <RouterView />
    <aside v-if="suggestions.length" class="room-next" aria-label="接下来可以试试"><div><span class="room-kicker">灵感还可以继续</span><h2>把这一点喜欢，带去下一站。</h2></div><RouterLink v-for="card in suggestions" :key="card.id" :to="card.path"><span>{{card.icon}}</span><strong>{{card.title}}</strong><span aria-hidden="true">↗</span></RouterLink></aside>
    <footer class="room-footer">作品和进度保存在当前浏览器，可在作品架导出备份。这里的短篇、场景与音色为本站原创同人内容。</footer>
  </main>
</template>
