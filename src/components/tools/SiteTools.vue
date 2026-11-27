<script setup>
import { computed,nextTick,onBeforeUnmount,onMounted,ref,shallowRef,watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { readPreferences,setPreferences } from '../../room/preferences.js';
import { siteSections } from '../../data/siteSections.js';
import SoundSettings from '../SoundSettings.vue';
import { startTour } from '../../room/tour.js';
const dialog=ref(null),search=ref(null),launcher=ref(null),tab=ref('search'),query=ref(''),kind=ref('all'),works=ref([]),cloud=ref([]),prefs=ref(readPreferences()),message=ref(''),cloudNotice=ref('');
const route=useRoute(),engine=shallowRef(null),searchLoading=ref(false),searchError=ref('');let request,alive=true;
const router = useRouter();
const results=computed(()=>engine.value?engine.value(query.value,{kind:kind.value,works:works.value,cloud:cloud.value}):[]);
const brokenPictures=ref(new Set());
function picture(result) {
  const src = result.preview || result.thumbnail;
  if (!src) return '';
  const url = /^(https?:|data:)/.test(src) ? src : import.meta.env.BASE_URL+src;
  return brokenPictures.value.has(url) ? '' : url;
}
const publicFeaturedUrl=import.meta.env.BASE_URL+'featured/';
const labels={activity:'活动与专题',note:'手记',image:'收藏',work:'我的作品'};
async function open(){
 tab.value='search';prefs.value=readPreferences();if(!dialog.value.open)dialog.value.showModal();await nextTick();search.value?.focus();
 if(searchLoading.value)return;
 searchLoading.value=true;searchError.value='';
 try{
  const [searchModule,shelf]=await Promise.all([import('../../services/siteSearch.js'),import('../../room/workshelf.js')]);
  if(!alive)return;engine.value=searchModule.searchSite;works.value=shelf.readWorks();
 }catch{if(alive)searchError.value='搜索暂时没能载入。请重试，仍未打开时可以刷新网站版本；作品和草稿会保留。';return;}
 finally{searchLoading.value=false;}
 if(!request){
  request=new AbortController();cloudNotice.value='正在检索云端新增收藏，结果会继续补齐…';
  try{const m=await import('../../services/galleryCloud.js');const items=await m.loadCloudGallery(request.signal);if(alive){cloud.value=items;cloudNotice.value='';}}
  catch{request=undefined;if(alive)cloudNotice.value='云端新增收藏暂未加入搜索，本地内容仍可检索。重新打开搜索可重试。';}
 }
}
function refreshWebsite(){location.reload();}
function close(){dialog.value?.close();}
function restoreFocus() {
  if (!dialog.value?.open) launcher.value?.focus({ preventScroll: true });
}
function selectResult(event, destination, isExactActive, navigate) {
  if (!isExactActive) return navigate(event);
  // The search parameter opens the dialog on arrival.
  const query = { ...route.query, search: undefined };
  const current = router.resolve({ path: destination.path, hash: route.hash, query });
  if (current.fullPath !== destination.fullPath) return navigate(event);
  if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  event.preventDefault();
  close();
}
function keyboard(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open();}}
function apply(){try{prefs.value=setPreferences(prefs.value);message.value='设置已记住，并应用到当前页面。';}catch(e){message.value=e.message;}}
function searchFromLink() {
  if (typeof route.query.search!=='string' || !route.query.search.trim()) return;
  query.value=route.query.search.slice(0,100);
  kind.value='all';
  open();
}
watch(()=>route.fullPath,()=>{ dialog.value?.close(); searchFromLink(); });
onMounted(()=>{ window.addEventListener('keydown',keyboard); searchFromLink(); });
onBeforeUnmount(()=>{alive=false;request?.abort();window.removeEventListener('keydown',keyboard);});
</script>
<template>
 <button ref="launcher" type="button" class="site-tools-button" aria-label="打开全站搜索与设置" @click="open"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg><span>搜索与设置</span></button>
 <dialog ref="dialog" class="site-tools-dialog" aria-labelledby="site-tools-title" @close="restoreFocus" @keydown.esc.prevent.stop="close" @click="e=>e.target===dialog&&close()"><div class="site-tools-body"><header><h2 id="site-tools-title">搜索与设置</h2><button type="button" aria-label="关闭搜索与设置" @click="close">×</button></header><div class="tools-tabs"><button v-for="(label,id) in {search:'全站搜索',settings:'阅读、声音与设置',explore:'更多角落'}" :key="id" type="button" :aria-pressed="tab===id" @click="tab=id">{{label}}</button></div>
 <section v-if="tab==='search'" class="site-search-panel"><label for="site-search">找图片、手记、活动和自己的作品</label><input id="site-search" ref="search" v-model="query" type="search" maxlength="100" placeholder="例如：一里、编曲、合影"><label for="site-search-kind" class="visually-hidden">搜索范围</label><select id="site-search-kind" v-model="kind"><option value="all">全部内容</option><option v-for="(label,id) in labels" :key="id" :value="id">{{label}}</option></select><p v-if="searchLoading" class="tools-note" role="status">正在准备搜索…</p><div v-if="searchError" class="tools-note" role="alert">{{searchError}}<div><button type="button" @click="open">重试搜索</button><button type="button" @click="refreshWebsite">刷新网站版本</button></div></div><p class="tools-note" role="status">{{query.trim()?`找到 ${results.length} 项`:'输入关键词开始查找 · Ctrl / ⌘ K 随时打开'}}</p><div class="site-search-results">
  <RouterLink v-for="result in results" :key="result.id" :to="result.to" custom
    v-slot="{ href, navigate, route: destination, isActive, isExactActive }">
   <a :href="href" class="search-entry" :class="{ 'router-link-active': isActive, 'router-link-exact-active': isExactActive }"
     :aria-current="isExactActive ? 'page' : undefined" :data-result-id="result.id"
     :data-result-kind="result.kind" :data-match-field="result.match?.hasMatch ? result.match.field : null"
     @click="selectResult($event, destination, isExactActive, navigate)">
    <div class="search-entry-art" :class="{ 'has-picture':picture(result) }" :style="{ '--result-ink':result.color || '#d5b4c4' }" aria-hidden="true">
      <img v-if="picture(result)" :src="picture(result)" alt="" loading="lazy" @error="brokenPictures.add($event.target.getAttribute('src'))">
      <span v-else-if="result.icon" class="search-entry-icon">{{ result.icon }}</span>
      <span v-else>{{ result.typeLabel || labels[result.kind] }}</span>
    </div>
    <div class="search-entry-copy">
      <div class="search-entry-title"><small>{{ result.kind==='work' ? labels.work + ' · ' + result.typeLabel : labels[result.kind] }}</small><strong>{{ result.title }}</strong></div>
      <span v-if="result.action" class="search-entry-action">{{ result.action }} <i aria-hidden="true">↗</i></span>
      <span v-if="result.match" class="search-entry-excerpt">
        <b v-if="result.match.hasMatch">{{ result.match.field }}</b>
        <template v-for="(part,i) in result.match.parts" :key="i"><mark v-if="part.marked">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template>
      </span>
      <span v-else-if="result.description && result.kind!=='work'" class="search-entry-excerpt">{{ result.description }}</span>
    </div>
   </a>
  </RouterLink>
