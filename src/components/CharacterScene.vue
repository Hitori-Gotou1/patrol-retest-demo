<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import members from '../data/characters.json' with { type: 'json' };
import { useSceneMotion } from '../composables/useSceneMotion.js';
import { useCharacterTransition } from '../composables/useCharacterTransition.js';
import { liveModeActive } from '../composables/useInteractionSession.js';
import { interactionFeatures } from '../data/interactions.js';
import CharacterEasterEgg from './CharacterEasterEgg.vue';
import InstrumentPanel from './InstrumentPanel.vue';
import '../styles/character-enhancements.css';

const scene = ref(null);
useSceneMotion(scene, { entrance: false });
const art = ref(null);
const baseLayer = ref(null);
const revealLayer = ref(null);
const content = ref(null);
const reaction = ref('');
const easterEgg = ref(null);
const interactionBlocked = computed(() => busy.value || liveModeActive.value);
const { selectedIndex, requestedIndex, member, busy, selectMember, react, pointerMove, pointerLeave } = useCharacterTransition({ members, scene, art, baseLayer, revealLayer, content, suspended: liveModeActive });
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
  '--portrait-position': member.value.portraitLayout.objectPosition
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
    <div id="character-showcase" class="cast-stage" :data-member="member.id">
      <header class="cast-topline"><h2 id="about-title">结束乐队</h2><span>KESSOKU BAND</span></header>
      <div class="cast-selector">
        <div id="character-tabs" class="cast-tabs" role="tablist" aria-label="结束乐队成员">
          <button v-for="(person, index) in members" :id="`tab-${person.id}`" :key="person.id" type="button" role="tab" :data-member="person.id" :data-pending="busy && index === requestedIndex" :style="{ '--tab-color': person.theme.primary, '--tab-ink': person.theme.ink }" aria-controls="character-panel" :aria-selected="index === selectedIndex" :tabindex="index === requestedIndex ? 0 : -1" @click="choose(index)" @keydown="onTabKey">
            <span class="cast-tab-portrait" aria-hidden="true"><img :src="asset(person.thumbnail || person.portrait)" :style="{ objectPosition: person.portraitLayout.thumbnailPosition, transform: `scale(${person.portraitLayout.thumbnailScale})`, transformOrigin: person.portraitLayout.thumbnailOrigin }" :width="(person.thumbnailSize || person.portraitSize)?.width" :height="(person.thumbnailSize || person.portraitSize)?.height" alt="" loading="lazy" decoding="async"></span><span class="cast-tab-copy"><strong>{{ person.name }}</strong><small>{{ person.shortRole }}</small></span><span class="cast-tab-indicator" aria-hidden="true">↗</span>
          </button>
        </div>
        <div class="cast-controls"><span id="character-counter">{{ counter }}</span><button id="character-prev" type="button" aria-label="上一位成员" @click="choose(requestedIndex - 1)">←</button><button id="character-next" type="button" aria-label="下一位成员" @click="choose(requestedIndex + 1)">→</button></div>
      </div>
      <div id="character-panel" ref="content" class="cast-content" role="tabpanel" :aria-labelledby="`tab-${member.id}`" :aria-busy="busy" tabindex="0">
        <article class="character-view cast-view" :data-character="member.id">
          <header class="cast-identity">
            <h3>{{ member.name }}</h3><p lang="ja">{{ member.nameJa }}</p>
            <span class="cast-role">{{ member.role }}</span><span class="cast-cv">CV. {{ member.cv }}</span>
          </header>
          <div ref="art" class="cast-art" @pointerdown="startSwipe" @pointerup="finishSwipe" @pointercancel="pointerStart = null">
            <div ref="baseLayer" class="cast-background cast-background-base" aria-hidden="true"></div>
            <div ref="revealLayer" class="cast-background cast-background-reveal" aria-hidden="true"></div>
            <div class="cast-paper-texture" aria-hidden="true"></div>
            <div class="cast-decorations" :data-kind="member.decoration" aria-hidden="true">
              <svg class="cast-score" viewBox="0 0 800 560" preserveAspectRatio="xMidYMid slice">
                <g v-if="member.id === 'hitori'" fill="none" stroke="currentColor">
                  <path d="M811 28L422 248M811 38L424 252M811 48L426 256M811 58L428 260M811 68L430 264M811 78L432 268" opacity=".48" stroke-width="2"/>
                  <path d="M0 555L411 273M0 530L410 266M0 505L409 259" opacity=".23" stroke-width="2"/>
                  <path d="M805 361L616 408M805 367L616 411M805 373L617 414M805 379L618 417M805 385L618 420M805 391L619 423" opacity=".7" stroke-width="1.6"/>
                </g>
                <g v-else-if="member.id === 'nijika'" fill="none" stroke="currentColor">
                  <circle cx="413" cy="132" r="174" stroke-width="22" opacity=".19"/>
                  <circle cx="413" cy="132" r="151" stroke-width="3" opacity=".56"/>
                  <circle cx="413" cy="132" r="191" stroke-width="7" stroke-dasharray="2 24" opacity=".8"/>
                  <ellipse cx="651" cy="424" rx="146" ry="24" stroke-width="3" opacity=".4" transform="rotate(-8 651 424)"/>
                  <path d="M67 477H274" stroke-width="2" opacity=".38"/>
                </g>
                <g v-else-if="member.id === 'ryo'" fill="none" stroke="currentColor" opacity=".68">
                  <path d="M-4 269H805" stroke-width="3"/>
                  <path d="M-4 296H805" stroke-width="6"/>
                  <path d="M-4 328H805" stroke-width="9"/>
                  <path d="M-4 365H805" stroke-width="12"/>
                  <path d="M141 249V387M680 249V387" stroke-width="1.5" opacity=".6"/>
                </g>
                <g v-else>
                  <path d="M836 -50H656L102 560H490Z" fill="#fff4df" opacity=".68"/>
                  <path d="M830 -15H742L377 560H562Z" fill="#fff4df" opacity=".56"/>
                  <path d="M588 0L164 560H6L552 0Z" fill="currentColor" opacity=".19"/>
                  <path d="M794 13L519 540" fill="none" stroke="#fff4df" stroke-width="3" opacity=".72"/>
                </g>
              </svg>
              <p class="cast-english-name"><span v-for="line in member.nameLines" :key="line">{{ line }}</span></p>
            </div>
            <div class="cast-portrait-motion"><div class="cast-portrait-parallax"><div class="cast-portrait-float">
              <CharacterEasterEgg ref="easterEgg" :member="member" :blocked="interactionBlocked" @message="reaction = $event">
                <button class="cast-portrait-trigger" type="button" :aria-label="`轻点${member.name}，查看原创角色印象`" @click="portraitReaction">
                  <img class="character-portrait cast-portrait-image" :src="asset(member.portrait)" :alt="member.portraitAlt" :style="portraitStyle" :width="member.portraitSize?.width" :height="member.portraitSize?.height">
                  <!-- 共用人物的转场和反应容器，切换、漂浮及躲箱时两种形象保持同步。 -->
                  <span v-if="member.thumbnail" class="cast-companion" :style="companionStyle" aria-hidden="true">
                    <img :key="`${member.id}-chibi`" :src="asset(member.thumbnail)" :width="member.thumbnailSize?.width" :height="member.thumbnailSize?.height" alt="" loading="lazy" decoding="async">
                  </span>
                </button>
              </CharacterEasterEgg>
            </div></div></div>
            <div class="cast-art-caption cast-peripheral"><span>{{ member.artNote }}</span><small v-if="member.placeholder">原创图形占位</small><small v-else>轻点人物，听听她的心声</small></div>
          </div>
          <div class="cast-details">
            <p class="cast-description cast-reveal-item">{{ member.description }}</p>
            <ul class="cast-personality cast-reveal-item" aria-label="性格关键词"><li v-for="trait in member.personality" :key="trait">{{ trait }}</li></ul>
            <blockquote class="cast-quote cast-reveal-item"><span>{{ member.lineKind }}</span><p aria-live="polite">{{ reaction || member.originalLine }}</p></blockquote>
            <p class="cast-connection cast-reveal-item"><span>{{ member.connectionTitle }}</span>{{ member.connection }}</p>
            <InstrumentPanel v-if="interactionFeatures.instruments" :member="member" :disabled="interactionBlocked" />
          </div>
        </article>
      </div>
      <p id="character-status" class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{{ member.name }}，{{ member.role }}</p>
    </div>
  </section>
</template>
