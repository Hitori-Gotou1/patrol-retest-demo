<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { gsap } from 'gsap';
import { instrumentProfiles } from '../data/instruments.js';
import { useInteractionAudio } from '../composables/useInteractionAudio.js';

const props = defineProps({ member: { type: Object, required: true }, disabled: Boolean });
const profile = computed(() => instrumentProfiles[props.member.id]);
const pads = computed(() => profile.value.pads || profile.value.notes.map((frequency, index) => ({ id: String(index), name: profile.value.names[index], frequency })));
const open = ref(false), panel = ref(null), status = ref(''), active = ref('');
const panelId = `instrument-${useId()}`;
const { enabled, play, stop } = useInteractionAudio('character-instrument');
let animation, timer, observer, media, lastPress = -Infinity, pointer = null, suppressUntil = 0;
function clearVisual() {
  // 保留每根弦的 CSS 粗细变量，只清除 GSAP 自己写入的属性。
  if (panel.value) gsap.set(panel.value.querySelectorAll('.instrument-vibration, .instrument-wave, .instrument-mic'), { clearProps: 'transform,opacity,visibility' });
}

function clear() {
  stop(); animation?.kill(); animation = null; clearTimeout(timer); active.value = ''; status.value = '';
  clearVisual();
}
function reset() { clear(); open.value = false; pointer = null; }
function toggle() { if (props.disabled) return; if (open.value) reset(); else open.value = true; }
function pointerDown(event) { pointer = { x: event.clientX, y: event.clientY }; }
function pointerUp(event) {
  if (pointer && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 16) suppressUntil = performance.now() + 350;
  pointer = null;
}
function strike(pad, event) {
  if (props.disabled || !open.value || document.hidden || (event?.detail && performance.now() < suppressUntil)) return;
  const time = performance.now();
  if (time - lastPress < 60) return;
  lastPress = time;
  animation?.kill(); clearTimeout(timer);
  clearVisual();
  active.value = pad.id;
  status.value = `${pad.name} · ${enabled.value ? '让这一声加入合奏。' : '静音练习中，可在导航开启音效。'}`;
  play(profile.value.type === 'drums' ? pad.id : profile.value.type, pad.frequency);
  const button = panel.value?.querySelector(`[data-pad="${pad.id}"]`);
  if (button && !media?.matches) {
    animation = gsap.timeline();
    if (profile.value.type === 'drums') animation.fromTo(button.querySelector('.instrument-vibration'), { scale: .9 }, { scale: 1, duration: .3, ease: 'back.out(2)' });
    else animation.fromTo(button.querySelector('.instrument-vibration'), { x: -3 }, { x: 3, duration: .035, repeat: 7, yoyo: true }).to(button.querySelector('.instrument-vibration'), { x: 0, duration: .08 });
    animation.fromTo(button.querySelector('.instrument-wave'), { scale: .55, opacity: .7 }, { scale: 1.5, opacity: 0, duration: .5 }, 0);
    const mic = panel.value.querySelector('.instrument-mic');
    if (mic) animation.fromTo(mic, { rotation: -8 }, { rotation: 0, duration: .4, ease: 'back.out(1.5)' }, 0);
  }
  timer = setTimeout(() => { animation?.kill(); animation = null; clearVisual(); active.value = ''; }, 650);
}
function onKey(event) {
  if (!open.value || props.disabled || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input, textarea, select')) return;
  if (profile.value.type !== 'drums') return;
  const pad = pads.value.find(item => item.key?.toLowerCase() === event.key.toLowerCase());
  if (!pad) return;
  event.preventDefault(); strike(pad);
}
function hidden() { if (document.hidden) clear(); }
watch(() => [props.member.id, props.disabled], reset, { flush: 'sync' });
onMounted(() => {
  media = matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', clear);
  document.addEventListener('visibilitychange', hidden);
  observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) clear(); });
  observer.observe(panel.value);
});
onBeforeUnmount(() => { clear(); observer?.disconnect(); media?.removeEventListener('change', clear); document.removeEventListener('visibilitychange', hidden); });
</script>

