<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { journalNotes } from '../../data/journal.js';
import { loadLocal, saveLocal } from '../../room/storage.js';
const route = useRoute(), query = ref(''), category = ref('all'), message = ref('');
const read = ref(loadLocal('hitori-room:journal-read:v1', [], value => {
  if (!Array.isArray(value)) throw new Error();
  return value.filter(slug => journalNotes.some(note => note.slug === slug));
}));
const categories = [...new Set(journalNotes.map(note => note.category))];
const article = computed(() => journalNotes.find(note => note.slug === route.params.slug));
const notes = computed(() => journalNotes.filter(note => (category.value === 'all' || note.category === category.value)
  && `${note.title} ${note.summary} ${note.sections.map(section => section.text).join(' ')}`.toLowerCase().includes(query.value.trim().toLowerCase())));
const readingTime = note => Math.max(1,Math.ceil(note.sections.reduce((sum,section) => sum + section.text.length,0)/400));
function markRead() {
  if (!article.value) return;
  read.value = read.value.includes(article.value.slug) ? read.value.filter(slug => slug !== article.value.slug) : [...read.value,article.value.slug];
  message.value = saveLocal('hitori-room:journal-read:v1',read.value) ? '阅读标记已保存。' : '当前浏览器无法保存阅读标记。';
}
</script>
<template>
  <section v-if="!route.params.slug" aria-labelledby="notes-title"><div class="room-panel"><h2 id="notes-title">写在小屋里的几页。</h2><p class="room-intro">观后感、练琴笔记、角色小记与小屋更新。当前文章是开发记录，之后可以继续添上站主自己的文字。</p><div class="room-fields"><label class="room-field" for="journal-search">查找手记<input id="journal-search" v-model="query" type="search" maxlength="100" placeholder="搜索标题或正文"></label><label class="room-field" for="journal-category">分类<select id="journal-category" v-model="category"><option value="all">全部手记</option><option v-for="item in categories" :key="item">{{ item }}</option></select></label></div></div><div class="room-cards journal-list"><article v-for="note in notes" :key="note.slug" class="room-card"><p class="room-hint"><time :datetime="note.date">{{ note.date }}</time> · {{ note.category }} · 约 {{ readingTime(note) }} 分钟</p><h3><RouterLink :to="`/room/notes/${note.slug}`">{{ note.title }}</RouterLink></h3><p class="room-intro">{{ note.summary }}</p><small>{{ read.includes(note.slug) ? '✓ 已读' : '待翻开的一页' }}</small></article></div><p v-if="!notes.length" class="room-hint" role="status">没有找到这篇手记，试试别的关键词。</p></section>
  <article v-else-if="article" class="room-panel room-prose"><RouterLink to="/room/notes" class="room-back">← 返回手记列表</RouterLink><p class="room-hint">{{ article.category }} · <time :datetime="article.date">{{ article.date }}</time> · {{ article.author }}</p><h2>{{ article.title }}</h2><p class="room-intro">{{ article.summary }}</p><section v-for="section in article.sections" :key="section.heading"><h3>{{ section.heading }}</h3><p>{{ section.text }}</p></section><button type="button" :aria-pressed="read.includes(article.slug)" @click="markRead">{{ read.includes(article.slug) ? '取消已读标记' : '标为已读' }}</button><p class="room-status" role="status">{{ message }}</p></article>
  <section v-else class="room-panel"><h2>这一页还没写下。</h2><p class="room-intro">手记地址可能已更新，可以回列表继续翻阅。</p><RouterLink to="/room/notes" class="room-button">返回手记列表</RouterLink></section>
</template>
<style scoped>.journal-list { margin-top: 20px; }.journal-list h3 { font-size: 22px; margin: 12px 0; }.journal-list h3 a { line-height: 1.6; }</style>
