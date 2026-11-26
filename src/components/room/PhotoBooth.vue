<script setup>
import PhotoSet from './PhotoSet.vue';
import EditorWorkspace from '../tools/EditorWorkspace.vue';
import TemplateLibrary from '../tools/TemplateLibrary.vue';
import { recordActivity } from '../../room/activityLog.js';
import { computed, ref } from 'vue';
import { cast, stickers, photoThemes } from '../../data/playroom.js';
import { defaultPhoto, validatePhoto } from '../../room/playroom.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { useStageEditor } from '../../composables/useStageEditor.js';
import { downloadStage } from '../../room/exportImage.js';
const { state, saved, persist } = useLocalDraft('hitori-room:photobooth:v1', defaultPhoto, validatePhoto);
const stage = ref(null), busy = ref(false), message = ref(''), undo = ref(null);
const prints = ref(0);
const objects = computed(() => state.value.objects);
const theme = computed(() => photoThemes.find(t => t.id === state.value.theme));
const editor = useStageEditor(stage, objects, { width: 720, height: 900, minY: 140, maxY: 720 });
const selected = computed(() => objects.value.find(o => o.key === editor.selectedKey.value));
const character = item => cast.find(c => c.id === item.id);
const sticker = item => stickers.find(c => c.id === item.id);
const objectLabel = item => character(item)?.name || sticker(item)?.name || '贴纸';
const asset = path => `${import.meta.env.BASE_URL}${path}`;
function toggleCast(person) {
  const existing = objects.value.findIndex(o => o.id === person.id);
  if (existing >= 0) { objects.value.splice(existing, 1); editor.selectedKey.value = ''; return; }
  add(person.id, 250);
}
function add(id, size = 115) {
  if (objects.value.length >= 20) { message.value = '画面最多放 20 个元素，先移走一张贴纸吧。'; return; }
  const item = { key: `${id}-${Date.now()}-${Math.floor(Math.random()*10000)}`, id, x: 360, y: size === 250 ? 470 : 220, size, rotation: 0 };
  objects.value.push(item); editor.selectedKey.value = item.key;
}
function front() { const i = objects.value.indexOf(selected.value); if (i >= 0) objects.value.push(...objects.value.splice(i, 1)); }
function reset() { undo.value = structuredClone(validatePhoto(state.value)); state.value = structuredClone(defaultPhoto); editor.selectedKey.value = ''; message.value = '已恢复最初的合影，可以撤销。'; }
function restore() { state.value = undo.value; undo.value = null; editor.selectedKey.value = ''; }
async function exportPhoto() {
  if (busy.value) return; busy.value = true; message.value = '正在冲洗这张合影…'; persist();
  try { await downloadStage(stage.value, 'hitori-room-photo.png'); prints.value++; message.value = '合影已生成，PNG 图片会保存到设备。'; recordActivity('photo',state.value.caption||'今天的合影',JSON.stringify(state.value)); }
  catch (error) { message.value = error.message; } finally { busy.value = false; }
}
</script>
<template>
  <section class="room-panel photo-room" aria-labelledby="photo-title">
    <header class="activity-title">
      <p class="play-eyebrow">小屋拍贴机</p>
      <h2 id="photo-title">这次，和大家一起入镜。</h2>
      <p class="room-intro">选一处取景地，把成员和贴纸拖进相纸里。</p>
    </header>
    <EditorWorkspace title="拍贴编辑" save-label="保存合影" @save="exportPhoto"><template #canvas>
      <div class="play-preview photo-preview">
        <svg ref="stage" class="play-editor-svg" viewBox="0 0 720 900" role="group" aria-label="合影编辑画布" @pointermove="editor.move" @pointerup="editor.up" @pointercancel="editor.up">
          <defs><clipPath id="photo-window"><rect x="32" y="108" width="656" height="650" rx="13"/></clipPath></defs>
          <rect width="720" height="900" :fill="theme.paper"/><rect x="14" y="14" width="692" height="872" fill="none" :stroke="theme.ink" stroke-width="2"/>
          <text x="42" y="58" :fill="theme.ink" font-family="monospace" font-size="13" letter-spacing="3">HITORI ROOM / PHOTO CLUB</text><text x="675" y="58" text-anchor="end" :fill="theme.ink" font-family="monospace" font-size="13">{{ theme.label }}</text>
          <g clip-path="url(#photo-window)">
            <PhotoSet :theme="state.theme"/>
            <g v-for="item in objects" :key="item.key" :transform="`translate(${item.x},${item.y}) rotate(${item.rotation})`" role="button" tabindex="0" :aria-label="`移动${objectLabel(item)}`" :aria-pressed="editor.selectedKey.value === item.key" @pointerdown="editor.down($event,item)" @keydown="editor.key($event,item)" @focus="editor.selectedKey.value = item.key">
              <rect :x="-item.size/2" :y="-item.size/2" :width="item.size" :height="item.size" fill="transparent"/>
              <image v-if="character(item)" :href="asset(character(item).image)" :x="-item.size/2" :y="-item.size/2" :width="item.size" :height="item.size" preserveAspectRatio="xMidYMid meet" style="pointer-events:none"/>
              <text v-else x="0" y="0" text-anchor="middle" dominant-baseline="middle" :fill="sticker(item).color" :font-size="item.size * (sticker(item).text.length > 4 ? .2 : sticker(item).text.length > 1 ? .32 : .8)" font-family="sans-serif" font-weight="800" style="pointer-events:none">{{ sticker(item).text }}</text>
              <rect v-show="editor.selectedKey.value === item.key" data-editor-only class="play-selected" :x="-item.size/2" :y="-item.size/2" :width="item.size" :height="item.size"/>
            </g>
          </g>
          <text x="360" y="813" text-anchor="middle" :fill="theme.ink" :font-size="state.caption.length > 24 ? 19 : state.caption.length > 17 ? 25 : 31" font-family="sans-serif" font-weight="600">{{ state.caption }}</text>
          <text x="360" y="857" text-anchor="middle" :fill="theme.ink" font-size="11" letter-spacing="3" font-family="monospace">FOUR COLORS, ONE LITTLE MEMORY.</text>
          <g :fill="theme.accent"><circle v-for="i in 4" :key="i" :cx="326+i*14" cy="82" r="3"/></g>
        </svg>
        <div class="photo-output" aria-hidden="true">
          <span v-if="prints" :key="prints"></span>
        </div>
        <div class="play-toolbar photo-themes" aria-label="选择取景地"><button v-for="item in photoThemes" :key="item.id" type="button" :aria-pressed="state.theme === item.id" @click="state.theme=item.id">{{ item.label }}</button></div>
        <div class="room-actions play-sticky-actions"><button id="photo-export" type="button" class="primary" :disabled="busy" @click="exportPhoto">{{ busy ? '冲洗中…' : '保存合影 PNG ↓' }}</button><span class="play-footer-note">1080 × 1350 · 适合分享</span></div>
      </div></template><template #tools>
      <div class="play-settings">
        <h3 class="play-subheading">谁来入镜？</h3><div class="play-palette"><button v-for="person in cast" :key="person.id" type="button" :aria-pressed="objects.some(o=>o.id===person.id)" @click="toggleCast(person)"><img :src="asset(person.thumbnail || person.image)" alt="" width="52" height="52">{{ person.name }}</button></div>
        <h3 class="play-subheading">加一点小心情</h3><div class="play-toolbar"><button v-for="item in stickers" :key="item.id" type="button" :aria-label="`添加${item.name}贴纸`" @click="add(item.id)">{{ item.text }}</button></div>
        <label class="room-field" for="photo-caption">相片上的一句话<input id="photo-caption" v-model="state.caption" maxlength="36"></label>
        <label class="room-field" for="photo-object">选择画面里的元素<select id="photo-object" v-model="editor.selectedKey.value"><option value="">选择成员或贴纸</option><option v-for="(item,index) in objects" :key="item.key" :value="item.key">{{index+1}} / {{objectLabel(item)}}</option></select></label>
        <div v-if="selected" class="play-editor-controls"><strong>正在调整：{{ objectLabel(selected) }}</strong><div class="room-fields"><label>大小<input v-model.number="selected.size" class="play-range" type="range" min="32" max="420"></label><label>角度<input v-model.number="selected.rotation" class="play-range" type="range" min="-30" max="30"></label></div><div class="play-movement"><button v-for="[label,key] in [['←','ArrowLeft'],['↑','ArrowUp'],['↓','ArrowDown'],['→','ArrowRight']]" :key="key" type="button" :aria-label="`向${{'ArrowLeft':'左','ArrowUp':'上','ArrowDown':'下','ArrowRight':'右'}[key]}移动`" @click="editor.key({key,preventDefault(){}},selected)">{{ label }}</button><button type="button" @click="front">移到最前</button><button type="button" @click="editor.remove">移走</button></div></div>
        <p v-else class="play-empty-selection">轻点画布里的成员或贴纸，就能调整大小、角度和前后顺序。</p>
        <div class="play-toolbar"><button type="button" @click="reset">重新布置</button><button v-if="undo" type="button" @click="restore">撤销重置</button></div>
        <p class="room-status" role="status">{{ message }}</p><p class="play-footer-note">{{ saved ? '编辑自动保存在这台设备。' : '浏览器无法保存草稿，请保存 PNG 留下合影。' }} 人物素材沿用站主提供的 Q 版图。</p>
      </div></template>
    </EditorWorkspace>
    <TemplateLibrary tool="photobooth" :current="state" @apply="state=$event;editor.selectedKey.value=''"/>
  </section>
