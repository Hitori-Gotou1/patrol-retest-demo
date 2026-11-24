<script setup>
import { festivalPath, festivalTitle } from '../../data/festival.js';
import FestivalEntry from './festival/FestivalEntry.vue';
import TopicSketch from './TopicSketch.vue';
import { useActivityFavorites } from '../../composables/useActivityFavorites.js';
import { siteSections } from '../../data/siteSections.js';
import { computed, ref } from 'vue';
import { activityCatalog, activityGroups, featuredActivities, filterActivities } from '../../data/activityCatalog.js';
import { recentActivities } from '../../room/recentVisits.js';
import { readWorks } from '../../room/workshelf.js';
import { journalNotes } from '../../data/journal.js';
import {startTour} from '../../room/tour.js';
import {readTour} from '../../room/tour.js';
const {favorites,notice,toggle,move}=useActivityFavorites();
const favoriteCards=computed(()=>favorites.value.map(id=>activityCatalog.find(c=>c.id===id)).filter(Boolean));
const tourDone=readTour().done;
import { assetUrl } from '../../data/site.js';
const category = ref('all'), query = ref(''),duration=ref('all'),difficulty=ref('all');
const recent = recentActivities().filter(card=>!['notes','guestbook'].includes(card.id)).slice(0, 3);
const works = readWorks();
const aftershow = activityCatalog.find(card => card.id === 'aftershow');
const cards = computed(() => filterActivities(activityCatalog,{query:query.value,group:category.value,duration:duration.value,difficulty:difficulty.value}));
const editorial = journalNotes.filter(note=>note.category!=='小屋更新').slice(0, 3);
</script>
<template>
  <section aria-labelledby="playroom-title" class="discovery-home">
    <h2 id="playroom-title" class="visually-hidden">放学以后，小屋还亮着灯。</h2>
    <nav v-if="favoriteCards.length" class="room-pinned-shortcuts" aria-label="常用活动快捷入口"><span>★ 常去的角落</span><RouterLink v-for="card in favoriteCards.slice(0,4)" :key="card.id" :to="card.path">{{card.short}} ↗</RouterLink></nav>
    <FestivalEntry :to="festivalPath" :title="festivalTitle" />
    <RouterLink :to="aftershow.path" class="aftershow-entry" aria-labelledby="aftershow-entry-title" aria-describedby="aftershow-entry-description">
      <div class="aftershow-entry-art">
        <img :src="assetUrl('assets/activities/aftershow.webp')" alt="专题的实际舞台分镜" width="960" height="540" fetchpriority="high" decoding="async">
      </div>
      <div class="aftershow-entry-copy">
        <p class="aftershow-entry-duration">互动专题 · 约 2–3 分钟</p>
        <h3 id="aftershow-entry-title"><span>STARRY</span> 散场以后</h3>
        <p id="aftershow-entry-description">选一拍，亲手印成四色海报，再带着它坐上末班车。</p>
        <span class="aftershow-entry-cta" aria-hidden="true">走进舞台 <span>↗</span></span>
      </div>
    </RouterLink>
    <div class="discovery-intro"><p>拍张合影，写个小故事，或者只是听一会儿雨。</p><span>从这三个角落开始</span></div>
    <div class="featured-activities" data-arrive="1">
      <RouterLink v-for="(card,index) in featuredActivities" :key="card.id" :to="card.path" class="featured-activity" :style="{'--feature-color':card.color}">
        <div class="featured-art"><img :src="assetUrl(card.image)" :alt="`${card.title}实际画面预览`" :style="{objectPosition:card.position}" width="640" height="640" :loading="index?'lazy':'eager'"><span>{{card.duration}}</span></div>
        <div class="featured-copy"><span>{{card.eyebrow}}</span><h3>{{card.title}} <span aria-hidden="true">↗</span></h3><p>{{card.note}}</p></div>
      </RouterLink>
    </div>
    <div v-if="recent.length" class="room-resume"><span>接着上次的小灵感</span><RouterLink v-for="card in recent" :key="card.id" :to="card.path">{{card.title}} →</RouterLink><RouterLink to="/room/works">{{works.length?`${works.length} 件作品在等你`:'打开作品架'}} ↗</RouterLink></div>
    <section class="favorite-activities" :class="{'is-empty':!favoriteCards.length}" aria-labelledby="favorite-title"><div class="discovery-section-heading"><div><p class="room-kicker">自己的快捷入口</p><h2 id="favorite-title">我的常用活动</h2></div></div><p v-if="!favoriteCards.length" class="room-hint">在下面的活动卡片点「加入常用」，喜欢的角落就会留在这里。不需要登录。</p><div v-else class="favorite-activity-list"><article v-for="(card,index) in favoriteCards" :key="card.id"><RouterLink :to="card.path">{{card.icon}} {{card.title}} ↗</RouterLink><div><button type="button" :disabled="index===0" :aria-label="`将${card.title}前移`" @click="move(card.id,-1)">↑</button><button type="button" :disabled="index===favoriteCards.length-1" :aria-label="`将${card.title}后移`" @click="move(card.id,1)">↓</button><button type="button" :aria-label="`取消常用${card.title}`" @click="toggle(card.id)">取消常用</button></div></article></div><p v-if="notice" class="room-hint" role="status">{{notice}}</p></section>
    <section class="room-topics" aria-labelledby="room-topics-title"><div class="discovery-section-heading"><div><p class="room-kicker">把灵感接成一段旅程</p><h2 id="room-topics-title">小屋的几个大专题</h2></div></div><div class="room-topic-grid"><RouterLink v-for="item in siteSections.filter(s=>['project','calendar','pilgrimage'].includes(s.id))" :key="item.id" :to="item.path"><TopicSketch :kind="item.id"/><small>{{({project:'创作 · 排一场演出',calendar:'阅读 · 记住特别的一天',pilgrimage:'探索 · 从小屋走出去'})[item.id]}}</small><h3>{{item.title}} ↗</h3><p>{{item.description}}</p></RouterLink></div></section>
    <div v-if="!tourDone" class="room-links-card"><p>第一次来？一起做一张合影，学会保存自己的作品。</p><RouterLink class="room-button" to="/room/photobooth" @click="startTour">带我做第一件作品 →</RouterLink></div>
    <section class="room-editorial" aria-labelledby="room-editorial-title"><div class="discovery-section-heading"><div><p class="room-kicker">给喜欢，多留一页</p><h2 id="room-editorial-title">小屋正在读</h2></div><RouterLink to="/room/notes">全部手记 ↗</RouterLink></div><div class="editorial-cards"><RouterLink v-for="note in editorial" :key="note.slug" :to="`/room/notes/${note.slug}`"><small>{{note.category}} · {{note.readingLabel||'慢慢读'}}</small><h3>{{note.title}}</h3><p>{{note.summary}}</p><span>翻开这一页 →</span></RouterLink></div></section>
    <section id="activity-directory" class="activity-browser" aria-labelledby="activity-browser-title">
      <div class="discovery-section-heading"><div><p class="room-kicker">再逛一会儿</p><h2 id="activity-browser-title">找到今天想做的事</h2></div><label class="activity-search"><span class="visually-hidden">搜索活动</span><input v-model="query" type="search" placeholder="找玩法、作品或声音" maxlength="60"></label></div>
      <div class="activity-filters" aria-label="活动分类"><button type="button" :aria-pressed="category==='all'" @click="category='all'">全部活动 · {{activityCatalog.length}}</button><button v-for="group in activityGroups" :key="group.id" type="button" :aria-pressed="category===group.id" @click="category=group.id">{{group.title}}</button></div>
      <div class="room-fields activity-refine"><label class="room-field">想玩多久<select v-model="duration"><option value="all">不限时间</option><option value="2">约2分钟</option><option value="5">约5分钟</option><option value="10">10分钟以上</option><option value="free">随时坐坐</option></select></label><label class="room-field">今天的心情<select v-model="difficulty"><option value="all">全部难度</option><option value="easy">轻松体验</option><option value="challenge">来点挑战</option></select></label></div><p class="activity-results" role="status">{{cards.length}} 个角落，按自己的步调来。</p>
      <div class="activity-cards"><article v-for="card in cards" :key="card.id" class="activity-card-wrap"><RouterLink :to="card.path" class="activity-card"><span class="activity-icon" :style="{background:card.color}" aria-hidden="true">{{card.icon}}</span><div><h3>{{card.title}}</h3><p>{{card.description}}</p><small>{{card.minutes?`约${card.minutes}分钟`:"随时坐坐"}} · {{card.difficulty==='challenge'?'来点挑战':'轻松体验'}}</small></div><span aria-hidden="true">↗</span></RouterLink><button type="button" class="activity-favorite-toggle" :aria-pressed="favorites.includes(card.id)" :aria-label="`${favorites.includes(card.id)?'取消常用':'加入常用'}${card.title}`" @click="toggle(card.id)">{{favorites.includes(card.id)?'★ 已加入常用':'☆ 加入常用'}}</button></article></div>
      <p v-if="!cards.length" class="room-hint">没有找到这个角落，换个关键词或分类试试。</p>
    </section>
  </section>
