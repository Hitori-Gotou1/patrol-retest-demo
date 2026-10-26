<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { gsap } from 'gsap';
import members from '../data/characters.json';
import '../styles/character-enhancements.css';

const scene = ref(null);
const showcase = ref(null);
const selectedIndex = ref(0);
const reaction = ref('');
const reducedMotion = ref(false);
const member = computed(() => members[selectedIndex.value]);
const counter = computed(() => `${String(selectedIndex.value + 1).padStart(2, '0')} / ${String(members.length).padStart(2, '0')}`);
const asset = path => `${import.meta.env.BASE_URL}${path}`;
const lines = {
  hitori: ['等、等一下，刚刚是在叫我吗？', '让吉他先替我说一句，你好。', '今天没有躲回纸箱，已经很厉害了。'],
  nijika: ['节拍已经准备好了，一起开始吧。', '下一次练习，大家也要到齐。'],
  ryo: ['安静一点，听见贝斯的声音了吗？', '自己的声音，值得被留下。'],
  kita: ['先认真练习，再把笑容送到台下。', '如果有点紧张，我们就一起上场。']
};
let reactionIndex = 0;
let animationContext;
let media;
let entryTimeline;
let reactionTween;
let observer;
let active = true;
let selectionRequest = 0;
let pointerStart;
let lastSwipe = 0;

function selectMember(index, focusTab = false) {
  selectedIndex.value = (index + members.length) % members.length;
  if (focusTab) nextTick(() => scene.value?.querySelector(`#tab-${member.value.id}`)?.focus());
}
function onTabKey(event, index) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const targets = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: members.length - 1 };
  if (!(event.key in targets)) return;
  event.preventDefault();
  selectMember(targets[event.key], true);
}
function startSwipe(event) {
  if (event.pointerType === 'touch') pointerStart = { x: event.clientX, y: event.clientY };
}
function finishSwipe(event) {
  if (!pointerStart) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;
  // 只响应明确的横向滑动；不 preventDefault，让手机纵向阅读保持原生行为。
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.6) {
    lastSwipe = performance.now();
    selectMember(selectedIndex.value + (dx < 0 ? 1 : -1));
  }
}
function reactToPortrait() {
  if (performance.now() - lastSwipe < 450) return;
  const choices = lines[member.value.id];
  reaction.value = choices[reactionIndex++ % choices.length];
  animationContext?.react();
}

watch(selectedIndex, async () => {
  const request = ++selectionRequest;
  reaction.value = '';
  reactionIndex = 0;
  await nextTick();
  if (active && request === selectionRequest) animationContext?.enter();
});

onMounted(() => {
  animationContext = gsap.context(context => {
    context.add('enter', () => {
      // 快速连点时取消上一段时间线，以当前成员为唯一状态来源，避免旧回调覆盖新内容。
      entryTimeline?.kill();
      reactionTween?.kill();
      const title = scene.value.querySelector('.character-copy h3');
      const layers = scene.value.querySelectorAll('.character-copy > :not(h3)');
      const portrait = scene.value.querySelector('.character-portrait-trigger');
      const lettering = scene.value.querySelector('.character-lettering');
      const targets = [title, ...layers, portrait, lettering];
      gsap.set(targets, { clearProps: 'transform,opacity,visibility' });
      gsap.to(showcase.value, {
        '--member': member.value.color,
        '--member-wash': member.value.wash,
        '--member-deep': member.value.deep,
        backgroundColor: member.value.deep,
        duration: reducedMotion.value ? 0 : 0.5,
        overwrite: 'auto'
      });
      if (reducedMotion.value) return;
      entryTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
        .fromTo(title, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42 }, 0)
        .fromTo(portrait, { x: 36, opacity: 0 }, { x: 0, opacity: 1, duration: 0.62 }, 0)
        .fromTo(lettering, { x: 18, opacity: 0 }, { x: 0, opacity: 0.21, duration: 0.7 }, 0.04)
        .fromTo(layers, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.035 }, 0.1);
    });
    context.add('react', () => {
      reactionTween?.kill();
      if (reducedMotion.value) return;
      const target = scene.value.querySelector('.character-portrait-trigger');
      // 点击彩蛋短促收束，不产生循环，也不会自动发声。
      reactionTween = gsap.fromTo(target, { rotation: -1.2, y: 0 }, {
        rotation: 1.2, y: member.value.id === 'hitori' ? 7 : -4,
        duration: 0.12, repeat: 3, yoyo: true, ease: 'sine.inOut',
        onComplete: () => gsap.set(target, { rotation: 0, y: 0 })
      });
    });
  }, scene.value);
  media = gsap.matchMedia();
  media.add({ reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, state => {
    reducedMotion.value = Boolean(state.conditions.reduce);
    // 媒体上下文和组件上下文分别管理；在微任务中进入，避免上下文互相嵌套。
    queueMicrotask(() => { if (active) animationContext?.enter(); });
    return () => { entryTimeline?.kill(); reactionTween?.kill(); };
  });
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      animationContext?.enter();
      observer.disconnect();
    }
  }, { threshold: 0.15 });
  observer.observe(scene.value);
});

