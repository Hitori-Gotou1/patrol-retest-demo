<script setup>
import {motionPreference as createMotionQuery} from '../room/preferences.js';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {withAttribution} from '../data/galleryAttributions.js';
import { galleryImages } from '../data/gallery.js';
import { cloudConfigured, loadCloudGallery } from '../services/galleryCloud.js';
import { cloudServiceMessage } from '../services/cloudConnection.js';
import { createProgressiveImage } from '../services/progressiveImage.js';
import { useGalleryPreview } from '../composables/useGalleryPreview.js';
import { filterGallery, galleryCharacters, galleryImageLocation, favoritesStorageKey, maxBackupBytes, readSavedFavorites, createFavoritesBackup, parseFavoritesBackup, mergeFavorites } from '../services/galleryDiscovery.js';
const remoteImages = ref([]);
const cloudError = ref('');
const cloudLoading = ref(false);
const allImages = computed(() => [...remoteImages.value, ...galleryImages].map(withAttribution));
const creator=ref('all');
const creators=computed(()=>[...new Set(allImages.value.map(i=>i.creator).filter(Boolean))]);
let cloudRequest;
async function refreshCloud() {
  if (!cloudConfigured || cloudLoading.value) return;
  cloudLoading.value = true;
  cloudError.value = '';
  cloudRequest = new AbortController();
  try {
    const items = await loadCloudGallery(cloudRequest.signal);
    if (mounted) remoteImages.value = items;
  } catch (cause) {
    if (mounted) cloudError.value = `新上传的收藏暂时无法加载，原有收藏仍可浏览。${cloudServiceMessage(cause)}`;
  } finally { if (mounted) cloudLoading.value = false; }
}
function reconnectCloud() { if (cloudError.value) refreshCloud(); }
import '../styles/gallery-enhancements.css';
import '../styles/gallery-discovery.css';

const section = ref(null);
const lightbox = ref(null);
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
const knownFavoriteCount = computed(() => allImages.value.filter(item => favorites.value.has(item.id)).length);
const visibleImages = computed(() => images.value.slice(0, wallLimit.value));
const { selectedImage, imageCounter, dialogOpen, previewImages, linkNotice, openImage, closeImage, stepImage, onDialogClose, clearLink } = useGalleryPreview({ allImages, images, section, lightbox, loading: cloudLoading });
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
  if (item) progressiveImage.load(asset(item.src), item.thumbnail ? asset(item.thumbnail) : undefined);
  else progressiveImage.clear();
}, { flush: 'sync' });
const isSmallImage = item => Number.isFinite(item.width) && Number.isFinite(item.height) && Math.max(item.width, item.height) <= 300;
const imageStyle = item => isSmallImage(item) ? { '--gallery-image-width': `${item.width}px`, '--gallery-image-height': `${item.height}px` } : undefined;
const flowDuration = (length, index) => `${([47, 57, 39][index] * length / 3).toFixed(1)}s`;
let observer;
let motionQuery;
let touchOrigin;
let mounted = false;

