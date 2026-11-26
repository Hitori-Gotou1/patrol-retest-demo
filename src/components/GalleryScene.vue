<script setup>
import {motionPreference as createMotionQuery} from '../room/preferences.js';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {withAttribution} from '../data/galleryAttributions.js';
import { galleryImages } from '../data/gallery.js';
import { cloudConfigured, loadCloudGalleryPage, findCloudGalleryImage, galleryMetadataCacheKey } from '../services/galleryCloud.js';
import { createGalleryPager, clearGalleryMetadataCache } from '../services/galleryPager.js';
import { usePhotoMotion } from '../composables/usePhotoMotion.js';
import { useSceneMotion } from '../composables/useSceneMotion.js';
import SceneAtmosphere from './motion/SceneAtmosphere.vue';
import SmoothFold from './motion/SmoothFold.vue';
import FluidPanel from './motion/FluidPanel.vue';
import { useGalleryZoom } from '../composables/useGalleryZoom.js';
import { cloudServiceMessage } from '../services/cloudConnection.js';
import { createProgressiveImage } from '../services/progressiveImage.js';
import { useGalleryPreview } from '../composables/useGalleryPreview.js';
import { filterGallery, galleryCharacters, galleryImageLocation, favoritesStorageKey, maxBackupBytes, readSavedFavorites, createFavoritesBackup, parseFavoritesBackup, mergeFavorites } from '../services/galleryDiscovery.js';
const pagedImages = ref([]);
const locatedImages = ref([]);
const remoteImages = computed(() => [...new Map([...locatedImages.value, ...pagedImages.value].map(item => [item.id, item])).values()]);
const cloudError = ref('');
const cloudLoading = ref(false);
const cloudHasMore = ref(cloudConfigured);
const cloudComplete = ref(!cloudConfigured);
const cloudUpdatedAt = ref(0);
const allImages = computed(() => [...remoteImages.value, ...galleryImages].map(withAttribution));
const creator=ref('all');
const creators=computed(()=>[...new Set(allImages.value.map(i=>i.creator).filter(Boolean))]);
const cloudPager = createGalleryPager({ fetchPage: loadCloudGalleryPage, cacheKey: galleryMetadataCacheKey, onChange: state => {
  if (!mounted) return;
  pagedImages.value = state.items;
  cloudLoading.value = state.loading;
  cloudHasMore.value = state.hasMore;
  cloudComplete.value = state.complete;
  cloudUpdatedAt.value = state.updatedAt;
  cloudError.value = state.error ? `云端收藏暂时无法继续读取，已加载的内容仍可浏览。${cloudServiceMessage(state.error)}` : '';
} });
const locating = new Map();
async function locateCloudImage(id) {
  if (!cloudConfigured) return null;
  if (locating.has(id)) return locating.get(id).promise;
  const controller = new AbortController();
  const promise = findCloudGalleryImage(id, controller.signal).then(item => { if (mounted && item) locatedImages.value = [...locatedImages.value.filter(entry => entry.id !== item.id), item]; return item; }).catch(error => {
    if (mounted && error.name !== 'AbortError') cloudError.value = `分享图片暂时无法定位。${cloudServiceMessage(error)}`;
    throw error;
  }).finally(() => locating.delete(id));
  locating.set(id, { controller, promise });
  return promise;
}
async function refreshCloud() {
  if (!cloudConfigured || cloudLoading.value) return;
  await cloudPager.refresh();
  if (hasFilters.value) await cloudPager.ensureComplete();
  retryLink();
}
async function retryCloud() {
  if (!cloudConfigured || cloudLoading.value) return;
  await cloudPager.loadMore();
  if (hasFilters.value) await cloudPager.ensureComplete();
  retryLink();
}
function reconnectCloud() { if (cloudError.value) retryCloud(); }
function invalidateCloud() { clearGalleryMetadataCache(galleryMetadataCacheKey); refreshCloud(); }
import '../styles/gallery-enhancements.css';
import '../styles/gallery-discovery.css';

