<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { galleryImages } from '../data/gallery.js';
import '../styles/gallery-enhancements.css';

const section = ref(null);
const lightbox = ref(null);
const activeFilter = ref('all');
const mode = ref('wall');
const paused = ref(false);
const reducedMotion = ref(false);
const inView = ref(false);
const pageVisible = ref(true);
const dialogOpen = ref(false);
const favorites = ref(new Set());
const status = ref('');
const imageError = ref(false);
const selectedId = ref('');
const wallPageSize = 9;
const wallLimit = ref(wallPageSize);
const storageKey = 'hitori-room:favorites:v1';
const filters = [{ id: 'all', label: '全部' }, { id: 'collection', label: '站主收藏' }, { id: 'illustration', label: '同人插画' }, { id: 'poster', label: '设计海报' }];
const images = computed(() => galleryImages.filter(item => activeFilter.value === 'all' || item.category === activeFilter.value));
const visibleImages = computed(() => images.value.slice(0, wallLimit.value));
const selectedIndex = computed(() => images.value.findIndex(item => item.id === selectedId.value));
const selectedImage = computed(() => images.value[selectedIndex.value]);
const imageCounter = computed(() => `${String(selectedIndex.value + 1).padStart(2, '0')} / ${String(images.value.length).padStart(2, '0')}`);
const flowing = computed(() => mode.value === 'flow' && !paused.value && !reducedMotion.value && inView.value && pageVisible.value && !dialogOpen.value);
const rows = computed(() => [0, 1, 2].map(offset => {
  if (!images.value.length) return [];
  // 三行分担素材，只复制一组用于首尾衔接，避免每行重复加载整份收藏。
  const group = images.value.filter((_, index) => index % 3 === offset);
  const source = group.length ? group : images.value;
  const length = Math.max(4, source.length);
  return Array.from({ length }, (_, index) => source[index % source.length]);
}));
const asset = path => `${import.meta.env.BASE_URL}${path}`;
const isSmallImage = item => Number.isFinite(item.width) && Number.isFinite(item.height) && Math.max(item.width, item.height) <= 300;
const imageStyle = item => isSmallImage(item) ? { '--gallery-image-width': `${item.width}px`, '--gallery-image-height': `${item.height}px` } : undefined;
const flowDuration = (length, index) => `${([47, 57, 39][index] * length / 3).toFixed(1)}s`;
let observer;
let motionQuery;
let returnFocus;
let originalOverflow = '';
let touchOrigin;
let mounted = false;

function setFilter(id) {
  activeFilter.value = id;
  wallLimit.value = wallPageSize;
  status.value = `显示 ${images.value.length} 张`;
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
  favorites.value = next;
  try {
    localStorage.setItem(storageKey, JSON.stringify([...next]));
    status.value = `已收藏 ${next.size} 张`;
  } catch {
    status.value = '当前浏览器无法保存收藏，仅本次有效';
  }
}
function favoriteLabel(item) {
  return `${favorites.value.has(item.id) ? '取消收藏' : '收藏'}：${item.title}`;
}
async function openImage(item, event) {
  selectedId.value = item.id;
  imageError.value = false;
  const trigger = event?.currentTarget || document.activeElement;
  returnFocus = trigger?.closest('[aria-hidden="true"]')
    ? section.value?.querySelector(`[data-preview-id="${item.id}"]`)
    : trigger;
  await nextTick();
  if (!lightbox.value || !selectedImage.value || dialogOpen.value) return;
  // 终止尚未结束的分屏滚动，再冻结背景；关闭时恢复原先的 overflow。
  window.scrollTo({ top: window.scrollY, behavior: 'instant' });
  originalOverflow = document.body.style.overflow;
  lightbox.value.showModal();
  dialogOpen.value = true;
  document.body.style.overflow = 'hidden';
}
function closeImage() {
  lightbox.value?.close();
  releaseDialog();
}
function releaseDialog() {
  if (!dialogOpen.value) return;
  dialogOpen.value = false;
  document.body.style.overflow = originalOverflow;
  if (mounted && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}
function stepImage(step) {
  if (images.value.length < 2) return;
  const index = (selectedIndex.value + step + images.value.length) % images.value.length;
  selectedId.value = images.value[index].id;
  imageError.value = false;
}
function dialogKeydown(event) {
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
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) favorites.value = new Set(saved.filter(id => galleryImages.some(image => image.id === id)));
  } catch { /* 隐私模式下仍可在当前页面收藏。 */ }
  motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  syncMotion();
  syncVisibility();
  motionQuery.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncVisibility);
  observer = new IntersectionObserver(([entry]) => { inView.value = entry.isIntersecting; }, { threshold: 0.05 });
  observer.observe(section.value);
});
onBeforeUnmount(() => {
  mounted = false;
  observer?.disconnect();
  motionQuery?.removeEventListener('change', syncMotion);
  document.removeEventListener('visibilitychange', syncVisibility);
  lightbox.value?.close();
  releaseDialog();
});
</script>

