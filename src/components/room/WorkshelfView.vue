<script setup>
import {computed,nextTick,onBeforeUnmount,onMounted,ref} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {readWorks,readDrafts,workTypes,removeWork,restoreWork,exportWorks,importWorks,maxWorks,updateWork,compareWorks,comparisonLabel,comparisonValue} from '../../room/workshelf.js';
import WorkCover from './WorkCover.vue';
import {downloadJson} from '../../room/storage.js';
const router=useRouter(),route=useRoute(),works=ref([]),drafts=ref([]),filter=ref('all'),query=ref(''),order=ref('new'),message=ref(''),removed=ref(null),fileInput=ref(null),busy=ref(false),editing=ref(''),editTitle=ref(''),editTags=ref(''),selected=ref([]);
let alive=true;
function refresh(){works.value=readWorks();drafts.value=readDrafts();selected.value=selected.value.filter(id=>works.value.some(w=>w.id===id));}
refresh();try{exportWorks();}catch(e){message.value=e.message;}
const visible=computed(()=>works.value.filter(w=>(filter.value==='all'||w.kind===filter.value)&&(w.title+' '+(w.tags||[]).join(' ')).toLowerCase().includes(query.value.trim().toLowerCase())).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(order.value==='old'?a.at-b.at:order.value==='title'?a.title.localeCompare(b.title,'zh-CN'):b.at-a.at)));
const kinds=computed(()=>[...new Set(works.value.map(w=>w.kind))]);
const compared=computed(()=>selected.value.map(id=>works.value.find(w=>w.id===id)).filter(Boolean));
const differences=computed(()=>compared.value.length===2&&compared.value[0].kind===compared.value[1].kind?compareWorks(...compared.value):[]);
const formatDate=at=>new Date(at).toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
async function open(work){try{await router.push(restoreWork(work.id));}catch(e){message.value=e.message;}}
function remove(work){try{removed.value=removeWork(work.id);message.value='已移出作品架，编辑页草稿保留，可以撤销。';refresh();}catch(e){message.value=e.message;}}
function undo(){try{importWorks(JSON.stringify({version:1,works:[removed.value]}));removed.value=null;message.value='作品已放回原位。';refresh();}catch(e){message.value=e.message;}}
function backup(){try{downloadJson(exportWorks(),'hitori-workshelf-backup.json');message.value='已导出作品、预览和编辑数据，可在另一台设备导入。';}catch(e){message.value=e.message;}}
async function importFile(event){const file=event.target.files?.[0];if(!file||busy.value)return;busy.value=true;try{if(file.size>5*1024*1024)throw new Error('备份不能超过5MiB。');const text=await file.text();if(!alive)return;const count=importWorks(text);message.value=`已合并 ${count} 个新版本，原作品和草稿都保留。`;refresh();}catch(e){if(alive)message.value=e.message;}finally{if(alive){busy.value=false;event.target.value='';}}}
function edit(w){editing.value=w.id;editTitle.value=w.title;editTags.value=(w.tags||[]).join('，');}
function saveMeta(w){try{updateWork(w.id,{title:editTitle.value,tags:editTags.value.split(/[,，]/).map(t=>t.trim()).filter(Boolean)});editing.value='';message.value='作品名称和标签已保存，画面与原版本时间保留。';refresh();}catch(e){message.value=e.message;}}
function pin(w){try{updateWork(w.id,{pinned:!w.pinned});refresh();}catch(e){message.value=e.message;}}
function choose(work, event) {
  if (selected.value.includes(work.id)) {
    selected.value = selected.value.filter(id => id !== work.id);
    return;
  }
  if (selected.value.length >= 2 || (compared.value[0] && compared.value[0].kind !== work.kind)) {
    message.value = selected.value.length >= 2 ? '每次选择两个版本对比，先取消一个。' : '请选择同一类型的两个版本。';
    event.target.checked = false;
    return;
  }
  selected.value.push(work.id);
}
function closeMenu(event, focus = true) {
  const menu = event.target.closest('details');
  if (!menu) return;
  menu.open = false;
  if (focus) menu.querySelector('summary')?.focus();
}
function organize(work, event) {
  closeMenu(event, false);
  edit(work);
  nextTick(() => document.getElementById('work-title-' + work.id)?.focus());
}
function downloadPreview(work) {
  const type = work.preview.slice(11, work.preview.indexOf(';'));
  return `hitori-work-${work.id}.${type}`;
}
onMounted(()=>{window.addEventListener('storage',refresh);window.addEventListener('hitori:works-changed',refresh);if(route.query.work)document.querySelector(`[data-work-id="${CSS.escape(String(route.query.work))}"]`)?.scrollIntoView({block:'center'});});
onBeforeUnmount(()=>{alive=false;window.removeEventListener('storage',refresh);window.removeEventListener('hitori:works-changed',refresh);});
</script>
<template>
  <section class="room-panel workshelf" aria-labelledby="works-title">
    <header class="activity-title works-header">
      <p class="play-eyebrow">我的作品架</p>
      <h2 id="works-title">那些由你完成的瞬间</h2>
      <p class="room-intro">{{ works.length }} / {{ maxWorks }} 个版本</p>
    </header>
    <div v-if="works.length" class="works-tools">
      <div class="rich-toolbar">
        <label class="room-field">查找作品<input v-model="query" type="search" placeholder="搜索作品名称或标签" maxlength="100"></label>
        <label class="room-field">排序<select v-model="order"><option value="new">新版本优先</option><option value="old">旧版本优先</option><option value="title">按作品名称</option></select></label>
      </div>
      <div class="activity-filters" aria-label="筛选作品">
        <button type="button" :aria-pressed="filter === 'all'" @click="filter = 'all'">全部作品</button>
        <button v-for="kind in kinds" :key="kind" type="button" :aria-pressed="filter === kind" @click="filter = kind">{{ workTypes[kind].label }}</button>
      </div>
    </div>
    <p class="room-status works-notice" role="status">{{ message }}</p>
    <button v-if="removed" type="button" @click="undo">撤销移出</button>
    <section v-if="selected.length" class="work-compare-panel" aria-labelledby="compare-title">
      <div class="room-actions compare-heading"><h3 id="compare-title">版本对比 · {{ selected.length }} / 2</h3><button type="button" @click="selected = []">清空对比选择</button></div>
      <p v-if="selected.length === 1">再选择一个同类型版本，可以并排看预览与修改。</p>
      <template v-else>
        <div class="compare-grid">
          <div v-for="work in compared" :key="work.id">
            <WorkCover :work="work"/><h4>{{ work.title }}</h4><p>{{ formatDate(work.at) }}</p>
          </div>
        </div>
        <p>{{ differences.length ? `发现${differences.length}${differences.length === 40 ? '处以上' : '处'}修改` : '两个版本的编辑数据相同。' }}</p>
        <div v-if="differences.length" class="compare-table-wrap">
          <table>
            <thead><tr><th scope="col">修改位置</th><th scope="col">{{ compared[0].title }}</th><th scope="col">{{ compared[1].title }}</th></tr></thead>
            <tbody><tr v-for="change in differences" :key="change.path">
              <th scope="row">{{ comparisonLabel(change.path) }}</th>
              <td>{{ comparisonValue(change.before, change.path) }}</td><td>{{ comparisonValue(change.after, change.path) }}</td>
            </tr></tbody>
          </table>
        </div>
      </template>
    </section>
    <div v-if="visible.length" class="works-grid">
      <article v-for="work in visible" :key="work.id" class="work-card" :class="{ 'is-pinned': work.pinned }" :data-work-id="work.id">
        <WorkCover :work="work"/>
        <div class="work-copy">
          <p class="work-meta">{{ work.pinned ? '★ 置顶 · ' : '' }}{{ workTypes[work.kind].label }} · <time :datetime="new Date(work.at).toISOString()">{{ formatDate(work.at) }}</time></p>
          <h3>{{ work.title }}</h3>
          <p v-if="work.tags.length" class="work-tags">{{ work.tags.map(tag => '#' + tag).join(' ') }}</p>
          <div class="work-card-actions">
            <button type="button" class="primary" @click="open(work)">继续编辑 →</button>
            <label class="room-check"><input type="checkbox" :checked="selected.includes(work.id)" @change="choose(work, $event)">对比此版本</label>
            <details class="work-menu" @keydown.esc.stop.prevent="closeMenu">
              <summary>更多 <span aria-hidden="true">⌄</span></summary>
              <div class="work-menu-options">
                <button type="button" @click="organize(work, $event)">整理</button>
                <button type="button" @click="closeMenu($event); pin(work)">{{ work.pinned ? '取消置顶' : '置顶' }}</button>
                <button type="button" @click="closeMenu($event); downloadJson({ version:1, works:[work] }, 'hitori-work.json')">备份此版本</button>
                <a v-if="work.preview" :href="work.preview" :download="downloadPreview(work)" @click="closeMenu($event)">保存预览 ↓</a>
                <button type="button" @click="remove(work)">移出作品架</button>
              </div>
            </details>
          </div>
          <div v-if="editing === work.id" class="work-metadata">
            <label class="room-field">作品名称<input :id="'work-title-' + work.id" v-model="editTitle" maxlength="90"></label>
            <label class="room-field">标签（逗号分隔，最多8个）<input v-model="editTags" maxlength="200"></label>
            <div class="work-card-actions"><button type="button" @click="saveMeta(work)">保存整理</button><button type="button" @click="editing = ''">取消</button></div>
          </div>
        </div>
      </article>
    </div>
    <div v-else-if="!works.length" class="works-empty">
      <h3>第一件作品，留一个位置给你。</h3>
      <p>拍张合影或画一页漫画，再点编辑页的「存入作品架」。</p>
      <div><RouterLink to="/room/photobooth">拍一张合影 ↗</RouterLink><RouterLink to="/room/comic">写一页漫画 ↗</RouterLink></div>
    </div>
    <p v-else class="room-hint">没有符合条件的作品，试试别的名称、标签或分类。</p>
    <div class="room-actions shelf-backups">
      <button type="button" @click="backup">导出作品架备份 ↓</button>
      <button type="button" :disabled="busy" @click="fileInput.click()">{{ busy ? '读取中…' : '导入作品架备份' }}</button>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden aria-label="选择作品架备份" @change="importFile">
    </div>
    <section v-if="drafts.length" class="works-drafts">
      <h3>还没收进架子的灵感</h3>
      <div class="shelf-draft-links">
        <RouterLink v-for="draft in drafts" :key="draft.kind" :to="'/room/' + draft.kind">
          <strong>{{ workTypes[draft.kind].label }}</strong><span>{{ draft.title }} ↗</span>
        </RouterLink>
      </div>
    </section>
    <p class="room-hint works-storage-note">作品和草稿保存在本机。导入会合并作品。继续编辑时，手边的不同草稿会先另存一份。</p>
  </section>
