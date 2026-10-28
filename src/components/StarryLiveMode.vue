<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { gsap } from 'gsap';
import members from '../data/characters.json';
import { useInteractionAudio } from '../composables/useInteractionAudio.js';
import InteractionSoundControl from './InteractionSoundControl.vue';

const props = defineProps({ returnFocus: { default: null } });
const emit = defineEmits(['close']);
const dialog = ref(null);
const phase = ref('intro');
const lighting = ref('warm');
const selected = ref('hitori');
const reduced = ref(false);
const compactEffects = ref(false);
const announcement = ref('灯光准备中，欢迎来到 STARRY。');
const selectedMember = computed(() => members.find(member => member.id === selected.value));
const lightModes = [
  { id: 'warm', label: 'Warm Up', note: '暖场' },
  { id: 'colors', label: 'Kessoku Colors', note: '四色合奏' },
  { id: 'spotlight', label: 'Spotlight', note: '成员聚光' }
];
const { play, stop } = useInteractionAudio('starry-live');
let intro, beatTween, entranceFocus, previousOverflow, motionPreference;
let disposed = false, closing = false, lastBeat = -Infinity;
const all = selector => [...(dialog.value?.querySelectorAll(selector) || [])];
const asset = path => `${import.meta.env.BASE_URL}${path}`;

function settleStage() {
  intro?.kill(); intro = null;
  if (!dialog.value || disposed) return;
  const wasOpening = phase.value === 'intro';
  const restoreFocus = document.activeElement?.id === 'starry-skip';
  // 只清理时间轴拥有的属性，保留成员和灯光节点上的主题 CSS 变量。
  gsap.set(all('.starry-member, .starry-sign, .starry-ready-line, .starry-beam'), { clearProps: 'transform,opacity,visibility' });
  gsap.set(all('.starry-curtain, .starry-prelude'), { clearProps: 'opacity,visibility' });
  phase.value = 'ready';
  if (wasOpening) lighting.value = 'colors';
  announcement.value = '四个人的声音，在这里相遇。点击成员，或轻敲一下节拍。';
  if (restoreFocus) nextTick(() => dialog.value?.querySelector('#starry-replay')?.focus({ preventScroll: true }));
}

function runEntrance() {
  intro?.kill(); beatTween?.kill(); stop();
  gsap.set(all('.starry-beat-ring'), { opacity: 0 });
  phase.value = 'intro';
  lighting.value = 'warm';
  announcement.value = '灯光准备中，欢迎来到 STARRY。';
  if (reduced.value || document.hidden) { settleStage(); return; }
  // 单一时间轴拥有舞台入场；角色页的转场、浮动和视差不操作这些节点。
  const people = all('.starry-member');
  const beams = all('.starry-beam');
  gsap.set(people, { autoAlpha: 0, y: 28, scale: .98 });
  gsap.set(beams, { opacity: 0, scaleY: .65 });
  gsap.set(all('.starry-sign, .starry-ready-line'), { opacity: 0, y: 8 });
  gsap.set(all('.starry-curtain, .starry-prelude'), { opacity: 1 });
  intro = gsap.timeline({ onComplete: settleStage });
  intro.to(all('.starry-curtain'), { opacity: 0, duration: .8, ease: 'power2.out' }, .25)
    .to(all('.starry-prelude'), { opacity: 0, duration: .35 }, .8)
    .to(all('.starry-sign'), { opacity: 1, y: 0, duration: .65 }, 1)
    .to(beams, { opacity: .6, scaleY: 1, duration: .7, stagger: .4, ease: 'sine.out' }, 1.15)
    .to(people, { autoAlpha: 1, y: 0, scale: 1, duration: .7, stagger: .4, ease: 'power3.out' }, 1.4)
    .to(all('.starry-ready-line'), { opacity: 1, y: 0, duration: .4 }, 3.25);
  nextTick(() => {
    if (!disposed && phase.value === 'intro') dialog.value?.querySelector('#starry-skip')?.focus({ preventScroll: true });
  });
}

