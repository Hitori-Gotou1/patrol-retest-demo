<script setup>
import '../../styles/review-folio.css';
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { galleryImages } from '../../data/gallery.js';
import { withAttribution } from '../../data/galleryAttributions.js';
import registry from '../../data/gallery-attributions.json' with { type:'json' };
import { downloadJson,loadLocal,saveLocal } from '../../room/storage.js';
import { httpsLink } from '../../services/safeMedia.js';
import { assetUrl } from '../../data/site.js';

const draftKey = 'hitori-room:source-draft:v1';
const route = useRoute();
const query = ref(''), creator = ref('all'), message = ref(''), selected = ref('');
const view = ref('records'), draftFields = ref(null), draftInput = ref(null);
const images = galleryImages.map(withAttribution);
const byId = new Map(images.map(image => [image.id,image]));
const creators = [...new Set(images.map(image => image.creator).filter(Boolean))];
const confirmed = images.filter(image => image.creator).length;
const rows = computed(() => {
  const term = query.value.trim().normalize('NFKC').toLowerCase();
  return images.filter(image => (creator.value==='all' || (creator.value==='pending' ? !image.creator : image.creator===creator.value))
    && [image.title,image.creator,image.credit,image.method,image.note,image.id].join(' ').normalize('NFKC').toLowerCase().includes(term));
});
const activeRecord = computed(() => typeof route.query.source==='string' ? byId.get(route.query.source) : undefined);
const draft = ref(loadLocal(draftKey,{},value => value && typeof value==='object' && !Array.isArray(value) ? value : {}));
const creatorName = ref(''), original = ref(''), profile = ref('');
const method = image => image.method.replace(/^AI生成/,'AI 生成');
const host = url => url ? new URL(url).hostname : '';
watch(activeRecord,entry => {
  if (!entry) return;
  view.value = 'records';
  creator.value = 'all';
  query.value = entry.title;
}, { immediate:true });

function choose() {
  const record = draft.value[selected.value] || registry[selected.value] || {};
  creatorName.value = record.creator || '';
  original.value = record.sourceUrl || '';
  profile.value = record.creatorUrl || '';
  message.value = '';
}
async function startDraft(id) {
  selected.value = id;
  choose();
  view.value = 'draft';
  await nextTick();
  draftInput.value?.focus({ preventScroll:true });
  draftFields.value?.scrollIntoView({ block:'nearest' });
}
function save() {
  try {
    if (!byId.has(selected.value)) throw new Error('先选择图片。');
    if (!creatorName.value.trim()) throw new Error('先填写核实后的作者名。');
    const sourceUrl = httpsLink(original.value);
    const creatorUrl = httpsLink(profile.value);
    if (!sourceUrl) throw new Error('请填写原作的 HTTPS 发布链接。');
    if (profile.value && !creatorUrl) throw new Error('画师主页需要 HTTPS 链接。');
    draft.value = { ...draft.value,[selected.value]:{
      creator:creatorName.value.trim().slice(0,100), sourceUrl, creatorUrl, status:'documented',
      method:'站主整理的原作来源', note:'请在发布前核对原发布页的署名。'
    } };
    if (!saveLocal(draftKey,draft.value)) throw new Error('草稿未能保存，请先导出来源表。');
    message.value = '这条来源草稿已保存在本机。';
  } catch (error) { message.value = error.message; }
}
function exportRegistry() {
  downloadJson({ ...registry,...draft.value },'hitori-gallery-attributions.json');
  message.value = '已导出来源表，供站主核对并更新公开档案。';
}
</script>