const section = ref(null);
useSceneMotion(section);
const filtersOpen = ref(false), toolsOpen = ref(false);
const lightbox = ref(null);
const zoomSurface = ref(null);
const activeFilter = ref('all');
const query = ref('');
const character = ref('all');
const favoritesOnly = ref(false);
const mode = ref('wall');
const paused = ref(false);
const reducedMotion = ref(false);
const inView = ref(false);
const pageVisible = ref(true);
const favorites = ref(new Set());
const status = ref('');
const imageState = ref({ source: '', status: 'idle', unavailable: false });
const wallPageSize = 9;
const wallLimit = ref(wallPageSize);
const filters = [{ id: 'all', label: '全部' }, { id: 'collection', label: '站主收藏' }, { id: 'illustration', label: '同人插画' }, { id: 'poster', label: '设计海报' }];
const images = computed(() => filterGallery(allImages.value, { category: activeFilter.value, query: query.value, character: character.value, creator:creator.value, favoritesOnly: favoritesOnly.value }, favorites.value));
const hasFilters = computed(() => activeFilter.value !== 'all' || query.value.trim() || character.value !== 'all' || creator.value!=='all' || favoritesOnly.value);
const filterChips = computed(() => [
  activeFilter.value !== 'all' && filters.find(f=>f.id===activeFilter.value)?.label,
  query.value.trim() && `“${query.value.trim()}”`,
  character.value !== 'all' && (galleryCharacters.find(c=>c.id===character.value)?.label || '未标注角色'),
  creator.value !== 'all' && (creator.value==='pending'?'原作者待确认':creator.value),
  favoritesOnly.value && '我的收藏'
].filter(Boolean));
const knownFavoriteCount = computed(() => allImages.value.filter(item => favorites.value.has(item.id)).length);
const visibleImages = computed(() => images.value.slice(0, wallLimit.value));
const photoMotion = usePhotoMotion({ lightbox, section });
const { selectedImage, imageCounter, dialogOpen, previewImages, linkNotice, openImage, closeImage, stepImage, onDialogClose, clearLink, retryLink } = useGalleryPreview({ allImages, images, section, lightbox, loading: cloudLoading, findImage: locateCloudImage, motion: photoMotion });
const zoom = useGalleryZoom({ selectedImage, dialogOpen, surface: zoomSurface, stepImage, section });
const router = useRouter();
const backupInput = ref(null);
const importing = ref(false);
const backupMessage = ref('');
const backupError = ref(false);
const shareLink = ref('');
const shareInput = ref(null);
const shareMessage = ref('');
let importRevision = 0;
let shareRevision = 0;
const flowing = computed(() => mode.value === 'flow' && !paused.value && !reducedMotion.value && inView.value && pageVisible.value && !dialogOpen.value);
const rows = computed(() => [0, 1, 2].map(offset => {
  if (!images.value.length) return [];
  // 三行分担素材，只复制一组用于首尾衔接，避免每行重复加载整份收藏。
  const group = images.value.filter((_, index) => index % 3 === offset);
  const source = group.length ? group : images.value;
  const length = Math.max(4, source.length);
  return Array.from({ length }, (_, index) => source[index % source.length]);
}));
const asset = path => path.startsWith('https://') ? path : `${import.meta.env.BASE_URL}${path}`;
const progressiveImage = createProgressiveImage({ onChange: state => { imageState.value = state; } });
watch(selectedImage, item => {
  if (item) progressiveImage.load(asset(item.preview || item.src), item.thumbnail ? asset(item.thumbnail) : undefined);
  else progressiveImage.clear();
}, { flush: 'sync' });
const isSmallImage = item => Number.isFinite(item.width) && Number.isFinite(item.height) && Math.max(item.width, item.height) <= 300;
const imageStyle = item => isSmallImage(item) ? { '--gallery-image-width': `${item.width}px`, '--gallery-image-height': `${item.height}px` } : undefined;
const frameMeasurements = ref({});
const framesWithoutCors = ref(new Set());