function skipEntrance() {
  settleStage();
  nextTick(() => dialog.value?.querySelector('#starry-replay')?.focus({ preventScroll: true }));
}
function selectMember(id) {
  if (phase.value !== 'ready') return;
  selected.value = id;
  lighting.value = 'spotlight';
  announcement.value = `${selectedMember.value.name}，${selectedMember.value.shortRole}。这一束光，属于你。`;
}
function setLighting(mode) {
  if (phase.value !== 'ready') return;
  lighting.value = mode;
}
function beat() {
  if (phase.value !== 'ready' || document.hidden) return;
  const now = performance.now();
  if (now - lastBeat < 180) return;
  lastBeat = now;
  play('kick');
  beatTween?.kill();
  const pulse = all('.starry-beat-ring');
  if (!reduced.value) {
    beatTween = gsap.fromTo(pulse, { opacity: .38, scale: .8 }, { opacity: 0, scale: 1.18, duration: .55, ease: 'power2.out' });
  }
  announcement.value = '咚。你的节拍，也加入了这场演出。';
}
function close() {
  if (closing) return;
  closing = true;
  intro?.kill(); beatTween?.kill(); stop();
  dialog.value?.close();
  emit('close');
}
function onDialogKey(event) {
  if (event.key !== 'Tab') return;
  // 原生 dialog 隔离背景；补齐首尾焦点循环，避免 Tab 到浏览器工具栏后失去操作位置。
  const controls = all('button:not([disabled]), a[href], input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')
    .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
  const first = controls[0], last = controls.at(-1);
  if (!first) return;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
function onVisibility() {
  if (document.hidden) {
    stop(); beatTween?.kill();
    gsap.set(all('.starry-beat-ring'), { opacity: 0 });
    // 后台不追赶过期时间轴，恢复页面时直接显示完整舞台。
    settleStage();
  }
}
function onMotionChange() {
  reduced.value = motionPreference.matches;
  if (reduced.value) { beatTween?.kill(); gsap.set(all('.starry-beat-ring'), { opacity: 0 }); settleStage(); }
}
onMounted(() => {
  entranceFocus = props.returnFocus || document.activeElement;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  reduced.value = motionPreference.matches;
  compactEffects.value = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  motionPreference.addEventListener('change', onMotionChange);
  document.addEventListener('visibilitychange', onVisibility);
  dialog.value.showModal();
  runEntrance();
  nextTick(() => dialog.value?.querySelector(reduced.value ? '#starry-exit' : '#starry-skip')?.focus({ preventScroll: true }));
});
onBeforeUnmount(() => {
  disposed = true;
  intro?.kill(); beatTween?.kill(); stop();
  motionPreference?.removeEventListener('change', onMotionChange);
  document.removeEventListener('visibilitychange', onVisibility);
  dialog.value?.close();
  document.body.style.overflow = previousOverflow || '';
  if (entranceFocus?.isConnected) entranceFocus.focus({ preventScroll: true });
});
</script>

<template>
  <Teleport to="body">
    <dialog id="starry-live-dialog" ref="dialog" class="starry-live" :data-phase="phase" :data-lighting="lighting" :data-selected-member="selected" :data-lite="compactEffects" :style="{ '--spot-color': selectedMember.theme.primary }" aria-labelledby="starry-title" aria-describedby="starry-instruction" @keydown.capture="onDialogKey" @cancel.prevent="close" @close="close">
      <header class="starry-topbar">
        <span class="starry-venue"><i aria-hidden="true"></i> SHIMOKITAZAWA <b>LIVE HOUSE</b></span>
        <div class="starry-top-actions"><InteractionSoundControl compact /><button id="starry-exit" type="button" @click="close">离开舞台 <span aria-hidden="true">↗</span></button></div>
      </header>
      <div class="starry-house">
        <div class="starry-stage" :aria-busy="phase === 'intro'">
          <div class="starry-truss" aria-hidden="true"><i v-for="n in 9" :key="n"></i></div>
          <div class="starry-lights" aria-hidden="true"><div v-for="member in members" :key="member.id" class="starry-beam" :data-beam="member.id" :style="{ '--member-color': member.theme.primary }"></div></div>
          <div class="starry-sign"><span>TONIGHT, WE ARE</span><h2 id="starry-title">STARRY<span aria-hidden="true">✦</span></h2><p>結束バンド <i></i> KESSOKU BAND</p></div>
          <div class="starry-haze" aria-hidden="true"></div>
          <div class="starry-speaker starry-speaker-left" aria-hidden="true"><i></i><i></i><b>ST.</b></div><div class="starry-speaker starry-speaker-right" aria-hidden="true"><i></i><i></i><b>ST.</b></div>
          <div class="starry-band">
            <button v-for="member in members" :key="member.id" type="button" class="starry-member" :data-stage-member="member.id" :aria-label="`为${member.name}点亮聚光灯`" :aria-pressed="selected === member.id && lighting === 'spotlight'" :disabled="phase === 'intro'" :style="{ '--member-color': member.theme.primary }" @click="selectMember(member.id)">
              <span class="starry-member-art"><img :src="asset(member.portrait)" :alt="member.portraitAlt" :width="member.portraitSize.width" :height="member.portraitSize.height" :style="{ '--stage-scale': member.portraitLayout.scale, '--stage-x': `${member.portraitLayout.x}%`, '--stage-y': `${member.portraitLayout.y}%` }" decoding="async"></span>
              <span class="starry-member-name"><b>{{ member.name }}</b><small>{{ member.instrument }}</small></span>
            </button>
          </div>
          <div class="starry-floor" aria-hidden="true"><span></span></div><div class="starry-beat-ring" aria-hidden="true"></div>
          <div class="starry-dust" aria-hidden="true"><i v-for="n in 8" :key="n" :style="{ '--n': n }"></i></div>
          <div class="starry-curtain" aria-hidden="true"></div>
          <div class="starry-prelude" aria-hidden="true"><span>— SOUND CHECK —</span><strong>下一束光，<br>为我们亮起。</strong><small>THE STAGE IS YOURS.</small></div>
        </div>
        <div class="starry-ready-line"><span>LIVE SESSION / 001</span><p id="starry-instruction">点亮一位成员，给今晚加一点自己的节奏。</p><span>FOUR COLORS, ONE BAND.</span></div>
      </div>
      <footer class="starry-console">
        <div class="starry-light-controls" role="group" aria-label="舞台灯光"><span class="starry-control-label">LIGHTING <small>舞台灯光</small></span><button v-for="mode in lightModes" :key="mode.id" type="button" :data-light-mode="mode.id" :aria-pressed="lighting === mode.id" :disabled="phase === 'intro'" @click="setLighting(mode.id)"><b>{{ mode.label }}</b><small>{{ mode.note }}</small></button></div>
        <div class="starry-performance-controls"><button id="starry-beat" type="button" :disabled="phase === 'intro'" @click="beat"><span aria-hidden="true">◉</span> 敲一下节拍</button><button v-if="phase === 'intro'" id="starry-skip" type="button" @click="skipEntrance">跳过入场 →</button><button v-else id="starry-replay" type="button" @click="runEntrance">重播开场 ↺</button></div>
        <p class="starry-status" role="status" aria-live="polite">{{ announcement }}</p>
      </footer>
    </dialog>
  </Teleport>
</template>

<style scoped>
.starry-live { --stage-paper:#fff8ec; color-scheme:dark; position:fixed; inset:0; width:100%; height:100dvh; max-width:none; max-height:none; margin:0; padding:0; border:0; color:var(--stage-paper); background:#100e13; overflow:auto; overscroll-behavior:contain; }
.starry-live[open] { display:flex; flex-direction:column; }
.starry-live::backdrop { background:#100e13; }
.starry-live button { font:inherit; border-radius:0; }
.starry-live button:focus-visible { outline:2px solid #fff8ec; outline-offset:4px; }
.starry-live button:disabled { cursor:default; }
.starry-topbar { flex-shrink:0; display:flex; justify-content:space-between; align-items:center; gap:16px; padding:16px 32px; border-bottom:1px solid #fff8ec20; position:sticky; top:0; background:#100e13f5; z-index:10; }
.starry-venue { font:10px/1.5 var(--mono); letter-spacing:2px; display:flex; align-items:center; gap:10px; }
.starry-venue i { width:6px; height:6px; background:#f6c945; border-radius:50%; }
.starry-venue b { font-weight:400; color:#998f9d; }
.starry-top-actions { display:flex; align-items:center; gap:22px; }
#starry-exit { border:1px solid #fff8ec60; padding:10px 15px; background:transparent; color:#fff8ec; min-height:44px; font-size:12px; white-space:nowrap; }
#starry-exit span { padding-left:16px; }
#starry-exit:hover { background:#fff8ec; color:#100e13; }
.starry-house { flex:1; display:flex; flex-direction:column; min-height:370px; }
.starry-stage { position:relative; flex:1; min-height:370px; isolation:isolate; overflow:hidden; background:radial-gradient(ellipse at 50% 10%,#36252e55,transparent 60%),repeating-linear-gradient(90deg,#fff8ec03 0 1px,transparent 1px 80px),#100e13; }
.starry-truss { position:absolute; top:0; left:0; right:0; height:20px; display:flex; justify-content:space-evenly; border-bottom:2px solid #52424d; background:repeating-linear-gradient(45deg,transparent 0 30px,#52424d 30px 32px,transparent 32px 62px); }
.starry-truss i { position:relative; top:9px; width:18px; height:13px; border-radius:2px 2px 50% 50%; background:#261f2a; border-bottom:3px solid #b4a77f; }
.starry-lights { position:absolute; inset:0 14%; display:flex; justify-content:center; pointer-events:none; }
.starry-beam { position:relative; width:24%; height:110%; transform-origin:50% 0; opacity:.6; clip-path:polygon(43% 0,57% 0,100% 100%,0 100%); transition:opacity .65s; }
/* 两层灯光交叉淡化，避免直接切换无法插值的渐变背景。 */
.starry-beam::before,.starry-beam::after { content:''; position:absolute; inset:0; transition:opacity .65s; }
.starry-beam::before { opacity:1; background:linear-gradient(#efc27545,#efc2750c 90%,transparent); }
.starry-beam::after { opacity:0; background:linear-gradient(color-mix(in srgb,var(--member-color) 46%,transparent),transparent 95%); }
[data-lighting='colors'] .starry-beam { opacity:.72; }
[data-lighting='colors'] .starry-beam::before,[data-lighting='spotlight'] .starry-beam::before,[data-phase='intro'] .starry-beam::before { opacity:0; }
[data-lighting='colors'] .starry-beam::after,[data-lighting='spotlight'] .starry-beam::after,[data-phase='intro'] .starry-beam::after { opacity:1; }
[data-phase='intro'] .starry-beam,[data-phase='intro'] .starry-beam::before,[data-phase='intro'] .starry-beam::after { transition:none; }
[data-phase='intro'] .starry-member { transition:none; }
[data-lighting='spotlight'] .starry-beam { opacity:.08; }
[data-selected-member='hitori'][data-lighting='spotlight'] [data-beam='hitori'],[data-selected-member='nijika'][data-lighting='spotlight'] [data-beam='nijika'],[data-selected-member='ryo'][data-lighting='spotlight'] [data-beam='ryo'],[data-selected-member='kita'][data-lighting='spotlight'] [data-beam='kita'] { opacity:1; }
.starry-sign { position:absolute; top:24px; left:50%; transform:translateX(-50%); width:80%; text-align:center; z-index:1; }
.starry-sign > span { font:9px var(--mono); letter-spacing:5px; color:#c7b8bd; }
.starry-sign h2 { margin:5px 0 0; font:900 clamp(50px,7.5vw,108px)/.9 Arial,sans-serif; letter-spacing:-.07em; color:#fff8ec; text-shadow:3px 3px 0 #e9667055; }
.starry-sign h2 > span { display:inline-block; color:#f6c945; font-size:.55em; vertical-align:top; margin:0 0 0 9px; }
.starry-sign p { margin:12px 0 0; display:flex; justify-content:center; gap:13px; align-items:center; font:9px var(--mono); letter-spacing:2px; color:#cbbec8; }
.starry-sign p i { width:25px; height:1px; background:currentColor; }
.starry-band { position:absolute; inset:150px 14% 24px; z-index:3; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); align-items:stretch; gap:8px; }
.starry-member { position:relative; min-width:0; padding:0; border:0; background:transparent; color:#fff8ec; display:flex; flex-direction:column; align-items:stretch; transition:opacity .4s; }
.starry-member-art { position:relative; display:block; flex:1; min-height:0; }
.starry-member img { position:absolute; left:50%; bottom:0; width:auto; max-width:none; height:100%; object-fit:contain; transform:translate(calc(-50% + var(--stage-x)),var(--stage-y)) scale(var(--stage-scale)); transform-origin:50% 100%; filter:drop-shadow(0 8px 10px #0009); }
.starry-member-name { position:relative; margin-top:9px; border-top:1px solid color-mix(in srgb,var(--member-color) 50%,transparent); padding-top:8px; display:flex; align-items:center; justify-content:center; gap:10px; }
.starry-member-name b { font-size:12px; font-weight:500; }
.starry-member-name small { color:var(--member-color); font:10px var(--mono); }
[data-lighting='spotlight'] .starry-member { opacity:.42; }
[data-lighting='spotlight'] .starry-member[aria-pressed='true'] { opacity:1; }
.starry-member:hover { opacity:1; }
.starry-floor { position:absolute; left:0; right:0; height:28%; bottom:0; border-top:1px solid #fff8ec1c; background:linear-gradient(#2b242a65,#171319),repeating-linear-gradient(90deg,transparent 0 15%,#fff8ec09 15% 15.1%); transform:perspective(600px) rotateX(28deg) scaleX(1.2); transform-origin:50% 100%; }
.starry-floor span { position:absolute; inset:0; opacity:.2; background:radial-gradient(ellipse at 20% 40%,#f48fb1,transparent 25%),radial-gradient(ellipse at 40% 40%,#f6c945,transparent 25%),radial-gradient(ellipse at 60% 40%,#76b9e8,transparent 25%),radial-gradient(ellipse at 80% 40%,#e96670,transparent 25%); }
.starry-haze { position:absolute; inset:50% -15% -20%; background:radial-gradient(ellipse at 45% 50%,#bd9eb218,transparent 65%); pointer-events:none; }
.starry-speaker { position:absolute; bottom:40px; width:8%; max-width:90px; height:46%; max-height:240px; background:repeating-linear-gradient(0deg,#fff8ec06 0 1px,transparent 1px 4px),#17141a; border:2px solid #3b313d; box-shadow:8px 10px 0 #09080a; display:flex; flex-direction:column; align-items:center; justify-content:space-evenly; }
.starry-speaker-left { left:3%; transform:rotate(2deg); }
.starry-speaker-right { right:3%; transform:rotate(-2deg); }
.starry-speaker i { width:70%; aspect-ratio:1; border:1px solid #655264; border-radius:50%; background:radial-gradient(circle,#342837 0 17%,#141117 18% 50%,#332a3540 51% 60%,transparent 61%); }
.starry-speaker b { font:8px var(--mono); color:#796779; }
.starry-curtain { position:absolute; inset:0; background:#100e13; z-index:5; pointer-events:none; }
.starry-prelude { position:absolute; inset:0; z-index:6; display:flex; justify-content:center; align-items:center; flex-direction:column; gap:24px; pointer-events:none; text-align:center; }
.starry-prelude > span,.starry-prelude small { font:10px var(--mono); letter-spacing:3px; color:#cbbec8; }
.starry-prelude strong { font-size:clamp(26px,4vw,54px); line-height:1.6; letter-spacing:4px; font-weight:500; }
[data-phase='ready'] .starry-curtain,[data-phase='ready'] .starry-prelude { opacity:0; visibility:hidden; }
.starry-beat-ring { position:absolute; inset:10% 10% 8%; border:3px solid var(--spot-color); border-radius:50%; opacity:0; pointer-events:none; z-index:2; }
.starry-dust { position:absolute; inset:20% 15% 10%; pointer-events:none; }
.starry-dust i { position:absolute; width:2px; height:2px; background:#fff8ec55; left:calc(var(--n) * 11%); top:calc(mod(var(--n) * 17, 70) * 1%); border-radius:50%; }
[data-lite='true'] .starry-dust { display:none; }
.starry-ready-line { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:14px 32px; border-block:1px solid #fff8ec20; background:#151117; }
.starry-ready-line span { font:8px var(--mono); letter-spacing:1.5px; color:#9f8c9e; }
.starry-ready-line p { margin:0; font-size:11px; letter-spacing:1px; color:#d9cbd6; }
.starry-console { flex-shrink:0; padding:19px 32px 13px; background:#1a151e; display:grid; grid-template-columns:1fr auto; gap:14px 24px; }
.starry-light-controls { display:flex; gap:7px; align-items:center; }
.starry-control-label { font:9px var(--mono); letter-spacing:1.5px; color:#ad9aaa; margin-right:16px; }
.starry-control-label small { display:block; margin-top:5px; font:9px var(--font); letter-spacing:1px; }
.starry-light-controls button { border:1px solid #fff8ec25; background:transparent; color:#b8a9b7; padding:9px 15px; min-height:48px; text-align:left; }
.starry-light-controls button b { font:11px var(--mono); display:block; }
.starry-light-controls button small { display:block; margin-top:3px; font-size:9px; }
.starry-light-controls button[aria-pressed='true'] { border-color:#f6c945; background:#f6c9450a; color:#f6c945; }
.starry-performance-controls { display:flex; gap:12px; align-items:center; }
#starry-beat { padding:12px 16px; background:#f6c945; border:0; color:#251c12; font-size:12px; min-height:48px; }
#starry-beat > span { padding-right:7px; font-size:17px; vertical-align:middle; }
#starry-beat:active { transform:scale(.97); }
#starry-skip,#starry-replay { background:transparent; border:0; border-bottom:1px solid #fff8ec45; font-size:11px; min-height:44px; padding:10px 0; color:#e1d3de; white-space:nowrap; }
.starry-light-controls button:disabled,#starry-beat:disabled { opacity:.4; }
.starry-status { grid-column:1/-1; color:#b9a8b6; font-size:10px; margin:0; line-height:1.5; min-height:15px; }
@media (min-width:1400px) { .starry-band,.starry-lights { inset-inline:21%; } }
@media (max-width:900px) { .starry-console { gap:14px; padding-inline:22px; } .starry-control-label { display:none; } .starry-ready-line span:last-child { display:none; } .starry-band,.starry-lights { inset-inline:11%; } .starry-topbar { padding-inline:22px; } .starry-venue b { display:none; } .starry-light-controls button { padding-inline:10px; } }
@media (max-width:600px) {
  .starry-topbar { padding:10px 16px; gap:10px; }
  .starry-venue { font-size:8px; letter-spacing:1px; gap:6px; }
  .starry-top-actions { gap:8px; }
  #starry-exit { font-size:10px; padding:8px 9px; }
  #starry-exit span { padding-left:5px; }
  .starry-house { min-height:350px; }
  .starry-stage { min-height:300px; }
  .starry-sign { top:30px; }
  .starry-sign h2 { font-size:58px; }
  .starry-sign > span { font-size:7px; letter-spacing:3px; }
  .starry-sign p { font-size:7px; letter-spacing:1px; }
  .starry-band { inset:135px 12px 18px; gap:5px; }
  .starry-lights { inset-inline:12px; }
  .starry-member-name { flex-direction:column; gap:3px; padding-top:8px; }
  .starry-member-name b { font-size:10px; white-space:nowrap; }
  .starry-member-name small { font-size:8px; }
  .starry-member img { max-height:55vw; filter:drop-shadow(0 5px 3px #0008); }
  .starry-speaker { display:none; }
  .starry-ready-line { padding:11px 16px; text-align:center; justify-content:center; }
  .starry-ready-line span { display:none; }
  .starry-ready-line p { font-size:10px; line-height:1.6; letter-spacing:.3px; }
  .starry-console { padding:14px 16px 12px; grid-template-columns:1fr; gap:13px; }
  .starry-light-controls { display:grid; grid-template-columns:1fr 1.2fr 1fr; gap:6px; }
  .starry-light-controls button { padding:9px 7px; text-align:center; }
  .starry-light-controls button b { font-size:9px; white-space:nowrap; }
  .starry-light-controls button small { font-size:8px; }
  .starry-performance-controls { justify-content:space-between; }
  #starry-beat { flex:1; margin-right:15px; }
  .starry-status { font-size:9px; line-height:1.6; min-height:28px; }
  .starry-dust i:nth-child(even) { display:none; }
}
@media (max-width:370px) { .starry-venue { font-size:0; gap:0; letter-spacing:0; } .starry-venue i { margin-right:5px; } .starry-venue::after { content:'STARRY'; font:9px var(--mono); letter-spacing:1px; } }
@media (max-height:650px) and (min-width:601px) { .starry-house,.starry-stage { min-height:280px; } .starry-sign { top:20px; } .starry-sign h2 { font-size:56px; } .starry-band { top:110px; bottom:15px; } .starry-console { padding-block:10px; gap:8px; } .starry-ready-line { padding-block:9px; } }
@media (prefers-reduced-motion:reduce) { .starry-beam,.starry-beam::before,.starry-beam::after,.starry-member { transition:none; } #starry-beat:active { transform:none; } }
</style>
