<script setup>
import PhotoSet from './PhotoSet.vue';
import EditorWorkspace from '../tools/EditorWorkspace.vue';
import TemplateLibrary from '../tools/TemplateLibrary.vue';
import { recordActivity } from '../../room/activityLog.js';
import { computed, ref } from 'vue';
import { cast, stickers, photoCaptionFonts, photoThemes } from '../../data/playroom.js';
import { defaultPhoto, validatePhoto } from '../../room/playroom.js';
import { useLocalDraft } from '../../composables/useLocalDraft.js';
import { useStageEditor } from '../../composables/useStageEditor.js';
import { downloadStage } from '../../room/exportImage.js';
const { state, saved, persist } = useLocalDraft('hitori-room:photobooth:v1', defaultPhoto, validatePhoto);
const stage = ref(null), busy = ref(false), message = ref(''), undo = ref(null);
const prints = ref(0);
const objects = computed(() => state.value.objects);
const theme = computed(() => photoThemes.find(t => t.id === state.value.theme));
const captionFont = computed(() => photoCaptionFonts.find(font => font.id === state.value.captionFont) || photoCaptionFonts[0]);
const editor = useStageEditor(stage, objects, { width: 720, height: 900, minY: 140, maxY: 720 });
const selected = computed(() => objects.value.find(o => o.key === editor.selectedKey.value));
const character = item => cast.find(c => c.id === item.id);
const sticker = item => stickers.find(c => c.id === item.id);
const objectLabel = item => character(item)?.name || sticker(item)?.name || '贴纸';
const asset = path => `${import.meta.env.BASE_URL}${path}`;
function chooseCaptionFont(id) {
  if (id === photoCaptionFonts[0].id) delete state.value.captionFont;
  else state.value.captionFont = id;
}
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
    <EditorWorkspace class="photo-workspace" title="拍贴编辑" :save-label="busy ? '冲洗中…' : '保存合影 PNG'" save-id="photo-export" :saving="busy" toolbar-tools @save="exportPhoto"><template #canvas>
      <div class="room-console photo-preview">
        <div class="photo-paper">
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
            <text x="360" y="813" text-anchor="middle" :fill="theme.ink" :font-size="state.caption.length > 24 ? 19 : state.caption.length > 17 ? 25 : 31" :font-family="captionFont.family" font-weight="600">{{ state.caption }}</text>
            <text x="360" y="857" text-anchor="middle" :fill="theme.ink" font-size="11" letter-spacing="3" font-family="monospace">FOUR COLORS, ONE LITTLE MEMORY.</text>
            <g :fill="theme.accent"><circle v-for="i in 4" :key="i" :cx="326+i*14" cy="82" r="3"/></g>
          </svg>
        </div>
        <div class="photo-output" aria-hidden="true">
          <span v-if="prints" :key="prints"></span>
        </div>
        <div class="play-toolbar photo-themes" aria-label="选择取景地"><button v-for="item in photoThemes" :key="item.id" type="button" :aria-pressed="state.theme === item.id" @click="state.theme=item.id">{{ item.label }}</button></div>
        <p class="photo-status" role="status">{{ message }}</p>
      </div></template><template #tools>
      <div class="play-settings">
        <h3 class="play-subheading">谁来入镜？</h3><div class="play-palette"><button v-for="person in cast" :key="person.id" type="button" :aria-pressed="objects.some(o=>o.id===person.id)" :class="{ 'is-editing': selected?.id === person.id }" @click="toggleCast(person)"><img :src="asset(person.thumbnail || person.image)" alt="" width="52" height="52">{{ person.name }}</button></div>
        <h3 class="play-subheading">加一点小心情</h3><div class="play-toolbar"><button v-for="item in stickers" :key="item.id" type="button" :aria-label="`添加${item.name}贴纸`" :class="{ 'is-editing': selected?.id === item.id }" @click="add(item.id)">{{ item.text }}</button></div>
        <label class="room-field" for="photo-caption">相片上的一句话<input id="photo-caption" v-model="state.caption" maxlength="36"></label>
        <div class="play-toolbar photo-fonts" role="group" aria-label="相片文字字体">
          <button v-for="font in photoCaptionFonts" :key="font.id" type="button" :aria-label="`相片文字字体：${font.label}`" :aria-pressed="captionFont.id === font.id" @click="chooseCaptionFont(font.id)">{{ font.label }}</button>
        </div>
        <label class="room-field" for="photo-object">选择画面里的元素<select id="photo-object" v-model="editor.selectedKey.value"><option value="">选择成员或贴纸</option><option v-for="(item,index) in objects" :key="item.key" :value="item.key">{{index+1}} / {{objectLabel(item)}}</option></select></label>
        <div v-if="selected" class="play-editor-controls"><strong>正在调整：{{ objectLabel(selected) }}</strong><div class="room-fields"><label>大小<input v-model.number="selected.size" class="play-range" type="range" min="32" max="420"></label><label>角度<input v-model.number="selected.rotation" class="play-range" type="range" min="-30" max="30"></label></div><div class="play-movement"><button v-for="[label,key] in [['←','ArrowLeft'],['↑','ArrowUp'],['↓','ArrowDown'],['→','ArrowRight']]" :key="key" type="button" :aria-label="`向${{'ArrowLeft':'左','ArrowUp':'上','ArrowDown':'下','ArrowRight':'右'}[key]}移动`" @click="editor.key({key,preventDefault(){}},selected)">{{ label }}</button><button type="button" @click="front">移到最前</button><button type="button" @click="editor.remove">移走</button></div></div>
        <p v-else class="play-empty-selection">轻点画布里的成员或贴纸，就能调整大小、角度和前后顺序。</p>
        <div class="play-toolbar"><button type="button" @click="reset">重新布置</button><button v-if="undo" type="button" @click="restore">撤销重置</button></div>
        <p class="play-footer-note">{{ saved ? '编辑自动保存在这台设备。' : '浏览器无法保存草稿，请保存 PNG 留下合影。' }} 人物素材沿用站主提供的 Q 版图。</p>
      </div></template>
    </EditorWorkspace>
    <TemplateLibrary tool="photobooth" :current="state" @apply="state=$event;editor.selectedKey.value=''"/>
  </section>
