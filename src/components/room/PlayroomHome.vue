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
const category = ref('all'), query = ref(''), duration = ref('all'), difficulty = ref('all'), order = ref('catalog');
const recent = recentActivities().filter(card=>!['notes','guestbook'].includes(card.id)).slice(0, 3);
const works = readWorks();
const aftershow = activityCatalog.find(card => card.id === 'aftershow');
const cards = computed(() => {
  const matches = filterActivities(activityCatalog, { query: query.value, group: category.value, duration: duration.value, difficulty: difficulty.value });
  if (order.value === 'duration') matches.sort((a, b) => (a.minutes || Infinity) - (b.minutes || Infinity));
  return matches;
});
const editorial = journalNotes.filter(note=>note.category!=='小屋更新').slice(0, 3);
</script>
<template>
  <section aria-labelledby="playroom-title" class="discovery-home">
    <h2 id="playroom-title" class="visually-hidden">放学以后，小屋还亮着灯。</h2>
    <nav v-if="favoriteCards.length" class="room-pinned-shortcuts" aria-label="常用活动快捷入口"><span>★ 常去的角落</span><RouterLink v-for="card in favoriteCards.slice(0,4)" :key="card.id" :to="card.path">{{card.short}} ↗</RouterLink></nav>
    <div class="room-featured-topics">
      <FestivalEntry :to="festivalPath" :title="festivalTitle" />
      <RouterLink :to="aftershow.path" class="aftershow-entry" aria-labelledby="aftershow-entry-title" aria-describedby="aftershow-entry-description">
        <div class="aftershow-entry-art">
          <img :src="assetUrl('assets/activities/aftershow.webp')" alt="专题的实际舞台分镜" width="960" height="540" fetchpriority="high" decoding="async">
        </div>
        <div class="aftershow-entry-copy">
          <p class="aftershow-entry-duration">互动专题 · 约 2–3 分钟</p>
          <h3 id="aftershow-entry-title"><span>STARRY</span> 散场以后</h3>
          <p id="aftershow-entry-description">选一拍，亲手印成四色海报，再带着它坐上末班车。</p>
          <span class="aftershow-entry-cta" aria-hidden="true">走进舞台</span>
        </div>
      </RouterLink>
    </div>
    <div v-if="recent.length" class="room-resume"><span>继续上次</span><RouterLink v-for="card in recent" :key="card.id" :to="card.path">{{card.title}}</RouterLink><RouterLink to="/room/works">{{works.length?`${works.length} 件作品在等你`:'打开作品架'}}</RouterLink></div>
    <div class="discovery-intro"><p>拍张合影，写个小故事，或者只是听一会儿雨。</p><span>从这三个角落开始</span></div>
    <div class="featured-activities" data-arrive="1">
      <RouterLink v-for="(card,index) in featuredActivities" :key="card.id" :to="card.path" class="featured-activity" :style="{'--feature-color':card.color}">
        <div class="featured-art"><img :src="assetUrl(card.image)" :alt="`${card.title}实际画面预览`" :style="{objectPosition:card.position}" width="640" height="640" :loading="index?'lazy':'eager'"><span>{{card.duration}}</span></div>
        <div class="featured-copy"><span>{{card.eyebrow}}</span><h3>{{card.title}} <span aria-hidden="true">↗</span></h3><p>{{card.note}}</p></div>
      </RouterLink>
    </div>

    <section class="favorite-activities" :class="{'is-empty':!favoriteCards.length}" aria-labelledby="favorite-title"><div class="discovery-section-heading"><div><p class="room-kicker">自己的快捷入口</p><h2 id="favorite-title">我的常用活动</h2></div></div><p v-if="!favoriteCards.length" class="room-hint">在下面的活动卡片点「加入常用」，喜欢的角落就会留在这里。不需要登录。</p><div v-else class="favorite-activity-list"><article v-for="(card,index) in favoriteCards" :key="card.id"><RouterLink :to="card.path">{{card.icon}} {{card.title}} ↗</RouterLink><div><button type="button" :disabled="index===0" :aria-label="`将${card.title}前移`" @click="move(card.id,-1)">↑</button><button type="button" :disabled="index===favoriteCards.length-1" :aria-label="`将${card.title}后移`" @click="move(card.id,1)">↓</button><button type="button" :aria-label="`取消常用${card.title}`" @click="toggle(card.id)">取消常用</button></div></article></div><p v-if="notice" class="room-hint" role="status">{{notice}}</p></section>
    <section class="room-topics" aria-labelledby="room-topics-title"><div class="discovery-section-heading"><div><p class="room-kicker">把灵感接成一段旅程</p><h2 id="room-topics-title">小屋的几个大专题</h2></div></div><div class="room-topic-grid"><RouterLink v-for="item in siteSections.filter(s=>['project','calendar','pilgrimage'].includes(s.id))" :key="item.id" :to="item.path"><TopicSketch :kind="item.id"/><small>{{({project:'创作 · 排一场演出',calendar:'阅读 · 记住特别的一天',pilgrimage:'探索 · 从小屋走出去'})[item.id]}}</small><h3>{{item.title}} ↗</h3><p>{{item.description}}</p></RouterLink></div></section>
    <div v-if="!tourDone" class="room-links-card"><p>第一次来？一起做一张合影，学会保存自己的作品。</p><RouterLink class="room-button" to="/room/photobooth" @click="startTour">带我做第一件作品 →</RouterLink></div>
    <section class="room-editorial" aria-labelledby="room-editorial-title"><div class="discovery-section-heading"><div><p class="room-kicker">给喜欢，多留一页</p><h2 id="room-editorial-title">小屋正在读</h2></div><RouterLink to="/room/notes">全部手记 ↗</RouterLink></div><div class="editorial-cards"><RouterLink v-for="note in editorial" :key="note.slug" :to="`/room/notes/${note.slug}`"><small>{{note.category}} · {{note.readingLabel||'慢慢读'}}</small><h3>{{note.title}}</h3><p>{{note.summary}}</p><span>翻开这一页 →</span></RouterLink></div></section>
    <section id="activity-directory" class="activity-browser" aria-labelledby="activity-browser-title">
      <header class="activity-browser-head">
        <h2 id="activity-browser-title">找到今天想做的事</h2>
        <div class="activity-filters" role="group" aria-label="活动分类">
          <button type="button" :aria-pressed="category === 'all'" @click="category = 'all'">全部活动</button>
          <button v-for="group in activityGroups" :key="group.id" type="button" :aria-pressed="category === group.id" @click="category = group.id">{{ group.title }}</button>
        </div>
        <div class="activity-refine">
          <label class="room-field activity-search">搜索活动<input v-model="query" type="search" placeholder="找玩法、作品或声音" maxlength="60"></label>
          <label class="room-field">想玩多久<select v-model="duration"><option value="all">不限时间</option><option value="2">约2分钟</option><option value="5">约5分钟</option><option value="10">10分钟以上</option><option value="free">随时坐坐</option></select></label>
          <label class="room-field">今天的心情<select v-model="difficulty"><option value="all">全部难度</option><option value="easy">轻松体验</option><option value="challenge">来点挑战</option></select></label>
          <label class="room-field">排序<select v-model="order"><option value="catalog">目录顺序</option><option value="duration">用时从短到长</option></select></label>
        </div>
        <p class="activity-results" role="status">{{ cards.length }} 项活动</p>
      </header>
      <div v-if="cards.length" class="activity-cards">
        <article v-for="card in cards" :key="card.id" class="activity-card-wrap">
          <RouterLink :to="card.path" class="activity-card" :aria-labelledby="`activity-${card.id}-title`" :aria-describedby="`activity-${card.id}-description activity-${card.id}-meta`">
            <span class="activity-icon" :style="{ background: card.color }" aria-hidden="true">{{ card.icon }}</span>
            <h3 :id="`activity-${card.id}-title`">{{ card.title }}</h3>
            <p :id="`activity-${card.id}-description`">{{ card.description }}</p>
            <small :id="`activity-${card.id}-meta`">{{ card.minutes ? `约${card.minutes}分钟` : '随时坐坐' }} · {{ card.difficulty === 'challenge' ? '来点挑战' : '轻松体验' }}</small>
          </RouterLink>
          <button type="button" class="activity-favorite-toggle" :aria-pressed="favorites.includes(card.id)"
            :aria-label="`常用活动：${card.title}`" :title="favorites.includes(card.id) ? '取消常用' : '加入常用'" @click="toggle(card.id)">
            <span aria-hidden="true">{{ favorites.includes(card.id) ? '★' : '☆' }}</span>
          </button>
        </article>
      </div>
      <p v-else class="activity-empty">没有找到这个角落，换个关键词或分类试试。</p>
    </section>
  </section>
