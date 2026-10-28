<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { gsap } from 'gsap';
import { characterReactions, easterEggSettings as settings } from '../data/interactions.js';
import { createInteractionCounter } from '../composables/interactionCounter.js';

const props = defineProps({ member: { type: Object, required: true }, blocked: Boolean });
const emit = defineEmits(['message']);
const root = ref(null), portrait = ref(null), box = ref(null), effects = ref(null);
const state = ref('idle'), line = ref('');
const counter = createInteractionCounter(settings);
let animation, timer, media, observer, disposed = false, lastLine = -1;
const asset = path => `${import.meta.env.BASE_URL}${path}`;

function clearAnimation() {
  animation?.kill(); animation = null;
  clearTimeout(timer); timer = null;
  if (portrait.value) gsap.set(portrait.value, { clearProps: 'transform,opacity,visibility,clipPath' });
  if (box.value) gsap.set(box.value, { clearProps: 'transform,opacity,visibility' });
  if (effects.value) gsap.set(effects.value.children, { clearProps: 'transform,opacity,visibility' });
}
function reset() {
  clearAnimation(); counter.reset();
  state.value = 'idle'; line.value = ''; emit('message', '');
}
function message(text) { line.value = text; emit('message', text); }
function randomLine() {
  const lines = characterReactions[props.member.id];
  // 尽量不连续抽到相同台词，所有句子均为本站原创互动文案。
  const index = (lastLine + 1 + Math.floor(Math.random() * (lines.length - 1))) % lines.length;
  lastLine = index; return lines[index];
}
async function hideInBox() {
  // autoAlpha 隐藏人物时浏览器可能先移走焦点，因此在退场前记录意图。
  const restoreFocus = portrait.value?.contains(document.activeElement);
  state.value = 'hiding'; message('等、等一下！让我先躲一小会儿……');
  await nextTick();
  if (disposed || props.blocked || state.value !== 'hiding') return;
  const complete = () => {
    state.value = 'boxed'; message('纸箱里暂时安全。轻点纸箱，叫我出来吧。');
    // 仅在键盘焦点原本位于人物上时移交焦点，不打断其他操作。
    if (restoreFocus && (document.activeElement === document.body || portrait.value?.contains(document.activeElement))) nextTick(() => box.value?.focus({ preventScroll: true }));
  };
  if (media?.matches) {
    gsap.set(portrait.value, { autoAlpha: 0 }); complete(); return;
  }
  // 本层仅控制彩蛋容器；外面的转场、漂浮、视差容器不被覆盖。
  animation = gsap.timeline({ onComplete: complete });
  animation.to(portrait.value, { x: 4, duration: .055, repeat: 5, yoyo: true })
    .fromTo(box.value, { y: 110, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4, ease: 'back.out(1.25)' }, .15)
    .to(portrait.value, { yPercent: 46, scale: .92, autoAlpha: 0, clipPath: 'inset(0 0 62% 0)', duration: .45, ease: 'power2.in' }, .32)
    .to(box.value, { rotation: 3, duration: .09, repeat: 3, yoyo: true }, .8)
    .set(box.value, { rotation: 0 });
}
function trigger() {
  if (props.blocked || document.hidden || disposed || ['hiding', 'boxed', 'returning'].includes(state.value)) return;
  const kind = counter.hit();
  if (!kind) return;
  clearAnimation();
  if (props.member.id === 'hitori' && kind === 'box') { hideInBox(); return; }
  state.value = props.member.id === 'hitori' ? kind : 'reacting';
  message(randomLine());
  if (!media?.matches) {
    const id = props.member.id;
    animation = gsap.timeline();
    if (id === 'hitori') animation.to(portrait.value, { x: kind === 'panic' ? 5 : 2, duration: .065, repeat: 5, yoyo: true }).to(portrait.value, { x: 0, duration: .12 });
    else if (id === 'nijika') animation.to(portrait.value, { y: -9, duration: .16, ease: 'power2.out' }).to(portrait.value, { y: 0, duration: .3, ease: 'back.out(1.3)' });
    else if (id === 'ryo') animation.to(portrait.value, { x: -4, rotation: -.5, duration: .25 }).to(portrait.value, { x: 0, rotation: 0, duration: .4 });
    else animation.to(portrait.value, { scale: 1.025, duration: .18 }).to(portrait.value, { scale: 1, duration: .4, ease: 'back.out(1.5)' });
    animation.fromTo(effects.value.children, { scale: .55, opacity: 0, y: 8 }, { scale: 1.15, opacity: .8, y: -5, duration: .35, stagger: .05 }, 0)
      .to(effects.value.children, { opacity: 0, y: -16, duration: .5, stagger: .04 }, .55);
  }
  timer = setTimeout(() => { clearAnimation(); state.value = 'idle'; message(''); }, settings.durationMs);
}
async function release() {
  if (!['hiding', 'boxed'].includes(state.value) || props.blocked) return;
  const restoreFocus = document.activeElement === box.value;
  clearAnimation(); state.value = 'returning'; message('出来了……今天也勇敢了一点点。');
  const complete = () => {
    reset();
    if (restoreFocus) nextTick(() => { if (!disposed && !props.blocked) portrait.value?.querySelector('button')?.focus({ preventScroll: true }); });
  };
  if (media?.matches) { complete(); return; }
  animation = gsap.timeline({ onComplete: complete })
    .to(box.value, { y: 70, autoAlpha: 0, duration: .25 })
    .fromTo(portrait.value, { y: 35, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .42, ease: 'power2.out' }, .1);
}
function hidden() { if (document.hidden) reset(); }
watch(() => [props.member.id, props.blocked], reset, { flush: 'sync' });
onMounted(() => {
  media = matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', reset);
  document.addEventListener('visibilitychange', hidden);
  observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) reset(); });
  observer.observe(root.value);
});
onBeforeUnmount(() => { disposed = true; reset(); observer?.disconnect(); media?.removeEventListener('change', reset); document.removeEventListener('visibilitychange', hidden); });
defineExpose({ trigger, reset });
</script>