function retryFrameWithoutCors(item) {
  if (item.cloudManaged) framesWithoutCors.value.add(item.id);
}
function measureFrame(item, event) {
  const image = event.target;
  const source = item.thumbnail || item.src;
  if (!image.naturalWidth || !image.naturalHeight || frameMeasurements.value[item.id]?.source === source) return;
  let transparent = false;
  // The visible derivative can preserve alpha even when its extension is WebP.
  // Images on servers without canvas access still get a neutral backing.
  try {
    const sample = document.createElement('canvas');
    sample.width = sample.height = 32;
    const paint = sample.getContext('2d');
    paint.drawImage(image, 0, 0, sample.width, sample.height);
    const pixels = paint.getImageData(0, 0, sample.width, sample.height).data;
    transparent = pixels.some((value, index) => index % 4 === 3 && value < 240);
  } catch {
    transparent = /\.(png|svg|webp)(?:$|[?#])/i.test(source);
  }
  frameMeasurements.value[item.id] = { source, ratio: image.naturalWidth / image.naturalHeight, transparent };
}
function frameRatio(item) {
  if (item.width > 0 && item.height > 0) return item.width / item.height;
  const measured = frameMeasurements.value[item.id];
  return measured?.source === (item.thumbnail || item.src) ? measured.ratio : 1;
}
function frameShape(item) {
  const ratio = frameRatio(item);
  if (ratio >= 1.48) return 'landscape';
  return ratio <= .83 ? 'portrait' : 'square';
}
function hasMat(item) {
  const measured = frameMeasurements.value[item.id];
  return measured?.source === (item.thumbnail || item.src) && measured.transparent;
}
const flowDuration = (length, index) => `${([47, 57, 39][index] * length / 3).toFixed(1)}s`;
let observer;
let motionQuery;
let filterTimer;
let mounted = false;

watch([activeFilter, query, character, creator, favoritesOnly], () => {
  wallLimit.value = wallPageSize;
  status.value = cloudComplete.value ? `找到 ${images.value.length} 张` : '筛选会检索全部云端收藏，读取完成前结果可能继续增加。';
  clearTimeout(filterTimer);
  if (cloudConfigured && hasFilters.value && !cloudComplete.value) filterTimer = setTimeout(() => cloudPager.ensureComplete(), 180);
});
watch(selectedImage, () => { shareRevision++; shareLink.value = ''; shareMessage.value = ''; });

function setFilter(id) {
  activeFilter.value = id;
}
function resetFilters() {
  activeFilter.value = 'all'; query.value = ''; character.value = 'all'; creator.value='all'; favoritesOnly.value = false;
}
async function loadMore() {
  const firstNewIndex = visibleImages.value.length;
  if (visibleImages.value.length + wallPageSize > images.value.length && cloudHasMore.value) await cloudPager.loadMore();
  wallLimit.value += wallPageSize;
  status.value = `已展示 ${visibleImages.value.length} / ${images.value.length} 张`;
  await nextTick();
  // 加载按钮被新增照片向下推移时，将键盘焦点交给第一张新照片。
  if (mounted) section.value?.querySelectorAll('#gallery-grid .gallery-image-button')[firstNewIndex]?.focus({ preventScroll: true });
}
function toggleFavorite(item, event) {
  const next = new Set(favorites.value);
  next.has(item.id) ? next.delete(item.id) : next.add(item.id);
  try { if (saveFavorites(mergeFavorites(new Set(), next)) && !reducedMotion.value) event?.currentTarget?.animate([{transform:'scale(1)'},{transform:'scale(1.22)'},{transform:'scale(1)'}], {duration:280,easing:'ease-out'}); }
  catch (error) { status.value = error.message; }
}
function saveFavorites(next) {
  favorites.value = next;
  try {
    localStorage.setItem(favoritesStorageKey, JSON.stringify([...next]));
    status.value = `已收藏 ${next.size} 张`;
    return true;
  } catch {
    status.value = '当前浏览器无法保存收藏，仅本次有效';
    return false;
  }
}
function favoriteLabel(item) {
  return `${favorites.value.has(item.id) ? '取消收藏' : '收藏'}：${item.title}`;
}
function exportFavorites() {
  backupError.value = false;
  try {
    const blob = new Blob([createFavoritesBackup(favorites.value)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hitori-room-favorites-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    backupMessage.value = '收藏备份已生成，包含收藏编号，不包含图片文件。';
  } catch (error) { backupError.value = true; backupMessage.value = error.message; }
}
async function importFavorites(event) {
  const file = event.target.files?.[0];
  if (!file || importing.value) return;
  const revision = ++importRevision;
  importing.value = true;
  backupError.value = false;
  backupMessage.value = '';
  try {
    if (file.size > maxBackupBytes) throw new Error('收藏备份不能超过 1 MiB。');
    const incoming = parseFavoritesBackup(await file.text());
    if (!mounted || revision !== importRevision) return;
    const merged = mergeFavorites(favorites.value, incoming);
    const saved = saveFavorites(merged);
    backupMessage.value = `已合并 ${merged.size} 条收藏记录。${saved ? '' : '当前浏览器无法保存，刷新后可能丢失，请导出备份。'}`;
  } catch (error) {
    if (mounted && revision === importRevision) { backupError.value = true; backupMessage.value = error.message; }
  } finally {
    if (mounted && revision === importRevision) { importing.value = false; event.target.value = ''; }
  }
}
function syncFavorites(event) {
  try {
    if (event.storageArea !== localStorage || (event.key !== favoritesStorageKey && event.key !== null)) return;
    favorites.value = readSavedFavorites(event.newValue);
    status.value = '已同步其他标签页的收藏。';
  } catch { /* Ignore malformed changes without replacing this tab's favorites. */ }
}
async function copyShareLink() {
  if (!selectedImage.value) return;
  const revision = ++shareRevision;
  const url = new URL(router.resolve(galleryImageLocation(selectedImage.value.id)).href, window.location.href).href;
  shareLink.value = url;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(url);
    if (mounted && revision === shareRevision) shareMessage.value = '分享链接已复制。';
  } catch {
    if (!mounted || revision !== shareRevision) return;
    shareMessage.value = '请选中下方链接复制，或在手机上长按复制。';
    await nextTick();
    shareInput.value?.focus();
    shareInput.value?.select();
  }
}
function dialogKeydown(event) {
  if (event.target.closest('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return;
  if (zoom.panKeyboard(event)) return;
  if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom.setZoom(zoom.scale.value * 1.4); return; }
  if (event.key === '-') { event.preventDefault(); zoom.setZoom(zoom.scale.value / 1.4); return; }
  if (event.key === '0') { event.preventDefault(); zoom.fit(); return; }
  if (event.key === '1') { event.preventDefault(); zoom.oneToOne(); return; }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    stepImage(event.key === 'ArrowLeft' ? -1 : 1);
  }
}
function dialogBackdrop(event) {
  if (event.target !== lightbox.value) return;
  const bounds = lightbox.value.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeImage();
}
function syncMotion() { reducedMotion.value = motionQuery.matches; }
function syncVisibility() { pageVisible.value = document.visibilityState === 'visible'; }

onMounted(() => {
  mounted = true;
  if (cloudConfigured) cloudPager.start();
  try {
    favorites.value = readSavedFavorites(localStorage.getItem(favoritesStorageKey));
  } catch { /* 隐私模式下仍可在当前页面收藏。 */ }
  window.addEventListener('storage', syncFavorites);
  window.addEventListener('online', reconnectCloud);
  window.addEventListener('hitori:gallery-changed', invalidateCloud);
  motionQuery = createMotionQuery();
  syncMotion();
  syncVisibility();
  motionQuery.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncVisibility);
  observer = new IntersectionObserver(([entry]) => { inView.value = entry.isIntersecting; }, { threshold: 0.05 });
  observer.observe(section.value);
});
onBeforeUnmount(() => {
  mounted = false;
  importRevision++; shareRevision++;
  progressiveImage.cancel();
  cloudPager.dispose();
  clearTimeout(filterTimer);
  for (const request of locating.values()) request.controller.abort();
  observer?.disconnect();
  motionQuery?.removeEventListener('change', syncMotion);
  document.removeEventListener('visibilitychange', syncVisibility);
  window.removeEventListener('storage', syncFavorites);
  window.removeEventListener('online', reconnectCloud);
  window.removeEventListener('hitori:gallery-changed', invalidateCloud);
});
</script>

<template>
  <section id="gallery" ref="section" class="gallery-section scene" data-scene-name="心动收藏" aria-labelledby="gallery-title">
    <SceneAtmosphere kind="gallery" />
    <div class="scene-inner">
      <div class="section-label"><span>04 / 把喜欢贴在墙上</span><span>把喜欢，认真收藏。</span></div>
      <div class="section-heading" data-arrive="0">
        <div><h2 id="gallery-title" tabindex="-1">心动，有迹可循<span class="pink-period">.</span></h2><p>像收集票根一样，收集每一次舍不得划走的瞬间。</p></div>
        <div class="filters" role="group" aria-label="筛选收藏">
          <button v-for="filter in filters" :key="filter.id" type="button" class="filter" :class="{ active: activeFilter === filter.id }" :data-filter="filter.id" :aria-pressed="activeFilter === filter.id" @click="setFilter(filter.id)">{{ filter.label }}<span v-if="filter.id === 'all'">{{ String(allImages.length).padStart(2, '0') }}</span></button>
        </div>
      </div>
      <div class="gallery-discovery" role="search" aria-label="查找收藏图片">
        <label class="gallery-search-field" for="gallery-search"><span>找一份心动</span><input id="gallery-search" v-model="query" type="search" maxlength="200" placeholder="搜索标题、描述或作者 / 来源"></label>
        <button type="button" class="gallery-favorites-only" :aria-pressed="favoritesOnly" @click="favoritesOnly = !favoritesOnly">♥ 我的收藏 <span>{{ knownFavoriteCount }}</span></button>
        <button type="button" class="gallery-filter-toggle" :aria-expanded="filtersOpen" aria-controls="gallery-advanced" @click="filtersOpen=!filtersOpen">筛选 <span v-if="character!=='all'||creator!=='all'" class="filter-dot" aria-label="已启用高级筛选">●</span><span aria-hidden="true">{{filtersOpen?'−':'＋'}}</span></button>
      </div>
      <SmoothFold id="gallery-advanced" :open="filtersOpen"><div class="gallery-advanced-fields">        <label class="gallery-character-field" for="gallery-character"><span>角色</span><select id="gallery-character" v-model="character" aria-describedby="gallery-character-hint"><option value="all">全部角色</option><option v-for="member in galleryCharacters" :key="member.id" :value="member.id">{{ member.label }}</option><option value="unmarked">未标注角色</option></select></label>
        <label class="gallery-character-field" for="gallery-creator"><span>画师 / 来源</span><select id="gallery-creator" v-model="creator"><option value="all">全部画师与来源</option><option v-for="name in creators" :key="name" :value="name">{{name}}</option><option value="pending">原作者待确认</option></select></label>
<p id="gallery-character-hint" class="gallery-character-hint">优先使用站主标注的角色；旧图片沿用标题和画面描述识别。</p></div></SmoothFold>
      <div v-if="filterChips.length" class="gallery-filter-chips" aria-label="已启用的筛选"><span v-for="chip in filterChips" :key="chip">{{chip}}</span><button type="button" @click="resetFilters">清除全部 ×</button></div>
      <div class="gallery-discovery-tools">
        <span class="gallery-result-count" aria-live="polite">{{ cloudComplete ? `找到 ${images.length} / ${allImages.length} 张` : `已读取 ${allImages.length} 张，当前符合 ${images.length} 张` }}</span><span v-if="hasFilters && !cloudComplete" class="gallery-search-coverage" role="status">{{ cloudError ? '全部收藏尚未检索完，请重试读取。' : '正在检索全部云端收藏，结果会继续补充…' }}</span>
        <button v-if="hasFilters" type="button" class="gallery-reset-filters" @click="resetFilters">清除筛选</button>

      </div>
      <div class="gallery-view-bar">
        <div class="gallery-view-switch" role="group" aria-label="相册展示方式">
          <button type="button" :aria-pressed="mode === 'wall'" @click="mode = 'wall'"><span aria-hidden="true">▤</span> 收藏墙</button>
          <button type="button" :aria-pressed="mode === 'flow'" @click="mode = 'flow'"><span aria-hidden="true">≋</span> 流动视图</button>
        </div>
        <button v-if="mode === 'flow'" type="button" class="gallery-motion-toggle" :disabled="reducedMotion" :aria-pressed="paused || reducedMotion" @click="paused = !paused">{{ reducedMotion ? '已减少动态效果' : paused ? '继续流动 ▶' : '暂停流动 Ⅱ' }}</button>
        <button type="button" class="gallery-tools-toggle" :aria-expanded="toolsOpen" aria-controls="gallery-tools" @click="toolsOpen=!toolsOpen">备份与工具 {{toolsOpen?'−':'＋'}}</button>
      </div>
      <p v-if="cloudLoading || cloudError" class="gallery-cloud-status" :class="{'has-error':cloudError,'gallery-cloud-notice':cloudError}" role="status">{{cloudError || '正在补齐云端收藏，已载入的图片可继续翻阅…'}}<button v-if="cloudError" type="button" :disabled="cloudLoading" @click="retryCloud">重试读取</button></p>
      <SmoothFold id="gallery-tools" :open="toolsOpen"><div class="gallery-tools-panel">        <details class="gallery-backup">
          <summary>收藏备份</summary>
          <div class="gallery-backup-panel" :aria-busy="importing">
            <p>备份收藏编号，换设备后可导入。导入会与本机记录合并，保留已有收藏；图片文件不包含在备份中。</p>
            <div><button type="button" @click="exportFavorites">导出收藏</button><button type="button" :disabled="importing" @click="backupInput.click()">{{ importing ? '正在导入…' : '导入收藏' }}</button></div>
            <input ref="backupInput" type="file" accept=".json,application/json" hidden aria-label="选择收藏备份文件" @change="importFavorites">
            <p v-if="backupMessage" class="gallery-backup-message" :role="backupError ? 'alert' : 'status'">{{ backupMessage }}</p>
          </div>
        </details>      <div v-if="cloudConfigured" class="gallery-cloud-controls"><span>{{ cloudComplete ? '云端收藏已全部读取' : `云端已读取 ${remoteImages.length} 张 · 可继续翻阅` }}</span><button type="button" :disabled="cloudLoading" @click="refreshCloud">刷新云端收藏</button><span v-if="cloudUpdatedAt">本次数据缓存在页面间保留 5 分钟</span></div>
<RouterLink to="/manage-gallery" class="gallery-upload-link">站主上传与管理 ↗</RouterLink></div></SmoothFold>
      <p v-if="linkNotice" class="gallery-link-notice" role="status">{{ linkNotice }} <button type="button" @click="clearLink">清除图片定位</button></p>
      <FluidPanel><Transition name="gallery-mode"><div v-if="mode === 'wall'" key="wall" class="gallery-wall-panel" data-arrive="1"><TransitionGroup tag="div" name="photo-card" id="gallery-grid" class="gallery-grid">
        <article v-for="item in visibleImages" :key="item.id" class="gallery-card" :data-category="item.category"
          :data-frame="frameShape(item)" :data-mat="hasMat(item)" :style="{ '--frame-ratio': frameRatio(item) }">
          <div class="gallery-mount">
            <button type="button" class="gallery-image-button" :data-photo-id="item.id" :aria-label="`放大图片：${item.title}`" @click="openImage(item, $event)">
              <img :src="asset(item.thumbnail || item.src)" :alt="item.alt" :class="{ 'is-small-image': isSmallImage(item) }"
                :crossorigin="item.cloudManaged && !framesWithoutCors.has(item.id) ? 'anonymous' : undefined"
                :style="imageStyle(item)" loading="lazy" decoding="async" :width="item.width || 600" :height="item.height || 620"
                @load="measureFrame(item, $event)" @error="retryFrameWithoutCors(item)">
            </button>
          </div>
          <div class="gallery-card-caption">
            <div><h3>{{ item.title }}</h3><small>{{ item.creator || item.credit || item.subtitle }}</small></div>
            <button type="button" class="favorite" :aria-label="favoriteLabel(item)" :aria-pressed="favorites.has(item.id)" @click="toggleFavorite(item, $event)">{{ favorites.has(item.id) ? '♥' : '♡' }}</button>
          </div>
        </article>
      </TransitionGroup></div>
      <div v-else key="flow" class="gallery-flow-view" :data-playing="flowing">
        <div class="gallery-flow-wall" aria-hidden="true">
          <div v-for="(row, rowIndex) in rows" :key="`${activeFilter}-${rowIndex}`" class="gallery-flow-row" :class="{ 'is-reversed': rowIndex % 2 }" :style="{ '--flow-duration': flowDuration(row.length, rowIndex) }">
            <div class="gallery-flow-track">
              <div v-for="copy in 2" :key="copy" class="gallery-flow-group">
                <button v-for="(item, index) in row" :key="`${copy}-${item.id}-${index}`" type="button" tabindex="-1" class="gallery-flow-photo" :data-photo-id="item.id" :data-category="item.category" @click="openImage(item, $event)">
                  <img :src="asset(item.thumbnail || item.src)" :class="{ 'is-small-image': isSmallImage(item) }" :style="imageStyle(item)" alt="" loading="lazy" decoding="async" :width="item.width || 440" :height="item.height || 260"><span>{{ item.title }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <!-- 流动副本不进入辅助技术和键盘焦点序列；独立且静止的入口始终可操作。 -->
        <div class="gallery-flow-access" aria-label="选择作品预览">
          <span>选择预览</span><button v-for="item in images" :key="item.id" type="button" :data-preview-id="item.id" @click="openImage(item, $event)">{{ item.title }} <span aria-hidden="true">↗</span></button>
        </div>
      </div>
      </Transition></FluidPanel>
      <div v-if="mode === 'wall' && images.length" class="gallery-pagination">
        <span>已展示 {{ visibleImages.length }} / {{ images.length }} 张</span>
        <button v-if="visibleImages.length < images.length || cloudHasMore" type="button" class="gallery-load-more" :disabled="cloudLoading" @click="loadMore">{{ cloudLoading ? '正在读取…' : visibleImages.length < images.length ? `再翻 ${Math.min(wallPageSize, images.length - visibleImages.length)} 张` : '读取更多云端收藏' }} <span aria-hidden="true">↓</span></button><span v-else>已经翻到最后一张</span>
      </div>
      <div v-if="mode === 'flow' && cloudHasMore" class="gallery-pagination"><button type="button" class="gallery-load-more" :disabled="cloudLoading" @click="cloudPager.loadMore()">{{ cloudLoading ? '正在读取…' : '继续读取云端收藏' }}</button></div>
      <p v-if="!images.length && !cloudLoading && cloudComplete" class="gallery-empty">{{ hasFilters ? '没有符合当前条件的图片，试试调整搜索或筛选。' : '这一页还在等待新的心动。' }}</p>
      <RouterLink to="/manage-gallery" class="gallery-manage-link">站主管理收藏 ↗</RouterLink>
      <p class="gallery-note"><span aria-hidden="true">↗</span> 点击图片放大 · 左右滑动预览 · 收藏留在这台设备 <span id="gallery-status" role="status" aria-live="polite">{{ status }}</span></p>
      <div v-if="mode === 'wall'" class="gallery-stamp" aria-hidden="true">KEEP<br>THE FEELING.</div>
    </div>
    <Teleport to="body">
      <dialog id="lightbox" ref="lightbox" class="lightbox gallery-lightbox" aria-labelledby="lightbox-title" @close="onDialogClose" @cancel.prevent="closeImage" @keydown="dialogKeydown" @click="dialogBackdrop">
        <div v-if="selectedImage" class="lightbox-content">
          <div class="lightbox-toolbar"><span id="lightbox-count" aria-live="polite">{{ imageCounter }}</span><span class="lightbox-hint">适配时滑动切图 · 放大后拖动查看</span><button id="lightbox-close" type="button" class="icon-button" aria-label="关闭图片" @click="closeImage">×</button></div>
          <div class="lightbox-zoom-controls" role="group" aria-label="图片缩放"><button type="button" aria-label="缩小图片" :disabled="zoom.scale.value <= 1" @click="zoom.setZoom(zoom.scale.value / 1.4)">−</button><output aria-live="polite">{{ zoom.zoomLabel.value }}</output><button type="button" aria-label="放大图片" :disabled="zoom.scale.value >= zoom.maxScale.value" @click="zoom.setZoom(zoom.scale.value * 1.4)">＋</button><button type="button" @click="zoom.fit">适配屏幕</button><button type="button" @click="zoom.oneToOne">1:1 查看</button></div>
          <div class="lightbox-image-wrap">
            <button v-if="previewImages.length > 1" id="lightbox-prev" type="button" class="icon-button lightbox-prev" aria-label="上一张" @click="stepImage(-1)">←</button>
            <div ref="zoomSurface" class="lightbox-zoom-surface" :class="{ 'is-zoomed': zoom.zoomed.value, 'is-dragging': zoom.dragging.value }" :style="{ touchAction: zoom.zoomed.value ? 'none' : 'pan-y pinch-zoom' }" @dblclick="zoom.doubleClick" @pointerdown="zoom.pointerDown" @pointermove="zoom.pointerMove" @pointerup="zoom.pointerUp" @pointercancel="zoom.pointerCancel" @lostpointercapture="zoom.pointerCancel">
              <img v-show="!imageState.unavailable" id="lightbox-image" :key="selectedImage.id" :src="imageState.source" :data-state="imageState.status" :alt="selectedImage.alt" :style="zoom.imageTransform.value" decoding="async" draggable="false" @load="zoom.imageLoaded" @error="progressiveImage.displayError($event.currentTarget.getAttribute('src'))">
              <p v-if="imageState.status === 'error'" class="lightbox-image-error" role="status">这张图片暂时没有加载成功，可以切换到下一张。</p>
            </div>
            <button v-if="previewImages.length > 1" id="lightbox-next" type="button" class="icon-button lightbox-next" aria-label="下一张" @click="stepImage(1)">→</button>
          </div>
          <p class="lightbox-gesture-hint">双击放大或还原 · 放大后可拖动、双指调整 · + / − 缩放，0 适配，Shift + 方向键移动</p>
          <div class="lightbox-bottom"><h3 id="lightbox-title">{{ selectedImage.title }}</h3><p id="lightbox-credit">{{ selectedImage.credit }}</p><p v-if="imageState.status === 'loading'" class="visually-hidden" role="status">正在加载高清图片…</p><p v-if="imageState.status === 'fallback'" class="lightbox-preview-notice" role="status">高清图片暂时无法加载，正在显示预览图。</p><p class="source-label">{{selectedImage.creator||'原作者待确认'}} · {{selectedImage.method}}</p><div class="source-links"><a v-if="selectedImage.sourceUrl" :href="selectedImage.sourceUrl" target="_blank" rel="noopener noreferrer">原作发布页 ↗</a><a v-if="selectedImage.creatorUrl" :href="selectedImage.creatorUrl" target="_blank" rel="noopener noreferrer">画师主页 ↗</a><RouterLink to="/room/sources">查看来源档案 ↗</RouterLink></div><div class="lightbox-actions"><button type="button" class="lightbox-favorite" :aria-label="favoriteLabel(selectedImage)" :aria-pressed="favorites.has(selectedImage.id)" @click="toggleFavorite(selectedImage, $event)">{{ favorites.has(selectedImage.id) ? '♥ 已收藏' : '♡ 收藏这张' }}</button><a v-if="selectedImage.originalSrc" class="lightbox-original" :href="asset(selectedImage.originalSrc)" target="_blank" rel="noopener noreferrer">查看原图 <span aria-hidden="true">↗</span></a><button type="button" class="lightbox-share" @click="copyShareLink">复制分享链接 ↗</button></div><div v-if="shareLink" class="lightbox-share-field"><label for="gallery-share-link">图片分享链接</label><input id="gallery-share-link" ref="shareInput" :value="shareLink" readonly @focus="$event.target.select()"><p role="status">{{ shareMessage }}</p></div></div>
        </div>
      </dialog>
    </Teleport>
  </section>
</template>

<style scoped>
.gallery-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(18px, 2.2vw, 32px);
  padding: 11px 3px 18px;
  align-items: start;
}
.gallery-section .gallery-card {
  --frame-border: #8a685e;
  --frame-paper: #fff8ea;
  --frame-padding: 12px;
  justify-self: start;
  width: 100%;
  background: none;
  border: 0;
  padding: 0;
  box-shadow: none;
  transform: none;
}
.gallery-section .gallery-card::before { display: none; }
.gallery-section .gallery-card[data-frame="landscape"] { grid-column: span 2; --frame-border: #634550; }
.gallery-section .gallery-card[data-frame="portrait"] {
  --frame-border: #815c53;
  --frame-padding: 9px;
  width: min(100%, calc(var(--frame-ratio) * 490px + 2 * var(--frame-padding)));
}
.gallery-mount { position: relative; width: 100%; }
.gallery-mount::before {
  content: "";
  position: absolute;
  z-index: 2;
  inset: -6px auto auto 23%;
  width: clamp(40px, 19%, 66px);
  height: 14px;
  background: #d4b583c9;
  border-inline: 2px dashed #f4e7ca9e;
  rotate: -4deg;
  pointer-events: none;
}
.gallery-section .gallery-card .gallery-image-button {
  display: grid;
  place-items: center;
  aspect-ratio: auto;
  height: auto;
  padding: var(--frame-padding);
  background: var(--frame-paper);
  border: 1px solid var(--frame-border);
  border-radius: 1px;
  box-shadow: 3px 4px #80605140, 0 7px 15px #79584923;
}
.gallery-section .gallery-card[data-mat="true"] {
  --frame-padding: 16px;
  --frame-paper: #e9dbcb;
  --frame-border: #947167;
}
.gallery-section .gallery-card .gallery-image-button img {
  display: block;
  height: auto;
  max-width: 100%;
  aspect-ratio: var(--frame-ratio);
  object-position: center;
  object-fit: contain;
  background: transparent;
  transition: none;
}
.gallery-section .gallery-card .gallery-image-button:hover img { transform: none; }
.gallery-image-button:hover { box-shadow: 3px 4px #80605161, 0 7px 16px #7958493f; }
.gallery-section .gallery-card-caption {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 6px;
  width: min(100%, 276px);
  margin: 9px 0 0;
  padding: 5px 4px 5px 9px;
  color: #563841;
  background: #fdf4e3;
  border: 1px solid #caae95;
  border-inline-start: 3px solid #a87a6e;
}
.gallery-section .gallery-card h3 { font-size: .94rem; font-weight: 750; line-height: 1.44; overflow-wrap: anywhere; }
.gallery-section .gallery-card small { font: .75rem/1.45 var(--font); color: #6c514a; margin-top: 3px; overflow-wrap: anywhere; }
.gallery-section .gallery-card .favorite { width: 44px; min-width: 44px; min-height: 44px; color: #82516f; }
.gallery-section .gallery-card .favorite[aria-pressed="true"] { color: #9c2851; }
@media (max-width: 760px) {
  .gallery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 11px; }
  .gallery-section .gallery-card,
  .gallery-section .gallery-card[data-frame="portrait"] { --frame-padding: 8px; grid-column: auto; width: 100%; }
  .gallery-section .gallery-card[data-frame="landscape"] { grid-column: 1 / -1; }
  .gallery-section .gallery-card[data-mat="true"] { --frame-padding: 10px; }
  .gallery-section .gallery-card h3 { font-size: .87rem; }
  .gallery-section .gallery-card-caption { padding: 6px 2px 5px 6px; gap: 2px; }
}
</style>