</template>

<style scoped>
.photo-room :deep(.editor-workspace-body) { grid-template-columns:minmax(0,1fr) minmax(285px,1fr); }
.photo-room .photo-preview { background:#29242f; border:1px solid #554455; border-radius:6px; box-shadow:0 8px 20px #38233323; padding:14px clamp(12px,3vw,36px) 8px; max-width:none; }
.photo-room .photo-preview>svg { max-width:345px; margin-inline:auto; box-shadow:0 9px 12px #14111788; }
.photo-room .play-sticky-actions { color:#fff1dd; justify-content:center; }
.photo-room .play-sticky-actions .play-footer-note { color:#f1dfcf; }
.photo-output { width:min(70%,280px); height:8px; position:relative; margin:9px auto 0; border-radius:3px; background:#15111b; border-top:2px solid #776273; }
.photo-output span { position:absolute; top:1px; inset-inline:9%; height:11px; background:#ffeed9; border-bottom:1px solid #ac8d80; transform-origin:top; animation:photo-out .48s ease-out both; }
.photo-themes { margin:8px 0 0; gap:4px; }
.photo-themes button { flex:1 1 auto; min-height:44px; font-size:12px; padding:3px 8px; }
.photo-themes button[aria-pressed=true] { background:#ffd9b0; border-color:#f9e9ce; color:#3e3038; box-shadow:inset 0 -3px #9c6e6b; }
.photo-room .photo-preview .play-sticky-actions { position:static; margin:6px 0 0; padding:0; background:none; border:none; box-shadow:none; }
.photo-room .play-sticky-actions button { margin:0; }

@keyframes photo-out { from { transform:scaleY(.1); } to { transform:scaleY(1); } }
@media(max-width:760px) {
  .photo-room :deep(.editor-workspace-body) { grid-template-columns:minmax(0,1fr); }
  .photo-room .photo-preview { padding:7px 10px; }
  .photo-room .photo-preview>svg { max-height:27dvh; width:auto; max-width:100%; }
  .photo-room .play-sticky-actions { margin:4px 0 0; padding:0; }
  .photo-room .play-sticky-actions .play-footer-note { display:none; }
}
@media(prefers-reduced-motion:reduce) { .photo-output span { animation:none; } }
</style>