<template>
  <div ref="root" class="character-easter-egg" :data-state="state" :data-kind="member.id">
    <div ref="portrait" class="cast-easter-portrait" :inert="state === 'boxed' || undefined"><slot /></div>
    <div ref="effects" class="egg-marks" aria-hidden="true">
      <i class="egg-ring"></i><span>{{ member.id === 'kita' ? '✦' : member.id === 'nijika' ? '♩' : member.id === 'ryo' ? '≈' : '〃' }}</span><span>{{ member.id === 'kita' ? '✧' : member.id === 'nijika' ? '♪' : member.id === 'ryo' ? '≋' : '！' }}</span>
    </div>
    <p v-if="line" class="egg-speech" role="status">{{ line }}<small>小屋原创互动</small></p>
    <button v-show="['hiding', 'boxed', 'returning'].includes(state)" id="character-box" ref="box" class="egg-box" type="button" aria-label="轻点纸箱，让后藤一里重新出现" :disabled="state === 'returning'" @click.stop="release" @pointerdown.stop @pointerup.stop><img :src="asset(settings.boxAsset)" alt="写着ひとり的纸箱" width="320" height="220"><span>轻点，叫我出来 ↗</span></button>
  </div>
</template>

<style scoped>
.character-easter-egg,.cast-easter-portrait{position:absolute;inset:0;transform-origin:50% 80%}
.egg-marks{position:absolute;inset:0;pointer-events:none;color:var(--cast-deep)}
.egg-marks>*{position:absolute;opacity:0}
.egg-ring{width:65%;aspect-ratio:1;border:2px solid currentColor;border-radius:50%;left:17%;top:22%}
.egg-marks span{font-size:48px;left:15%;top:30%;font-style:normal}.egg-marks span:last-child{left:auto;right:13%;top:16%}
[data-kind=ryo] .egg-ring{border-radius:0;height:40px;top:40%;border-inline:0;border-width:1px}
[data-kind=nijika] .egg-marks span{width:44px;height:44px;display:grid;place-items:center;font-size:24px;border:2px solid currentColor;border-radius:50%}
[data-state=panic] .egg-ring{border-style:dashed}
.egg-speech{position:absolute;top:3%;left:0;z-index:4;max-width:190px;margin:0;padding:13px 16px;background:var(--cast-paper);color:var(--cast-ink);border:1px solid currentColor;box-shadow:4px 4px 0 var(--cast-deep);font-size:12px;line-height:1.65;transform:rotate(-3deg);pointer-events:none}
.egg-speech:after{content:'';position:absolute;bottom:-9px;right:20px;width:14px;height:14px;background:var(--cast-paper);border-right:1px solid;border-bottom:1px solid;transform:skewY(30deg)}
.egg-speech small{display:block;font-size:8px;letter-spacing:2px;opacity:.6;margin-top:6px}
.egg-box{position:absolute;z-index:5;width:clamp(150px,66%,260px);left:50%;bottom:4%;margin-left:clamp(-130px,-33%,-75px);border:0;background:none;color:var(--cast-ink);padding:0;cursor:pointer;transform-origin:50% 85%;touch-action:manipulation}
.egg-box img{width:100%;height:auto;display:block;filter:drop-shadow(0 8px 0 #422c2917)}
.egg-box span{font-size:10px;display:inline-block;border-bottom:1px dashed;margin-top:7px}
@media(max-width:760px){.egg-speech{max-width:112px;font-size:11px;top:0;left:-8px;padding:9px 10px}.egg-marks span{font-size:32px}.egg-box{bottom:3%}}
@media(prefers-reduced-motion:reduce){.egg-speech{transform:none}}
</style>