<template>
  <section class="room-panel review-folio source-archive" aria-labelledby="sources-title" :data-source-view="view">
    <h2 id="sources-title">收藏来源档案</h2>
    <p class="room-intro">已记录来源{{ confirmed }}张，原作者待确认{{ images.length-confirmed }}张。每张收藏沿用原有署名与水印说明。</p>
    <div class="source-switch" role="group" aria-label="选择资料夹">
      <button type="button" :aria-pressed="view==='records'" @click="view='records'">已发布资料</button>
      <button type="button" :aria-pressed="view==='draft'" @click="view='draft'">本机草稿</button>
    </div>
    <div class="source-library">
      <section class="source-records" aria-labelledby="record-folder-title">
        <div class="source-folder-head"><h3 id="record-folder-title">已发布资料</h3><span aria-live="polite">找到 {{ rows.length }} 张</span></div>
        <div class="source-query">
          <label class="room-field">找图片或画师<input v-model="query" type="search" placeholder="搜索标题、作者或来源" maxlength="100"></label>
          <label class="room-field">按画师浏览<select v-model="creator"><option value="all">全部画师与来源</option><option v-for="name in creators" :key="name" :value="name">{{ name }}</option><option value="pending">原作者待确认</option></select></label>
        </div>
        <div v-if="rows.length" class="resource-grid">
          <article v-for="image in rows" :key="image.id" class="resource-card source-card" :data-source-id="image.id">
            <details :open="activeRecord?.id===image.id">
              <summary>
                <img :src="assetUrl(image.thumbnail || image.src)" alt="" width="72" height="55" loading="lazy">
                <span class="source-tab">
                  <strong>{{ image.title }}</strong><small>{{ method(image) }}</small>
                  <span>{{ image.sourceUrl ? host(image.sourceUrl) : (image.creator || '原作者待确认') }}</span>
                </span>
                <span class="file-arrow" aria-hidden="true">⌄</span>
              </summary>
              <div class="source-details">
                <dl><div><dt>署名</dt><dd>{{ image.creator || '原作者待确认' }}</dd></div>
                  <div><dt>来源记录</dt><dd>{{ image.credit || method(image) }}</dd></div>
                  <div><dt>画面与水印</dt><dd>{{ image.note }}</dd></div></dl>
                <div class="resource-actions">
                  <a v-if="image.sourceUrl" :href="image.sourceUrl" target="_blank" rel="noopener noreferrer">原作发布页 ↗</a>
                  <a v-if="image.creatorUrl" :href="image.creatorUrl" target="_blank" rel="noopener noreferrer">画师主页 ↗</a>
                  <RouterLink :to="{ path:'/',query:{ image:image.id },hash:'#gallery' }">在收藏墙查看 ↗</RouterLink>
                  <button type="button" @click="startDraft(image.id)">补录这条来源</button>
                </div>
              </div>
            </details>
          </article>
        </div>
        <p v-else class="source-empty" role="status">这次没有找到相关资料。可以清空关键词，或换一个画师。</p>
      </section>
      <section ref="draftFields" class="source-drafts" aria-labelledby="draft-folder-title">
        <div class="source-folder-head"><h3 id="draft-folder-title">站主整理来源表</h3><span>{{ Object.keys(draft).length }} 条本机草稿</span></div>
        <p>补录只保存在这台设备。导出来源表后，可以核对并更新已发布档案。</p>
        <div class="source-form">
          <label class="room-field">选择收藏<select v-model="selected" @change="choose"><option value="">请选择图片</option><option v-for="image in images" :key="image.id" :value="image.id">{{ image.title }} · {{ image.id }}</option></select></label>
          <span v-if="selected && draft[selected]" class="draft-badge">当前读到的是已保存的本机草稿</span>
          <label class="room-field">画师 / 原作者<input ref="draftInput" v-model="creatorName" maxlength="100"></label>
          <label class="room-field">原作发布链接<input v-model="original" type="url" maxlength="1000"></label>
          <label class="room-field">画师主页（选填）<input v-model="profile" type="url" maxlength="1000"></label>
          <div class="room-actions"><button type="button" @click="save">保存来源草稿</button><button type="button" @click="exportRegistry">导出来源表 JSON</button></div>
        </div>
        <p class="room-status" role="status">{{ message }}</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.source-library { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(250px,.75fr); gap:clamp(10px,2vw,20px); align-items:start; }
.source-records,.source-drafts { min-width:0; background:#f1dfcd; border:1px solid #b89a9e; }
.source-folder-head { display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:4px 8px; padding:9px 12px; background:#e2c8d4; color:#53384e; }
.source-folder-head h3 { margin:0; font-size:17px; color:inherit; }
.source-folder-head span { font-size:11px; }
.source-query { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); padding:8px 10px; gap:7px; }
.source-query :is(input,select), .source-form :is(input,select) { min-width:0; width:100%; min-height:44px; }
.source-archive .resource-grid { display:grid; grid-template-columns:minmax(0,1fr); gap:5px; padding:0 7px 8px; margin:0; }
.source-archive .source-card { min-width:0; padding:0; background:#fff7e8; border:1px solid #cdb0b3; }
.source-card summary { display:grid; grid-template-columns:70px minmax(0,1fr) auto; gap:8px; align-items:center; min-height:65px; padding:5px; list-style:none; cursor:pointer; }
.source-card summary::-webkit-details-marker { display:none; }
.source-card summary img { width:70px; height:54px; object-fit:contain; background:#eddccd; }
.source-tab { display:grid; min-width:0; gap:2px; overflow-wrap:anywhere; }
.source-tab strong { color:#4f354b; font-size:14px; }
.source-tab small { color:#6c435c; font-size:11px; font-weight:700; }
.source-tab>span { color:#644d60; font-size:11px; }
.file-arrow { color:#775069; padding-inline:6px; }
details[open] .file-arrow { transform:rotate(180deg); }
.source-details { border-top:1px dashed #b69a9f; padding:8px 10px; }
.source-details dl { margin:0; display:grid; gap:6px; font-size:12px; }
.source-details dl>div { display:grid; grid-template-columns:70px minmax(0,1fr); gap:5px; color:#624455; }
.source-details dd { margin:0; min-width:0; overflow-wrap:anywhere; }
.source-details .resource-actions { display:flex; flex-wrap:wrap; gap:4px 9px; margin-top:7px; }
.source-details .resource-actions :is(a,button) { display:inline-flex; align-items:center; min-height:44px; color:#6a3f5b; font-size:11px; }
.source-drafts>p { margin:9px 12px; color:#644755; font-size:12px; }
.source-form { padding:0 12px 8px; display:grid; gap:5px; }
.draft-badge { padding:4px 6px; background:#e2c8d4; color:#62415a; font-size:11px; }
.source-switch { display:none; }
.source-empty { margin:0; padding:14px; }
@media(max-width:740px) {
  .source-library { grid-template-columns:minmax(0,1fr); }
  .source-switch { display:flex; flex-wrap:wrap; gap:6px; margin:9px 0; }
  .source-switch button[aria-pressed=true] { background:#77526c; color:#fff6eb; }
  .source-archive[data-source-view=records] .source-drafts,.source-archive[data-source-view=draft] .source-records { display:none; }
  .source-card summary { grid-template-columns:53px minmax(0,1fr) auto; gap:5px; }
  .source-card summary img { width:53px; height:48px; }
  .source-query { gap:5px; padding:8px 6px; }
}
</style>
