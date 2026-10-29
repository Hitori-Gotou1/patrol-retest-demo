<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import members from '../data/characters.json';
import { useCharacterTransition } from '../composables/useCharacterTransition.js';
import { liveModeActive } from '../composables/useInteractionSession.js';
import { interactionFeatures } from '../data/interactions.js';
import CharacterEasterEgg from './CharacterEasterEgg.vue';
import InstrumentPanel from './InstrumentPanel.vue';
import '../styles/character-enhancements.css';

const scene = ref(null);
const baseLayer = ref(null);
const revealLayer = ref(null);
const content = ref(null);
const reaction = ref('');
const easterEgg = ref(null);
const interactionBlocked = computed(() => busy.value || liveModeActive.value);
const { selectedIndex, requestedIndex, member, busy, selectMember, react, pointerMove, pointerLeave } = useCharacterTransition({ members, scene, baseLayer, revealLayer, content, suspended: liveModeActive });
const counter = computed(() => `${String(selectedIndex.value + 1).padStart(2, '0')} / ${String(members.length).padStart(2, '0')}`);
const themeStyle = computed(() => ({
  '--cast-primary': member.value.theme.primary,
  '--cast-deep': member.value.theme.deep,
  '--cast-ink': member.value.theme.ink,
  '--cast-paper': member.value.theme.paper
}));
const portraitStyle = computed(() => ({
  '--portrait-scale': member.value.portraitLayout.scale,
  '--portrait-x': `${member.value.portraitLayout.x}%`,
  '--portrait-y': `${member.value.portraitLayout.y}%`,
  objectPosition: member.value.portraitLayout.objectPosition
}));
const companionStyle = computed(() => ({
  '--companion-scale': member.value.companionLayout?.scale ?? 1,
  '--companion-x': `${member.value.companionLayout?.x ?? 0}%`
}));
const asset = path => `${import.meta.env.BASE_URL}${path}`;
let reactionIndex = 0;
let pointerStart = null;
let lastSwipe = 0;

function choose(index, { focus = false } = {}) {
  const normalized = (index + members.length) % members.length;
  const tab = scene.value?.querySelector(`#tab-${members[normalized].id}`);
  selectMember(normalized, { origin: tab });
  if (focus) nextTick(() => tab?.focus({ preventScroll: true }));
}
function onTabKey(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const targets = { ArrowLeft: requestedIndex.value - 1, ArrowRight: requestedIndex.value + 1, Home: 0, End: members.length - 1 };
  if (!(event.key in targets)) return;
  event.preventDefault();
  event.stopPropagation();
  choose(targets[event.key], { focus: true });
}
function onSectionKey(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input, textarea, select, [contenteditable="true"], .instrument-panel')) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  choose(requestedIndex.value + (event.key === 'ArrowRight' ? 1 : -1));
}
function startSwipe(event) {
  if (event.pointerType === 'touch') pointerStart = { x: event.clientX, y: event.clientY };
}
function finishSwipe(event) {
  if (!pointerStart) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;
  // 只识别明显的横向手势，纵向阅读保持浏览器原生滚动。
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.6) {
    lastSwipe = performance.now();
    choose(requestedIndex.value + (dx < 0 ? 1 : -1));
  }
}
function portraitReaction() {
  if (interactionBlocked.value || performance.now() - lastSwipe < 450) return;
  if (interactionFeatures.easterEggs) { easterEgg.value?.trigger(); return; }
  const lines = member.value.reactions;
  reaction.value = lines[reactionIndex++ % lines.length];
  react();
}
watch(selectedIndex, () => { reaction.value = ''; reactionIndex = 0; });
</script>

