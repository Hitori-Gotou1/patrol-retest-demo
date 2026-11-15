<script setup>
import { nextTick, onErrorCaptured, ref } from 'vue';
import { useRouter } from 'vue-router';
import { appRecovery, reportAppError } from '../services/appRecovery.js';
const router = useRouter(), generation = ref(0), retrying = ref(false), panel = ref(null);
onErrorCaptured(error => { reportAppError(error, router.currentRoute.value); nextTick(() => panel.value?.focus()); return false; });
async function retry() {
  if (retrying.value) return;
  retrying.value = true;
  const path = appRecovery.pendingRoute;
  appRecovery.issue = null;
  generation.value++;
  try { if (path && path !== router.currentRoute.value.fullPath) await router.push(path); }
  catch (error) { reportAppError(error, { fullPath: path }); }
  finally { retrying.value = false; }
}
function refresh() { location.reload(); }
</script>
<template>
  <p v-if="appRecovery.loading" class="route-loading" role="status">正在打开小屋的这一页…</p>
  <section v-if="appRecovery.issue" ref="panel" tabindex="-1" class="app-recovery" aria-labelledby="recovery-title" role="alert">
    <small>小屋的门还在这里</small><h1 id="recovery-title">这一页没能顺利打开</h1><p>{{ appRecovery.issue.message }}</p>
    <div><button type="button" :disabled="retrying" @click="retry">重新打开这一页</button><button type="button" @click="refresh">刷新网站版本</button><RouterLink to="/room/play" @click="appRecovery.issue=null">回到活动室</RouterLink></div>
    <p class="recovery-note">刷新只会重新载入网站，不会清空作品、草稿或收藏。离线时，可以打开已缓存的常用玩法。</p>
  </section>
  <slot v-else :key="generation" />
</template>
<style>
.route-loading{position:fixed;z-index:80;top:0;left:0;right:0;margin:0;padding:6px 16px;text-align:center;font-size:12px;background:#f2aec6;color:#251d2b;pointer-events:none}
.app-recovery{max-width:760px;margin:clamp(140px,20vh,220px) auto 80px;padding:30px;background:#fff7e8;color:#493449;border:1px solid #d5a7be}.app-recovery small{color:#9c5478}.app-recovery h1{font-size:clamp(24px,5vw,34px);margin:16px 0}.app-recovery p{line-height:1.9}.app-recovery>div{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}.app-recovery button,.app-recovery a{display:inline-flex;align-items:center;min-height:44px;padding:10px 16px;border:1px solid #98728d;background:#f0dfed;color:#493449;font:inherit}.recovery-note{font-size:13px}@media(max-width:800px){.app-recovery{margin-inline:16px}}
</style>
