<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import MusicPlayer from './MusicPlayer.vue';
import { site, assetUrl } from '../data/site.js';
const mode = ref('music'), music = ref(null), video = ref(null), fileInput = ref(null);
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
watch(mode, (value) => { if (value === 'music') pauseVideo(); else music.value?.pause(); });
onMounted(() => { document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', pauseVideo); });
onUnmounted(() => { pauseVideo(); if (objectUrl) URL.revokeObjectURL(objectUrl); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', pauseVideo); });
</script>
<template>
  <section id="video" class="video-section scene" data-scene-name="音乐放映室" aria-labelledby="video-title">
    <div class="scene-inner">
      <div class="section-label"><span>05 / 给今天，配一段旋律</span><span>FROM THE ROOM TO THE STAGE</span></div>
      <div class="section-heading media-heading"><div><h2 id="video-title">把灯调暗，再听一遍<span class="pink-period">.</span></h2><p>一张练习唱片，一段珍藏的画面。今晚，慢慢来。</p></div><div class="media-tabs" role="group" aria-label="选择音乐或视频"><button type="button" :aria-pressed="mode === 'music'" @click="mode = 'music'">练习唱片</button><button type="button" :aria-pressed="mode === 'video'" @click="mode = 'video'">私人放映</button></div></div>
      <MusicPlayer v-show="mode === 'music'" ref="music" @play="pauseVideo" />
      <div v-show="mode === 'video'" class="video-layout">
        <div id="video-stage" class="video-stage">
          <div v-if="!videoSource" id="video-empty" class="video-empty"><span class="screen-corner top-left" aria-hidden="true"></span><span class="screen-corner bottom-right" aria-hidden="true"></span><p class="screen-label">想再看一遍的瞬间</p><button id="choose-video" class="play-button" type="button" aria-label="选择本地视频预览" @click="fileInput?.click()"><span aria-hidden="true">▶</span></button><span class="screen-caption">把喜欢的片段，留在这里。</span></div>
          <video v-else id="video-player" ref="video" :src="videoSource" :poster="site.video.poster ? assetUrl(site.video.poster) : undefined" controls playsinline preload="metadata" aria-label="收藏的视频" @play="music?.pause()" @loadedmetadata="videoStatus = '视频已就绪，点击播放即可观看。'" @error="videoStatus = '视频无法播放，请换用浏览器支持的 MP4 / WebM 文件。'"></video>
        </div>
        <div class="video-info"><span class="pill">小小放映室</span><h3 id="video-name">{{ videoSource ? videoTitle : '下一场心动，由你来选。' }}</h3><p id="video-description">{{ videoSource ? videoDescription : '这里留给你最喜欢的演出、片段，或自己剪辑的视频。' }}</p><button class="button button-outline" type="button" @click="fileInput?.click()">选择本地视频 <span aria-hidden="true">＋</span></button><input id="video-file" ref="fileInput" type="file" accept="video/*" hidden @change="selectFile"><p class="local-note">仅在当前浏览器预览，不会上传。<br>公开展示的视频将在选好素材后加入。</p><p id="video-status" class="video-status" role="status">{{ videoStatus }}</p></div>
      </div>
      <div class="cinema-closing"><span aria-hidden="true">✦</span><p>即使步伐很小，也有正在前进的声音。</p><RouterLink :to="{path:'/',hash:'#home'}">回到开场 ↑</RouterLink></div>
      <footer class="site-footer"><RouterLink class="brand" :to="{path:'/',hash:'#home'}"><span class="brand-mark" aria-hidden="true"><i></i><i></i></span>一里小屋</RouterLink><RouterLink to="/about" class="about-site-link">关于这个小小的空间 ↗</RouterLink></footer>
    </div>
  </section>
</template>
