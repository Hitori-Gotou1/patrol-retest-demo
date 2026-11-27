<script setup>
import '../styles/review-folio.css';
import '../styles/collection-folios.css';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { collectionUrl, collectionLayout, orderedCollectionImages, collectionAsset } from '../services/collectionPage.js';
import { galleryImages } from '../data/gallery.js';
import { withAttribution } from '../data/galleryAttributions.js';
import { galleryCollectionExamples } from '../data/galleryCollections.js';
import { galleryManager } from '../services/galleryManagement.js';
import { cloudConfigured, findCloudGalleryImage } from '../services/galleryCloud.js';
const route=useRoute();
const collections=ref([...galleryCollectionExamples]);const cloudImages=ref([]);const busy=ref(false);const error=ref('');const shareMessage=ref('');
let alive=true;let request=0;
const selected=computed(()=>collections.value.find(item=>item.id===route.params.id));
const knownImages = galleryImages.map(withAttribution);
const available = computed(() => [...knownImages,...cloudImages.value]);
const items = computed(() => orderedCollectionImages(selected.value,available.value));
const layout = computed(() => collectionLayout(items.value.length));
const base = import.meta.env.BASE_URL;
function imageSrc(image, thumbnail = false) {
  const path = thumbnail ? image.thumbnail || image.src : image.src || image.thumbnail;
  return collectionAsset(path,base);
}
function cover(collection) {
  const entries = orderedCollectionImages(collection,available.value);
  const image = entries.find(entry => entry.id === collection.cover_image_id) || entries[0];
  return image ? imageSrc(image,true) : '';
}
function count(collection) { return orderedCollectionImages(collection,available.value).length; }
async function load(){if(!cloudConfigured)return;const revision=++request;busy.value=true;error.value='';try{const rows=await galleryManager.collections();if(!alive||revision!==request)return;collections.value=[...galleryCollectionExamples,...rows];const ids=[...new Set(rows.flatMap(row=>[row.cover_image_id,...row.imageIds]).filter(id=>id?.startsWith('cloud-')))];const results=[];for(let offset=0;offset<ids.length;offset+=4){const batch=await Promise.all(ids.slice(offset,offset+4).map(id=>findCloudGalleryImage(id)));results.push(...batch.filter(Boolean));if(!alive||revision!==request)return;}cloudImages.value=results;}catch(cause){if(alive&&revision===request)error.value='云端合集暂时无法读取。本站策展仍可查看，可以稍后重试。';}finally{if(alive&&revision===request)busy.value=false;}}
async function share(){const url=selected.value?.static?collectionUrl(selected.value.id):location.href;try{await navigator.clipboard.writeText(url);shareMessage.value='合集链接已复制。';}catch{shareMessage.value=`复制此链接分享：${url}`;}}
watch(()=>selected.value?.title,title=>{document.title=`${title||'主题合集'} · 一里小屋`;},{immediate:true});
onMounted(load);onBeforeUnmount(()=>{alive=false;request++;});
</script>
<template><main id="main" class="collections-page collection-folio-page" tabindex="-1"><div class="collections-paper"><header><RouterLink to="/room/play">← 回到活动室</RouterLink><h1>{{route.params.id?(selected?.title||'寻找这份合集'):'把喜欢，串成一册'}}</h1><p v-if="!route.params.id">演出前、放学后，还有四个人在一起的日常。</p></header><p v-if="busy" role="status">正在读取云端合集…</p><p v-if="error" role="alert" class="collections-error">{{error}} <button @click="load">重试</button></p>
<template v-if="route.params.id"><template v-if="selected"><p class="collection-description">{{selected.description}}</p><div class="collection-controls"><RouterLink to="/collections">全部合集</RouterLink><button type="button" @click="share">复制合集链接</button><span>{{items.length}} 张可用图片</span></div><p v-if="shareMessage" role="status">{{shareMessage}}</p><div v-if="items.length" class="collection-image-grid" :data-layout="layout">
      <figure v-for="image in items" :key="image.id" class="collection-leaf" :data-image-id="image.id">
        <RouterLink class="collection-picture" :to="{path:'/',query:{image:image.id},hash:'#gallery'}">
          <img :src="imageSrc(image,layout==='index')" :alt="image.alt||image.title" loading="lazy">
          <span>在收藏墙放大 ↗</span>
        </RouterLink>
        <figcaption><strong>{{ image.title }}</strong><small>{{ [image.credit,image.creator].filter(Boolean).join(' · ') || '沿用站内来源记录' }}</small></figcaption>
      </figure>
    </div><p v-else-if="!busy" class="collection-empty">这册还在慢慢收集。图片可能已下架，或尚未加入，稍后再来看看。</p></template><p v-else-if="!busy" class="collection-empty">这份合集暂时不可用，可能尚未公开或已移除。<RouterLink to="/collections">去看其他合集 ↗</RouterLink></p></template>
