import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

export const SCENES = [
  { id: 'home', label: '开场', number: '01' },
  { id: 'about', label: '结束乐队', number: '02' },
  { id: 'theater', label: '纸箱剧场', number: '03' },
  { id: 'gallery', label: '心动收藏', number: '04' },
  { id: 'video', label: '音乐放映室', number: '05' }
];

/** 全局导航只管理交互；URL 与跨页滚动由 Vue Router 管理。 */
export function useSceneNavigation() {
  const route = useRoute();
  const isHome = computed(() => route.path === '/');
  const activeScene = ref('home');
  const activeIndex = computed(() => SCENES.find(item => item.id === activeScene.value)?.number || '01');
  let sections = [];
  let mounted = false;
  let scrollFrame = 0;
  let rebindFrame = 0;
  let focusFrame = 0;
  let focusToken = 0;
  let routeToken = 0;
  let temporaryFocus = null;
  let reducedMotion;
  let desktopPaging;
  let lastWheelAt = 0;
  let wheelTotal = 0;
  let wheelDirection = 0;
  let gestureHandled = false;
  let wheelLockUntil = 0;
  const listeners = [];

  const topOf = section => section.getBoundingClientRect().top + window.scrollY;
  const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const desiredTop = section => Math.min(maxScroll(), Math.max(0, Math.round(topOf(section))));

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  function updateActiveScene() {
    scrollFrame = 0;
    if (!isHome.value || !sections.length) return;
    const probe = window.innerHeight * 0.4;
    let selected = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= probe) selected = section;
      else break;
    }
    activeScene.value = selected.id;
    document.body.dataset.activeScene = selected.id;
  }

  function scheduleActiveUpdate() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateActiveScene);
  }

  function cancelFocus() {
    focusToken += 1;
    cancelAnimationFrame(focusFrame);
    focusFrame = 0;
  }

  function clearTemporaryFocus() {
    if (!temporaryFocus) return;
    temporaryFocus.element.removeEventListener('blur', temporaryFocus.cleanup);
    temporaryFocus.element.removeAttribute('tabindex');
    temporaryFocus = null;
  }

  function focusElement(element) {
    clearTemporaryFocus();
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '-1');
      const cleanup = () => {
        element.removeAttribute('tabindex');
        if (temporaryFocus?.element === element) temporaryFocus = null;
      };
      temporaryFocus = { element, cleanup };
      element.addEventListener('blur', cleanup, { once: true });
    }
    element.focus({ preventScroll: true });
  }

  function focusHeadingWhenSettled(section) {
    cancelFocus();
    const token = focusToken;
    const started = performance.now();
    let settledFrames = 0;
    const check = () => {
      if (!mounted || token !== focusToken || !section.isConnected || document.querySelector('dialog[open]')) return;
      if (Math.abs(window.scrollY - desiredTop(section)) < 3) settledFrames += 1;
      else settledFrames = 0;
      if (settledFrames >= 2) {
        focusFrame = 0;
        focusElement(section.querySelector('h1, h2') || section);
      } else if (performance.now() - started < 2200) {
        focusFrame = requestAnimationFrame(check);
      }
    };
    focusFrame = requestAnimationFrame(check);
  }

  function scrollToSection(section, { end = false } = {}) {
    cancelFocus();
    const top = topOf(section);
    const y = end ? Math.max(top, top + section.getBoundingClientRect().height - innerHeight) : top;
    window.scrollTo({
      top: Math.min(maxScroll(), Math.max(0, Math.round(y))),
      behavior: reducedMotion?.matches ? 'instant' : 'smooth'
    });
    scheduleActiveUpdate();
  }

  function resetWheel() {
    lastWheelAt = 0;
    wheelTotal = 0;
    wheelDirection = 0;
    gestureHandled = false;
    wheelLockUntil = 0;
  }

  async function bindScenes() {
    const token = ++routeToken;
    cancelFocus();
    resetWheel();
    await nextTick();
    if (!mounted || token !== routeToken) return;
    sections = isHome.value ? [...document.querySelectorAll('main > .scene[id]')] : [];
    document.documentElement.classList.toggle('has-scene-pages', isHome.value);
    if (!isHome.value) document.body.dataset.activeScene = 'about-page';
    cancelAnimationFrame(rebindFrame);
    rebindFrame = requestAnimationFrame(() => {
      rebindFrame = 0;
      updateActiveScene();
    });
  }

  function plainActivation(event) {
    return !event.defaultPrevented && event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
  }

  async function navigateToScene(event, id, navigate) {
    // 保留 Ctrl / Command 点击、新标签页等浏览器原生行为。
    if (!plainActivation(event)) return;
    const sameLocation = isHome.value && route.hash === `#${id}`;
    const keyboard = event.detail === 0;
    await navigate(event);
    await nextTick();
    if (!mounted || !isHome.value) return;
    const section = document.getElementById(id);
    if (!section) return;
    if (sameLocation) scrollToSection(section);
    if (keyboard) focusHeadingWhenSettled(section);
  }

  async function navigateToAbout(event, navigate) {
    if (!plainActivation(event)) return;
    const keyboard = event.detail === 0;
    const sameLocation = !isHome.value;
    await navigate(event);
    await nextTick();
    if (!mounted || isHome.value) return;
    const main = document.getElementById('main');
    if (!main) return;
    if (sameLocation) window.scrollTo({ top: 0, behavior: reducedMotion?.matches ? 'instant' : 'smooth' });
    if (keyboard) focusHeadingWhenSettled(main);
  }

  function skipToContent(event) {
    if (!plainActivation(event)) return;
    const main = document.getElementById('main');
    if (!main) return;
    event.preventDefault();
    cancelFocus();
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function nestedScrollerHasRoom(target, direction) {
    for (let element = target; element && element !== document.body && element !== document.documentElement; element = element.parentElement) {
      if (element.scrollHeight <= element.clientHeight + 2) continue;
      if (!/^(auto|scroll|overlay)$/.test(getComputedStyle(element).overflowY)) continue;
      if (direction > 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 2) return true;
      if (direction < 0 && element.scrollTop > 2) return true;
    }
    return false;
  }

  function onWheel(event) {
    cancelFocus();
    if (!isHome.value || !sections.length || !desktopPaging.matches || reducedMotion.matches || event.defaultPrevented || !event.cancelable) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    const target = event.target instanceof Element ? event.target : null;
    if (document.querySelector('dialog[open]') || getComputedStyle(document.body).overflowY === 'hidden') return;
    if (target?.closest('input, textarea, select, video, audio, iframe, [contenteditable=""], [contenteditable="true"], [role="slider"], [data-native-scroll]')) return;
    const direction = Math.sign(event.deltaY);
    if (nestedScrollerHasRoom(target, direction)) return;

    const now = performance.now();
    // 一次触控板手势只翻一幕，持续到来的惯性事件不会连续跳页。
    if (now - lastWheelAt > 180) {
      wheelTotal = 0;
      wheelDirection = direction;
      gestureHandled = false;
    }
    lastWheelAt = now;
    if (gestureHandled || now < wheelLockUntil) { event.preventDefault(); return; }
    if (direction !== wheelDirection) { wheelTotal = 0; wheelDirection = direction; }

    let index = 0;
    for (let i = 0; i < sections.length; i += 1) {
      if (topOf(sections[i]) <= window.scrollY + 3) index = i;
      else break;
    }
    const section = sections[index];
    const top = topOf(section);
    const height = section.getBoundingClientRect().height;
    // 展开资料和音乐列表可以超过一屏，读到边缘后才触发下一幕。
    if (height > innerHeight + 4 && ((direction > 0 && scrollY + innerHeight < top + height - 3) || (direction < 0 && scrollY > top + 3))) {
      wheelTotal = 0;
      return;
    }
    let destination;
    let end = false;
    if (direction < 0 && scrollY > top + 3) destination = section;
    else { destination = sections[index + direction]; end = direction < 0; }
    if (!destination) { wheelTotal = 0; return; }
    const factor = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? innerHeight : 1;
    wheelTotal += Math.abs(event.deltaY * factor);
    event.preventDefault();
    if (wheelTotal < 45) return;
    gestureHandled = true;
    wheelLockUntil = now + 700;
    scrollToSection(destination, { end });
  }

  watch(() => route.fullPath, bindScenes, { flush: 'post' });
  onMounted(() => {
    mounted = true;
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    desktopPaging = matchMedia('(min-width: 1100px) and (min-height: 700px) and (hover: hover) and (pointer: fine)');
    listen(window, 'scroll', scheduleActiveUpdate, { passive: true });
    listen(window, 'resize', scheduleActiveUpdate, { passive: true });
    listen(window, 'wheel', onWheel, { passive: false });
    listen(window, 'pointerdown', cancelFocus, { passive: true });
    listen(window, 'touchstart', cancelFocus, { passive: true });
    listen(window, 'keydown', cancelFocus, { capture: true });
    listen(reducedMotion, 'change', resetWheel);
    listen(desktopPaging, 'change', resetWheel);
    bindScenes();
  });

  onBeforeUnmount(() => {
    mounted = false;
    routeToken += 1;
    cancelFocus();
    clearTemporaryFocus();
    cancelAnimationFrame(scrollFrame);
    cancelAnimationFrame(rebindFrame);
    listeners.forEach(remove => remove());
    document.documentElement.classList.remove('has-scene-pages');
    delete document.body.dataset.activeScene;
    sections = [];
  });

  return { scenes: SCENES, isHome, activeScene, activeIndex, navigateToScene, navigateToAbout, skipToContent };
}
