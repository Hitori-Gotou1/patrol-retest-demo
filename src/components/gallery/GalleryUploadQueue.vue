<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { galleryManager } from '../../services/galleryManagement.js';
import { galleryFileDigest } from '../../services/galleryImagePreparation.js';
import { createGalleryUploadQueue } from '../../services/galleryUploadQueue.js';
import { validateUploadFile, validateImageSignature } from '../../services/galleryUploadRules.js';
import GalleryMetadataFields from './GalleryMetadataFields.vue';
const emit = defineEmits(['busy', 'published']);
const tasks = reactive([]);
const status = ref('');
const error = ref('');
const adding = ref(false);
const revision = ref(0);
const input = ref(null);
const bulk = reactive({ category: 'collection', characters: [], tags: '', creator: '', source_url: '', credit: '' });
const bulkOpen = ref(false);
let alive = true;
const queue = createGalleryUploadQueue({ tasks, concurrency: matchMedia('(max-width: 700px)').matches ? 1 : 2,
  changed() { revision.value++; emit('busy', queue.active || adding.value); },
  async publish(task, onProgress) {
    const result = await galleryManager.publish({ file: task.file, ...task.meta, digest: task.digest, uploadId: task.id, onProgress });
    window.dispatchEvent(new Event('hitori:gallery-changed'));
    emit('published');
    return result;
  }
});
const pending = computed(() => { revision.value; return tasks.filter(task => task.status === 'queued').length; });
const completed = computed(() => tasks.filter(task => task.status === 'done').length);
const active = computed(() => { revision.value; return queue.active; });
const names = {queued:'等待开始', uploading:'正在发布', done:'已发布', failed:'失败，可单张重试', cancelled:'已取消'};
async function addFiles(files) {
  if (adding.value) return;
  queue.pause(); // Every new selection is reviewed before it starts publishing.
  adding.value = true; emit('busy', true); error.value = ''; status.value = '正在校验图片和内容指纹…';
  try {
    for (const file of [...files].slice(0, 50)) {
      if (!alive) break;
      try {
        validateUploadFile(file); await validateImageSignature(file);
        const digest = await galleryFileDigest(file);
        const same = tasks.find(task => task.digest === digest && task.status !== 'cancelled');
        if (same) { error.value += `「${file.name}」与队列中的「${same.file.name}」内容相同，已跳过。\n`; continue; }
        const cloud = await galleryManager.duplicate(digest);
        if (cloud) { error.value += `「${file.name}」已收录为「${cloud.title}」，请到已发布列表编辑或恢复。\n`; continue; }
        queue.add({ id: crypto.randomUUID(), file, digest, preview: URL.createObjectURL(file),
          meta: { title: file.name.replace(/\.[^.]+$/, '').slice(0,120), alt:'', ...JSON.parse(JSON.stringify(bulk)) } });
      } catch (cause) { error.value += `「${file.name}」：${cause?.message || '无法加入队列'}\n`; }
    }
    status.value = `队列中共 ${tasks.length} 张，检查每张信息后开始发布。`;
    if (files.length > 50) status.value += '每次最多加入 50 张，其余请分批加入。';
  } finally { adding.value = false; emit('busy', queue.active); if (input.value) input.value.value = ''; }
}
function bulkApply() {
  for (const task of tasks.filter(task => task.status === 'queued')) Object.assign(task.meta, JSON.parse(JSON.stringify(bulk)));
  status.value = `已将分类、角色、标签及来源信息应用到 ${pending.value} 张待上传图片；标题和描述保持各自内容。`;
}
function beforeUnload(event) {
  if (!queue.active && !adding.value && !pending.value) return;
  event.preventDefault(); event.returnValue = '';
}
window.addEventListener('beforeunload', beforeUnload);
onBeforeUnmount(() => { alive = false; queue.pause(); window.removeEventListener('beforeunload', beforeUnload); tasks.forEach(task => URL.revokeObjectURL(task.preview)); });
defineExpose({ hasUnfinished: () => queue.active || adding.value || tasks.some(task => task.status === 'queued') });
</script>
<template>
  <section class="upload-queue" aria-labelledby="upload-queue-heading" :aria-busy="adding || active">
    <h2 id="upload-queue-heading">把新的心动放进收藏</h2>
    <p>JPG / PNG / WebP，每张不超过 10 MB、4000 万像素。小屏一次处理一张，其他设备最多两张同时上传。</p>
    <div class="queue-drop" @dragover.prevent @drop.prevent="addFiles($event.dataTransfer.files)">
      <label for="gallery-upload-file">选择多张图片，或拖到这里</label>
      <input id="gallery-upload-file" ref="input" type="file" multiple accept="image/jpeg,image/png,image/webp" :disabled="adding" @change="addFiles($event.target.files)">
    </div>
    <div class="queue-toolbar"><button type="button" @click="bulkOpen = !bulkOpen" :aria-expanded="bulkOpen">批量填写分类与来源</button><button type="button" :disabled="!pending || adding" @click="queue.start()">开始发布 {{ pending }} 张</button><button type="button" :disabled="!active" @click="queue.pause()">暂停后续任务</button></div>
    <details v-if="bulkOpen" open class="bulk-metadata"><summary>批量信息仅应用到等待中的任务</summary><GalleryMetadataFields :model="bulk" prefix="bulk" /><button type="button" @click="bulkApply">应用到待上传图片</button><p>批量面板的标题与描述不会应用；请在每张卡片中填写。</p></details>
    <p v-if="status" role="status">{{ status }} 已发布 {{ completed }} 张。</p><p v-if="error" role="alert" class="queue-error">{{ error }}</p>
    <p v-if="!tasks.length" class="queue-empty">还没有待上传图片。每张都会先计算内容指纹，同名不同图也能正确区分。</p>
    <ol class="queue-list"><li v-for="(task,index) in tasks" :key="task.id" :class="`task-${task.status}`">
      <img :src="task.preview" :alt="task.meta.title || task.file.name" loading="lazy"><div class="task-content"><strong>{{ task.file.name }}</strong><small>{{ (task.file.size/1024/1024).toFixed(2) }} MB · {{ names[task.status] }}</small><p role="status">{{ task.progress }}</p>
      <details :open="tasks.length === 1 && task.status === 'queued'"><summary>编辑这张图片的信息</summary><GalleryMetadataFields :model="task.meta" :prefix="index===0 ? 'gallery-upload' : `upload-${task.id}`" :disabled="!['queued','failed'].includes(task.status)" /></details>
      <p v-if="task.error" role="alert" class="queue-error">{{ task.error }}</p><div class="task-buttons"><button v-if="task.status === 'failed'" type="button" @click="queue.retry(task.id); queue.start()">重试这张</button><button v-if="['queued','failed'].includes(task.status)" type="button" @click="queue.cancel(task.id)">取消这张</button></div></div>
    </li></ol>
  </section>
