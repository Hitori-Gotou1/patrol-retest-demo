<script setup>
import { computed, defineAsyncComponent, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
const MusicPlayer = defineAsyncComponent(() => import('./MusicPlayer.vue'));
import FluidPanel from './motion/FluidPanel.vue';
import CinemaAtmosphere from './motion/CinemaAtmosphere.vue';
import { useSceneMotion } from '../composables/useSceneMotion.js';
import { cinemaMoods, cinemaMoodKey, readCinemaMood, saveCinemaMood } from '../room/cinemaMood.js';
import MusicGuide from './MusicGuide.vue';
import { site, assetUrl } from '../data/site.js';
const root = ref(null), moodPrefs = ref(readCinemaMood()), moodNotice = ref('');
const { active, reduced } = useSceneMotion(root);
const atmosphereActive = computed(() => active.value && moodPrefs.value.dynamic);
const currentMood = computed(() => cinemaMoods.find(m => m.id === moodPrefs.value.mood));
function setMood(id) { moodPrefs.value.mood = id; persistMood(); }
function persistMood() { moodNotice.value = saveCinemaMood(moodPrefs.value) ? '' : '本次选择已应用；浏览器暂时无法记住设置。'; }
function syncMood(event) { if (event.key === cinemaMoodKey || event.key === null) moodPrefs.value = readCinemaMood(); }
function energy(value) { root.value?.style.setProperty('--audio-glow', atmosphereActive.value ? Math.min(.12, value * .12).toFixed(3) : '0'); }
watch(atmosphereActive, value => { if (!value) energy(0); });
const musicOpened=ref(false);
const mode = ref('guide'), music = ref(null), video = ref(null), fileInput = ref(null);
const videoSource = ref(site.video.src ? assetUrl(site.video.src) : '');
const videoTitle = ref(site.video.title), videoDescription = ref(site.video.description), videoStatus = ref('');
let objectUrl = '';
function selectFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('video/') && !/\.(mp4|webm|ogv|mov|m4v)$/i.test(file.name)) { videoStatus.value = '请选择 MP4 或 WebM 等视频文件。'; event.target.value = ''; return; }
  video.value?.pause();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file); videoSource.value = objectUrl;
  videoTitle.value = file.name.replace(/\.[^.]+$/, ''); videoDescription.value = '你选中的片段 · 仅在当前浏览器预览';
  videoStatus.value = '正在读取视频…'; event.target.value = '';
}
function pauseVideo() { video.value?.pause(); }
function hidden() { if (document.hidden) pauseVideo(); }
watch(mode, (value) => { if(value==='music')musicOpened.value=true; if (value !== 'video') pauseVideo(); if (value !== 'music') music.value?.pause(); });
const route = useRoute();
watch(() => [route.query.listen,route.hash], ([listen,hash]) => {
  if (listen==='demo' && hash==='#video') mode.value='music';
}, { immediate:true });
onMounted(() => { window.addEventListener('storage', syncMood); document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', pauseVideo); });
onUnmounted(() => { window.removeEventListener('storage', syncMood); pauseVideo(); if (objectUrl) URL.revokeObjectURL(objectUrl); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', pauseVideo); });
</script>
<template>
  <section id="video" ref="root" :data-mood="moodPrefs.mood" :data-dynamic="atmosphereActive" class="video-section scene" data-scene-name="音乐放映室" aria-labelledby="video-title">
    <CinemaAtmosphere :mood="moodPrefs.mood" />
    <div class="scene-inner">
      <div class="section-label"><span>音乐放映室</span></div>
      <div class="section-heading media-heading" data-arrive="0"><div><h2 id="video-title">把灯调暗，再听一遍<span class="pink-period">.</span></h2><p>从一首喜欢的歌，到自己的第一段合奏。</p></div></div>
      <div class="media-toolbar" data-arrive="1">
        <div class="media-tabs" role="group" aria-label="选择音乐或视频">
          <button type="button" :aria-pressed="mode === 'guide'" @click="mode = 'guide'">原曲导听</button>
          <button type="button" :aria-pressed="mode === 'music'" @click="mode = 'music'">练习唱片</button>
          <button type="button" :aria-pressed="mode === 'video'" @click="mode = 'video'">私人放映</button>
        </div>
        <details class="cinema-mood-bar">
          <summary><span>氛围</span> <strong>{{ currentMood.name }}</strong></summary>
          <div class="cinema-mood-panel">
            <div class="cinema-mood-choices" role="group" aria-label="今晚氛围">
              <button v-for="item in cinemaMoods" :key="item.id" type="button" :aria-pressed="moodPrefs.mood === item.id" :data-mood-choice="item.id" @click="setMood(item.id)"><span aria-hidden="true">{{ item.icon }}</span>{{ item.name }}</button>
            </div>
            <p class="cinema-mood-label">{{ currentMood.note }}</p>
            <button type="button" class="cinema-dynamic-toggle" :disabled="reduced" :aria-pressed="moodPrefs.dynamic && !reduced" @click="moodPrefs.dynamic = !moodPrefs.dynamic; persistMood()">{{ reduced ? '已减少动态' : '背景动态 ' + (moodPrefs.dynamic ? '开' : '关') }}</button>
            <p v-if="moodNotice" class="cinema-mood-notice" role="status">{{ moodNotice }}</p>
          </div>
        </details>
      </div>
      <FluidPanel><div class="media-panel" :data-panel="mode">
      <div v-show="mode === 'guide'" class="media-pane" :class="{'is-current':mode==='guide'}"><MusicGuide /></div>
      <div v-show="mode === 'music'" class="media-pane" :class="{'is-current':mode==='music'}"><MusicPlayer v-if="musicOpened" ref="music" :visual-active="active && mode==='music'" @energy="energy" @pause="energy(0)" @play="pauseVideo" /></div>
      <div v-show="mode === 'video'" class="video-layout media-pane" :class="{'is-current':mode==='video'}">
        <div id="video-stage" class="video-stage">
          <div v-if="!videoSource" id="video-empty" class="video-empty"><span class="screen-corner top-left" aria-hidden="true"></span><span class="screen-corner bottom-right" aria-hidden="true"></span><p class="screen-label">想再看一遍的瞬间</p><button id="choose-video" class="play-button" type="button" aria-label="选择本地视频预览" @click="fileInput?.click()"><span aria-hidden="true">▶</span></button><span class="screen-caption">把喜欢的片段，留在这里。</span></div>
          <video v-else id="video-player" ref="video" :src="videoSource" :poster="site.video.poster ? assetUrl(site.video.poster) : undefined" controls playsinline preload="metadata" aria-label="收藏的视频" @play="music?.pause()" @loadedmetadata="videoStatus = '视频已就绪，点击播放即可观看。'" @error="videoStatus = '视频无法播放，请换用浏览器支持的 MP4 / WebM 文件。'"></video>
        </div>
        <div class="video-info"><h3 id="video-name">{{ videoSource ? videoTitle : '下一场心动，由你来选。' }}</h3><p id="video-description">{{ videoSource ? videoDescription : '这里留给你最喜欢的演出、片段，或自己剪辑的视频。' }}</p><button class="button button-outline" type="button" @click="fileInput?.click()">选择本地视频</button><input id="video-file" ref="fileInput" type="file" accept="video/*" hidden @change="selectFile"><p class="local-note">仅在当前浏览器预览，不会上传。<br>公开展示的视频将在选好素材后加入。</p><p id="video-status" class="video-status" role="status">{{ videoStatus }}</p></div>
      </div>
      </div></FluidPanel>
      <RouterLink to="/room/practice" class="room-entry-link">给今天留一段练习 · 练琴计时 ↗</RouterLink>
      <div class="cinema-closing"><span aria-hidden="true">✦</span><p>即使步伐很小，也有正在前进的声音。</p><RouterLink :to="{path:'/',hash:'#home'}">回到开场 ↑</RouterLink></div>
      <footer class="site-footer"><RouterLink class="brand" :to="{path:'/',hash:'#home'}"><span class="brand-mark" aria-hidden="true"><i></i><i></i></span>一里小屋</RouterLink><RouterLink to="/about" class="about-site-link">关于这个小小的空间 ↗</RouterLink></footer>
    </div>
  </section>
</template>

<style scoped>
.video-section {
  --deck-edge: #bb886e;
  --screen-edge: #b37353;
  --screen-glow: #bc754a4d;
}
.video-section[data-mood="rain"] {
  --deck-edge: #8d82ad;
  --screen-edge: #74678e;
  --screen-glow: #7869a448;
}
.video-section[data-mood="stage"] {
  --deck-edge: #c19ab9;
  --screen-edge: #a96695;
  --screen-glow: #bf7fa64d;
}
.video-section .section-label { margin-bottom: 7px; color: #f1d8ba; font-size: .81rem; }
.video-section .media-heading h2 { font-weight: 760; font-size: clamp(1.8rem, 4vw, 3.35rem); line-height: 1.2; }
.video-section .media-heading p { color: var(--room-console-muted); margin-top: .4rem; font-size: .9375rem; }
.video-section .media-heading { margin-bottom: .85rem; }
.media-toolbar {
  display: flex;
  align-items: start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: .25rem 1rem;
  padding-bottom: .6rem;
  margin-bottom: .7rem;
  border-bottom: 1px solid var(--room-console-edge);
}
.media-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; padding: 3px; border: 1px solid var(--room-console-edge); background: #1e1923; }
.video-section .media-tabs button { min-height: 44px; padding: .45rem .8rem; font-size: .875rem; color: var(--room-console-muted); background: transparent; border: 1px solid transparent; }
.video-section .media-tabs button[aria-pressed='true'] { color: #361e31; background: var(--room-berry-light); border-color: var(--room-berry-light); font-weight: 750; }
.video-section :is(summary, button):focus-visible { outline: 2px solid var(--room-berry-light); outline-offset: 2px; }
.cinema-mood-bar { min-width: 0; }
.cinema-mood-bar summary { display: flex; align-items: center; gap: .5rem; width: fit-content; min-height: 44px; padding-inline: .3rem; color: var(--room-console-muted); font-size: .875rem; cursor: pointer; list-style: none; }
.cinema-mood-bar summary::-webkit-details-marker { display: none; }
.cinema-mood-bar summary strong { color: var(--room-console-ink); }
.cinema-mood-bar summary::after { content: ''; width: .42rem; height: .42rem; border: solid currentColor; border-width: 0 1px 1px 0; transform: rotate(45deg); margin: -.2rem .2rem 0 .1rem; flex-shrink: 0; }
.cinema-mood-bar[open] summary::after { transform: rotate(225deg); margin-top: .2rem; }
.cinema-mood-panel { padding: .55rem; background: var(--room-console); border: 1px solid var(--room-console-edge); color: var(--room-console-muted); }
.cinema-mood-choices { display: flex; flex-wrap: wrap; gap: .3rem; }
.cinema-mood-choices button, .cinema-dynamic-toggle { min-height: 44px; padding: .35rem .55rem; background: transparent; color: var(--room-console-muted); border: 1px solid var(--room-console-top); font-size: .8125rem; }
.cinema-mood-choices button span { margin-inline-end: .25rem; }
.cinema-mood-choices button[aria-pressed='true'] { color: var(--room-console-ink); border-color: var(--room-berry-light); font-weight: 700; }
.cinema-mood-label, .cinema-mood-notice { margin: .35rem 0; font-size: .8125rem; }
.cinema-dynamic-toggle { border-color: transparent; text-decoration: underline; text-underline-offset: .22em; padding-inline: 0; }
.cinema-dynamic-toggle:disabled { opacity: .8; text-decoration: none; cursor: default; }
.video-section .video-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  justify-items: center;
  gap: 9px;
  margin-top: 0;
  padding: clamp(8px, 2.2vw, 24px);
  border: 1px solid var(--room-console-edge);
  border-top-color: var(--room-console-top);
  background: var(--room-console);
}
.video-section .video-layout::before, .video-section .video-layout::after { display: none; }
.video-section .video-stage {
  display: flex;
  width: min(100%, 870px);
  min-height: 0;
  max-height: none;
  aspect-ratio: 16 / 9;
  border: 2px solid var(--screen-edge);
  background: #090a10;
  box-shadow: 0 0 24px var(--screen-glow);
}
.video-section .video-empty {
  display: flex;
  height: 100%;
  background: linear-gradient(#180f1c35, #14101bb0), url('/assets/bocchi-cover.webp') center 41% / cover;
}
.video-section .video-info { width: min(100%, 870px); padding: 0; }
.video-section .video-info h3 { color: #f7e9ed; font-size: clamp(1rem, 2vw, 1.36rem); margin: 6px 0; }
.video-section .video-info > p { color: #e6d4df; font-size: .86rem; margin: 4px 0 9px; }
.video-section .video-info .local-note, .video-section .video-info .video-status { color: #e5c4d5; }
.video-section .video-info .button { min-height: 44px; color: #fff0e4; }
.video-section .video-info .video-status:empty { display: none; }
@media (max-width: 760px) {
  .video-section.scene { padding-top: 116px; }
  .video-section .media-heading { margin-bottom: .6rem; }
  .media-toolbar > * { width: 100%; }
  .video-section .media-tabs button { padding-inline: .3rem; }
  .media-toolbar { gap: 0; padding-bottom: .12rem; margin-bottom: .65rem; }
}
</style>