watch([activeFilter, query, character, creator, favoritesOnly], () => {
  wallLimit.value = wallPageSize;
  status.value = `找到 ${images.value.length} 张`;
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
  wallLimit.value += wallPageSize;
  status.value = `已展示 ${visibleImages.value.length} / ${images.value.length} 张`;
  await nextTick();
  // 加载按钮被新增照片向下推移时，将键盘焦点交给第一张新照片。
  if (mounted) section.value?.querySelectorAll('#gallery-grid .gallery-image-button')[firstNewIndex]?.focus({ preventScroll: true });
}
function toggleFavorite(item) {
  const next = new Set(favorites.value);
  next.has(item.id) ? next.delete(item.id) : next.add(item.id);
  try { saveFavorites(mergeFavorites(new Set(), next)); }
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
  if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
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
function startTouch(event) {
  if (event.touches.length === 1) touchOrigin = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  else touchOrigin = null;
}
function endTouch(event) {
  if (!touchOrigin || !event.changedTouches.length) return;
  const dx = event.changedTouches[0].clientX - touchOrigin.x;
  const dy = event.changedTouches[0].clientY - touchOrigin.y;
  touchOrigin = null;
  // 只识别清楚的横向手势，不阻止纵向滚动和双指缩放。
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) stepImage(dx < 0 ? 1 : -1);
}
function syncMotion() { reducedMotion.value = motionQuery.matches; }
function syncVisibility() { pageVisible.value = document.visibilityState === 'visible'; }

onMounted(() => {
  mounted = true;
  refreshCloud();
  try {
    favorites.value = readSavedFavorites(localStorage.getItem(favoritesStorageKey));
  } catch { /* 隐私模式下仍可在当前页面收藏。 */ }
  window.addEventListener('storage', syncFavorites);
  window.addEventListener('online', reconnectCloud);
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
  cloudRequest?.abort();
  observer?.disconnect();
  motionQuery?.removeEventListener('change', syncMotion);
  document.removeEventListener('visibilitychange', syncVisibility);
  window.removeEventListener('storage', syncFavorites);
  window.removeEventListener('online', reconnectCloud);
});
</script>

<template>
  <section id="gallery" ref="section" class="gallery-section scene" data-scene-name="心动收藏" aria-labelledby="gallery-title">
    <div class="scene-inner">
      <div class="section-label"><span>04 / 把喜欢贴在墙上</span><span>把喜欢，认真收藏。</span></div>
      <div class="section-heading">
        <div><h2 id="gallery-title" tabindex="-1">心动，有迹可循<span class="pink-period">.</span></h2><p>像收集票根一样，收集每一次舍不得划走的瞬间。</p></div>
        <div class="filters" role="group" aria-label="筛选收藏">
          <button v-for="filter in filters" :key="filter.id" type="button" class="filter" :class="{ active: activeFilter === filter.id }" :data-filter="filter.id" :aria-pressed="activeFilter === filter.id" @click="setFilter(filter.id)">{{ filter.label }}<span v-if="filter.id === 'all'">{{ String(allImages.length).padStart(2, '0') }}</span></button>
        </div>
      </div>
      <div class="gallery-discovery" role="search" aria-label="查找收藏图片">
        <label class="gallery-search-field" for="gallery-search"><span>找一份心动</span><input id="gallery-search" v-model="query" type="search" maxlength="200" placeholder="搜索标题、描述或作者 / 来源"></label>
        <label class="gallery-character-field" for="gallery-character"><span>角色</span><select id="gallery-character" v-model="character" aria-describedby="gallery-character-hint"><option value="all">全部角色</option><option v-for="member in galleryCharacters" :key="member.id" :value="member.id">{{ member.label }}</option><option value="unmarked">未标注角色</option></select></label>
        <label class="gallery-character-field" for="gallery-creator"><span>画师 / 来源</span><select id="gallery-creator" v-model="creator"><option value="all">全部画师与来源</option><option v-for="name in creators" :key="name" :value="name">{{name}}</option><option value="pending">原作者待确认</option></select></label>
        <button type="button" class="gallery-favorites-only" :aria-pressed="favoritesOnly" @click="favoritesOnly = !favoritesOnly">♥ 我的收藏 <span>{{ knownFavoriteCount }}</span></button>
      </div>
      <p id="gallery-character-hint" class="gallery-character-hint">角色依据标题和画面描述筛选。</p>
      <div class="gallery-discovery-tools">
        <span class="gallery-result-count">找到 {{ images.length }} / {{ allImages.length }} 张</span>
        <button v-if="hasFilters" type="button" class="gallery-reset-filters" @click="resetFilters">清除筛选</button>
        <details class="gallery-backup">
          <summary>收藏备份</summary>
          <div class="gallery-backup-panel" :aria-busy="importing">
            <p>备份收藏编号，换设备后可导入。导入会与本机记录合并，保留已有收藏；图片文件不包含在备份中。</p>
            <div><button type="button" @click="exportFavorites">导出收藏</button><button type="button" :disabled="importing" @click="backupInput.click()">{{ importing ? '正在导入…' : '导入收藏' }}</button></div>
            <input ref="backupInput" type="file" accept=".json,application/json" hidden aria-label="选择收藏备份文件" @change="importFavorites">
            <p v-if="backupMessage" class="gallery-backup-message" :role="backupError ? 'alert' : 'status'">{{ backupMessage }}</p>
          </div>
        </details>
      </div>
      <div class="gallery-view-bar">
        <div class="gallery-view-switch" role="group" aria-label="相册展示方式">
          <button type="button" :aria-pressed="mode === 'wall'" @click="mode = 'wall'"><span aria-hidden="true">▤</span> 收藏墙</button>
          <button type="button" :aria-pressed="mode === 'flow'" @click="mode = 'flow'"><span aria-hidden="true">≋</span> 流动视图</button>
        </div>
        <button v-if="mode === 'flow'" type="button" class="gallery-motion-toggle" :disabled="reducedMotion" :aria-pressed="paused || reducedMotion" @click="paused = !paused">{{ reducedMotion ? '已减少动态效果' : paused ? '继续流动 ▶' : '暂停流动 Ⅱ' }}</button>
        <RouterLink to="/manage-gallery" class="gallery-upload-link">站主上传图片 ↗</RouterLink>
      </div>
      <p v-if="cloudLoading" class="gallery-cloud-loading" role="status">正在读取云端收藏，原有收藏可继续浏览…</p>
      <p v-if="cloudError" class="gallery-cloud-notice" role="status">{{ cloudError }} <button type="button" :disabled="cloudLoading" @click="refreshCloud">重试</button></p>
      <p v-if="linkNotice" class="gallery-link-notice" role="status">{{ linkNotice }} <button type="button" @click="clearLink">清除图片定位</button></p>
      <div v-if="mode === 'wall'" id="gallery-grid" class="gallery-grid">
        <article v-for="item in visibleImages" :key="item.id" class="gallery-card" :data-category="item.category">
          <button type="button" class="gallery-image-button" :aria-label="`放大图片：${item.title}`" @click="openImage(item, $event)">
            <img :src="asset(item.thumbnail || item.src)" :alt="item.alt" :class="{ 'is-small-image': isSmallImage(item) }" :style="imageStyle(item)" loading="lazy" decoding="async" :width="item.width || 600" :height="item.height || 620">
            <span class="gallery-tag">{{ item.tag }}</span><span class="expand-icon" aria-hidden="true">↗</span>
          </button>
          <div class="gallery-card-caption"><div><h3>{{ item.title }}</h3><small>{{ item.subtitle }}</small></div><button type="button" class="favorite" :aria-label="favoriteLabel(item)" :aria-pressed="favorites.has(item.id)" @click="toggleFavorite(item)">{{ favorites.has(item.id) ? '♥' : '♡' }}</button></div>
        </article>
      </div>
      <div v-else class="gallery-flow-view" :data-playing="flowing">
        <div class="gallery-flow-wall" aria-hidden="true">
          <div v-for="(row, rowIndex) in rows" :key="`${activeFilter}-${rowIndex}`" class="gallery-flow-row" :class="{ 'is-reversed': rowIndex % 2 }" :style="{ '--flow-duration': flowDuration(row.length, rowIndex) }">
            <div class="gallery-flow-track">
              <div v-for="copy in 2" :key="copy" class="gallery-flow-group">
                <button v-for="(item, index) in row" :key="`${copy}-${item.id}-${index}`" type="button" tabindex="-1" class="gallery-flow-photo" :data-category="item.category" @click="openImage(item, $event)">
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
      <div v-if="mode === 'wall' && images.length" class="gallery-pagination">
        <span>已展示 {{ visibleImages.length }} / {{ images.length }} 张</span>
        <button v-if="visibleImages.length < images.length" type="button" class="gallery-load-more" @click="loadMore">再翻 {{ Math.min(wallPageSize, images.length - visibleImages.length) }} 张 <span aria-hidden="true">↓</span></button>
      </div>
      <p v-if="!images.length" class="gallery-empty">{{ hasFilters ? '没有符合当前条件的图片，试试调整搜索或筛选。' : '这一页还在等待新的心动。' }}</p>
      <RouterLink to="/manage-gallery" class="gallery-manage-link">站主管理收藏 ↗</RouterLink>
      <p class="gallery-note"><span aria-hidden="true">↗</span> 点击图片放大 · 左右滑动预览 · 收藏留在这台设备 <span id="gallery-status" role="status" aria-live="polite">{{ status }}</span></p>
      <div v-if="mode === 'wall'" class="gallery-stamp" aria-hidden="true">KEEP<br>THE FEELING.</div>
    </div>
    <Teleport to="body">
      <dialog id="lightbox" ref="lightbox" class="lightbox gallery-lightbox" aria-labelledby="lightbox-title" @close="onDialogClose" @cancel.prevent="closeImage" @keydown="dialogKeydown" @click="dialogBackdrop">
        <template v-if="selectedImage">
          <div class="lightbox-toolbar"><span id="lightbox-count" aria-live="polite">{{ imageCounter }}</span><span class="lightbox-hint">左右滑动 / 方向键切换</span><button id="lightbox-close" type="button" class="icon-button" aria-label="关闭图片" @click="closeImage">×</button></div>
          <div class="lightbox-image-wrap" @touchstart.passive="startTouch" @touchend.passive="endTouch" @touchcancel="touchOrigin = null">
            <button v-if="previewImages.length > 1" id="lightbox-prev" type="button" class="icon-button lightbox-prev" aria-label="上一张" @click="stepImage(-1)">←</button>
            <img v-show="!imageState.unavailable" id="lightbox-image" :key="selectedImage.id" :src="imageState.source" :data-state="imageState.status" :alt="selectedImage.alt" :class="{ 'is-small-image': isSmallImage(selectedImage) }" :style="imageStyle(selectedImage)" decoding="async" @error="progressiveImage.displayError($event.currentTarget.getAttribute('src'))">
            <p v-if="imageState.status === 'error'" class="lightbox-image-error" role="status">这张图片暂时没有加载成功，可以切换到下一张。</p>
            <button v-if="previewImages.length > 1" id="lightbox-next" type="button" class="icon-button lightbox-next" aria-label="下一张" @click="stepImage(1)">→</button>
          </div>
          <div class="lightbox-bottom"><h3 id="lightbox-title">{{ selectedImage.title }}</h3><p id="lightbox-credit">{{ selectedImage.credit }}</p><p v-if="imageState.status === 'loading'" class="visually-hidden" role="status">正在加载高清图片…</p><p v-if="imageState.status === 'fallback'" class="lightbox-preview-notice" role="status">高清图片暂时无法加载，正在显示预览图。</p><p class="source-label">{{selectedImage.creator||'原作者待确认'}} · {{selectedImage.method}}</p><div class="source-links"><a v-if="selectedImage.sourceUrl" :href="selectedImage.sourceUrl" target="_blank" rel="noopener noreferrer">原作发布页 ↗</a><a v-if="selectedImage.creatorUrl" :href="selectedImage.creatorUrl" target="_blank" rel="noopener noreferrer">画师主页 ↗</a><RouterLink to="/room/sources">查看来源档案 ↗</RouterLink></div><div class="lightbox-actions"><button type="button" class="lightbox-favorite" :aria-label="favoriteLabel(selectedImage)" :aria-pressed="favorites.has(selectedImage.id)" @click="toggleFavorite(selectedImage)">{{ favorites.has(selectedImage.id) ? '♥ 已收藏' : '♡ 收藏这张' }}</button><a v-if="selectedImage.originalSrc" class="lightbox-original" :href="asset(selectedImage.originalSrc)" target="_blank" rel="noopener noreferrer">查看原图 <span aria-hidden="true">↗</span></a><button type="button" class="lightbox-share" @click="copyShareLink">复制分享链接 ↗</button></div><div v-if="shareLink" class="lightbox-share-field"><label for="gallery-share-link">图片分享链接</label><input id="gallery-share-link" ref="shareInput" :value="shareLink" readonly @focus="$event.target.select()"><p role="status">{{ shareMessage }}</p></div></div>
        </template>
      </dialog>
    </Teleport>
  </section>
</template>
