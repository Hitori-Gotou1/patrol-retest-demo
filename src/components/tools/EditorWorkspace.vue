<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { useRoute } from 'vue-router';
const props = defineProps({ title: { type: String, required: true }, saveLabel: { type: String, default: '保存 / 导出' } });
const emit = defineEmits(['save']);
const route=useRoute(), shelfBusy=ref(false), shelfMessage=ref('');
async function saveToShelf(){
  if(shelfBusy.value)return; shelfBusy.value=true;shelfMessage.value='正在保存作品…';
  try{const [{draftKey,saveWork},{captureWorkPreview}]=await Promise.all([import('../../room/workshelf.js'),import('../../room/exportImage.js')]);const activity=route.path.split('/')[2],detail={key:draftKey(activity)};window.dispatchEvent(new CustomEvent('hitori:capture-draft',{detail}));if(detail.error||!detail.snapshot)throw new Error(detail.error||'画面还没准备好，请稍后再保存。');let preview='';try{preview=await captureWorkPreview(root.value);}catch{}saveWork(activity,detail.snapshot,preview);shelfMessage.value='已存入作品架，退出全屏后可以继续编辑。';}catch(error){shelfMessage.value=error.message||'作品暂未保存，请重试。';}finally{shelfBusy.value=false;}
}
const fullscreen = ref(false), root = ref(null), trigger = ref(null), toolsOpen = ref(true);
let previousOverflow = '', previousFocus = null;
async function enter() {
  previousFocus = document.activeElement;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden'; fullscreen.value = true;
  document.addEventListener('keydown', key);
  await nextTick(); root.value?.querySelector('.editor-exit')?.focus();
}
function exit() {
  if (!fullscreen.value) return;
  fullscreen.value = false; document.body.style.overflow = previousOverflow;
  document.removeEventListener('keydown', key); nextTick(() => { const target = previousFocus?.isConnected ? previousFocus : trigger.value; target?.focus(); });
}
function key(event) {
  if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
  if (event.key !== 'Tab') return;
  const items = [...root.value.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]')].filter(el => el.getClientRects().length);
  const first = items[0], last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
onBeforeUnmount(exit);
</script>
<template>
  <div ref="root" class="editor-workspace" :class="{'is-fullscreen':fullscreen,'tools-collapsed':!toolsOpen}" :role="fullscreen?'dialog':undefined" :aria-modal="fullscreen?true:undefined" :aria-label="fullscreen?`${title}全屏编辑`:undefined">
    <div class="editor-workspace-bar"><strong>{{title}}</strong><div><button v-if="!fullscreen" ref="trigger" type="button" class="editor-enter" @click="enter">⛶ 全屏编辑</button><button v-else type="button" class="editor-exit" @click="exit">退出全屏</button><button type="button" class="editor-save" @click="emit('save')">{{saveLabel}}</button><button type="button" class="editor-save-work" :disabled="shelfBusy" @click="saveToShelf">{{shelfBusy?'保存中…':'存入作品架'}}</button></div></div>
    <slot name="overview"/>
    <div class="editor-workspace-body"><div class="editor-workspace-canvas"><slot name="canvas"/><div class="editor-workspace-actions"><slot name="actions"/></div></div><div class="editor-workspace-tools"><slot name="tools"/></div></div>
    <p v-if="shelfMessage" class="editor-workspace-notice" role="status">{{shelfMessage}}</p><div class="editor-mobile-footer"><button type="button" :aria-expanded="toolsOpen" @click="toolsOpen=!toolsOpen">{{toolsOpen?'收起工具 · 看画面':'展开工具 · 继续编辑'}}</button><span>编辑会沿用本机自动保存</span></div>
  </div>
</template>
<style scoped>
:global(.room-refresh:has(.editor-workspace.is-fullscreen)) { isolation:auto; }
.editor-workspace{border:1px solid #baa0b0;min-width:0;background:#fbf3e7;color:#563b51;margin:18px 0}.editor-workspace-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid #d8bfcd}.editor-workspace-bar strong{font-size:13px}.editor-workspace-notice{font-size:12px;line-height:1.7;padding:8px 14px;margin:0;background:#f4e4eb;flex-shrink:0}.editor-workspace-bar>div{display:flex;gap:8px;flex-wrap:wrap}.editor-workspace button{font:inherit;cursor:pointer;border:1px solid #ad8c9f;color:#62445c;background:#f4e4e9;min-height:44px;padding:8px 12px;font-size:12px}.editor-workspace .editor-save{background:#72506c;color:#fff5e7}.editor-workspace-body{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(240px,1fr);align-items:start;gap:20px;padding:16px;min-width:0}.editor-workspace-canvas,.editor-workspace-tools{min-width:0}.editor-workspace-canvas{position:sticky;top:120px}.editor-workspace-canvas :deep(svg),.editor-workspace-canvas :deep(canvas){display:block;max-width:100%;height:auto;max-height:70dvh;object-fit:contain}.editor-workspace-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.editor-workspace-tools{display:grid;gap:12px}.editor-workspace-tools :deep(label){font-size:13px}.editor-mobile-footer{display:none}.is-fullscreen{position:fixed;inset:0;z-index:3000;margin:0;border:0;height:100dvh;max-height:100dvh;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);box-sizing:border-box}.is-fullscreen .editor-workspace-body{flex:1;min-height:0;overflow:hidden}.is-fullscreen .editor-workspace-canvas{position:static;align-self:start;max-height:100%;overflow:auto}.is-fullscreen .editor-workspace-tools{max-height:100%;overflow-y:auto;overscroll-behavior:contain;padding:0 6px 20px}.is-fullscreen .editor-workspace-canvas :deep(svg),.is-fullscreen .editor-workspace-canvas :deep(canvas){max-height:calc(100dvh - 160px)}
@media(max-width:760px){.editor-workspace-bar{padding:8px 10px;gap:8px}.editor-workspace-bar strong{max-width:36%;line-height:1.6}.editor-workspace-bar button{font-size:12px;padding-inline:10px}.editor-workspace-body{grid-template-columns:minmax(0,1fr);gap:10px;padding:10px}.editor-workspace-canvas{position:sticky;top:106px;z-index:2;background:#f6ecdf;box-shadow:0 6px 14px #5e405c12}.editor-workspace-canvas :deep(svg),.editor-workspace-canvas :deep(canvas){width:100%;max-height:38dvh;object-fit:contain}.editor-workspace-tools{max-height:48dvh;overflow-y:auto;overscroll-behavior:contain;padding:5px 4px 14px}.editor-mobile-footer{display:flex;align-items:center;gap:8px;padding:8px 10px;border-top:1px solid #d8bfcd}.editor-mobile-footer span{font-size:10px;line-height:1.6}.tools-collapsed .editor-workspace-tools{display:none}.tools-collapsed .editor-workspace-canvas :deep(svg),.tools-collapsed .editor-workspace-canvas :deep(canvas){max-height:65dvh}.is-fullscreen .editor-workspace-body{display:flex;flex-direction:column;gap:8px}.is-fullscreen .editor-workspace-canvas{position:static;flex-shrink:0;width:100%;overflow-y:auto;overscroll-behavior:contain;max-height:43%}.is-fullscreen .editor-workspace-canvas :deep(svg),.is-fullscreen .editor-workspace-canvas :deep(canvas){max-height:32dvh;width:100%;object-fit:contain}.is-fullscreen .editor-workspace-tools{flex:1;min-height:0;max-height:none;width:100%}.is-fullscreen.tools-collapsed .editor-workspace-canvas{max-height:none;flex:1}.is-fullscreen.tools-collapsed .editor-workspace-canvas :deep(svg),.is-fullscreen.tools-collapsed .editor-workspace-canvas :deep(canvas){max-height:70dvh}.editor-workspace-actions{margin-top:4px}.editor-workspace-actions :deep(button){min-height:44px}.editor-workspace-actions :deep(.pg-small){font-size:11px}.is-fullscreen:has(input:focus,textarea:focus) .editor-workspace-canvas{max-height:26%}.is-fullscreen:has(input:focus,textarea:focus) .editor-workspace-canvas :deep(svg),.is-fullscreen:has(input:focus,textarea:focus) .editor-workspace-canvas :deep(canvas){max-height:19dvh}}
@media(max-width:440px){.editor-workspace-bar{flex-wrap:wrap}.editor-workspace-bar strong{max-width:none;flex-basis:100%;font-size:11px}.editor-workspace-bar>div{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.editor-workspace-bar button{font-size:11px;padding-inline:4px;white-space:nowrap}}
@media(max-height:500px) and (orientation:landscape){.editor-workspace-body{display:grid!important;grid-template-columns:minmax(0,1.2fr) minmax(220px,1fr);overflow:hidden}.editor-workspace-canvas{max-height:100%!important;position:static}.editor-workspace-canvas :deep(svg),.editor-workspace-canvas :deep(canvas){max-height:calc(100dvh - 130px)!important}.editor-workspace-tools{max-height:calc(100dvh - 130px)!important;overflow:auto}.editor-mobile-footer{padding-block:2px}.editor-mobile-footer span{display:none}}
</style>
