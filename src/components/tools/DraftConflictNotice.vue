<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { draftConflicts } from '../../services/draftPersistence.js';
import { downloadJson } from '../../room/storage.js';
const error = ref(''), dialog = ref(null); let previousFocus;
watch(() => draftConflicts.length, async count => {
  await nextTick();
  if (count && dialog.value && !dialog.value.open) { previousFocus = document.activeElement; dialog.value.showModal(); dialog.value.querySelector('button')?.focus(); }
  else if (!count && dialog.value?.open) { dialog.value.close(); if (previousFocus?.isConnected) previousFocus.focus(); }
}, { immediate: true });
function resolve(item, choice) { try { error.value=''; item.resolve(choice); } catch (reason) { error.value=reason.message; } }
onBeforeUnmount(() => dialog.value?.close());
</script>
<template><dialog ref="dialog" class="draft-conflict-notice" aria-labelledby="draft-conflict-title" @cancel.prevent @keydown.stop><template v-if="draftConflicts.length"><h2 id="draft-conflict-title">两份草稿都先留在这里</h2><p>你正在编辑时，另一台设备或标签页送来了新稿。编辑和自动保存已经暂停，避免覆盖任一份内容。先保留需要的内容，再选择继续。</p><article v-for="item in draftConflicts" :key="item.key"><strong>{{item.local.name||item.local.title||item.local.caption||'当前创作草稿'}}</strong><p v-if="item.ownerChanged">同步账号已切换。先导出原账号的当前草稿，再采用新账号草稿。</p><div><button type="button" @click="downloadJson(item.local,'hitori-current-draft.json')">先导出当前内容 JSON</button><button v-if="!item.ownerChanged" type="button" @click="resolve(item,'local')">保留当前编辑</button><button type="button" @click="resolve(item,'incoming')">采用收到的新稿</button></div></article><p v-if="error" role="alert">{{error}}</p></template></dialog></template>
<style scoped>.draft-conflict-notice{width:min(620px,calc(100vw - 32px));max-height:70dvh;padding:24px;box-sizing:border-box;border:2px solid #edcf85;background:#35293c;color:#fff1e6;box-shadow:0 6px 50px #0009;line-height:1.7;overflow:auto}.draft-conflict-notice::backdrop{background:#170e20b8}.draft-conflict-notice h2{font-size:18px;margin-top:0}.draft-conflict-notice p{font-size:14px}.draft-conflict-notice article>div{display:flex;flex-wrap:wrap;gap:8px}.draft-conflict-notice button{min-height:44px;font:inherit;padding:8px 12px;background:#634a64;color:#fff4e7;border:1px solid #d0b0c7;border-radius:4px}.draft-conflict-notice :focus-visible{outline:3px solid #edcf85;outline-offset:2px}@media(max-width:600px){.draft-conflict-notice{max-height:80dvh;padding:16px}.draft-conflict-notice button{flex:1 1 140px}}</style>
