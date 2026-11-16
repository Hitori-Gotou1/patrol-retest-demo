<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { gsap } from 'gsap';
import { motionPreference } from '../../room/preferences.js';
const props = defineProps({ open: Boolean, id: String });
const shell = ref(null), content = ref(null);
let tween, preference;
function settle() {
  tween?.kill();
  if (!shell.value) return;
  shell.value.style.height = props.open ? 'auto' : '0px';
  shell.value.style.visibility = props.open ? 'visible' : 'hidden';
}
async function update() {
  const el = shell.value;
  if (!el) return;
  const from = el.getBoundingClientRect().height;
  tween?.kill();
  await nextTick();
  if (!shell.value) return;
  if (preference?.matches) { settle(); return; }
  el.style.visibility = 'visible';
  tween = gsap.fromTo(el, { height: from }, { height: props.open ? content.value.offsetHeight : 0,
    duration: .28, ease: 'power2.inOut', onComplete: settle });
}
watch(() => props.open, update);
onMounted(() => { preference = motionPreference(); preference.addEventListener('change', settle); settle(); });
onBeforeUnmount(() => { tween?.kill(); preference?.removeEventListener('change', settle); });
</script>
<template><div :id="id" ref="shell" class="smooth-fold" :inert="!open" :aria-hidden="!open"><div ref="content"><slot /></div></div></template>
<style>.smooth-fold{overflow:clip;min-width:0}.smooth-fold>div{display:flow-root}</style>