</template>

<style scoped>
.works-tools { display:flex; justify-content:space-between; align-items:end; flex-wrap:wrap; gap:4px 12px; margin-bottom:13px; }
.works-tools .rich-toolbar { margin:0; display:grid; grid-template-columns:1.4fr minmax(116px,1fr); gap:7px; }
.works-tools .activity-filters { margin:0; padding:0; flex-wrap:wrap; }
.works-tools .activity-filters button { min-height:44px; }
.works-notice:empty { display:none; }
.works-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; align-items:start; }
.work-card { background:#fff9ed; border:1px solid #bda58f; min-width:0; box-shadow:0 3px 0 #cbb498; }
.work-card.is-pinned { border-color:#946178; }
.work-copy { padding:12px; }
.work-copy h3 { margin:3px 0 8px; font-size:18px; line-height:1.4; overflow-wrap:anywhere; }
.work-meta,.work-tags { font-size:11px; color:#725257; margin:0; overflow-wrap:anywhere; }
.work-card-actions { display:flex; align-items:center; flex-wrap:wrap; gap:5px 8px; }
.work-card-actions button { min-height:44px; font-size:12px; }
.work-card-actions .room-check { display:inline-flex; align-items:center; min-height:44px; margin:0; font-size:11px; }
.work-menu { position:relative; margin-inline-start:auto; }
.work-menu summary { display:flex; cursor:pointer; min-height:44px; align-items:center; gap:4px; padding:3px 7px; font-size:12px; color:#65445b; }
.work-menu summary::-webkit-details-marker { display:none; }
.work-menu-options { position:absolute; right:0; z-index:5; display:grid; width:max-content; max-width:100%; min-width:138px; background:#fff9e9; border:1px solid #ad8c81; box-shadow:0 5px 18px #39212b33; }
.work-menu-options button,.work-menu-options a { min-height:44px; width:100%; text-align:start; background:none; color:#5d4254; border:0; border-bottom:1px solid #dbc6b1; padding:5px 9px; font-size:12px; }
.work-menu-options a { display:flex; align-items:center; text-underline-offset:3px; }
.work-menu-options button:hover,.work-menu-options a:hover { background:#f1ded7; }
.work-metadata { margin-top:10px; padding:9px; background:#f2e4d6; border:1px solid #d3b9a4; }
.work-compare-panel { color:#523846; background:#fff8e9; padding:12px; border:1px solid #bda68e; margin:0 0 14px; }
.compare-heading { margin:0 0 8px; justify-content:space-between; }
.compare-heading h3 { margin:0; }
.compare-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.compare-grid>div { min-width:0; padding:0; background:#f3e6d5; border:1px solid #c5aa94; color:#493642; }
.compare-grid h4,.compare-grid p { margin:5px 7px; overflow-wrap:anywhere; }
.compare-table-wrap table { width:100%; table-layout:fixed; border-collapse:collapse; }
.compare-table-wrap :is(th,td) { text-align:left; border:1px solid #cbb4a0; color:#573d4c; padding:7px 9px; font-size:13px; overflow-wrap:anywhere; }
.compare-table-wrap thead th:first-child,.compare-table-wrap tbody th { background:#f1e1cc; }
.works-empty { padding:30px 18px; border:1px dashed #a58676; background:#f7e8d7; text-align:center; }
.works-empty p { font-size:13px; }
.works-empty>div { display:flex; flex-wrap:wrap; justify-content:center; column-gap:14px; }
.works-empty a,.shelf-draft-links a { min-height:44px; display:inline-flex; align-items:center; color:#76485e; text-underline-offset:3px; }
.shelf-backups { margin-top:18px; }
.works-drafts { padding-top:9px; border-top:1px solid #bdab99; }
.shelf-draft-links { display:flex; flex-wrap:wrap; gap:5px; }
.shelf-draft-links a { border:1px solid #c8ad9b; padding:4px 8px; gap:6px; overflow-wrap:anywhere; font-size:12px; }
.works-storage-note { margin-top:16px; }
@media(max-width:1000px) { .works-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:600px) {
  .works-grid { grid-template-columns:minmax(0,1fr); gap:11px; }
  .works-tools .rich-toolbar { width:100%; }
  .compare-table-wrap tr { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
  .compare-table-wrap tr th:first-child { grid-column:1/-1; }
  .compare-table-wrap :is(th,td) { min-width:0; }
  .compare-grid { gap:5px; }
}
</style>
