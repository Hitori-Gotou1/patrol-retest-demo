<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import gsap from 'gsap';
import { site, assetUrl } from '../data/site.js';
const root = ref(null);
const backdrop = ref(null);
const backgroundVideo = ref(null);
const failedVideo = ref(false);
const reduce = ref(false);
let motion, observer, context;
let moveX, moveY;
function move(event) {
  if (reduce.value || event.pointerType !== 'mouse' || !moveX) return;
  const bounds = root.value.getBoundingClientRect();
  moveX((event.clientX / bounds.width - .5) * 10);
  moveY(((event.clientY - bounds.top) / bounds.height - .5) * 8);
}
function reset() { moveX?.(0); moveY?.(0); }
function updateMotion() { reduce.value = motion.matches; if (reduce.value) { reset(); backgroundVideo.value?.pause(); } }
onMounted(() => {
  motion = matchMedia('(prefers-reduced-motion: reduce)');
  updateMotion(); motion.addEventListener('change', updateMotion);
  context = gsap.matchMedia();
  context.add('(prefers-reduced-motion: no-preference)', () => {
    const elements = root.value.querySelectorAll('.hero-content > *, .hero-bottom');
    // 信息始终在文档中可读，GSAP 只负责短暂的分层入场。
    gsap.from(elements, { y: 24, opacity: 0, stagger: .09, duration: .8, ease: 'power3.out', clearProps: 'transform,opacity' });
    moveX = gsap.quickTo(backdrop.value, 'x', { duration: .8, ease: 'power2.out' });
    moveY = gsap.quickTo(backdrop.value, 'y', { duration: .8, ease: 'power2.out' });
    return () => { moveX = null; moveY = null; };
  }, root.value);
  observer = new IntersectionObserver(([entry]) => {
    root.value?.classList.toggle('is-offscreen', !entry.isIntersecting);
    const video = backgroundVideo.value;
    if (video) {
      if (entry.isIntersecting && !motion.matches && !document.hidden) video.play().catch(() => { failedVideo.value = true; });
      else video.pause();
    }
  });
  observer.observe(root.value);
  document.addEventListener('visibilitychange', pauseHidden);
});
function pauseHidden() { if (document.hidden) backgroundVideo.value?.pause(); }
onUnmounted(() => { context?.revert(); observer?.disconnect(); motion?.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', pauseHidden); backgroundVideo.value?.pause(); });
</script>
<template>
  <section id="home" ref="root" class="hero scene" data-scene-name="开场" aria-labelledby="hero-title" @pointermove="move" @pointerleave="reset">
    <div ref="backdrop" class="hero-backdrop">
      <img id="hero-image" :src="assetUrl(site.cover)" :alt="site.coverAlt" fetchpriority="high" width="1672" height="940">
      <video v-if="site.backgroundVideo && !failedVideo && !reduce" ref="backgroundVideo" class="hero-background-video" :src="assetUrl(site.backgroundVideo)" :poster="assetUrl(site.cover)" muted loop playsinline autoplay aria-hidden="true" @error="failedVideo = true"></video>
    </div>
    <div class="hero-stage-light" aria-hidden="true"></div><div class="hero-grain" aria-hidden="true"></div>
    <div class="hero-content scene-inner">
      <div class="eyebrow"><span class="status-dot"></span>01 / 一里小屋 · 开场</div>
      <p class="hero-pretitle">ひとりじゃない。</p>
      <h1 id="hero-title">把心跳，<br><span>弹给世界听。</span></h1>
      <p class="hero-description">平时，想躲进纸箱。上台，想被你听见。<br>从一个人的练习，到四个人的舞台，<br>这里收藏后藤一里的每一点勇气。</p>
      <div class="hero-actions"><RouterLink class="button button-pink" :to="{path:'/',hash:'#about'}">走近结束乐队 <span aria-hidden="true">↗</span></RouterLink><RouterLink class="text-link" :to="{path:'/',hash:'#theater'}">敲敲她的纸箱 <span aria-hidden="true">→</span></RouterLink></div>
    </div>
    <div class="hero-bottom"><span class="hero-edition">GUITAR, DREAMS<br>& A LITTLE COURAGE</span><RouterLink :to="{path:'/',hash:'#about'}" class="scroll-cue">往下，故事才刚刚开始 <span aria-hidden="true">↓</span></RouterLink><span class="hero-signature" aria-hidden="true">ぼっち！</span></div>
  </section>
</template>
