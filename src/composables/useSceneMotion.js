import { computed, onBeforeUnmount, onMounted, ref, unref } from 'vue';
import { gsap } from 'gsap';
import { motionPreference } from '../room/preferences.js';

/** One lifecycle for local decoration and once-per-visit chapter entrances.
 * Content is visible in CSS; only a working observer/GSAP may briefly animate it. */
export function useSceneMotion(root, { entrance = true } = {}) {
  const visible = ref(false), reduced = ref(false), pageVisible = ref(true);
  const active = computed(() => visible.value && pageVisible.value && !reduced.value);
  let observer, preference, timeline, entered = false;
  const nodes = () => [...(unref(root)?.querySelectorAll('[data-arrive]') || [])];
  function reveal() {
    if (entered || !visible.value) return;
    entered = true;
    if (!entrance || reduced.value) return;
    try {
      const items = nodes().sort((a, b) => Number(a.dataset.arrive) - Number(b.dataset.arrive));
      if (!items.length) return;
      timeline = gsap.from(items, { opacity: .2, y: 14, duration: .48, stagger: .085,
        ease: 'power2.out', clearProps: 'opacity,transform', onComplete: () => { timeline = null; } });
    } catch { for (const el of nodes()) { el.style.removeProperty('opacity'); el.style.removeProperty('transform'); } }
  }
  function sync() {
    reduced.value = preference.matches;
    pageVisible.value = !document.hidden;
    if (!active.value) {
      timeline?.kill(); timeline = null;
      for (const el of nodes()) { el.style.removeProperty('opacity'); el.style.removeProperty('transform'); }
    }
    if (unref(root)) unref(root).dataset.ambient = active.value ? 'running' : 'paused';
    reveal();
  }
  onMounted(() => {
    preference = motionPreference();
    preference.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(([entry]) => { visible.value = entry.isIntersecting; sync(); }, { threshold: .04 });
      observer.observe(unref(root));
    } else { visible.value = true; }
    sync();
  });
  onBeforeUnmount(() => {
    observer?.disconnect(); preference?.removeEventListener('change', sync);
    document.removeEventListener('visibilitychange', sync); timeline?.kill();
  });
  return { active, visible, reduced };
}
