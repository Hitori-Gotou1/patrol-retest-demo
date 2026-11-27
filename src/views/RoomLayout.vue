<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import '../styles/room.css';
import { useActivityFavorites } from '../composables/useActivityFavorites.js';
import '../styles/playroom.css';
import '../styles/adventures.css';
import '../styles/playground.css';
import '../styles/room-discovery.css';
import '../styles/room-activities.css';
import { activityCatalog, activityGroups, findActivity, nextActivities } from '../data/activityCatalog.js';
import { rememberVisit } from '../room/recentVisits.js';
import { festivalPath } from '../data/festival.js';
import {siteSections} from '../data/siteSections.js';
import FirstWorkGuide from '../components/tools/FirstWorkGuide.vue';
import {countEvent} from '../services/analytics.js';
import PageTransition from '../components/motion/PageTransition.vue';
import SmoothFold from '../components/motion/SmoothFold.vue';
import SceneAtmosphere from '../components/motion/SceneAtmosphere.vue';
import { useSceneMotion } from '../composables/useSceneMotion.js';
const roomRoot = ref(null);
useSceneMotion(roomRoot, { entrance: false });
import SaveWorkButton from '../components/room/SaveWorkButton.vue';
const { favorites, notice:favoriteNotice, toggle:toggleFavorite } = useActivityFavorites();
const route = useRoute(), directoryOpen = ref(false);
const isFestival = computed(() => route.path === festivalPath || route.path.startsWith(festivalPath + '/'));
const isAftershow = computed(() => route.name === 'aftershow' || route.path === '/room/aftershow');
const isPractice = computed(() => route.path === '/room/practice');
const practicePinned = computed(() => favorites.value.includes('practice'));
const active = computed(() => findActivity(route.path)||siteSections.find(s=>s.path===route.path));
const redesignedRoutes = new Set(['walk', 'pilgrimage', 'calendar', 'notes', 'effects', 'lights', 'mix', 'ambient', 'photobooth', 'decorate', 'works', 'guestbook', 'project', 'studio', 'shop', 'concert', 'pinball', 'maze', 'platform', 'cards', 'comic', 'graffiti', 'relay', 'jigsaw']);
const redesigned = computed(() => redesignedRoutes.has(route.path.split('/')[2]));
const suggestions = computed(() => (nextActivities[active.value?.id] || []).map(id => activityCatalog.find(card => card.id === id)));
watch(() => route.path, async path => {
  directoryOpen.value = false;
  rememberVisit(path);
  const id=findActivity(path)?.id || path.split('/')[2];if(id!=='play')countEvent('open',id);

  document.title = `${path === '/room/works' ? '我的作品架' : findActivity(path)?.title || siteSections.find(s=>s.path===path)?.title || '小屋活动室'} · 一里小屋`;
  await nextTick(); document.getElementById('room-heading')?.focus({ preventScroll: true });
}, { immediate: true });
</script>
<template>
  <main id="main" ref="roomRoot" class="room-page room-refresh" :class="{'room-page-compact':route.path!=='/room/play','discovery-page':route.path==='/room/play','aftershow-page':isAftershow,'festival-page':isFestival,'activity-redesign':redesigned,'practice-page':isPractice}" tabindex="-1">
    <SceneAtmosphere v-if="!isFestival && !redesigned && !isPractice" kind="room" />
    <header v-if="isAftershow" class="aftershow-heading">
      <RouterLink to="/room/play">← 活动室</RouterLink>
      <h1 id="room-heading" tabindex="-1">STARRY 散场以后</h1>
    </header>
    <header v-else-if="isPractice" class="practice-heading">
      <h1 id="room-heading" tabindex="-1">练琴计时</h1>
      <nav class="practice-nav" aria-label="活动室导航">
        <RouterLink :to="{ path: '/', hash: '#theater' }">返回小屋</RouterLink>
        <RouterLink to="/room/play">活动室</RouterLink>
        <button type="button" :aria-expanded="directoryOpen" aria-controls="room-directory" @click="directoryOpen = !directoryOpen">目录 <span aria-hidden="true">{{ directoryOpen ? '−' : '＋' }}</span></button>
        <button type="button" aria-label="常用练琴计时" :aria-pressed="practicePinned" @click="toggleFavorite('practice')"><span aria-hidden="true">{{ practicePinned ? '★' : '☆' }}</span> 常用</button>
        <RouterLink to="/room/works">作品架</RouterLink>
      </nav>
      <p v-if="favoriteNotice" class="room-hint practice-nav-status" role="status">{{ favoriteNotice }}</p>
    </header>
    <header v-else-if="!isFestival" class="room-heading room-heading-refresh">
      <RouterLink :to="{ path: '/', hash: '#theater' }" class="room-back">← 回到小屋</RouterLink>
      <div class="room-heading-line"><div><p class="room-kicker">放学后的小屋</p><h1 id="room-heading" tabindex="-1">{{route.path==='/room/play'?'今天，想做点什么':'小屋活动室'}}<span>。</span></h1></div><RouterLink to="/room/works" class="room-shelf-link">我的作品架 <span aria-hidden="true">↗</span></RouterLink></div>
    </header>
    <nav v-if="!isAftershow && !isFestival && !isPractice" class="room-nav room-quick-nav" aria-label="活动室导航">
      <RouterLink to="/room/play" :aria-current="route.path==='/room/play'?'page':undefined">活动室首页</RouterLink>
      <RouterLink v-if="active" :to="active.path" aria-current="page">{{active.short}}</RouterLink>
      <RouterLink v-if="route.path==='/room/works'" to="/room/works" aria-current="page">我的作品架</RouterLink>
      <RouterLink v-if="route.params.slug" to="/room/notes" aria-current="page">小屋手记</RouterLink>
      <button type="button" :aria-expanded="directoryOpen" aria-controls="room-directory" @click="directoryOpen=!directoryOpen">{{directoryOpen?'收起目录 −':'全部玩法 ＋'}}</button>
    </nav>
    <SmoothFold v-if="!isAftershow && !isFestival" id="room-directory" :open="directoryOpen"><div class="room-directory">
      <section v-for="group in activityGroups" :key="group.id"><h2>{{group.title}}</h2><div><RouterLink v-for="card in activityCatalog.filter(card=>card.group===group.id)" :key="card.id" :to="card.path">{{card.short}}</RouterLink></div></section>
    </div></SmoothFold>
    <RouterView v-if="redesigned || isPractice" v-slot="{ Component }"><component :is="Component" :key="route.path"/></RouterView>
    <button v-if="!isAftershow&&!isFestival&&!isPractice&&active&&activityCatalog.some(c=>c.id===active.id)" type="button" class="room-button activity-pin-current" :aria-pressed="favorites.includes(active.id)" @click="toggleFavorite(active.id)">{{favorites.includes(active.id)?'★ 已加入常用 · 点击取消':'☆ 将这个活动加入常用'}}</button><p v-if="favoriteNotice && !isPractice" class="room-hint" role="status">{{favoriteNotice}}</p>
    <FirstWorkGuide v-if="!isAftershow && !isFestival" />
    <SaveWorkButton v-if="active && !isAftershow && !isFestival" :key="route.path" :activity="active" />
    <RouterView v-if="!redesigned && !isPractice" v-slot="{ Component }"><PageTransition><component :is="Component" :key="isFestival ? festivalPath : route.path" /></PageTransition></RouterView>
    <aside v-if="suggestions.length" class="room-next" aria-label="接下来可以试试"><div><span class="room-kicker">灵感还可以继续</span><h2>把这一点喜欢，带去下一站。</h2></div><RouterLink v-for="card in suggestions" :key="card.id" :to="card.path"><span>{{card.icon}}</span><strong>{{card.title}}</strong><span aria-hidden="true">↗</span></RouterLink></aside>
    <nav v-if="!isFestival" class="resource-links" aria-label="更多小屋专题"><RouterLink v-for="item in siteSections" :key="item.id" :to="item.path">{{item.title}} ↗</RouterLink></nav>
    <footer v-if="!isFestival" class="room-footer">作品和进度保存在当前浏览器，可在作品架导出备份。这里的短篇、场景与音色为本站原创同人内容。</footer>
  </main>
</template>

<style scoped>
.room-page.practice-page { width: min(72rem, 100%); padding-top: 108px; }
.practice-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0 1.25rem;
  margin-bottom: .85rem;
  border-bottom: 1px solid var(--room-console-edge);
}
.practice-heading h1 { margin: 0 0 .35rem; font-size: clamp(1.8rem, 4.2vw, 2.8rem); line-height: 1.25; }
.practice-heading h1:focus { outline: none; }
.practice-nav { display: flex; align-items: center; flex-wrap: wrap; gap: 0 .2rem; }
.practice-nav :is(a, button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: .3rem .4rem;
  border: 1px solid transparent;
  background: transparent;
  color: var(--room-console-muted);
  font-size: .8125rem;
  text-decoration: none;
}
.practice-nav :is(a, button):hover { text-decoration: underline; text-underline-offset: .23em; }
.practice-nav button[aria-pressed='true'] { color: var(--room-berry-light); }
.practice-nav-status { flex-basis: 100%; margin: 0 0 .4rem; }
@media (max-width: 47.5rem) {
  .room-page.practice-page { padding: 116px 16px 40px; }
  .practice-heading { display: block; }
  .practice-heading h1 { margin-bottom: .15rem; }
}
</style>