onBeforeUnmount(() => {
  active = false;
  selectionRequest += 1;
  observer?.disconnect();
  entryTimeline?.kill();
  reactionTween?.kill();
  media?.revert();
  animationContext?.revert();
});
</script>

<template>
  <section id="about" ref="scene" class="about scene character-scene" data-scene-name="结束乐队" aria-labelledby="about-title">
    <div class="scene-inner">
      <div class="scene-heading"><div><span class="scene-kicker">02 / 聚光灯亮起</span><h2 id="about-title">四种颜色，同一支乐队。</h2></div><p>一个人的练习，<br>四个人的回响。</p></div>
      <div id="character-showcase" ref="showcase" class="character-showcase" :data-member="member.id">
        <div class="character-stage-top"><span><i aria-hidden="true"></i> KESSOKU BAND / MEMBER FILE</span><div class="character-controls"><span id="character-counter">{{ counter }}</span><button id="character-prev" type="button" aria-label="上一位成员" @click="selectMember(selectedIndex - 1)">←</button><button id="character-next" type="button" aria-label="下一位成员" @click="selectMember(selectedIndex + 1)">→</button></div></div>
        <div id="character-tabs" class="character-tabs" role="tablist" aria-label="结束乐队成员">
          <button v-for="(person, index) in members" :id="`tab-${person.id}`" :key="person.id" type="button" role="tab" :data-member="person.id" aria-controls="character-panel" :aria-selected="index === selectedIndex" :tabindex="index === selectedIndex ? 0 : -1" @click="selectMember(index)" @keydown="onTabKey($event, index)">
            <span class="tab-portrait" aria-hidden="true"><img :src="asset(person.portrait)" alt="" width="406" height="620" loading="lazy"></span><span class="tab-copy"><strong>{{ person.name }}</strong><small>{{ person.shortRole }}</small></span><span class="tab-indicator" aria-hidden="true">↗</span>
          </button>
        </div>
        <div id="character-panel" class="character-panel" role="tabpanel" :aria-labelledby="`tab-${member.id}`" tabindex="0">
          <article class="character-view" :data-character="member.id">
            <div class="character-copy">
              <span class="character-part">{{ member.role }}</span>
              <h3>{{ member.name }}</h3>
              <div class="character-names"><p class="character-jp" lang="ja">{{ member.nameJa }}</p><p class="character-romanized">{{ member.romanizedName }}</p></div>
              <ul class="character-personality" aria-label="性格关键词"><li v-for="trait in member.personality" :key="trait">{{ trait }}</li></ul>
              <div class="character-line"><span class="character-line-label">{{ member.lineKind }}</span><p class="character-headline" aria-live="polite">{{ reaction || member.originalLine }}</p></div>
              <p class="character-description">{{ member.description }}</p>
              <div class="character-connection"><span>{{ member.connectionTitle }}</span><p>{{ member.connection }}</p></div>
              <p class="character-cv"><span>声优</span>{{ member.cv }}</p>
            </div>
            <div class="character-art" @pointerdown="startSwipe" @pointerup="finishSwipe" @pointercancel="pointerStart = null">
              <span class="character-lettering" aria-hidden="true">{{ member.lettering }}</span><span class="character-instrument" aria-hidden="true">{{ member.instrument }}</span><div class="character-halo" aria-hidden="true"></div><div class="character-frame" aria-hidden="true"></div>
              <button class="character-portrait-trigger" type="button" :aria-label="`轻点${member.name}的图形，听听她的脑内小剧场`" @click="reactToPortrait"><img :key="member.id" class="character-portrait" :src="asset(member.portrait)" :alt="member.portraitAlt" width="406" height="620" loading="lazy" decoding="async"></button>
              <span class="character-art-note">原创图形占位 · 轻点有回应</span><span class="character-art-index" aria-hidden="true">{{ String(selectedIndex + 1).padStart(2, '0') }}</span>
            </div>
          </article>
        </div>
        <div class="character-stage-bottom"><span>{{ member.artNote }}</span><span class="character-keyboard-hint">点击缩略图切换 · 支持 ← → 方向键</span></div>
        <p id="character-status" class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{{ member.name }}，{{ member.role }}</p>
      </div>
    </div>
  </section>
</template>