<div v-else class="collection-card-grid"><RouterLink v-for="collection in collections" :key="collection.id" :to="`/collections/${collection.id}`"><img v-if="cover(collection)" :src="cover(collection)" :alt="collection.title" loading="lazy"><div v-else class="collection-cover-empty" aria-hidden="true">✦</div><span>{{collection.static?'本站策展':'站主主题册'}} · {{count(collection)}} 张</span><h2>{{collection.title}}</h2><p>{{collection.description}}</p></RouterLink></div>
<footer><RouterLink :to="{path:'/',hash:'#gallery'}">回到收藏墙 ↗</RouterLink><RouterLink to="/manage-gallery">站主管理合集</RouterLink></footer></div></main></template>
<style scoped>
.collections-page { min-height:100dvh; padding:116px 22px 42px; background:#1d1925; color:#493b47; }
.collections-paper { max-width:1120px; margin:auto; background:#f9eedc; padding:clamp(13px,4.2vw,46px); border:1px solid #b1979e; }
.collections-paper header { border-bottom:1px solid #9b7588; padding-bottom:12px; }
.collections-paper header>a { display:inline-flex; align-items:center; min-height:44px; }
.collections-paper h1 { font-size:clamp(27px,5vw,46px); line-height:1.28; margin:5px 0 8px; }
.collections-paper p { font-size:14px; line-height:1.75; overflow-wrap:anywhere; }
.collections-paper a { color:inherit; }
.collections-paper footer a { color:#fff8ee; }
.collection-card-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:start; gap:16px; margin-top:20px; }
.collection-card-grid>a { display:block; min-width:0; border:1px solid #bca3af; background:#fff8ec; padding:12px; text-decoration:none; }
.collection-card-grid img,.collection-cover-empty { display:block; width:100%; height:clamp(159px,25vw,290px); object-fit:cover; object-position:center; background:#e6d3dc; }
.collection-cover-empty { display:grid; place-items:center; font-size:34px; color:#825774; }
.collection-card-grid span { display:block; font-size:12px; color:#6c4e62; margin-top:10px; }
.collection-card-grid h2 { font-size:clamp(19px,2.7vw,25px); margin:6px 0 4px; }
.collection-card-grid p { margin:5px 0 0; }
.collection-controls { display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; margin:10px 0 15px; font-size:13px; }
.collection-controls :is(a,button),footer a { display:inline-flex; align-items:center; min-height:44px; padding:7px 12px; background:#664158; color:#fff8ee; font:inherit; border:1px solid #664158; text-decoration:none; cursor:pointer; }
.collection-empty { padding:20px; background:#ecdfdd; }
.collection-empty a { display:flex; align-items:center; min-height:44px; }
.collections-paper footer { display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-top:23px; padding-top:12px; border-top:1px solid #bda6b2; font-size:13px; }
.collections-error { color:#842844; }.collections-error button { min-height:44px; }
@media(max-width:720px) {
  .collections-page { padding:111px 12px 24px; }
  .collection-card-grid { grid-template-columns:minmax(0,1fr); gap:10px; }
}
</style>
