<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { journalNotes } from '../../data/journal.js';
import {articleUrl} from '../../services/articlePage.js';
import { loadLocal, saveLocal } from '../../room/storage.js';
const share=ref('');
async function shareArticle(){if(!article.value)return;share.value=articleUrl(article.value.slug);try{await navigator.clipboard.writeText(share.value);message.value='文章分享链接已复制，打开后可直接阅读全文。';}catch{message.value='请复制下面的文章地址。';}}
const route = useRoute(), query = ref(''), category = ref('all'), message = ref('');
const read = ref(loadLocal('hitori-room:journal-read:v1', [], value => {
  if (!Array.isArray(value)) throw new Error();
  return value.filter(slug => journalNotes.some(note => note.slug === slug));
}));
const categories = [...new Set(journalNotes.map(note => note.category))];
const article = computed(() => journalNotes.find(note => note.slug === route.params.slug));
watch(article, note => { if(note)document.title=`${note.title} · 一里小屋`; }, {immediate:true});
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
  <section v-if="!route.params.slug" aria-labelledby="notes-title"><div class="room-panel"><h2 id="notes-title">写在小屋里的几页。</h2><p class="room-intro">从一个人的勇气，到四个人的合奏。翻翻角色小记、听歌札记和收藏专题，给喜欢多留一点时间。</p><div class="room-fields"><label class="room-field" for="journal-search">查找手记<input id="journal-search" v-model="query" type="search" maxlength="100" placeholder="搜索标题或正文"></label><label class="room-field" for="journal-category">分类<select id="journal-category" v-model="category"><option value="all">全部手记</option><option v-for="item in categories" :key="item">{{ item }}</option></select></label></div></div><div class="room-cards journal-list"><article v-for="note in notes" :key="note.slug" class="room-card"><p class="room-hint"><time :datetime="note.date">{{ note.date }}</time> · {{ note.category }} · 约 {{ readingTime(note) }} 分钟</p><h3><RouterLink :to="`/room/notes/${note.slug}`">{{ note.title }}</RouterLink></h3><p class="room-intro">{{ note.summary }}</p><small>{{ read.includes(note.slug) ? '✓ 已读' : '待翻开的一页' }}</small></article></div><p v-if="!notes.length" class="room-hint" role="status">没有找到这篇手记，试试别的关键词。</p></section>
  <article v-else-if="article" class="room-panel room-prose"><RouterLink to="/room/notes" class="room-back">← 返回手记列表</RouterLink><p class="room-hint">{{ article.category }} · <time :datetime="article.date">{{ article.date }}</time> · {{ article.author }}</p><h2>{{ article.title }}</h2><p class="room-intro">{{ article.summary }}</p><p v-if="article.notice" class="journal-notice">{{article.notice}}</p><section v-for="section in article.sections" :key="section.heading"><h3>{{ section.heading }}</h3><p>{{ section.text }}</p></section><section v-if="article.sources?.length" class="journal-sources"><h3>参考资料</h3><a v-for="source in article.sources" :key="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{source.label}} ↗</a></section><div v-if="article.gallery" class="journal-related"><RouterLink v-for="image in article.gallery" :key="image.id" :to="{path:'/',query:{image:image.id},hash:'#gallery'}">看看{{image.label}} ↗</RouterLink></div><div class="room-actions"><button type="button" @click="shareArticle">复制文章分享链接</button><a :href="articleUrl(article.slug)" class="room-button">打开独立阅读页 ↗</a><button type="button" :aria-pressed="read.includes(article.slug)" @click="markRead">{{ read.includes(article.slug) ? '取消已读标记' : '标为已读' }}</button><RouterLink v-if="article.activity" :to="`/room/${article.activity}`" class="room-button primary">把灵感带去活动室 ↗</RouterLink></div><p class="room-status" role="status">{{ message }}</p><input v-if="share" :value="share" readonly aria-label="文章分享地址" @focus="$event.target.select()"><section v-if="article.related" class="journal-related"><h3>下一页，也许会喜欢</h3><template v-for="slug in article.related" :key="slug"><RouterLink v-if="journalNotes.find(n=>n.slug===slug)" :to="`/room/notes/${slug}`">{{journalNotes.find(n=>n.slug===slug).title}} →</RouterLink></template></section></article>
  <section v-else class="room-panel"><h2>这一页还没写下。</h2><p class="room-intro">手记地址可能已更新，可以回列表继续翻阅。</p><RouterLink to="/room/notes" class="room-button">返回手记列表</RouterLink></section>
</template>
<style scoped>.journal-list { margin-top: 20px; }.journal-list h3 { font-size: 22px; margin: 12px 0; }.journal-list h3 a { line-height: 1.6; }.journal-notice{font-size:12px;padding:12px 15px;background:#f0e3e6;border-left:2px solid #ab7b96;color:#856477}.journal-sources a,.journal-related a{display:block;color:#79596e;font-size:13px;min-height:44px;line-height:1.8;padding-block:10px;text-underline-offset:5px}.journal-related{border-top:1px solid #d4bcca;padding-top:14px}.room-prose{max-width:820px;margin-inline:auto}.room-prose>h2{font-size:clamp(27px,4vw,39px);line-height:1.6;letter-spacing:-.03em}.room-prose section>p{line-height:2.1}</style>