</template>

<style scoped>
.aftershow-entry {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  align-items: stretch;
  min-width: 0;
  margin: 24px 0 30px;
  color: #fbecdf;
  background: #1b1c2c;
  border: 1px solid #64546d;
  text-decoration: none;
  box-shadow: 3px 5px 0 #120f19;
}

.aftershow-entry-art {
  position: relative;
  min-height: 210px;
  overflow: hidden;
  isolation: isolate;
  background: #211e31;
}

.aftershow-entry-art img {
  display: block;
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  object-fit: cover;
  object-position: 50% 52%;
  transition: transform .45s var(--ease-room, ease);
}

.aftershow-entry-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 10px;
  padding: clamp(18px, 3.6vw, 40px);
  border-inline-start: 1px solid #64546d;
  background: linear-gradient(135deg, #252237, #1a1a2a 80%);
}

.aftershow-entry-copy h3 {
  font-size: clamp(22px, 3.15vw, 37px);
  line-height: 1.23;
  letter-spacing: -.04em;
  margin: 0;
  text-wrap: balance;
}

.aftershow-entry-copy h3 span { color: #ffcf98; }
.aftershow-entry-copy p { margin: 0; line-height: 1.7; }
.aftershow-entry-duration { color: #e6b7d3; font-size: 12px; }
#aftershow-entry-description { color: #ead3df; font-size: clamp(12px, 1.25vw, 14px); }

.aftershow-entry-cta {
  display: inline-flex;
  align-items: center;
  gap: 18px;
  margin-top: 4px;
  color: #ffdab1;
  font-size: 13px;
  font-weight: 700;
  border-bottom: 1px solid #927866;
  padding-bottom: 4px;
}

.aftershow-entry:focus-visible { outline: 2px solid #ffcf98; outline-offset: 4px; }

@media (hover: hover) {
  .aftershow-entry:hover { border-color: #bb91aa; }
  .aftershow-entry:hover img { transform: scale(1.025); }
}

@media (max-width: 700px) {
  .aftershow-entry { grid-template-columns: minmax(0, 1fr); margin: 15px 0 22px; }
  .aftershow-entry-art { min-height: 0; aspect-ratio: 2.02; }
  .aftershow-entry-copy {
    padding: 14px 16px 16px;
    gap: 6px;
    border-inline-start: 0;
    border-top: 1px solid #64546d;
  }
}

@media (prefers-reduced-motion: reduce) {
  .aftershow-entry:hover img { transform: none; }
}

:global(html[data-motion='reduce'] .aftershow-entry:hover img) { transform: none; }
</style>