</template>

<style scoped>
.room-featured-topics {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  align-items: center;
  gap: clamp(12px, 2vw, 26px);
  margin: 12px 0 20px;
}
.room-featured-topics > a { margin: 0; }
.aftershow-entry {
  --ticket-edge: #19151d;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, .95fr);
  position: relative;
  min-width: 0;
  min-height: 194px;
  color: #fbecdf;
  background: #29202e;
  border: 1px solid #916f7d;
  text-decoration: none;
  box-shadow: 3px 5px 0 #100d15;
}
.aftershow-entry::after {
  content: "";
  position: absolute;
  inset: 0 -1px 0 auto;
  width: 8px;
  background: radial-gradient(circle at right center, var(--ticket-edge) 0 3px, transparent 3.5px) 0 0 / 8px 15px repeat-y;
  pointer-events: none;
}
.aftershow-entry-art {
  position: relative;
  overflow: hidden;
  background: #221b2b;
}
.aftershow-entry-art img {
  display: block;
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  object-fit: cover;
  object-position: 48% 48%;
  transition: transform .25s ease;
}
.aftershow-entry-copy {
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 8px;
  padding: clamp(12px, 1.7vw, 22px);
  border-inline-start: 1px dashed #916f7d;
}
.aftershow-entry-copy h3 {
  font-size: clamp(1.18rem, 2.15vw, 1.8rem);
  line-height: 1.15;
  letter-spacing: -.04em;
  margin: 0;
}
.aftershow-entry-copy h3 span { color: #ffcf98; display: block; }
.aftershow-entry-copy p { margin: 0; line-height: 1.55; }
.aftershow-entry-duration { color: #e6b7d3; font-size: .75rem; }
#aftershow-entry-description { color: #ead3df; font-size: .84rem; }
.aftershow-entry-cta {
  color: #ffe2b9;
  font-size: .87rem;
  font-weight: 700;
  border-bottom: 1px solid #ae9280;
  padding-bottom: 3px;
}
.aftershow-entry:focus-visible { outline: 2px solid #ffcf98; outline-offset: 4px; }
@media (hover: hover) {
  .aftershow-entry:hover { border-color: #eab7cb; }
  .aftershow-entry:hover img { transform: scale(1.035); }
}
@media (max-width: 820px) {
  .room-featured-topics { grid-template-columns: minmax(0, 1fr); gap: 13px; margin-bottom: 15px; }
  .aftershow-entry { grid-template-columns: 39% minmax(0, 1fr); min-height: 140px; }
  .aftershow-entry-art img { object-position: 52% 42%; }
  .aftershow-entry-copy { gap: 4px; padding: 11px 14px; }
  .aftershow-entry-copy h3 { font-size: clamp(1.08rem, 4.8vw, 1.4rem); }
  .aftershow-entry-copy h3 span { display: inline; }
}
@media (prefers-reduced-motion: reduce) {
  .aftershow-entry:hover img { transform: none; }
}
:global(html[data-motion='reduce'] .aftershow-entry:hover img) { transform: none; }
</style>
