<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { gsap } from 'gsap';
import { motionPreference } from '../../room/preferences.js';
const shell = ref(null), content = ref(null);
let observer, tween, height = 0, preference;
function preferenceChanged() {
  if (!preference?.matches) return;
  tween?.kill();
  if (shell.value) shell.value.style.height = '';
  height = content.value?.getBoundingClientRect().height || 0;
}
onMounted(() => {
  preference = motionPreference();
  preference.addEventListener('change', preferenceChanged);
  height = content.value.getBoundingClientRect().height;
  if (typeof ResizeObserver !== 'function') return;
  observer = new ResizeObserver(() => {
    const next = content.value?.getBoundingClientRect().height || 0;
    if (!content.value || Math.abs(next - height) < 1) return;
    const current = tween?.isActive() ? shell.value.getBoundingClientRect().height : height;
    height = next; tween?.kill();
    if (preference.matches) { shell.value.style.height = ''; return; }
    tween = gsap.fromTo(shell.value, { height: current }, { height: next, duration: .28, ease: 'power2.inOut',
      onComplete: () => { if(shell.value) shell.value.style.height = ''; } });
  });
  observer.observe(content.value);
});
onBeforeUnmount(() => { observer?.disconnect(); tween?.kill(); preference?.removeEventListener('change', preferenceChanged); });
</script>
<template><div ref="shell" class="fluid-panel"><div ref="content" class="fluid-panel-content"><slot /></div></div></template>
<style>.fluid-panel{min-width:0;overflow:clip}.fluid-panel-content{display:flow-root;min-width:0}</style>
