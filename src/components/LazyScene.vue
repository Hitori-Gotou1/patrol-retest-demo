<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
const props = defineProps({ eager: Boolean, id: { type:String, required:true }, title:String, name:String, sceneClass:String, loader:{ type:Function, required:true }, minHeight:{type:String,default:'100svh'} });
const route = useRoute(), host = ref(null), Scene = shallowRef(null), loading = ref(false), failed = ref(false);
let observer, alive = true;
async function load() {
  if (Scene.value || loading.value || !alive) return;
  loading.value = true; failed.value = false;
  try {
    const module = await props.loader();
    if (!alive) return;
    Scene.value = module.default;
    observer?.disconnect();
    await nextTick();
    window.dispatchEvent(new CustomEvent('hitori:scene-ready', { detail:props.id }));
  } catch { if (alive) failed.value = true; }
  finally { loading.value = false; }
}
function refresh() { location.reload(); }
function requested() { return route.hash === '#'+props.id || (props.id === 'gallery' && route.query.image); }
watch(() => props.eager, value => { if(value) load(); });
watch(() => route.fullPath, () => { if (requested()) load(); });
onMounted(() => {
  if (props.eager || requested() || typeof IntersectionObserver === 'undefined') { load(); return; }
  observer = new IntersectionObserver(entries => { if (entries.some(entry=>entry.isIntersecting)) load(); }, { rootMargin:'180px 0px' });
  observer.observe(host.value);
});
onBeforeUnmount(() => { alive = false; observer?.disconnect(); });
</script>
<template>
  <component :is="Scene" v-if="Scene" />
  <section v-else :id="id" ref="host" :class="['scene','scene-pending',sceneClass]" :style="{'min-height':minHeight}" :data-scene-name="name" :aria-busy="loading" :aria-labelledby="id+'-pending-title'">
    <div class="scene-inner"><span class="scene-kicker">{{ name }}</span><h2 :id="id+'-pending-title'">{{ title }}</h2><p role="status">{{ failed ? '这一幕暂时没有载入。请检查网络后再试，作品和收藏仍然保留。' : '走近一点，这一幕就会展开。' }}</p><button type="button" class="button" :disabled="loading" @click="load">{{ loading ? '正在准备…' : failed ? '重试打开这一幕' : '打开这一幕' }}</button><button v-if="failed" type="button" class="button button-outline" @click="refresh">刷新网站版本</button></div>
  </section>
</template>
<style>
.scene-pending{display:flex;align-items:center;padding:100px 0;background:#211927;color:#fff4e5;contain:layout}.scene-pending.character-scene{background:#edb7ca;color:#492c46}.scene-pending.gallery-section{background:#fff7e8;color:#493449}.scene-pending .scene-inner{width:min(1200px,90%);margin:auto}.scene-pending h2{font-size:clamp(26px,4vw,46px);line-height:1.5}.scene-pending p{line-height:1.9}.scene-pending button{margin:12px 12px 0 0;min-height:44px}
</style>
