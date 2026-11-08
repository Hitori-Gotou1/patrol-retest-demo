<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { roomStories } from '../../data/roomStories.js';
import { storyNode, storyEndings, validateStoryProgress } from '../../room/story.js';
import { loadLocal, saveLocal } from '../../room/storage.js';
const key = 'hitori-room:stories:v1';
const empty = validateStoryProgress({ version: 1, progress: {} }, roomStories);
const saved = ref(loadLocal(key, empty, value => validateStoryProgress(value, roomStories)));
const selected = ref(saved.value.lastStory), note = ref(''), heading = ref(null);
const story = computed(() => roomStories.find(item => item.id === selected.value));
const progress = computed(() => saved.value.progress[story.value.id]);
const node = computed(() => storyNode(story.value, progress.value.path));
const total = computed(() => roomStories.reduce((sum, story) => sum + storyEndings(story).length, 0));
const unlocked = computed(() => Object.values(saved.value.progress).reduce((sum, item) => sum + item.endings.length, 0));
async function update(path) {
  const current = storyNode(story.value, path);
  const endings = [...new Set([...progress.value.endings, ...(current.ending ? [current.ending] : [])])];
  saved.value = { version: 1, lastStory: selected.value, progress: { ...saved.value.progress, [story.value.id]: { path, endings } } };
  note.value = saveLocal(key, saved.value) ? current.ending ? '已解锁这个结局，进度已保存。' : '剧情进度已保存。' : '当前浏览器无法保存，进度仅本次有效。';
  await nextTick(); heading.value?.focus({ preventScroll: true });
}
watch(selected, () => { saved.value.lastStory = selected.value; if (!saveLocal(key,saved.value)) note.value = '当前浏览器无法保存，进度仅本次有效。'; });
</script>
<template>
  <section class="room-panel" aria-labelledby="stories-title"><h2 id="stories-title">把故事，接下去。</h2><p class="room-intro">三篇本站原创同人短篇。选一条路，看看今天会走到哪个结局。</p>
    <div class="room-actions" role="group" aria-label="选择短篇"><button v-for="item in roomStories" :key="item.id" type="button" :aria-pressed="selected === item.id" @click="selected = item.id; note = ''">{{ item.title }}</button></div>
    <p class="room-hint">{{ story.intro }} · 已解锁 {{ unlocked }} / {{ total }} 个结局</p>
    <article class="story-stage"><p class="room-kicker">{{ node.speaker }}</p><h3 ref="heading" tabindex="-1">{{ node.ending || story.title }}</h3><p class="room-prose">{{ node.text }}</p><div v-if="node.choices" class="story-choices"><button v-for="(choice,index) in node.choices" :key="choice.next" type="button" @click="update([...progress.path,index])">{{ choice.text }} <span aria-hidden="true">↗</span></button></div><p v-else class="story-ending" role="status">结局解锁 · {{ node.ending }}</p></article>
    <div class="room-actions"><button type="button" :disabled="!progress.path.length" @click="update(progress.path.slice(0,-1))">回到上一幕</button><button type="button" @click="update([])">从头再读</button></div>
    <div class="story-endings"><h3>这一篇的结局手帐</h3><ul><li v-for="ending in storyEndings(story)" :key="ending">{{ progress.endings.includes(ending) ? `✓ ${ending}` : '○ 尚未解锁' }}</li></ul></div><p class="room-status" role="status">{{ note }}</p>
  </section>
</template>
<style scoped>.story-stage { border-block: 1px solid #d7c4b5; padding: 15px 0 25px; margin-top: 24px; }.story-stage .room-prose { font-size: 16px; }.story-choices { display: grid; gap: 12px; margin-top: 24px; }.story-choices button { justify-content: space-between; text-align: left; }.story-ending { color: #8c4767; font-weight: 700; }.story-endings ul { padding-left: 20px; line-height: 2; font-size: 13px; }</style>
