<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { journalNotes } from '../../data/journal.js';
import { articleCover, articleUrl } from '../../services/articlePage.js';
import { loadLocal, saveLocal } from '../../room/storage.js';
import '../../styles/journal-reading.css';
const share=ref('');
async function shareArticle(){if(!article.value)return;share.value=articleUrl(article.value.slug);try{await navigator.clipboard.writeText(share.value);message.value='文章分享链接已复制，打开后可直接阅读全文。';}catch{message.value='请复制下面的文章地址。';}}
const route = useRoute(), query = ref(''), category = ref('all'), message = ref('');
const read = ref(loadLocal('hitori-room:journal-read:v1', [], value => {
  if (!Array.isArray(value)) throw new Error();
  return value.filter(slug => journalNotes.some(note => note.slug === slug));
}));
const categories = [...new Set(journalNotes.map(note => note.category))];
const article = computed(() => journalNotes.find(note => note.slug === route.params.slug));
const cover = computed(() => articleCover(article.value));
const coverSrc = computed(() => cover.value ? import.meta.env.BASE_URL + cover.value.src : '');
const categoryInk = { '角色小记': '#87495a', '听歌札记': '#42647d', '收藏专题': '#5d6748', '观后随笔': '#7a563f', '小屋更新': '#694961' };
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
  <section v-if="!route.params.slug" class="room-panel journal-index" aria-labelledby="notes-title">
    <header class="activity-title">
      <p class="play-eyebrow">小屋手记 · 本期目录</p>
      <h2 id="notes-title">写在小屋里的几页。</h2>
      <p class="room-intro">翻翻角色小记、听歌札记和收藏专题，给喜欢多留一点时间。</p>
    </header>
    <div class="room-fields journal-filters">
      <label class="room-field" for="journal-search">查找手记<input id="journal-search" v-model="query" type="search" maxlength="100" placeholder="搜索标题或正文"></label>
      <label class="room-field" for="journal-category">分类<select id="journal-category" v-model="category"><option value="all">全部手记</option><option v-for="item in categories" :key="item">{{ item }}</option></select></label>
    </div>
    <div v-if="notes.length" class="journal-list">
      <article v-for="note in notes" :key="note.slug" class="journal-entry" :class="{ 'journal-has-read': read.includes(note.slug) }"
        :style="{ '--journal-ink': categoryInk[note.category] || '#664957' }">
        <p class="journal-tag">{{ note.category }}</p>
        <div class="journal-entry-copy">
          <p class="journal-entry-meta"><time :datetime="note.date">{{ note.date }}</time> · {{ note.readingLabel || `约 ${readingTime(note)} 分钟` }}</p>
          <h3><RouterLink :to="`/room/notes/${note.slug}`">{{ note.title }}</RouterLink></h3>
          <p class="journal-summary">{{ note.summary }}</p>
          <span v-if="read.includes(note.slug)" class="journal-read-tag">已读</span>
        </div>
        <RouterLink :to="`/room/notes/${note.slug}`" class="journal-open" :aria-label="'翻开《' + note.title + '》'">翻开这页 <span aria-hidden="true">→</span></RouterLink>
      </article>
    </div>
    <p v-else class="journal-empty" role="status">没有找到这篇手记，试试别的关键词。</p>
  </section>
  <section v-else-if="article" class="journal-reading">
    <article class="journal-sheet">
      <RouterLink to="/room/notes" class="journal-back">← 返回手记列表</RouterLink>
      <header>
        <p class="journal-byline">{{ article.category }} · <time :datetime="article.date">{{ article.date }}</time> · {{ article.author }}</p>
        <h2 class="journal-headline">{{ article.title }}</h2>
        <p class="journal-lede">{{ article.summary }}</p>
      </header>
      <figure v-if="cover" class="journal-cover">
        <img :src="coverSrc" :alt="cover.alt" fetchpriority="high">
        <figcaption>《{{ cover.title }}》 · {{ cover.credit }}</figcaption>
      </figure>
      <p v-if="article.notice" class="journal-notice">{{ article.notice }}</p>
      <section v-for="section in article.sections" :key="section.heading">
        <h3 class="journal-section-heading">{{ section.heading }}</h3>
        <p class="journal-text">{{ section.text }}</p>
      </section>
      <section v-if="article.sources?.length" class="journal-reference">
        <h3 class="journal-section-heading">参考资料</h3>
        <ul><li v-for="source in article.sources" :key="source.url"><a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.label }} ↗</a></li></ul>
      </section>
      <section v-if="article.gallery?.length" class="journal-reference">
        <h3 class="journal-section-heading">关联作品</h3>
        <ul><li v-for="image in article.gallery" :key="image.id"><RouterLink :to="{ path:'/', query:{ image:image.id }, hash:'#gallery' }">{{ image.label }} ↗</RouterLink></li></ul>
      </section>
      <div class="journal-actions">
        <button type="button" @click="shareArticle">复制文章分享链接</button>
        <a :href="articleUrl(article.slug)">打开独立阅读页 ↗</a>
        <button type="button" :aria-pressed="read.includes(article.slug)" @click="markRead">{{ read.includes(article.slug) ? '取消已读标记' : '标为已读' }}</button>
        <RouterLink v-if="article.activity" :to="`/room/${article.activity}`">把灵感带去活动室 ↗</RouterLink>
      </div>
      <p class="room-status" role="status">{{ message }}</p>
      <input v-if="share" :value="share" readonly aria-label="文章分享地址" @focus="$event.target.select()">
      <section v-if="article.related" class="journal-reference">
        <h3 class="journal-section-heading">下一页，也许会喜欢</h3>
        <ul><template v-for="slug in article.related" :key="slug">
          <li v-if="journalNotes.find(note => note.slug === slug)"><RouterLink :to="`/room/notes/${slug}`">{{ journalNotes.find(note => note.slug === slug).title }} →</RouterLink></li>
        </template></ul>
      </section>
    </article>
  </section>
  <section v-else class="room-panel">
    <h2>这一页还没写下。</h2>
    <p class="room-intro">手记地址可能已更新，可以回列表继续翻阅。</p>
    <RouterLink to="/room/notes" class="room-button">返回手记列表</RouterLink>
  </section>