</template>
<style scoped>
.upload-queue{min-width:0}.upload-queue h2{font-size:25px;margin:16px 0}.upload-queue>p{font-size:13px;line-height:1.8}.queue-drop{padding:24px;border:2px dashed #af8e9f;background:#fff8ed;display:grid;gap:14px}.queue-drop label{font-weight:700}.queue-drop input{max-width:100%;font:inherit}.queue-toolbar,.task-buttons{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}button,input::file-selector-button{min-height:44px;padding:10px 16px;background:#663e55;color:#fff8ee;border:1px solid #663e55;font:inherit;font-size:14px;cursor:pointer}button:disabled{opacity:.5;cursor:default}.queue-list{list-style:none;padding:0;display:grid;gap:20px}.queue-list>li{display:grid;grid-template-columns:130px minmax(0,1fr);gap:20px;padding:20px;background:#fff9f0;border:1px solid #ccb4bd}.queue-list img{width:130px;max-height:160px;object-fit:contain;align-self:start;background:#eddfd7}.task-content{min-width:0;overflow-wrap:anywhere}.task-content small{display:block;margin-top:8px;color:#755f70}.task-content p{font-size:13px}.task-content summary{min-height:44px;padding:12px 0;font-size:14px;cursor:pointer}.queue-error{color:#9b2449;white-space:pre-line;line-height:1.8}.bulk-metadata{padding:20px;background:#eddfd7}.bulk-metadata summary{min-height:44px}.bulk-metadata button{margin-top:18px}.queue-empty{padding:30px;background:#eddfd7}.task-done{border-left:4px solid #618269!important}.task-failed{border-left:4px solid #ad4569!important}@media(max-width:560px){.queue-list>li{grid-template-columns:72px minmax(0,1fr);padding:12px;gap:12px}.queue-list img{width:72px}.queue-toolbar button{flex:1}.queue-drop{padding:18px}}
</style>
