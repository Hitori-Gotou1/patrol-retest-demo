<script setup>
import { computed,nextTick,ref,watch } from 'vue';
import { useRoute } from 'vue-router';
import { cast } from '../data/playroom.js';
import { useCompanion } from '../composables/useCompanion.js';
import CompanionControls from './CompanionControls.vue';
const {state}=useCompanion(),route=useRoute(),open=ref(false),launcher=ref(null),closer=ref(null);
const person=computed(()=>cast.find(c=>c.id===state.value.member));
const asset=path=>`${import.meta.env.BASE_URL}${path}`;
watch(()=>route.path,()=>open.value=false);
async function toggle(){open.value=!open.value;if(open.value){await nextTick();closer.value?.focus();}}
function close(){open.value=false;nextTick(()=>launcher.value?.focus());}
</script>
<template>
  <aside v-if="state.enabled" class="room-companion" :class="{'is-compact':state.compact,'in-room':route.path.startsWith('/room')}" aria-label="小屋常驻伙伴" @keydown.esc.stop.prevent="close">
    <section v-if="open" id="buddy-dialog" class="buddy-dialog" role="dialog" aria-labelledby="buddy-dialog-title"><header><span><small>HITORI ROOM / LITTLE COMPANY</small><strong id="buddy-dialog-title">{{person.name}}，在这里。</strong></span><button ref="closer" type="button" aria-label="关闭伙伴面板" @click="close">×</button></header><CompanionControls compact/><button type="button" class="buddy-fold" @click="state.compact=!state.compact">{{state.compact?'展开小伙伴':'收成小按钮'}}</button></section>
    <button id="buddy-launcher" ref="launcher" type="button" class="buddy-launcher" :aria-expanded="open" aria-controls="buddy-dialog" :aria-label="`打开小屋伙伴：${person.name}`" @click="toggle"><img v-if="!state.compact" :src="asset(person.thumbnail || person.image)" alt="" width="62" height="68"><span>{{state.compact?'✿ 伙伴':'小屋伙伴'}}</span></button>
  </aside>
</template>
<style scoped>.room-companion{position:fixed;right:18px;bottom:16px;z-index:45;width:82px;font-family:inherit}.buddy-launcher{border:0;background:transparent;padding:0;display:flex;flex-direction:column;align-items:center;width:100%;min-height:44px;color:#f7e9ef;font:11px inherit;cursor:pointer;filter:drop-shadow(0 3px 5px #26152b33)}.buddy-launcher img{width:62px;height:68px;object-fit:contain}.buddy-launcher span{background:#684d64;color:#fff4e9;padding:7px 11px;border:1px solid #b190a5;border-radius:24px;font-size:10px;line-height:1.4}.buddy-dialog{position:absolute;width:min(350px,calc(100vw - 32px));right:0;bottom:110px;max-height:min(650px,calc(100dvh - 170px));overflow:auto;background:#fff8ed;border:1px solid #bda2b0;box-shadow:0 15px 60px #17101c44;padding:18px;box-sizing:border-box}.buddy-dialog header{display:flex;justify-content:space-between;align-items:start;gap:12px;margin-bottom:18px}.buddy-dialog header small{display:block;font:8px monospace;letter-spacing:1px;color:#9a788c;margin-bottom:7px}.buddy-dialog header strong{font-size:17px;color:#5c4357}.buddy-dialog header button{background:transparent;border:1px solid #c6adb7;min-width:44px;min-height:44px;font-size:24px;color:#77516a;cursor:pointer}.buddy-fold{background:transparent;border:0;padding:9px 0;color:#916a81;font:11px inherit;min-height:44px;text-decoration:underline;cursor:pointer}.is-compact .buddy-dialog{bottom:58px}.room-companion :focus-visible{outline:2px solid #b789a4;outline-offset:4px}@media(max-width:600px){.room-companion{right:10px;top:108px;bottom:auto;width:60px}.buddy-launcher img{width:36px;height:39px}.buddy-launcher span{font-size:9px;padding:7px 9px}.buddy-dialog,.is-compact .buddy-dialog{top:77px;bottom:auto;padding:14px;max-height:calc(100dvh - 200px)}.is-compact .buddy-dialog{top:50px}}@media(prefers-reduced-motion:reduce){.room-companion *{animation:none!important;transition:none!important}}
@media(max-width:600px){.room-companion.in-room{top:auto;bottom:14px}.in-room .buddy-dialog{top:auto;bottom:88px;max-height:calc(100dvh - 200px)}.in-room.is-compact .buddy-dialog{top:auto;bottom:50px}}
</style>