</template>

<style scoped>
.journal-filters { max-width:650px; margin:0 0 13px; gap:9px; }
.journal-list { border-top:2px solid #907666; }
.journal-entry { display:grid; grid-template-columns:86px minmax(0,1fr) auto; align-items:center; gap:8px 17px; position:relative; min-height:108px; padding:13px 16px 13px 0; border-bottom:1px solid #c9b6a1; background:#fffaed; }
.journal-entry:nth-child(even) { background:#f6ead8; }
.journal-entry-copy { min-width:0; }
.journal-tag { align-self:start; justify-self:start; color:#fff8ed; background:var(--journal-ink); font-size:11px; margin:3px 0 0; padding:4px 9px 4px 8px; clip-path:polygon(0 0,100% 0,93% 50%,100% 100%,0 100%); }
.journal-entry-meta { color:#694f4c; font-size:11px; margin:0 0 2px; }
.journal-entry h3 { color:#43313c; font-size:clamp(17px,2.5vw,22px); margin:0; line-height:1.36; overflow-wrap:anywhere; }
.journal-entry h3 a { text-decoration:none; }
.journal-entry h3 a:hover { text-decoration:underline; text-underline-offset:4px; }
.journal-summary { margin:5px 0 0; font-size:13px; color:#654e51; }
.journal-open { font-size:13px; color:#6c3c55; min-height:44px; padding-inline:8px; text-decoration:none; white-space:nowrap; border-bottom:1px solid #a2737b; display:inline-flex; align-items:center; gap:4px; }
.journal-read-tag { font-size:11px; color:#6f4157; }
.journal-has-read::after { content:""; position:absolute; top:0; right:0; width:20px; height:20px; background:linear-gradient(225deg,#cba990 49%,#e9d7bd 50%,#fff8e6 60%); pointer-events:none; }
.journal-empty { color:#634652; background:#fff9eb; padding:16px; border:1px solid #c9b6a1; }
.journal-actions button { min-height:44px; }
.journal-sheet>input { width:100%; }
@media(max-width:760px) {
  .journal-filters { display:grid; grid-template-columns:1.2fr minmax(112px,1fr); }
  .journal-filters .room-field { margin:0; }
  .journal-entry { grid-template-columns:11px minmax(0,1fr) auto; gap:5px 6px; min-height:0; padding:10px 10px 8px 0; align-items:start; }
  .journal-tag { grid-row:1/3; align-self:stretch; writing-mode:vertical-rl; padding:4px 1px; margin:0; letter-spacing:0; font-size:9px; clip-path:none; overflow:hidden; }
  .journal-entry-copy { grid-column:2/-1; }
  .journal-open { grid-column:2; justify-self:start; border:none; min-height:44px; padding-inline:0; }
  .journal-has-read::after { width:15px; height:15px; }
}
</style>
