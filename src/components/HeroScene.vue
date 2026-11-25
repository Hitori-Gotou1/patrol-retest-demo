<script setup>
import {motionPreference as createMotionQuery} from '../room/preferences.js';
import { ref, onMounted, onUnmounted } from 'vue';
import gsap from 'gsap';
import { useSceneMotion } from '../composables/useSceneMotion.js';
import { site, assetUrl } from '../data/site.js';
const root = ref(null);
const { active } = useSceneMotion(root, { entrance: false });
const backdrop = ref(null);
const backgroundVideo = ref(null);
const failedVideo = ref(false);
const reduce = ref(false);
let motion, observer, context;
let moveX, moveY;
function move(event) {
  if (!active.value || reduce.value || event.pointerType !== 'mouse' || !moveX) return;
  const bounds = root.value.getBoundingClientRect();
  moveX((event.clientX / bounds.width - .5) * 10);
  moveY(((event.clientY - bounds.top) / bounds.height - .5) * 8);
}
function reset() { moveX?.(0); moveY?.(0); }
function updateMotion() { reduce.value = motion.matches; if (reduce.value) { gsap.killTweensOf(backdrop.value); gsap.set(backdrop.value, {x:0,y:0}); backgroundVideo.value?.pause(); } }
onMounted(() => {
  motion = createMotionQuery();
  updateMotion(); motion.addEventListener('change', updateMotion);
  context = gsap.matchMedia();
  context.add('(prefers-reduced-motion: no-preference)', () => {
    const elements = root.value.querySelectorAll('.hero-content > *, .hero-bottom');
    // 信息始终在文档中可读，GSAP 只负责短暂的分层入场。
    if (!motion.matches) gsap.from(elements, { y: 24, opacity: 0, stagger: .09, duration: .8, ease: 'power3.out', clearProps: 'transform,opacity' });
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
function pauseHidden() { if (document.hidden) { reset(); backgroundVideo.value?.pause(); } }
onUnmounted(() => { context?.revert(); observer?.disconnect(); motion?.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', pauseHidden); backgroundVideo.value?.pause(); });
</script>
<template>
  <section id="home" ref="root" class="hero scene" data-scene-name="开场" aria-labelledby="hero-title" @pointermove="move" @pointerleave="reset">
    <div ref="backdrop" class="hero-backdrop">
      <img id="hero-image" :src="assetUrl(site.cover)" :alt="site.coverAlt" fetchpriority="high" width="1672" height="940">
      <video v-if="site.backgroundVideo && !failedVideo && !reduce" ref="backgroundVideo" class="hero-background-video" :src="assetUrl(site.backgroundVideo)" :poster="assetUrl(site.cover)" muted loop playsinline autoplay aria-hidden="true" @error="failedVideo = true"></video>
    </div>
    <div class="hero-stage-light" aria-hidden="true"></div>
    <div class="hero-content scene-inner">
      <p class="eyebrow">下北泽 · STARRY</p>
      <p class="hero-pretitle">ひとりじゃない。</p>
      <h1 id="hero-title"><span>把心跳，</span><span>弹给世界听。</span></h1>
      <p class="hero-description">平时，想躲进纸箱。上台，想被你听见。<br>从一个人的练习，到四个人的舞台，<br>这里收藏后藤一里的每一点勇气。</p>
      <div class="hero-actions"><RouterLink class="button button-pink" :to="{path:'/',hash:'#about'}">走近结束乐队</RouterLink><RouterLink class="text-link" :to="{path:'/',hash:'#theater'}">敲敲她的纸箱</RouterLink></div>
    </div>
    <div class="hero-bottom"><RouterLink :to="{path:'/',hash:'#about'}" class="scroll-cue">往下，故事才刚刚开始 <span aria-hidden="true">↓</span></RouterLink></div>
  </section>
</template>

<style scoped>
.hero.scene {
  --poster-edge: clamp(36px, 8vw, 126px);
  padding-inline: var(--poster-edge);
  padding-block: 115px 95px;
  background: #141019;
}
.hero.scene::after {
  content: "";
  position: absolute;
  inset: 92px 35px 34px;
  border: 1px solid #efbfd344;
  pointer-events: none;
  z-index: -1;
}
.hero-backdrop { inset: -10px; }
.hero-backdrop :is(img, video) { object-position: 68% 39%; }
.hero-backdrop img { filter: brightness(1.16) saturate(1.06); }
.hero-backdrop::after {
  background:
    linear-gradient(90deg, #141019fa 0%, #151019df 22%, #17101d8c 37%, #17101d20 52%, transparent 63%),
    linear-gradient(0deg, #151019bb, transparent 24%);
}
.hero .eyebrow {
  align-items: center;
  gap: 9px;
  margin: 0 0 16px;
  font-size: .79rem;
  letter-spacing: .13em;
}
.hero .eyebrow::before { content: ""; width: 26px; height: 1px; background: currentColor; }
.hero-pretitle { margin-bottom: 12px; font-size: .9rem; letter-spacing: .23em; }
.hero.scene h1 {
  width: fit-content;
  font-size: clamp(3.4rem, 6.75vw, 6.35rem);
  line-height: 1.08;
  letter-spacing: -.068em;
}
.hero.scene h1 span { display: block; white-space: nowrap; }
.hero.scene h1 span:first-child { color: #fff1ed; }
.hero.scene h1 span:last-child { color: #fac0d5; }
.hero.scene .hero-description { color: #f4dfe9; line-height: 1.75; }
.hero.scene .button { background: #f8afc9; color: #2f1829; padding-inline: 23px; font-size: .91rem; min-height: 47px; }
.hero.scene .text-link { text-decoration: underline; text-underline-offset: 5px; }
.hero-bottom { inset: auto var(--poster-edge) 48px; }

@media (max-width: 760px) {
  .hero.scene {
    --poster-edge: clamp(18px, 6vw, 33px);
    min-height: max(720px, 100svh);
    padding-block: clamp(354px, 48svh, 515px) 62px;
    align-items: flex-start;
  }
  .hero.scene::after { inset: 112px 11px 13px; border-color: #d795b239; }
  .hero-backdrop { inset: 86px -6px auto; height: clamp(382px, 57svh, 560px); }
  .hero-backdrop :is(img, video) { object-position: 76% 36%; }
  .hero-backdrop img { filter: brightness(1.15) saturate(1.04); }
  .hero-backdrop::after {
    background: linear-gradient(0deg, #141019 1%, #16101bb8 21%, #1b111e16 44%, transparent 74%);
  }
  .hero-content { padding-block: 0; }
  .hero .eyebrow { margin-bottom: 8px; font-size: .73rem; }
  .hero-pretitle { display: none; }
  .hero.scene h1 { font-size: clamp(2.45rem, 12vw, 4.7rem); line-height: 1.09; }
  .hero.scene .hero-description { margin: 13px 0 17px; font-size: .84rem; line-height: 1.6; }
  .hero.scene .hero-actions { gap: 7px 16px; }
  .hero.scene .button { padding-inline: 14px; font-size: .85rem; }
  .hero.scene .text-link { display: inline-flex; min-height: 44px; align-items: center; }
  .hero-bottom { bottom: 17px; }
}
</style>
