<script setup>
import { computed,nextTick,onBeforeUnmount,onMounted,ref,shallowRef,watch } from 'vue';
import { useRoute } from 'vue-router';
import { readPreferences,setPreferences } from '../../room/preferences.js';
import { siteSections } from '../../data/siteSections.js';
import { startTour } from '../../room/tour.js';
const dialog=ref(null),search=ref(null),launcher=ref(null),tab=ref('search'),query=ref(''),kind=ref('all'),works=ref([]),cloud=ref([]),prefs=ref(readPreferences()),message=ref(''),cloudNotice=ref('');
const route=useRoute(),engine=shallowRef(null);let request,alive=true;
const results=computed(()=>engine.value?engine.value(query.value,{kind:kind.value,works:works.value,cloud:cloud.value}):[]);
const labels={activity:'活动与专题',note:'手记',image:'收藏',work:'我的作品'};
async function open(){prefs.value=readPreferences();dialog.value.showModal();await nextTick();search.value?.focus();const [searchModule,shelf]=await Promise.all([import('../../services/siteSearch.js'),import('../../room/workshelf.js')]);if(!alive)return;engine.value=searchModule.searchSite;works.value=shelf.readWorks();if(!request){request=new AbortController();try{const m=await import('../../services/galleryCloud.js');const items=await m.loadCloudGallery(request.signal);if(alive)cloud.value=items;}catch{if(alive)cloudNotice.value='云端新增收藏暂未加入搜索，本地内容仍可检索。';}}}
function close(){dialog.value?.close();launcher.value?.focus();}
function keyboard(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open();}}
function apply(){try{prefs.value=setPreferences(prefs.value);message.value='设置已记住，并应用到当前页面。';}catch(e){message.value=e.message;}}
watch(()=>route.fullPath,()=>dialog.value?.close());
onMounted(()=>window.addEventListener('keydown',keyboard));onBeforeUnmount(()=>{alive=false;request?.abort();window.removeEventListener('keydown',keyboard);});
</script>
<template>
 <button ref="launcher" type="button" class="site-tools-button" aria-label="打开全站搜索与设置" @click="open">⌕<span>工具</span></button>
 <dialog ref="dialog" class="site-tools-dialog" aria-labelledby="site-tools-title" @click="e=>e.target===dialog&&close()"><div class="site-tools-body"><header><h2 id="site-tools-title">小屋工具</h2><button type="button" aria-label="关闭小屋工具" @click="close">×</button></header><div class="tools-tabs"><button v-for="(label,id) in {search:'全站搜索',settings:'阅读与动效',explore:'更多角落'}" :key="id" type="button" :aria-pressed="tab===id" @click="tab=id">{{label}}</button></div>
 <section v-if="tab==='search'"><label for="site-search">找图片、手记、活动和自己的作品</label><input id="site-search" ref="search" v-model="query" type="search" maxlength="100" placeholder="例如：一里、编曲、合影"><label for="site-search-kind" class="visually-hidden">搜索范围</label><select id="site-search-kind" v-model="kind"><option value="all">全部内容</option><option v-for="(label,id) in labels" :key="id" :value="id">{{label}}</option></select><p class="tools-note" role="status">{{query.trim()?`找到 ${results.length} 项`:'输入关键词开始查找 · Ctrl / ⌘ K 随时打开'}}</p><div class="site-search-results"><RouterLink v-for="result in results" :key="result.id" :to="result.to"><small>{{labels[result.kind]}}</small><strong>{{result.title}}</strong><span>{{result.description}}</span></RouterLink></div><p v-if="query.trim()&&!results.length" class="tools-note">换一个关键词，或选择全部内容试试。</p><p v-if="cloudNotice" class="tools-note">{{cloudNotice}}</p></section>
 <section v-else-if="tab==='settings'" class="tools-settings"><label>阅读字号<select v-model.number="prefs.font"><option :value="1">标准</option><option :value="1.15">稍大</option><option :value="1.3">大字</option></select></label><label>阅读行距<select v-model.number="prefs.line"><option :value="1.8">紧凑</option><option :value="2.1">舒适</option><option :value="2.4">宽松</option></select></label><label>动态效果<select v-model="prefs.motion"><option value="system">跟随系统</option><option value="reduce">减少动态效果</option></select></label><label class="tools-check"><input v-model="prefs.contrast" type="checkbox">增强文字对比度</label><label class="tools-check"><input v-model="prefs.metrics" type="checkbox">记录匿名体验次数</label><p class="tools-note">只记录日期、活动编号和打开/完成/导出次数，不记录搜索词、作品内容或身份。全站汇总仅在站主启用接口后发送。</p><button type="button" @click="apply">应用并记住设置</button><p role="status" class="tools-note">{{message}}</p></section>
 <nav v-else class="tools-explore" aria-label="专题导航"><RouterLink v-for="item in siteSections" :key="item.id" :to="item.path"><strong>{{item.title}} ↗</strong><span>{{item.description}}</span></RouterLink><RouterLink to="/room/photobooth" @click="startTour">新手引导 · 做第一件作品 →</RouterLink></nav>
 </div></dialog>
</template>
