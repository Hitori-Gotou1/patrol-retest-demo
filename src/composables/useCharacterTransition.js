import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { gsap } from 'gsap';

/** 使用最远角的距离，而不是视口宽度，保证长手机页面和边缘点击也能完全覆盖。 */
export function revealGeometry(width, height, x, y) {
  const cx = Math.min(width, Math.max(0, x));
  const cy = Math.min(height, Math.max(0, y));
  return { x: cx, y: cy, radius: Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy)) + 6 };
}

export function useCharacterTransition({ members, scene, baseLayer, revealLayer, content, suspended = ref(false) }) {
  const selectedIndex = ref(0);
  const requestedIndex = ref(0);
  const member = computed(() => members[selectedIndex.value]);
  const busy = ref(false);
  let disposed = false, visible = false, generation = 0;
  let timeline, finishTimeline, idleTween, reactionTween, media, observer, resizeObserver;
  let originElement, geometry, normalizedOrigin = { x: .5, y: .85 };
  const revealProgress = { value: 0 };
  const pressTweens = new Map();
  let parallaxX, parallaxY;
  let previousPrimary = '', previousInk = '';
  const $ = selector => content.value?.querySelector(selector);
  const $$ = selector => [...(content.value?.querySelectorAll(selector) || [])];
  const normalize = index => (index % members.length + members.length) % members.length;

  function synchronizeTheme() {
    if (!scene.value) return;
    baseLayer.value.style.backgroundColor = member.value.theme.primary;
    document.body.style.setProperty('--active-character-primary', member.value.theme.primary);
    document.body.style.setProperty('--active-character-ink', member.value.theme.ink);
  }
  function stopTimeline() {
    timeline?.kill(); timeline = null;
    // kill() 不触发 onComplete，主动释放等待，过期任务再由 generation 拦截。
    finishTimeline?.(); finishTimeline = null;
  }
  function stopAmbient() {
    idleTween?.kill(); idleTween = null;
    reactionTween?.kill(); reactionTween = null;
    gsap.killTweensOf($('.cast-portrait-parallax'));
    parallaxX = null; parallaxY = null;
    if (content.value) gsap.set($$('.cast-portrait-float, .cast-portrait-parallax'), { x: 0, y: 0, rotation: 0 });
  }
  function startAmbient() {
    stopAmbient();
    if (disposed || !visible || document.hidden || media?.matches || busy.value || suspended.value) return;
    const floating = $('.cast-portrait-float');
    if (floating) idleTween = gsap.to(floating, { y: -member.value.motion.floatY, duration: 2.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    const parallax = $('.cast-portrait-parallax');
    if (parallax) {
      parallaxX = gsap.quickTo(parallax, 'x', { duration: .65, ease: 'power2.out' });
      parallaxY = gsap.quickTo(parallax, 'y', { duration: .65, ease: 'power2.out' });
    }
  }
  function showAll() {
    if (!content.value) return;
    gsap.set($$('.cast-reveal-item, .cast-portrait-motion, .cast-decorations, .cast-peripheral'), { clearProps: 'transform,opacity,visibility' });
    revealLayer.value.style.opacity = '0';
    revealLayer.value.style.clipPath = 'none';
    revealProgress.value = 0;
  }
  function animate(build) {
    return new Promise(resolve => {
      finishTimeline = resolve;
      timeline = gsap.timeline({ onComplete: () => { timeline = null; finishTimeline = null; resolve(); } });
      build(timeline);
    });
  }
  function updateGeometry() {
    if (!scene.value) return;
    const bounds = scene.value.getBoundingClientRect();
    geometry = revealGeometry(bounds.width, bounds.height, normalizedOrigin.x * bounds.width, normalizedOrigin.y * bounds.height);
    if (busy.value) renderReveal();
  }
  function renderReveal() {
    if (!geometry || !revealLayer.value) return;
    const { x, y, radius } = geometry;
    // 动画帧只写 clip-path；布局测量集中到点击与 ResizeObserver，避免逐帧读写重排。
    revealLayer.value.style.clipPath = `circle(${(radius * revealProgress.value).toFixed(2)}px at ${x.toFixed(2)}px ${y.toFixed(2)}px)`;
  }
  function chooseOrigin(element) {
    const bounds = scene.value.getBoundingClientRect();
    const anchor = element?.isConnected ? element.getBoundingClientRect() : null;
    normalizedOrigin = anchor ? {
      x: Math.min(1, Math.max(0, (anchor.left + anchor.width / 2 - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (anchor.top + anchor.height / 2 - bounds.top) / bounds.height))
    } : { x: .5, y: .85 };
    updateGeometry();
  }
  function feedback(element) {
    if (!element || media?.matches) return;
    pressTweens.get(element)?.kill();
    const tween = gsap.fromTo(element, { scale: .94 }, { scale: 1, duration: .25, ease: 'back.out(1.8)', onComplete: () => { element.style.removeProperty('transform'); pressTweens.delete(element); } });
    pressTweens.set(element, tween);
  }

  async function settleInstant(index) {
    const token = ++generation;
    stopTimeline(); stopAmbient();
    selectedIndex.value = normalize(index);
    busy.value = true;
    await nextTick();
    if (disposed || token !== generation) return;
    synchronizeTheme(); showAll(); busy.value = false;
    startAmbient();
  }

  async function transition(index, origin) {
    const token = ++generation;
    busy.value = true;
    stopAmbient();
    const outgoing = member.value;
    const incoming = members[index];
    chooseOrigin(origin);
    revealLayer.value.style.backgroundColor = incoming.theme.primary;
    revealProgress.value = 0; renderReveal();
    revealLayer.value.style.opacity = '1';
    // 单一事务：旧内容退场 → 完整圆形覆盖 → 同步提交人物和主题 → 新内容依次入场。
    // 点击期间只保留最后一个目标，不中断半径/颜色，也不创建第二个人物层。
    await animate(tl => {
      tl.to($$('.cast-reveal-item'), { y: -9, autoAlpha: 0, duration: .2, stagger: .01, ease: 'power2.in' }, 0)
        .to($('.cast-portrait-motion'), { x: outgoing.motion.exitX, scale: .96, autoAlpha: 0, duration: .3, ease: 'power2.in' }, 0)
        .to($$('.cast-decorations, .cast-peripheral'), { opacity: 0, duration: .25 }, 0)
        .to(revealProgress, { value: 1, duration: .62, ease: 'power3.inOut', onUpdate: renderReveal }, .12);
    });
    if (disposed || token !== generation) return;
    selectedIndex.value = index;
    await nextTick();
    if (disposed || token !== generation) return;
    updateGeometry(); revealProgress.value = 1; renderReveal();
    synchronizeTheme();
    const portrait = $('.cast-portrait-motion');
    const details = $$('.cast-reveal-item');
    const decorations = $$('.cast-decorations, .cast-peripheral');
    gsap.set(portrait, { x: incoming.motion.enterX, scale: .95, autoAlpha: 0 });
    gsap.set(details, { y: 16, autoAlpha: 0 });
    gsap.set(decorations, { opacity: 0 });
    // 底层已是相同颜色，再撤走遮罩；没有透明中间帧或旧色角落。
    revealLayer.value.style.opacity = '0';
    await animate(tl => {
      tl.to(portrait, { x: 0, scale: 1, autoAlpha: 1, duration: .65, ease: incoming.motion.ease }, 0)
        .to(details, { y: 0, autoAlpha: 1, duration: .32, stagger: .035, ease: 'power3.out' }, .13)
        .to(decorations, { opacity: 1, duration: .4, ease: 'sine.out' }, .24);
    });
    if (disposed || token !== generation) return;
    showAll(); busy.value = false;
    if (requestedIndex.value !== selectedIndex.value) transition(requestedIndex.value, originElement);
    else startAmbient();
  }

  function selectMember(index, { origin } = {}) {
    if (disposed) return;
    const target = normalize(index);
    requestedIndex.value = target;
    originElement = origin || scene.value?.querySelector(`#tab-${members[target].id}`);
    feedback(originElement);
    if (media?.matches || !visible || document.hidden) { settleInstant(target); return; }
    if (!busy.value && selectedIndex.value !== target) transition(target, originElement);
  }
  function react() {
    if (busy.value || media?.matches || !visible || suspended.value) return;
    reactionTween?.kill(); idleTween?.kill();
    const floating = $('.cast-portrait-float');
    reactionTween = gsap.fromTo(floating, { rotation: -1, y: 0 }, {
      rotation: 1, y: member.value.id === 'hitori' ? 3 : -3, duration: .1, repeat: 3, yoyo: true,
      onComplete: () => { reactionTween = null; startAmbient(); }
    });
  }
  function pointerMove(event) {
    if (busy.value || media?.matches || suspended.value || event.pointerType !== 'mouse' || !parallaxX) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    parallaxX((event.clientX - bounds.left - bounds.width / 2) / bounds.width * 9);
    parallaxY((event.clientY - bounds.top - bounds.height / 2) / bounds.height * 7);
  }
  function pointerLeave() { parallaxX?.(0); parallaxY?.(0); }
  function motionChanged() {
    if (media.matches) {
      pressTweens.forEach((tween, element) => { tween.kill(); element.style.removeProperty('transform'); }); pressTweens.clear();
      settleInstant(requestedIndex.value);
    } else startAmbient();
  }
  function visibilityChanged() {
    scene.value?.classList.toggle('cast-is-visible', visible && !document.hidden && !suspended.value);
    if (document.hidden) { stopAmbient(); if (busy.value) settleInstant(requestedIndex.value); }
    else startAmbient();
  }

  // 舞台模态窗口只暂停环境动画，保留原先选中的人物及圆形转场状态。
  watch(suspended, paused => {
    scene.value?.classList.toggle('cast-is-visible', visible && !paused && !document.hidden);
    if (paused) { stopAmbient(); if (busy.value) settleInstant(requestedIndex.value); }
    else startAmbient();
  });

  onMounted(() => {
    previousPrimary = document.body.style.getPropertyValue('--active-character-primary');
    previousInk = document.body.style.getPropertyValue('--active-character-ink');
    media = matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener('change', motionChanged);
    document.addEventListener('visibilitychange', visibilityChanged);
    synchronizeTheme();
    observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      scene.value?.classList.toggle('cast-is-visible', visible && !suspended.value && !document.hidden);
      if (visible) startAmbient();
      else { stopAmbient(); if (busy.value) settleInstant(requestedIndex.value); }
    }, { threshold: 0 });
    observer.observe(scene.value);
    resizeObserver = new ResizeObserver(updateGeometry);
    resizeObserver.observe(scene.value);
  });
  onBeforeUnmount(() => {
    disposed = true; generation++;
    stopTimeline(); stopAmbient();
    pressTweens.forEach(tween => tween.kill()); pressTweens.clear();
    observer?.disconnect(); resizeObserver?.disconnect();
    media?.removeEventListener('change', motionChanged);
    document.removeEventListener('visibilitychange', visibilityChanged);
    for (const [key, oldValue] of [['--active-character-primary', previousPrimary], ['--active-character-ink', previousInk]]) {
      if (oldValue) document.body.style.setProperty(key, oldValue); else document.body.style.removeProperty(key);
    }
  });
  return { selectedIndex, requestedIndex, member, busy, selectMember, react, pointerMove, pointerLeave };
}