</template>

<style scoped>
.photo-room.room-panel { background: var(--room-paper); border-color: var(--room-paper-edge); }
.photo-room .activity-title { margin-bottom: 1rem; }
.photo-workspace { margin-top: 0; border-color: var(--room-paper-edge); background: var(--room-paper); }
.photo-room :deep(.editor-workspace-bar) { border-color: var(--room-paper-edge); }
.photo-room :deep(.editor-save) { background: var(--room-berry); color: #fffaf5; border-color: var(--room-berry); font-weight: 700; }
.photo-room :deep(.editor-workspace-body) { grid-template-columns: minmax(0, 1.64fr) minmax(16rem, 1fr); gap: clamp(.6rem, 2vw, 1.35rem); }
.photo-room :deep(.tools-collapsed .editor-workspace-body) { grid-template-columns: minmax(0, 1fr); }
.photo-room :deep(.tools-collapsed .play-selected) { visibility: hidden; }
.photo-preview { display: grid; gap: .45rem; padding: clamp(.45rem, 1.8vw, 1.2rem); min-width: 0; }
.photo-paper {
  --photo-paper-limit: 28rem;
  --photo-paper-viewport-limit: 50dvh;
  width: min(100%, var(--photo-paper-limit), var(--photo-paper-viewport-limit));
  margin-inline: auto;
  padding: clamp(.2rem, .6vw, .38rem);
  background: #f4eee2;
  box-shadow: 0 6px 8px -4px #100d17b5;
}
.photo-room .photo-paper > svg { display: block; width: 100%; height: auto; max-height: none; background: transparent; box-shadow: none; color-scheme: light; }
.photo-output { width: min(68%, 17rem); height: 7px; position: relative; margin-inline: auto; border-radius: 2px; background: #19151f; border-top: 1px solid var(--room-console-top); }
.photo-output span { position: absolute; top: 1px; inset-inline: 9%; height: 10px; background: #ffeed9; border-bottom: 1px solid #ac8d80; transform-origin: top; animation: photo-out .48s ease-out both; }
.photo-themes { margin: .2rem 0 0; gap: .3rem; }
.photo-themes button { flex: 1 1 auto; min-height: 44px; font-size: .8125rem; padding: .25rem .4rem; color: var(--room-console-muted); border-color: var(--room-console-top); background: transparent; }
.photo-themes button[aria-pressed='true'] { color: var(--room-console-ink); background: #443744; border-color: var(--room-berry-light); font-weight: 700; }
.photo-status { margin: 0; font-size: .875rem; color: var(--room-console-muted); overflow-wrap: anywhere; }
.photo-status:empty { position: absolute; inline-size: 1px; block-size: 1px; clip-path: inset(50%); }
.photo-room .play-palette button[aria-pressed='true'] { color: var(--room-ink); background: #eee0df; border-color: #a78e99; }
.photo-room .play-settings button.is-editing,
.photo-room .photo-fonts button[aria-pressed='true'] { color: var(--room-berry); background: #f4dce6; border-color: var(--room-berry); font-weight: 700; }
.photo-room .play-toolbar button { min-width: 44px; }
.photo-fonts { margin: .4rem 0 .85rem; }
.photo-room :deep(.is-fullscreen .photo-paper) { --photo-paper-limit: 31rem; --photo-paper-viewport-limit: 56dvh; }
@keyframes photo-out { from { transform: scaleY(.1); } to { transform: scaleY(1); } }
@media (max-width: 47.5rem) {
  .photo-room :deep(.editor-workspace-body) { grid-template-columns: minmax(0, 1fr); }
  .photo-room :deep(.editor-workspace-canvas) { background: transparent; box-shadow: none; }
  .photo-paper { --photo-paper-limit: 15rem; --photo-paper-viewport-limit: 29dvh; }
  .photo-room :deep(.tools-collapsed .photo-paper) { --photo-paper-limit: 17rem; --photo-paper-viewport-limit: 35dvh; }
  .photo-room :deep(.is-fullscreen .photo-paper) { --photo-paper-limit: 15rem; --photo-paper-viewport-limit: 27.5dvh; }
  .photo-room :deep(.is-fullscreen .editor-workspace-canvas) { max-height: 55%; }
  .photo-room :deep(.tools-collapsed.is-fullscreen .photo-paper) { --photo-paper-limit: 23rem; --photo-paper-viewport-limit: 51dvh; }
  .photo-room :deep(.is-fullscreen:has(input:focus, textarea:focus) .photo-paper) { --photo-paper-viewport-limit: 16dvh; }
}
@media (max-width: 27.5rem) {
  .photo-room :deep(.editor-workspace-bar > strong) { display: none; }
  .photo-room :deep(.editor-workspace-bar > div) { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .photo-room :deep(.editor-workspace-bar button) { white-space: normal; overflow-wrap: anywhere; }
}
@media (max-width: 22rem) {
  .photo-room :deep(.editor-workspace-bar > div) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-height: 31.25rem) and (orientation: landscape) {
  .photo-room :deep(.tools-collapsed.is-fullscreen .editor-workspace-body) { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .photo-output span { animation: none; } }
</style>
