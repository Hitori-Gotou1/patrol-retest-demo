<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { workTypes, draftKey, saveWork } from '../../room/workshelf.js';
import { captureWorkPreview } from '../../room/exportImage.js';
const props = defineProps({ activity: Object });
const busy = ref(false), message = ref('');
let alive = true;
onBeforeUnmount(()=>{alive=false;});
async function save() {
  if (busy.value) return;
  busy.value = true; message.value = '';
  try {
    await nextTick();
    const detail = { key: draftKey(props.activity.id) };
    window.dispatchEvent(new CustomEvent('hitori:capture-draft', { detail }));
    if (detail.error) throw new Error(detail.error);
    if (!detail.snapshot) throw new Error('画面还在准备，请稍后再保存。');
    let preview = '';
    try { preview = await captureWorkPreview(document.querySelector('.room-refresh .room-panel')); } catch { /* The editable snapshot remains useful without a preview. */ }
    if (!alive) return;
    saveWork(props.activity.id, detail.snapshot, preview);
    message.value = '已放进作品架，可以保留多个版本，随时回来继续。';
  } catch(error) { if(alive) message.value = error.message; }
  finally { if(alive) busy.value = false; }
}
</script>
<template><div v-if="workTypes[activity.id]" class="work-save-bar"><div><span>今天的灵感，值得留下。</span><p v-if="message" role="status">{{message}}</p></div><button id="save-to-works" type="button" :disabled="busy" @click="save">{{busy?'正在收好…':'存入作品架 ＋'}}</button></div></template>
<style scoped>.work-save-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 16px;margin-bottom:18px;border:1px solid #6a5366;background:#261f2d;color:#e6cad8;font-size:12px}.work-save-bar p{font-size:11px;line-height:1.8;margin:7px 0 0;color:#d6b1c5}.work-save-bar button{background:#f3d6e2;border-color:#c9a6ba;white-space:nowrap;font-size:12px}.work-save-bar>div{min-width:0}@media(max-width:600px){.work-save-bar{padding:12px;font-size:11px}.work-save-bar button{padding:8px 10px;font-size:11px}}</style>