<template>
  <section id="gallery" ref="section" class="gallery-section scene" data-scene-name="心动收藏" aria-labelledby="gallery-title">
    <div class="scene-inner">
      <div class="section-label"><span>04 / 把喜欢贴在墙上</span><span>把喜欢，认真收藏。</span></div>
      <div class="section-heading">
        <div><h2 id="gallery-title">心动，有迹可循<span class="pink-period">.</span></h2><p>像收集票根一样，收集每一次舍不得划走的瞬间。</p></div>
        <div class="filters" role="group" aria-label="筛选收藏">
          <button v-for="filter in filters" :key="filter.id" type="button" class="filter" :class="{ active: activeFilter === filter.id }" :data-filter="filter.id" :aria-pressed="activeFilter === filter.id" @click="setFilter(filter.id)">{{ filter.label }}<span v-if="filter.id === 'all'">{{ String(galleryImages.length).padStart(2, '0') }}</span></button>
        </div>
      </div>
      <div class="gallery-view-bar">
        <div class="gallery-view-switch" role="group" aria-label="相册展示方式">
          <button type="button" :aria-pressed="mode === 'wall'" @click="mode = 'wall'"><span aria-hidden="true">▤</span> 收藏墙</button>
          <button type="button" :aria-pressed="mode === 'flow'" @click="mode = 'flow'"><span aria-hidden="true">≋</span> 流动视图</button>
        </div>
        <button v-if="mode === 'flow'" type="button" class="gallery-motion-toggle" :disabled="reducedMotion" :aria-pressed="paused || reducedMotion" @click="paused = !paused">{{ reducedMotion ? '已减少动态效果' : paused ? '继续流动 ▶' : '暂停流动 Ⅱ' }}</button>
        <span v-else class="gallery-view-note">小小收藏，慢慢翻阅。</span>
      </div>
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
      <p v-if="!images.length" class="gallery-empty">这一页还在等待新的心动。</p>
      <p class="gallery-note"><span aria-hidden="true">↗</span> 点击图片放大 · 左右滑动预览 · 收藏留在这台设备 <span id="gallery-status" role="status" aria-live="polite">{{ status }}</span></p>
      <div v-if="mode === 'wall'" class="gallery-stamp" aria-hidden="true">KEEP<br>THE FEELING.</div>
    </div>
    <Teleport to="body">
      <dialog id="lightbox" ref="lightbox" class="lightbox gallery-lightbox" aria-labelledby="lightbox-title" @close="releaseDialog" @cancel.prevent="closeImage" @keydown="dialogKeydown" @click="dialogBackdrop">
        <template v-if="selectedImage">
          <div class="lightbox-toolbar"><span id="lightbox-count" aria-live="polite">{{ imageCounter }}</span><span class="lightbox-hint">左右滑动 / 方向键切换</span><button id="lightbox-close" type="button" class="icon-button" aria-label="关闭图片" @click="closeImage">×</button></div>
          <div class="lightbox-image-wrap" @touchstart.passive="startTouch" @touchend.passive="endTouch" @touchcancel="touchOrigin = null">
            <button v-if="images.length > 1" id="lightbox-prev" type="button" class="icon-button lightbox-prev" aria-label="上一张" @click="stepImage(-1)">←</button>
            <img v-show="!imageError" id="lightbox-image" :key="selectedImage.id" :src="asset(selectedImage.src)" :alt="selectedImage.alt" :class="{ 'is-small-image': isSmallImage(selectedImage) }" :style="imageStyle(selectedImage)" decoding="async" @error="imageError = true">
            <p v-if="imageError" class="lightbox-image-error" role="status">这张图片暂时没有加载成功，可以切换到下一张。</p>
            <button v-if="images.length > 1" id="lightbox-next" type="button" class="icon-button lightbox-next" aria-label="下一张" @click="stepImage(1)">→</button>
          </div>
          <div class="lightbox-bottom"><h3 id="lightbox-title">{{ selectedImage.title }}</h3><p id="lightbox-credit">{{ selectedImage.credit }}</p><div class="lightbox-actions"><button type="button" class="lightbox-favorite" :aria-label="favoriteLabel(selectedImage)" :aria-pressed="favorites.has(selectedImage.id)" @click="toggleFavorite(selectedImage)">{{ favorites.has(selectedImage.id) ? '♥ 已收藏' : '♡ 收藏这张' }}</button><a v-if="selectedImage.originalSrc" class="lightbox-original" :href="asset(selectedImage.originalSrc)" target="_blank" rel="noopener noreferrer">查看原图 <span aria-hidden="true">↗</span></a></div></div>
        </template>
      </dialog>
    </Teleport>
  </section>
</template>
