<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { galleryManager } from '../../services/galleryManagement.js';
import { cloudImage } from '../../services/galleryCloud.js';
import { galleryCategoryOptions } from '../../services/galleryMetadata.js';
import GalleryMetadataFields from './GalleryMetadataFields.vue';
const emit = defineEmits(['changed']);
const rows = ref([]); const page = ref(1); const count = ref(0); const query = ref(''); const category = ref('all'); const published = ref('all');
const busy = ref(false); const saving = ref(false); const message = ref(''); const error = ref(''); const editing = ref(''); const draft = reactive({});
let revision = 0;
const pages = computed(() => Math.max(1,Math.ceil(count.value/12)));
async function load(reset=false) {
  if (reset) page.value = 1;
  const request = ++revision; busy.value = true; error.value = '';
  try {
    const result = await galleryManager.list({ page:page.value, query:query.value, category:category.value, published:published.value });
    if (request !== revision) return;
    rows.value=result.rows; count.value=result.count;
  } catch(cause) { if(request===revision) error.value=`无法读取已发布列表：${cause?.message || '请检查网络与迁移配置。'}`; }
  finally { if(request===revision) busy.value=false; }
}
function edit(row) { editing.value=row.id; Object.assign(draft,{...row,tags:row.tags || [],characters:row.characters ?? null,category:row.category || 'collection'}); }
async function save(row, override={}) {
  if(saving.value) return;
  saving.value=true; error.value=''; message.value='正在保存…';
  try {
    await galleryManager.update(row.id,{...row,...override});
    window.dispatchEvent(new Event('hitori:gallery-changed')); emit('changed');
    message.value = override.published === false ? '已从收藏墙下架，编号与收藏记录保留。' : override.published === true ? '已恢复展示，原有收藏和分享链接继续有效。' : '图片信息已保存。';
    editing.value=''; await load();
  } catch(cause) { error.value=cause?.message || '保存失败，请重试。'; message.value=''; }
  finally { saving.value=false; }
}
onMounted(load);
</script>
<template>
<section class="gallery-workbench" aria-labelledby="published-heading">
  <h2 id="published-heading">已发布图片</h2><p>这里管理云端上传的图片。仓库静态素材请在代码仓库维护，此处不显示无效的编辑按钮。下架仅移出展示，不删除存储原图。</p>
  <form class="workbench-filters" @submit.prevent="load(true)"><label>搜索标题、描述、作者与来源<input v-model="query" type="search" maxlength="100" placeholder="寻找一张收藏"></label><label>状态<select v-model="published"><option value="all">全部状态</option><option value="published">展示中</option><option value="hidden">已下架</option></select></label><label>分类<select v-model="category"><option value="all">全部分类</option><option v-for="item in galleryCategoryOptions" :key="item.id" :value="item.id">{{ item.label }}</option></select></label><button :disabled="busy">搜索</button></form>
  <p v-if="busy" role="status">正在读取图片…当前列表保留。</p><p v-if="error" role="alert" class="workbench-error">{{ error }} <button type="button" @click="load()">重试</button></p><p v-if="message" role="status">{{ message }}</p>
  <p v-if="!rows.length && !busy && !error" class="workbench-empty">{{ query || category!=='all' || published!=='all' ? '没有符合条件的图片，试着换一组筛选。' : '还没有云端图片，去上传队列添上第一张吧。' }}</p>
  <ol class="published-list"><li v-for="row in rows" :key="row.id"><img :src="cloudImage(row)?.thumbnail" :alt="row.alt || row.title" loading="lazy"><div class="published-details"><h3>{{ row.title }}</h3><p>{{ row.published === false ? '已下架' : '展示中' }} · 顺序 {{ row.sort_order || 0 }} · {{ row.width }} × {{ row.height }}</p><small class="image-id">cloud-{{ row.id }}</small><div class="workbench-actions"><button type="button" :disabled="saving" @click="edit(row)">编辑信息与顺序</button><button type="button" :disabled="saving" @click="save(row,{published:row.published===false})">{{ row.published === false ? '恢复展示' : '下架' }}</button></div></div>
    <form v-if="editing===row.id" class="edit-image" @submit.prevent="save(draft)"><GalleryMetadataFields :model="draft" :prefix="`edit-${row.id}`" :disabled="saving"/><label>展示顺序（数字越小越靠前）<input v-model.number="draft.sort_order" type="number" min="-1000000" max="1000000" step="1" :disabled="saving"></label><div class="workbench-actions"><button :disabled="saving">{{ saving ? '正在保存…' : '保存修改' }}</button><button type="button" :disabled="saving" @click="editing=''">取消编辑</button></div></form>
  </li></ol>
  <nav class="workbench-pagination" aria-label="已发布图片分页"><button type="button" :disabled="page<=1 || busy" @click="page--;load()">上一页</button><span>第 {{ page }} / {{ pages }} 页，共 {{ count }} 张</span><button type="button" :disabled="page>=pages || busy" @click="page++;load()">下一页</button></nav>
</section>
</template>
<style scoped>
.gallery-workbench{min-width:0}.gallery-workbench h2{font-size:25px;margin:16px 0}.gallery-workbench>p{font-size:13px;line-height:1.8}.workbench-filters{display:flex;align-items:end;flex-wrap:wrap;gap:12px;margin:24px 0}.workbench-filters label:first-child{flex:1;min-width:min(100%,260px)}label{display:grid;gap:8px;font-size:13px;font-weight:700}input,select{min-width:0;min-height:44px;padding:10px;background:#fffcf5;border:1px solid #b8a491;color:#493b47;font:inherit;font-size:16px}button{min-height:44px;padding:10px 15px;background:#663e55;color:#fff8ee;border:1px solid #663e55;font:inherit;font-size:14px;cursor:pointer}button:disabled{opacity:.5}.published-list{padding:0;list-style:none;display:grid;gap:18px}.published-list>li{display:grid;grid-template-columns:100px minmax(0,1fr);gap:18px;padding:18px;background:#fff8ef;border:1px solid #ceb6bf}.published-list img{width:100px;height:100px;object-fit:contain;background:#eddfd7}.published-details{min-width:0;overflow-wrap:anywhere}.published-details h3{font-size:18px;margin:0 0 8px}.published-details p{font-size:13px}.image-id{user-select:all}.published-details small{font-size:11px;color:#776271}.workbench-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.edit-image{grid-column:1/-1;padding-top:18px;border-top:1px dashed #bda4ae}.edit-image>label{margin-top:18px}.workbench-pagination{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;font-size:13px}.workbench-error{color:#9b2449}.workbench-empty{padding:24px;background:#eddfd7}@media(max-width:500px){.published-list>li{grid-template-columns:65px minmax(0,1fr);padding:12px;gap:12px}.published-list img{width:65px;height:85px}.workbench-filters label{flex:1;min-width:120px}.workbench-filters label:first-child{flex-basis:100%;min-width:0}}
</style>