<template>
  <section id="about" ref="scene" class="about scene character-scene" data-scene-name="结束乐队" :data-member="member.id" :data-transitioning="busy" :style="themeStyle" aria-labelledby="about-title" @keydown="onSectionKey" @pointermove="pointerMove" @pointerleave="pointerLeave">
    <div ref="baseLayer" class="cast-background cast-background-base" aria-hidden="true"></div>
    <div ref="revealLayer" class="cast-background cast-background-reveal" aria-hidden="true"></div>
    <div class="cast-paper-texture" aria-hidden="true"></div>
    <div id="character-showcase" class="cast-stage" :data-member="member.id">
      <header class="cast-topline"><span><i aria-hidden="true"></i> 02 / KESSOKU BAND</span><h2 id="about-title">四种颜色，同一支乐队。</h2><span class="cast-file-label">MEMBER FILE — {{ String(selectedIndex + 1).padStart(2, '0') }}</span></header>
      <div id="character-panel" ref="content" class="cast-content" role="tabpanel" :aria-labelledby="`tab-${member.id}`" :aria-busy="busy" tabindex="0">
        <article class="character-view cast-view" :data-character="member.id">
          <div class="cast-details">
            <p class="cast-english-name cast-reveal-item" :aria-label="member.romanizedName"><span v-for="line in member.nameLines" :key="line">{{ line }}</span></p>
            <div class="cast-name-row cast-reveal-item"><h3>{{ member.name }}</h3><p lang="ja">{{ member.nameJa }}</p></div>
            <div class="cast-role-row cast-reveal-item"><span class="cast-role">{{ member.role }}</span><span class="cast-cv">CV. {{ member.cv }}</span></div>
            <ul class="cast-personality cast-reveal-item" aria-label="性格关键词"><li v-for="trait in member.personality" :key="trait">{{ trait }}</li></ul>
            <p class="cast-description cast-reveal-item">{{ member.description }}</p>
            <blockquote class="cast-quote cast-reveal-item"><span>{{ member.lineKind }}</span><p aria-live="polite">{{ reaction || member.originalLine }}</p></blockquote>
            <p class="cast-connection cast-reveal-item"><span>{{ member.connectionTitle }}</span>{{ member.connection }}</p>
            <InstrumentPanel v-if="interactionFeatures.instruments" :member="member" :disabled="interactionBlocked" />
          </div>
          <div class="cast-art" @pointerdown="startSwipe" @pointerup="finishSwipe" @pointercancel="pointerStart = null">
            <div class="cast-decorations" :data-kind="member.decoration" aria-hidden="true">
              <span class="cast-giant-lettering">{{ member.lettering }}</span><div class="cast-orbit cast-orbit-one"></div><div class="cast-orbit cast-orbit-two"></div><div class="cast-orbit cast-orbit-three"></div>
              <span class="cast-mark cast-mark-one">{{ member.decoration === 'stars' ? '✦' : member.decoration === 'sun' ? '✳' : member.decoration === 'lines' ? '＋' : '♪' }}</span><span class="cast-mark cast-mark-two">{{ member.decoration === 'stars' ? '✧' : member.decoration === 'sun' ? '＋' : member.decoration === 'lines' ? '＝' : '♩' }}</span><span class="cast-rhythm"></span>
            </div>
            <span class="cast-instrument cast-peripheral" aria-hidden="true">{{ member.instrument }}</span>
            <div class="cast-portrait-motion"><div class="cast-portrait-parallax"><div class="cast-portrait-float">
              <CharacterEasterEgg ref="easterEgg" :member="member" :blocked="interactionBlocked" @message="reaction = $event">
                <button class="cast-portrait-trigger" type="button" :aria-label="`轻点${member.name}，查看原创角色印象`" @click="portraitReaction">
                  <img :key="member.id" class="character-portrait cast-portrait-image" :src="asset(member.portrait)" :alt="member.portraitAlt" :style="portraitStyle" :width="member.portraitSize?.width" :height="member.portraitSize?.height" loading="lazy" decoding="async">
                  <!-- 共用人物的转场和反应容器，切换、漂浮及躲箱时两种形象保持同步。 -->
                  <span v-if="member.thumbnail" class="cast-companion" :style="companionStyle" aria-hidden="true">
                    <img :key="`${member.id}-chibi`" :src="asset(member.thumbnail)" :width="member.thumbnailSize?.width" :height="member.thumbnailSize?.height" alt="" loading="lazy" decoding="async">
                  </span>
                </button>
              </CharacterEasterEgg>
            </div></div></div>
            <div class="cast-art-caption cast-peripheral"><span>{{ member.artNote }}</span><small v-if="member.placeholder">原创图形占位</small><small v-else>轻点人物，听听她的心声</small></div>
          </div>
        </article>
      </div>
      <footer class="cast-selector">
        <div class="cast-selector-label"><span>CHOOSE YOUR COLOR</span><small>选一种颜色，听一种心跳。</small></div>
        <div id="character-tabs" class="cast-tabs" role="tablist" aria-label="结束乐队成员">
          <button v-for="(person, index) in members" :id="`tab-${person.id}`" :key="person.id" type="button" role="tab" :data-member="person.id" :data-pending="busy && index === requestedIndex" :style="{ '--tab-color': person.theme.primary, '--tab-ink': person.theme.ink }" aria-controls="character-panel" :aria-selected="index === selectedIndex" :tabindex="index === requestedIndex ? 0 : -1" @click="choose(index)" @keydown="onTabKey">
            <span class="cast-tab-portrait" aria-hidden="true"><img :src="asset(person.thumbnail || person.portrait)" :style="{ objectPosition: person.portraitLayout.thumbnailPosition, transform: `scale(${person.portraitLayout.thumbnailScale})`, transformOrigin: person.portraitLayout.thumbnailOrigin }" :width="(person.thumbnailSize || person.portraitSize)?.width" :height="(person.thumbnailSize || person.portraitSize)?.height" alt="" loading="lazy" decoding="async"></span><span class="cast-tab-copy"><strong>{{ person.name }}</strong><small>{{ person.shortRole }}</small></span><span class="cast-tab-indicator" aria-hidden="true">↗</span>
          </button>
        </div>
        <div class="cast-controls"><span id="character-counter">{{ counter }}</span><button id="character-prev" type="button" aria-label="上一位成员" @click="choose(requestedIndex - 1)">←</button><button id="character-next" type="button" aria-label="下一位成员" @click="choose(requestedIndex + 1)">→</button></div>
      </footer>
      <p id="character-status" class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{{ member.name }}，{{ member.role }}</p>
    </div>
  </section>
</template>