</div><p v-if="query.trim()&&!results.length&&!searchLoading&&!searchError" class="tools-note">换一个关键词，或选择全部内容试试。</p><p v-if="cloudNotice" class="tools-note">{{cloudNotice}}</p></section>
 <section v-else-if="tab==='settings'" class="tools-settings"><label>阅读字号<select v-model.number="prefs.font"><option :value="1">标准</option><option :value="1.15">稍大</option><option :value="1.3">大字</option></select></label><label>阅读行距<select v-model.number="prefs.line"><option :value="1.8">紧凑</option><option :value="2.1">舒适</option><option :value="2.4">宽松</option></select></label><label>动态效果<select v-model="prefs.motion"><option value="system">跟随系统</option><option value="reduce">减少动态效果</option></select></label><label class="tools-check"><input v-model="prefs.contrast" type="checkbox">增强文字对比度</label><label class="tools-check"><input v-model="prefs.metrics" type="checkbox">记录匿名体验次数</label><p class="tools-note">只记录日期、活动编号和打开/完成/导出次数，不记录搜索词、作品内容或身份。全站汇总仅在站主启用接口后发送。</p><button type="button" @click="apply">应用并记住设置</button><p role="status" class="tools-note">{{message}}</p><SoundSettings /><RouterLink class="device-settings-link" to="/settings/device">安装、离线与跨设备同步 ↗</RouterLink></section>
 <nav v-else class="tools-explore" aria-label="专题导航"><RouterLink v-for="item in siteSections" :key="item.id" :to="item.path"><strong>{{item.title}} ↗</strong><span>{{item.description}}</span></RouterLink><RouterLink to="/collections"><strong>主题合集 ↗</strong><span>把演出前与放学后的片刻，收进一册。</span></RouterLink><a :href="publicFeaturedUrl">小屋公开精选 ↗</a><RouterLink to="/settings/device">安装、离线与跨设备同步 ↗</RouterLink><RouterLink to="/room/photobooth" @click="startTour">新手引导 · 做第一件作品 →</RouterLink></nav>
 </div></dialog>
</template>

<style scoped>
.site-search-panel .site-search-results { gap:6px; }
.site-search-panel .site-search-results .search-entry {
  display:grid; grid-template-columns:66px minmax(0,1fr); align-items:center; gap:0 10px;
  min-height:65px; min-width:0; padding:5px; overflow:hidden; background:#fff5e7; border:1px solid #c2a4b0;
}
.site-search-panel .site-search-results .search-entry:focus-visible { outline:2px solid #794766; outline-offset:-2px; }
.search-entry-art { display:grid; place-items:center; min-height:49px; width:100%; color:#51374a; background:color-mix(in srgb,var(--result-ink) 48%,#f6e4d3); border:1px solid #ba9ba9; }
.search-entry-art.has-picture { background:#ead7d1; }
.search-entry-art img { width:100%; height:51px; object-fit:contain; display:block; }
.search-entry-art span { font-size:10px; line-height:1.25; padding:3px; text-align:center; overflow-wrap:anywhere; }
.search-entry-art .search-entry-icon { font-size:22px; }
.search-entry-copy { display:grid; gap:2px; min-width:0; color:#50394d; overflow-wrap:anywhere; padding:3px 1px; }
.search-entry-title { display:flex; align-items:baseline; flex-wrap:wrap; gap:2px 7px; }
.search-entry-title small { flex:none; color:#704960; font-size:10px; }
.search-entry-title strong { color:#432e42; font-size:14px; line-height:1.4; }
.search-entry-excerpt { color:#6b5361; font-size:11px; line-height:1.5; }
.search-entry-excerpt b { margin-right:5px; color:#694760; }
.search-entry-excerpt mark { background:#e9cba6; color:#402d40; }
.search-entry-action { color:#694360; font-size:11px; font-weight:700; }
.search-entry-action i { font-style:normal; }
@media(max-width:480px) {
  .site-search-panel .site-search-results .search-entry { grid-template-columns:48px minmax(0,1fr); gap:0 6px; }
  .search-entry-art img { height:44px; }
  .search-entry-title { gap:1px 5px; }
  .search-entry-title strong { font-size:13px; }
}
</style>
