<script setup>
import { computed, defineAsyncComponent, ref, onMounted, onUnmounted, watch } from 'vue';
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
const tabs = ['guide', 'music', 'video'];
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
onMounted(() => { window.addEventListener('storage', syncMood); document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', pauseVideo); });
onUnmounted(() => { window.removeEventListener('storage', syncMood); pauseVideo(); if (objectUrl) URL.revokeObjectURL(objectUrl); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', pauseVideo); });
</script>
<template>
  <section id="video" ref="root" :data-mood="moodPrefs.mood" :data-dynamic="atmosphereActive" class="video-section scene" data-scene-name="音乐放映室" aria-labelledby="video-title">
    <CinemaAtmosphere :mood="moodPrefs.mood" />
    <div class="scene-inner">
      <div class="section-label"><span>音乐放映室</span></div>
      <div class="section-heading media-heading" data-arrive="0"><div><h2 id="video-title">把灯调暗，再听一遍<span class="pink-period">.</span></h2><p>从一首喜欢的歌，到自己的第一段合奏。今晚，慢慢来。</p></div><div class="media-tabs" :style="{'--tab-index':tabs.indexOf(mode)}" role="group" aria-label="选择音乐或视频"><i class="media-tab-marker" aria-hidden="true"></i><button type="button" :aria-pressed="mode === 'guide'" @click="mode = 'guide'">原曲导听</button><button type="button" :aria-pressed="mode === 'music'" @click="mode = 'music'">练习唱片</button><button type="button" :aria-pressed="mode === 'video'" @click="mode = 'video'">私人放映</button></div></div>
      <div class="cinema-mood-bar" data-arrive="1">
        <div class="cinema-mood-label"><span>今晚氛围</span><p>{{ currentMood.note }}</p></div>
        <div class="cinema-mood-choices" role="group" aria-label="今晚氛围"><button v-for="item in cinemaMoods" :key="item.id" type="button" :aria-pressed="moodPrefs.mood===item.id" :data-mood-choice="item.id" @click="setMood(item.id)"><span aria-hidden="true">{{item.icon}}</span>{{item.name}}</button></div>
        <button type="button" class="cinema-dynamic-toggle" :disabled="reduced" :aria-pressed="moodPrefs.dynamic && !reduced" @click="moodPrefs.dynamic=!moodPrefs.dynamic;persistMood()">{{reduced?'已减少动态':'背景动态 '+(moodPrefs.dynamic?'开':'关')}}</button>
        <p v-if="moodNotice" class="cinema-mood-notice" role="status">{{moodNotice}}</p>
      </div>
      <FluidPanel><div class="media-panel" :data-panel="mode" data-arrive="2">
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
  --liner-paper: #efddbe;
  --liner-sheen: #fff9eac9;
  --deck-edge: #bb886e;
  --deck-sheen: #624049;
  --screen-edge: #b37353;
  --screen-glow: #bc754a4d;
}
.video-section[data-mood="rain"] {
  --liner-paper: #d6c9dd;
  --liner-sheen: #f7e3f078;
  --deck-edge: #8d82ad;
  --deck-sheen: #393756;
  --screen-edge: #74678e;
  --screen-glow: #7869a448;
}
.video-section[data-mood="stage"] {
  --liner-paper: #e8ced0;
  --liner-sheen: #fff8edca;
  --deck-edge: #c19ab9;
  --deck-sheen: #5b354d;
  --screen-edge: #a96695;
  --screen-glow: #bf7fa64d;
}
.video-section .section-label { margin-bottom: 7px; color: #f1d8ba; font-size: .81rem; }
.video-section .media-heading h2 { font-weight: 760; font-size: clamp(1.8rem, 4vw, 3.35rem); line-height: 1.2; }
.video-section .media-heading p { color: #e1ccdc; margin-top: 7px; font-size: .91rem; }
.video-section .media-heading { margin-bottom: 15px; }
.video-section .cinema-mood-bar { padding: 8px 0 12px; margin-bottom: 9px; }
.video-section .cinema-mood-label > span { font-size: .82rem; letter-spacing: 0; }
.video-section .cinema-mood-label > p { margin-top: 3px; color: #e3cede; }
.video-section :is(.cinema-mood-choices, .media-tabs) button { font-weight: 650; font-size: .84rem; }
.video-section .cinema-dynamic-toggle { color: #ebd7e5; font-size: .76rem; }
.video-section .video-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  justify-items: center;
  gap: 9px;
  margin-top: 0;
  padding: clamp(8px, 2.2vw, 24px);
  border: 1px solid var(--screen-edge);
  background: radial-gradient(ellipse at 50% 42%, var(--screen-glow), transparent 70%), #1b1723;
  box-shadow: 0 12px 29px #0b0a12bd;
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
  .video-section .media-heading { gap: 9px; margin-bottom: 10px; }
  .video-section .cinema-mood-bar { padding-top: 6px; gap: 4px; margin-bottom: 4px; }
  .video-section .cinema-mood-label { display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 8px; }
  .video-section .cinema-dynamic-toggle { min-height: 33px; margin-inline-start: 0; }
  .video-section :is(.cinema-mood-choices, .media-tabs) button { font-size: clamp(.72rem, 3.14vw, .84rem); }
}
</style>
