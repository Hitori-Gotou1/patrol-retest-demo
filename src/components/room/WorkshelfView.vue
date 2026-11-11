<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { readWorks, readDrafts, workTypes, removeWork, restoreWork, exportWorks, importWorks, maxWorks } from '../../room/workshelf.js';
import { downloadJson } from '../../room/storage.js';
const router = useRouter(), works = ref([]), drafts = ref([]), filter = ref('all'), message = ref(''), removed = ref(null), fileInput = ref(null), busy = ref(false);
let alive = true;
function refresh() { works.value=readWorks(); drafts.value=readDrafts(); }
refresh();
try { exportWorks(); } catch(error) { message.value=error.message; }
const visible = computed(()=>works.value.filter(work=>filter.value==='all'||work.kind===filter.value));
const kinds = computed(()=>[...new Set(works.value.map(work=>work.kind))]);
const formatDate = at => new Date(at).toLocaleDateString('zh-CN', {month:'long',day:'numeric'});
async function open(work) {
  try { const path=restoreWork(work.id); await router.push(path); }
  catch(error) { message.value=error.message; }
}
function remove(work) { try { removed.value=removeWork(work.id); message.value='已移出作品架，编辑页的草稿仍保留。可以撤销。'; refresh(); } catch(error) { message.value=error.message; } }
function undo() { try { importWorks(JSON.stringify({version:1,works:[removed.value]})); removed.value=null; message.value='作品已放回原位。'; refresh(); } catch(error) { message.value=error.message; } }
function backup() { try { downloadJson(exportWorks(),'hitori-workshelf-backup.json'); message.value='已导出作品、预览和编辑数据，可在另一台设备导入。'; } catch(error) { message.value=error.message; } }
async function importFile(event) {
  const file=event.target.files?.[0]; if(!file||busy.value)return; busy.value=true;
  try { if(file.size>5*1024*1024)throw new Error('备份不能超过 5 MiB。'); const text=await file.text(); if(!alive)return; const count=importWorks(text); message.value=`已合并 ${count} 个新版本，原有作品和当前草稿都保留。`; refresh(); }
  catch(error) { if(alive)message.value=error.message; }
  finally { if(alive){busy.value=false;event.target.value='';} }
}
onMounted(()=>{window.addEventListener('storage',refresh);window.addEventListener('hitori:works-changed',refresh);});
onBeforeUnmount(()=>{alive=false;window.removeEventListener('storage',refresh);window.removeEventListener('hitori:works-changed',refresh);});
</script>
<template>
  <section class="workshelf" aria-labelledby="works-title">
    <div class="discovery-section-heading"><div><p class="room-kicker">我的小小收藏展</p><h2 id="works-title">那些由你完成的瞬间</h2></div><span class="works-count">{{works.length}} / {{maxWorks}} 个版本</span></div>
    <p class="works-intro">合影、漫画、房间、涂鸦与声音，都可以留在同一层架子上。点击“继续编辑”时，当前不同的草稿会先另存一份。</p>
    <div class="room-actions"><button type="button" @click="backup">导出作品架备份 ↓</button><button type="button" :disabled="busy" @click="fileInput.click()">{{busy?'读取中…':'导入作品架备份'}}</button><input ref="fileInput" type="file" accept=".json,application/json" hidden aria-label="选择作品架备份" @change="importFile"><button v-if="removed" type="button" @click="undo">撤销移出</button></div>
    <p class="room-status" role="status">{{message}}</p>
    <div v-if="works.length" class="activity-filters" aria-label="筛选作品"><button type="button" :aria-pressed="filter==='all'" @click="filter='all'">全部作品</button><button v-for="kind in kinds" :key="kind" type="button" :aria-pressed="filter===kind" @click="filter=kind">{{workTypes[kind].label}}</button></div>
    <div v-if="visible.length" class="works-grid"><article v-for="work in visible" :key="work.id" class="work-card" :data-work-id="work.id"><div class="work-preview"><img v-if="work.preview" :src="work.preview" :alt="`${work.title}的保存预览`" width="360" height="300" loading="lazy"><div v-else class="work-sound-preview"><span aria-hidden="true">{{workTypes[work.kind].icon}}</span><small>{{workTypes[work.kind].label}}</small><strong>{{work.title}}</strong></div></div><div class="work-copy"><p>{{workTypes[work.kind].label}} · <time :datetime="new Date(work.at).toISOString()">{{formatDate(work.at)}}</time></p><h3>{{work.title}}</h3><div class="work-card-actions"><button type="button" class="primary" @click="open(work)">继续编辑 →</button><button type="button" @click="downloadJson({version:1,works:[work]},'hitori-work.json')">备份此版本</button><a v-if="work.preview" :href="work.preview" :download="`hitori-work-${work.id}.${work.preview.startsWith('data:image/webp')?'webp':'png'}`">保存预览 ↓</a><button type="button" class="work-remove" @click="remove(work)">移出作品架</button></div></div></article></div>
    <div v-else-if="!works.length" class="works-empty"><span aria-hidden="true">▣</span><h3>第一件作品，留一个位置给你。</h3><p>去拍张合影或画一页漫画，再点击编辑页上方的“存入作品架”。</p><div><RouterLink to="/room/photobooth">拍一张合影 ↗</RouterLink><RouterLink to="/room/comic">写一页漫画 ↗</RouterLink></div></div>
    <p v-else class="room-hint">这个分类暂时没有作品，可以切换到全部作品。</p>
    <section v-if="drafts.length" class="works-drafts" aria-labelledby="drafts-title"><div class="discovery-section-heading"><div><p class="room-kicker">草稿也在这里</p><h2 id="drafts-title">还没收进架子的灵感</h2></div></div><p class="works-intro">原有编辑页的本机草稿会继续保留。打开后，可以把喜欢的版本收进作品架。</p><div class="activity-cards"><RouterLink v-for="draft in drafts" :key="draft.kind" :to="`/room/${draft.kind}`" class="activity-card"><span class="activity-icon" aria-hidden="true">{{workTypes[draft.kind].icon}}</span><div><h3>{{workTypes[draft.kind].label}}</h3><p>{{draft.title}}</p></div><span aria-hidden="true">↗</span></RouterLink></div></section>
    <p class="room-hint works-storage-note">作品保存在当前浏览器，清除网站数据会移除本机记录。导出备份后，可以在另一台设备继续；导入会合并作品，不替换草稿。</p>
  </section>