<template>
  <div ref="panel" class="instrument-panel" :data-instrument="profile.type" @keydown.stop="onKey" @pointerdown.stop="pointerDown" @pointerup.stop="pointerUp" @pointercancel.stop="pointer = null">
    <button class="instrument-toggle" type="button" :aria-expanded="open" :aria-controls="panelId" :disabled="disabled" @click="toggle"><svg viewBox="0 0 28 28" aria-hidden="true"><template v-if="profile.type === 'drums'"><ellipse cx="14" cy="10" rx="10" ry="4"/><path d="M4 10v10c0 5 20 5 20 0V10M8 13v9m6-8v10m6-11v9M2 2l15 6M26 2l-15 6"/></template><path v-else d="m16 11 7-7m-5 5 3 3M13 9c-1-4-6-3-6 1 0 2-4 2-4 6 0 5 7 9 11 5 4-4 0-5 3-8 2-3-1-5-4-4ZM8 14l5 5M21 3l4 4"/></svg><span>{{ profile.label }} · 练习一下</span><span class="instrument-toggle-sign" aria-hidden="true">{{ open ? '−' : '＋' }}</span></button>
    <div v-if="open" :id="panelId" class="instrument-console">
      <div class="instrument-caption"><span>{{ profile.caption }}</span><svg v-if="profile.microphone" class="instrument-mic" viewBox="0 0 24 30" aria-hidden="true"><rect x="8" y="2" width="8" height="15" rx="4"/><path d="M5 12v2a7 7 0 0 0 14 0v-2M12 21v7M7 28h10"/></svg><small v-else>SOUND CHECK</small></div>
      <div class="instrument-pads" :class="profile.type === 'drums' ? 'drum-pads' : 'string-pads'" role="group" :aria-label="`${member.name}的${profile.label}练习`">
        <button v-for="(pad, index) in pads" :key="pad.id" class="instrument-pad" :data-pad="pad.id" :data-active="active === pad.id" type="button" :aria-label="profile.type === 'drums' ? `${pad.name}，快捷键 ${pad.key}` : `弹奏第 ${index + 1} 根弦 ${pad.name}`" @click="strike(pad, $event)"><span class="instrument-vibration" :style="{ '--string-size': `${Math.max(1, 3 - index * .4)}px` }"><i v-if="profile.type === 'drums'"></i></span><i class="instrument-wave" aria-hidden="true"></i><span class="instrument-pad-name">{{ pad.name }}<kbd v-if="pad.key">{{ pad.key }}</kbd></span></button>
      </div>
      <p class="instrument-note">{{ profile.type === 'drums' ? '轻点鼓面；面板内可按 A / S / D。' : '轻点琴弦，也可以用 Tab 和空格弹奏。' }}</p>
      <p class="instrument-status" role="status" aria-live="polite">{{ status || (enabled ? '音效已开，轻轻试一下。' : '静音练习 · 开启导航音效后才发声。') }}</p>
    </div>
  </div>
</template>

<style scoped>
.instrument-panel{max-width:385px;margin-top:14px;color:var(--cast-ink);position:relative}
.instrument-toggle{display:flex;align-items:center;gap:9px;min-height:44px;padding:7px 0;width:100%;background:none;border:0;border-top:1px solid color-mix(in srgb,var(--cast-ink) 25%,transparent);color:inherit;text-align:left;font-size:11px;letter-spacing:.4px}
.instrument-toggle svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}.instrument-toggle-sign{margin-left:auto;font-size:19px}.instrument-toggle:disabled{opacity:.45;cursor:default}
.instrument-console{padding:12px 14px 10px;background:color-mix(in srgb,var(--cast-paper) 36%,transparent);border:1px solid color-mix(in srgb,var(--cast-ink) 25%,transparent);border-left:3px solid var(--cast-deep)}
.instrument-caption{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px;min-height:24px}.instrument-caption small{font:7px var(--mono);letter-spacing:1px}.instrument-mic{height:25px;width:20px;fill:none;stroke:currentColor;stroke-width:1.4;transform-origin:50% 90%}
.instrument-pads{display:grid;margin-top:9px;gap:4px}.string-pads{grid-template-columns:repeat(6,minmax(0,1fr));background:repeating-linear-gradient(0deg,transparent 0 25px,#32172312 25px 26px)}[data-instrument=bass] .string-pads{grid-template-columns:repeat(4,minmax(0,1fr))}
.instrument-pad{position:relative;min-width:0;height:105px;color:inherit;background:transparent;border:0;padding:0;touch-action:manipulation;overflow:hidden}.instrument-pad:hover,.instrument-pad[data-active=true]{background:color-mix(in srgb,var(--cast-paper) 45%,transparent)}.instrument-vibration{position:absolute;inset:5px 0 24px;pointer-events:none}.string-pads .instrument-vibration:before{content:'';position:absolute;left:50%;top:0;bottom:0;width:var(--string-size);background:var(--cast-deep);box-shadow:1px 0 0 var(--cast-paper)}
.instrument-pad-name{position:absolute;bottom:0;left:0;right:0;min-height:24px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:10px;font-family:var(--mono)}.instrument-wave{position:absolute;width:40px;height:40px;left:calc(50% - 20px);top:25px;border:1px solid var(--cast-deep);border-radius:50%;opacity:0;pointer-events:none}
.drum-pads{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.drum-pads .instrument-vibration{inset:3px 5px 26px;border:2px solid var(--cast-deep);border-radius:50%;box-shadow:inset 0 0 0 4px color-mix(in srgb,var(--cast-paper) 50%,transparent);background:color-mix(in srgb,var(--cast-primary) 50%,var(--cast-paper))}.drum-pads [data-pad=hat] .instrument-vibration{border-radius:50%;transform:scaleY(.55)}.drum-pads .instrument-vibration i{position:absolute;inset:30%;border:1px solid var(--cast-deep);border-radius:50%;opacity:.6}.instrument-pad kbd{font:8px var(--mono);border-bottom:1px solid;padding:0 2px;opacity:.6}
.instrument-note{font-size:9px;line-height:1.7;margin:8px 0 3px;opacity:.75}.instrument-status{font-size:9px;line-height:1.7;margin:0;min-height:16px}.instrument-panel button:focus-visible{outline:2px solid var(--cast-ink);outline-offset:2px}
@media(max-width:760px){.instrument-panel{max-width:none}.instrument-console{padding-inline:10px}.instrument-caption small{font-size:6px}.instrument-pad{height:110px}}
</style>
