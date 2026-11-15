import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { clampImagePan, fittedImageSize } from '../services/galleryZoom.js';

export function useGalleryZoom({ selectedImage, dialogOpen, surface, stepImage }) {
  const scale = ref(1);
  const x = ref(0);
  const y = ref(0);
  const size = ref({ width: 0, height: 0 });
  const available = ref({ width: 0, height: 0 });
  const natural = ref({ width: 0, height: 0 });
  const dragging = ref(false);
  const pointers = new Map();
  const maxScale = computed(() => Math.max(4, Math.min(8, natural.value.width / (size.value.width || 1))));
  const zoomed = computed(() => scale.value > 1.01);
  const zoomLabel = computed(() => `${Math.round(scale.value * 100)}%`);
  const imageTransform = computed(() => ({ width: `${size.value.width}px`, height: `${size.value.height}px`, transform: `translate(${x.value}px, ${y.value}px) scale(${scale.value})` }));
  let observer;
  let pinch;
  let lastTap;
  let pointerOrigin;
  let lastTouchZoom = 0;

  function clamp() {
    const result = clampImagePan({ x: x.value, y: y.value, scale: scale.value, ...size.value, availableWidth: available.value.width, availableHeight: available.value.height });
    x.value = result.x; y.value = result.y;
  }
  function measure() {
    if (!surface.value) return;
    available.value = { width: surface.value.clientWidth, height: surface.value.clientHeight };
    size.value = fittedImageSize(natural.value.width, natural.value.height, available.value.width, available.value.height);
    clamp();
  }
  function reset() { scale.value = 1; x.value = 0; y.value = 0; dragging.value = false; pointers.clear(); pinch = null; pointerOrigin = null; lastTap = null; }
  function imageLoaded(event) {
    natural.value = { width: event.target.naturalWidth, height: event.target.naturalHeight };
    measure();
  }
  function setZoom(next, clientX, clientY) {
    const previous = scale.value;
    const value = Math.max(1, Math.min(maxScale.value, next));
    if (clientX != null && surface.value) {
      const bounds = surface.value.getBoundingClientRect();
      const anchorX = clientX - bounds.left - bounds.width / 2;
      const anchorY = clientY - bounds.top - bounds.height / 2;
      x.value = anchorX - (anchorX - x.value) * value / previous;
      y.value = anchorY - (anchorY - y.value) * value / previous;
    }
    scale.value = value;
    clamp();
  }
  function fit() { reset(); measure(); }
  function oneToOne() { setZoom(natural.value.width / (size.value.width || 1)); }
  function toggle(event) { zoomed.value ? fit() : setZoom(Math.max(2, Math.min(3, maxScale.value)), event?.clientX, event?.clientY); }
  function doubleClick(event) { if (Date.now() - lastTouchZoom < 500 || event.sourceCapabilities?.firesTouchEvents) return; toggle(event); }
  function distance() { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
  function pointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) pointerOrigin = { x: event.clientX, y: event.clientY, panX: x.value, panY: y.value, time: Date.now(), moved: false, zoomed: zoomed.value, pointerType: event.pointerType };
    if (pointers.size === 2) { pinch = { distance: distance(), scale: scale.value }; if (pointerOrigin) pointerOrigin.moved = true; }
    if (zoomed.value) { try { surface.value?.setPointerCapture?.(event.pointerId); } catch { /* A detached or cancelled pointer can no longer be captured. */ } }
  }
  function pointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2 && pinch && zoomed.value) {
      if (event.cancelable) event.preventDefault();
      const [a, b] = [...pointers.values()];
      setZoom(pinch.scale * distance() / Math.max(1, pinch.distance), (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (pointers.size !== 1 || !pointerOrigin) return;
    const dx = event.clientX - pointerOrigin.x;
    const dy = event.clientY - pointerOrigin.y;
    if (Math.abs(dx) + Math.abs(dy) > 8) pointerOrigin.moved = true;
    if (!zoomed.value) return;
    if (event.cancelable) event.preventDefault();
    dragging.value = true;
    x.value = pointerOrigin.panX + dx; y.value = pointerOrigin.panY + dy;
    clamp();
  }
  function pointerUp(event) {
    pointers.delete(event.pointerId);
    dragging.value = false;
    if (pointers.size || !pointerOrigin) return;
    const origin = pointerOrigin;
    pointerOrigin = null; pinch = null;
    const dx = event.clientX - origin.x; const dy = event.clientY - origin.y;
    if (origin.pointerType !== 'mouse' && !origin.moved && Date.now() - origin.time < 400) {
      if (lastTap && Date.now() - lastTap.time < 320 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 30) { toggle(event); lastTouchZoom = Date.now(); lastTap = null; }
      else lastTap = { time: Date.now(), x: event.clientX, y: event.clientY };
    }
    if (!origin.zoomed && !zoomed.value && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) stepImage(dx < 0 ? 1 : -1);
  }
  function pointerCancel(event) { pointers.delete(event.pointerId); dragging.value = false; pointerOrigin = null; pinch = null; }
  function panKeyboard(event) {
    if (!zoomed.value || !event.shiftKey || !event.key.startsWith('Arrow')) return false;
    event.preventDefault();
    if (event.key === 'ArrowLeft') x.value += 45;
    if (event.key === 'ArrowRight') x.value -= 45;
    if (event.key === 'ArrowUp') y.value += 45;
    if (event.key === 'ArrowDown') y.value -= 45;
    clamp(); return true;
  }
  watch(() => selectedImage.value?.id, () => { reset(); natural.value = { width: selectedImage.value?.width || 1, height: selectedImage.value?.height || 1 }; nextTick(measure); }, { flush: 'sync' });
  watch([dialogOpen, surface], async () => {
    observer?.disconnect();
    if (!dialogOpen.value) { reset(); return; }
    await nextTick(); measure();
    if (surface.value) { observer = new ResizeObserver(measure); observer.observe(surface.value); }
  }, { flush: 'post' });
  onBeforeUnmount(() => observer?.disconnect());
  return { scale, maxScale, zoomed, zoomLabel, imageTransform, dragging, imageLoaded, reset, fit, oneToOne, setZoom, toggle, doubleClick, pointerDown, pointerMove, pointerUp, pointerCancel, panKeyboard };
}
