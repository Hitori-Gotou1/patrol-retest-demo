(() => {
  'use strict';

  const scenes = [...document.querySelectorAll('main > .scene[id]')];
  if (!scenes.length) return;
  const sceneById = new Map(scenes.map(scene => [scene.id, scene]));
  const navLinks = [...document.querySelectorAll('#scene-nav a, .site-header nav a')];
  const currentLabel = document.querySelector('#scene-current-label');
  const currentIndex = document.querySelector('#scene-current-index');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const desktopPaging = matchMedia('(min-width: 1100px) and (min-height: 700px) and (hover: hover) and (pointer: fine)');
  let scrollFrame = 0;
  let locationFrame = 0;
  let focusToken = 0;
  let interacted = false;
  let activeScene;
  let lastWheelAt = 0;
  let wheelTotal = 0;
  let wheelDirection = 0;
  let gestureHandled = false;
  let wheelLockUntil = 0;

  function sceneFromHash(hash) {
    try { return sceneById.get(decodeURIComponent(hash.slice(1))); }
    catch { return undefined; }
  }

  function linkedScene(anchor) {
    if (!anchor || anchor.hasAttribute('download')) return undefined;
    try {
      const target = new URL(anchor.href, location.href);
      if (target.origin !== location.origin || target.pathname !== location.pathname || target.search !== location.search) return undefined;
      return sceneFromHash(target.hash);
    } catch { return undefined; }
  }

  function topOf(scene) { return scene.getBoundingClientRect().top + scrollY; }
  function maxScroll() { return Math.max(0, document.documentElement.scrollHeight - innerHeight); }

  function updateActiveScene() {
    scrollFrame = 0;
    const probe = innerHeight * 0.4;
    // Sample the viewport, rather than just the most recently clicked link.
    // This also follows touch scrolling, scrollbar dragging and keyboard scroll.
    let selected = scenes[0];
    for (const scene of scenes) {
      if (scene.getBoundingClientRect().top <= probe) selected = scene;
      else break;
    }
    if (activeScene === selected) return;
    activeScene = selected;
    document.body.dataset.activeScene = selected.id;
    navLinks.forEach(link => {
      if (linkedScene(link) === selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    if (currentLabel) currentLabel.textContent = selected.dataset.sceneName || selected.querySelector('h1, h2')?.textContent.trim() || selected.id;
    if (currentIndex) currentIndex.textContent = `${String(scenes.indexOf(selected) + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
  }

  function scheduleActiveUpdate() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateActiveScene);
  }

  function focusHeadingWhenSettled(scene, targetY, token) {
    const started = performance.now();
    let settledFrames = 0;
    function check() {
      if (token !== focusToken) return;
      if (Math.abs(scrollY - targetY) < 3) settledFrames += 1;
      else settledFrames = 0;
      if (settledFrames >= 2) {
        const target = scene.querySelector('h1, h2') || scene;
        if (!target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1');
          target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
        }
        target.focus({ preventScroll: true });
        return;
      }
      // A user can interrupt the scroll; never pull focus to an off-screen page.
      if (performance.now() - started < 1800) requestAnimationFrame(check);
    }
    requestAnimationFrame(check);
  }

  function scrollToScene(scene, { keyboard = false, instant = false, end = false } = {}) {
    const top = topOf(scene);
    const destination = end ? Math.max(top, top + scene.getBoundingClientRect().height - innerHeight) : top;
    const targetY = Math.min(maxScroll(), Math.max(0, Math.round(destination)));
    const token = ++focusToken;
    window.scrollTo({ top: targetY, behavior: instant || reducedMotion.matches ? 'instant' : 'smooth' });
    if (keyboard) focusHeadingWhenSettled(scene, targetY, token);
    scheduleActiveUpdate();
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor || (anchor.target && anchor.target !== '_self')) return;
    const scene = linkedScene(anchor);
    if (!scene) return; // In particular, retain the normal #main skip link.
    event.preventDefault();
    interacted = true;
    if (sceneFromHash(location.hash) !== scene) {
      const destination = new URL(location.href);
      destination.hash = scene.id;
      history.pushState(null, '', destination);
    }
    scrollToScene(scene, { keyboard: event.detail === 0 });
  });

  function alignWithLocation() {
    cancelAnimationFrame(locationFrame);
    locationFrame = requestAnimationFrame(() => {
      locationFrame = requestAnimationFrame(() => {
        locationFrame = 0;
        const scene = sceneFromHash(location.hash);
        if (scene) scrollToScene(scene, { instant: true });
        else if (!location.hash) scrollToScene(scenes[0], { instant: true });
        scheduleActiveUpdate();
      });
    });
  }
  window.addEventListener('popstate', alignWithLocation);
  window.addEventListener('hashchange', alignWithLocation);

  function noteInteraction() { interacted = true; focusToken += 1; }
  window.addEventListener('pointerdown', noteInteraction, { passive: true });
  window.addEventListener('keydown', noteInteraction, { capture: true });
  window.addEventListener('touchstart', noteInteraction, { passive: true });
  window.addEventListener('scroll', scheduleActiveUpdate, { passive: true });
  window.addEventListener('resize', scheduleActiveUpdate, { passive: true });

  function nestedScrollerHasRoom(target, direction) {
    for (let element = target; element && element !== document.body && element !== document.documentElement; element = element.parentElement) {
      if (element.scrollHeight <= element.clientHeight + 2) continue;
      const overflow = getComputedStyle(element).overflowY;
      if (!/^(auto|scroll|overlay)$/.test(overflow)) continue;
      if (direction > 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 2) return true;
      if (direction < 0 && element.scrollTop > 2) return true;
    }
    return false;
  }

  function resetWheel() {
    lastWheelAt = 0;
    wheelTotal = 0;
    wheelDirection = 0;
    gestureHandled = false;
    wheelLockUntil = 0;
  }
  desktopPaging.addEventListener('change', resetWheel);
  reducedMotion.addEventListener('change', resetWheel);

  window.addEventListener('wheel', event => {
    noteInteraction();
    // Touch, smaller windows, reduced motion, browser zoom, dialogs and media
    // remain entirely native. There is no global keyboard interception.
    if (!desktopPaging.matches || reducedMotion.matches || event.defaultPrevented || !event.cancelable) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    const target = event.target instanceof Element ? event.target : null;
    if (document.querySelector('dialog[open]') || getComputedStyle(document.body).overflowY === 'hidden') return;
    if (target?.closest('input, textarea, select, video, audio, iframe, [contenteditable=""], [contenteditable="true"], [role="slider"]')) return;
    const direction = Math.sign(event.deltaY);
    if (nestedScrollerHasRoom(target, direction)) return;

    const now = performance.now();
    // A trackpad's inertial tail must not turn one gesture into several pages.
    if (now - lastWheelAt > 180) {
      wheelTotal = 0;
      wheelDirection = direction;
      gestureHandled = false;
    }
    lastWheelAt = now;
    if (gestureHandled || now < wheelLockUntil) { event.preventDefault(); return; }
    if (direction !== wheelDirection) { wheelTotal = 0; wheelDirection = direction; }

    let index = 0;
    for (let i = 0; i < scenes.length; i += 1) {
      if (topOf(scenes[i]) <= scrollY + 3) index = i;
      else break;
    }
    const scene = scenes[index];
    const top = topOf(scene);
    const height = scene.getBoundingClientRect().height;
    const bottom = top + height;
    const tall = height > innerHeight + 4;
    // Tall panels keep normal document scrolling until their edge is reached.
    // No overflow:hidden wrapper and no forced jump over unread text.
    if (tall && ((direction > 0 && scrollY + innerHeight < bottom - 3) || (direction < 0 && scrollY > top + 3))) {
      wheelTotal = 0;
      return;
    }
    let destination;
    let atEnd = false;
    if (direction < 0 && scrollY > top + 3) destination = scene;
    else {
      destination = scenes[index + direction];
      atEnd = direction < 0;
    }
    if (!destination) { wheelTotal = 0; return; }

    const factor = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? innerHeight : 1;
    wheelTotal += Math.abs(event.deltaY * factor);
    event.preventDefault();
    if (wheelTotal < 45) return;
    gestureHandled = true;
    wheelLockUntil = now + 700;
    scrollToScene(destination, { end: atEnd });
  }, { passive: false });

  // Position direct #section links after initial browser layout. A late load
  // must not move somebody who has already started reading or interacting.
  if (sceneFromHash(location.hash)) alignWithLocation();
  window.addEventListener('load', () => {
    if (!interacted && sceneFromHash(location.hash)) alignWithLocation();
    scheduleActiveUpdate();
  }, { once: true });
  updateActiveScene();
})();
