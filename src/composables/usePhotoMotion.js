import { nextTick, onBeforeUnmount, onMounted } from 'vue';
import { gsap } from 'gsap';
import { fittedImageSize } from '../services/galleryZoom.js';
import { motionPreference } from '../room/preferences.js';

/** The flight is a non-interactive copy in the dialog top layer.
 * Never animate the zoom surface's transform or delay route/history updates. */
export function usePhotoMotion({ lightbox, section }) {
  let preference, tween, flight, revision = 0, captured, sourceId = '', sourceButton;
  let stepDirection = 1, frame = 0, finishFrame;
  function nextFrame() { return new Promise(resolve => { finishFrame = resolve; frame = requestAnimationFrame(() => { frame = 0; finishFrame = null; resolve(); }); }); }
  function cancelFrame() { cancelAnimationFrame(frame); frame = 0; finishFrame?.(); finishFrame = null; }
  const image = () => lightbox.value?.querySelector('#lightbox-image');
  const chrome = () => lightbox.value?.querySelectorAll('.lightbox-toolbar,.lightbox-navigation,.lightbox-bottom,.lightbox-utilities');
  function clean() {
    tween?.kill(); tween = null; flight?.remove(); flight = null;
    const photo = image();
    if (photo) { gsap.killTweensOf(photo); photo.style.removeProperty('opacity'); }
    const controls = [...(chrome() || [])];
    if (controls.length) gsap.killTweensOf(controls);
    for (const el of controls) { el.style.removeProperty('opacity'); el.style.removeProperty('transform'); }
    if (lightbox.value) gsap.killTweensOf(lightbox.value);
  }
  function validRect(rect) { return rect && rect.width > 4 && rect.height > 4 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth; }
  function capture(id, button) {
    sourceId = id; sourceButton = button;
    const target = button?.querySelector('img');
    captured = target && validRect(target.getBoundingClientRect()) ? { rect: target.getBoundingClientRect(), src: target.currentSrc || target.src, width: target.naturalWidth, height: target.naturalHeight, fit: getComputedStyle(target).objectFit } : null;
  }
  function makeFlight(src, rect, fit = 'contain') {
    if (!src || !validRect(rect)) return null;
    const node = document.createElement('img');
    node.className = 'photo-flight'; node.alt = ''; node.setAttribute('aria-hidden', 'true'); node.src = src;
    Object.assign(node.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, objectFit: fit });
    lightbox.value.append(node); flight = node; return node;
  }
  async function open(item) {
    const token = ++revision; cancelFrame(); clean();
    if (captured && sourceButton?.isConnected && image() && !preference?.matches) gsap.set(image(), { opacity: 0 });
    await nextTick(); await nextFrame(); await nextTick();
    if (token !== revision || !lightbox.value?.open || preference?.matches) { if(token===revision) clean(); return; }
    const target = image(), surface = lightbox.value.querySelector('.lightbox-zoom-surface')?.getBoundingClientRect();
    const vector = item?.vectorViewBox;
    const size = fittedImageSize(vector?.width || item?.width || captured?.width || target?.naturalWidth || 1200,
      vector?.height || item?.height || captured?.height || target?.naturalHeight || 800,
      surface?.width, surface?.height, { allowUpscale: !!vector });
    const left = (surface?.left || 0) + ((surface?.width || 0) - size.width) / 2;
    const top = (surface?.top || 0) + ((surface?.height || 0) - size.height) / 2;
    const targetRect = { left, top, width: size.width, height: size.height, right: left + size.width, bottom: top + size.height };
    const origin = sourceButton?.isConnected ? captured : null;
    gsap.fromTo(lightbox.value, { backgroundColor: 'rgba(35,30,40,0)' }, { backgroundColor: 'rgba(35,30,40,.98)', duration: .32, clearProps: 'backgroundColor' });
    gsap.fromTo([...chrome()], { opacity: .1, y: 5 }, { opacity: 1, y: 0, delay: .16, duration: .22, clearProps: 'opacity,transform' });
    if (!origin || !validRect(targetRect)) { if(target) gsap.set(target, { clearProps: 'opacity' }); return; }
    const node = makeFlight(origin.src, origin.rect, origin.fit);
    if (!node) return;
    gsap.set(target, { opacity: 0 });
    tween = gsap.to(node, { x: targetRect.left - origin.rect.left, y: targetRect.top - origin.rect.top,
      width: targetRect.width, height: targetRect.height, duration: .36, ease: 'power3.inOut',
      onComplete: () => { if(token===revision) clean(); } });
  }
  function beforeStep(direction) {
    stepDirection = direction; revision++; clean();
    const current = image(), rect = current?.getBoundingClientRect();
    if (!preference?.matches && current && validRect(rect)) makeFlight(current.currentSrc || current.src, rect);
  }
  async function changed() {
    const token = ++revision;
    await nextTick(); await nextTick();
    const current = image();
    if (token !== revision) return;
    if (!current || !lightbox.value?.open || preference?.matches) { clean(); return; }
    // Only opacity touches the real image: zoom and pointer gestures keep control.
    gsap.fromTo(current, { opacity: .15 }, { opacity: 1, duration: .2, clearProps: 'opacity' });
    if (flight) tween = gsap.to(flight, { opacity: 0, x: -stepDirection * 12, duration: .2, onComplete: () => { flight?.remove(); flight = null; } });
  }
  function close(id) {
    const token = ++revision; clean();
    if (!lightbox.value?.open || preference?.matches) return Promise.resolve();
    const current = image(), rect = current?.getBoundingClientRect();
    // Only a connected photo in the current filtered layout can receive it.
    const origin = !sourceId ? null : sourceId === id && sourceButton?.isConnected ? sourceButton :
      [...(section.value?.querySelectorAll('[data-photo-id]') || [])].find(el => el.dataset.photoId === id);
    const candidate = origin?.closest('.photo-card-leave-active') ? null : origin;
    const thumbnail = candidate?.querySelector('img');
    const destination = thumbnail?.getBoundingClientRect();
    return new Promise(resolve => {
      const finish = () => { if (token===revision) clean(); resolve(); };
      if (!current || !validRect(rect) || !validRect(destination)) {
        tween = gsap.to(lightbox.value, { opacity: 0, duration: .18, onComplete: finish, onInterrupt: resolve });
        return;
      }
      const node = makeFlight(current.currentSrc || current.src, rect, getComputedStyle(thumbnail).objectFit);
      gsap.set(current, { opacity: 0 });
      gsap.to(chrome(), { opacity: 0, duration: .12 });
      gsap.to(lightbox.value, { backgroundColor: 'rgba(35,30,40,0)', duration: .28 });
      tween = gsap.to(node, { x: destination.left - rect.left, y: destination.top - rect.top,
        width: destination.width, height: destination.height, duration: .3, ease: 'power3.inOut', onComplete: finish, onInterrupt: resolve });
    });
  }
  function reset() { revision++; cancelFrame(); clean(); captured = null; sourceId = ''; sourceButton = null; if(lightbox.value) { lightbox.value.style.removeProperty('opacity'); lightbox.value.style.removeProperty('background-color'); } }
  function preferenceChanged() { if (preference.matches) { revision++; clean(); if(lightbox.value) { lightbox.value.style.removeProperty('opacity'); lightbox.value.style.removeProperty('background-color'); } } }
  onMounted(() => { preference = motionPreference(); preference.addEventListener('change', preferenceChanged); });
  onBeforeUnmount(() => { reset(); preference?.removeEventListener('change', preferenceChanged); });
  return { capture, open, close, beforeStep, changed, reset };
}