</template>
<style scoped>
.works-intro{font-size:13px;color:#cbb9ca;line-height:1.9;max-width:720px}.works-count{color:#ba9eaf;font-size:12px}.works-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin-top:22px}.work-card{background:#fff8ed;color:#493b47;border:1px solid #cdb6a7;min-width:0}.work-preview{height:240px;background:#e8d5db;overflow:hidden}.work-preview>img{width:100%;height:100%;object-fit:contain;display:block;padding:12px}.work-sound-preview{height:100%;padding:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:15px;background:repeating-linear-gradient(0deg,transparent,transparent 23px,#bfa7b633 24px)}.work-sound-preview>span{font-size:50px;color:#93657e}.work-sound-preview small{font-size:10px;letter-spacing:.12em}.work-sound-preview strong{text-align:center;font-size:17px;line-height:1.7}.work-copy{padding:20px}.work-copy>p{font-size:10px;color:#8a6e79;margin:0 0 10px}.work-copy h3{font-size:18px;line-height:1.7;margin:0 0 18px;overflow-wrap:anywhere}.work-card-actions{display:flex;flex-wrap:wrap;gap:8px}.work-card-actions button{font-size:11px;padding:8px 10px}.work-card-actions a{color:#79596f;font-size:11px;min-height:44px;display:inline-flex;align-items:center;text-underline-offset:4px}.work-card-actions .work-remove{background:transparent;border:0;text-decoration:underline;color:#8a6e79;padding:8px 0;margin-left:auto}.works-empty{padding:45px 24px;border:1px dashed #816577;background:#231c2a;text-align:center}.works-empty>span{font-size:54px;color:#d6a0bb}.works-empty h3{font-size:23px;line-height:1.7;margin:18px 0 10px}.works-empty p{font-size:13px;color:#c6acbd;line-height:1.9}.works-empty>div{display:flex;flex-wrap:wrap;justify-content:center;gap:20px}.works-empty a{display:inline-flex;align-items:center;min-height:44px;color:#edc4d7;font-size:13px;text-underline-offset:5px}.works-drafts{margin-top:40px}.works-drafts .activity-icon{background:#d9b3ca}.works-storage-note{margin-top:26px}@media(max-width:950px){.works-grid{grid-template-columns:1fr 1fr}}@media(max-width:600px){.works-grid{grid-template-columns:1fr}.work-preview{height:270px}.works-empty{padding:28px 16px}.works-empty h3{font-size:20px}.work-card-actions button{min-height:44px}.work-card-actions .work-remove{margin-left:0}}
</style>
