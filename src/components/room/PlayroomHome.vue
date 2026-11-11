<script setup>
import { computed, ref } from 'vue';
import { activityCatalog, activityGroups, featuredActivities } from '../../data/activityCatalog.js';
import { recentActivities } from '../../room/recentVisits.js';
import { readWorks } from '../../room/workshelf.js';
import { journalNotes } from '../../data/journal.js';
import { assetUrl } from '../../data/site.js';
const category = ref('all'), query = ref('');
const recent = recentActivities().filter(card=>!['notes','guestbook'].includes(card.id)).slice(0, 3);
const works = readWorks();
const cards = computed(() => activityCatalog.filter(card => (category.value==='all' || card.group===category.value) && `${card.title} ${card.short} ${card.description}`.toLowerCase().includes(query.value.trim().toLowerCase())));
const editorial = journalNotes.filter(note=>note.category!=='小屋更新').slice(0, 3);
</script>
<template>
  <section aria-labelledby="playroom-title" class="discovery-home">
    <h2 id="playroom-title" class="visually-hidden">放学以后，小屋还亮着灯。</h2>
    <div v-if="recent.length" class="room-resume"><span>接着上次的小灵感</span><RouterLink v-for="card in recent" :key="card.id" :to="card.path">{{card.title}} →</RouterLink><RouterLink to="/room/works">{{works.length?`${works.length} 件作品在等你`:'打开作品架'}} ↗</RouterLink></div>
    <div class="discovery-intro"><p>拍张合影，写个小故事，或者只是听一会儿雨。</p><span>从这三个角落开始</span></div>
    <div class="featured-activities">
      <RouterLink v-for="(card,index) in featuredActivities" :key="card.id" :to="card.path" class="featured-activity" :style="{'--feature-color':card.color}">
        <div class="featured-art"><img :src="assetUrl(card.image)" :alt="`${card.title}实际画面预览`" :style="{objectPosition:card.position}" width="640" height="640" :loading="index?'lazy':'eager'"><span>{{card.duration}}</span></div>
        <div class="featured-copy"><span>{{card.eyebrow}}</span><h3>{{card.title}} <span aria-hidden="true">↗</span></h3><p>{{card.note}}</p></div>
      </RouterLink>
    </div>
    <section class="room-editorial" aria-labelledby="room-editorial-title"><div class="discovery-section-heading"><div><p class="room-kicker">给喜欢，多留一页</p><h2 id="room-editorial-title">小屋正在读</h2></div><RouterLink to="/room/notes">全部手记 ↗</RouterLink></div><div class="editorial-cards"><RouterLink v-for="note in editorial" :key="note.slug" :to="`/room/notes/${note.slug}`"><small>{{note.category}} · {{note.readingLabel||'慢慢读'}}</small><h3>{{note.title}}</h3><p>{{note.summary}}</p><span>翻开这一页 →</span></RouterLink></div></section>
    <section id="activity-directory" class="activity-browser" aria-labelledby="activity-browser-title">
      <div class="discovery-section-heading"><div><p class="room-kicker">再逛一会儿</p><h2 id="activity-browser-title">找到今天想做的事</h2></div><label class="activity-search"><span class="visually-hidden">搜索活动</span><input v-model="query" type="search" placeholder="找玩法、作品或声音" maxlength="60"></label></div>
      <div class="activity-filters" aria-label="活动分类"><button type="button" :aria-pressed="category==='all'" @click="category='all'">全部活动 · {{activityCatalog.length}}</button><button v-for="group in activityGroups" :key="group.id" type="button" :aria-pressed="category===group.id" @click="category=group.id">{{group.title}}</button></div>
      <p class="activity-results" role="status">{{cards.length}} 个角落，按自己的步调来。</p>
      <div class="activity-cards"><RouterLink v-for="card in cards" :key="card.id" :to="card.path" class="activity-card"><span class="activity-icon" :style="{background:card.color}" aria-hidden="true">{{card.icon}}</span><div><h3>{{card.title}}</h3><p>{{card.description}}</p></div><span aria-hidden="true">↗</span></RouterLink></div>
      <p v-if="!cards.length" class="room-hint">没有找到这个角落，换个关键词或分类试试。</p>
    </section>
  </section>
</template>
