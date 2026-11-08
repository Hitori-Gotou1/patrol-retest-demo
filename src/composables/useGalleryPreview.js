import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { galleryRouteImage } from '../services/galleryDiscovery.js';

export function useGalleryPreview({ allImages, images, section, lightbox, loading }) {
  const route = useRoute();
  const router = useRouter();
  const selectedId = ref('');
  const pool = ref([]);
  const dialogOpen = ref(false);
  const linkNotice = ref('');
  const previewImages = computed(() => {
    const entries = new Map(allImages.value.map(item => [item.id, item]));
    return pool.value.map(id => entries.get(id)).filter(Boolean);
  });
  const selectedIndex = computed(() => previewImages.value.findIndex(item => item.id === selectedId.value));
  const selectedImage = computed(() => previewImages.value[selectedIndex.value]);
  const imageCounter = computed(() => `${String(selectedIndex.value + 1).padStart(2, '0')} / ${String(previewImages.value.length).padStart(2, '0')}`);
  let mounted = false;
  let revision = 0;
  let returnFocus;
  let trigger;
  let originalOverflow = '';
  let closing = false;
  let previousRouteId;

  function releaseDialog() {
    if (lightbox.value?.open) return;
    revision++;
    selectedId.value = '';
    if (!dialogOpen.value) return;
    dialogOpen.value = false;
    document.body.style.overflow = originalOverflow;
    if (mounted) (returnFocus?.isConnected ? returnFocus : section.value?.querySelector('h2'))?.focus({ preventScroll: true });
  }

  function hideDialog() {
    lightbox.value?.close();
    releaseDialog();
  }

  async function syncRoute() {
    if (!mounted) return;
    const request = ++revision;
    const raw = route.query.image;
    const id = galleryRouteImage(raw);
    if (raw !== previousRouteId) { closing = false; previousRouteId = raw; }
    if (closing) return;
    linkNotice.value = '';
    if (!id || !allImages.value.some(item => item.id === id)) {
      hideDialog();
      if (raw != null) linkNotice.value = id && loading.value ? '正在查找分享的图片…' : '这张分享的图片暂时无法找到，仍可浏览其他收藏。';
      return;
    }
    if (!pool.value.includes(id)) pool.value = allImages.value.map(item => item.id);
    selectedId.value = id;
    await nextTick();
    if (!mounted || request !== revision || !lightbox.value || !selectedImage.value || dialogOpen.value) return;
    const fromButton = trigger?.id === id;
    returnFocus = fromButton ? trigger.element : section.value?.querySelector('h2');
    trigger = undefined;
    window.scrollTo({ top: fromButton ? window.scrollY : section.value.getBoundingClientRect().top + window.scrollY, behavior: 'instant' });
    originalOverflow = document.body.style.overflow;
    lightbox.value.showModal();
    dialogOpen.value = true;
    document.body.style.overflow = 'hidden';
  }

  function navigate(location, replace = false) {
    return router[replace ? 'replace' : 'push'](location).catch(() => { linkNotice.value = '暂时无法打开这张图片，请重试。'; });
  }

  function openImage(item, event) {
    const element = event?.currentTarget || document.activeElement;
    trigger = { id: item.id, element: element?.closest('[aria-hidden="true"]')
      ? section.value?.querySelector(`[data-preview-id="${item.id}"]`) : element };
    pool.value = images.value.map(image => image.id);
    return navigate({ path: '/', query: { ...route.query, image: item.id }, hash: route.hash || '#gallery', state: { hitoriGalleryPreview: true } });
  }

  function clearLink() {
    const query = { ...route.query };
    delete query.image;
    return navigate({ path: '/', query, hash: '#gallery', state: { hitoriGalleryPreview: false } }, true);
  }

  function closeImage() {
    if (closing) return;
    if (route.query.image == null) { hideDialog(); return; }
    closing = true;
    if (window.history.state?.hitoriGalleryPreview === true) router.back();
    else clearLink();
  }

  function onDialogClose() {
    if (lightbox.value?.open) return;
    releaseDialog();
    if (mounted && route.query.image != null) closeImage();
  }

  function stepImage(step) {
    if (previewImages.value.length < 2 || closing) return;
    const index = (selectedIndex.value + step + previewImages.value.length) % previewImages.value.length;
    return navigate({ path: '/', query: { ...route.query, image: previewImages.value[index].id }, hash: route.hash }, true);
  }

  watch([() => route.query.image, allImages, loading], syncRoute, { flush: 'post' });
  onMounted(async () => { mounted = true; await nextTick(); syncRoute(); });
  onBeforeUnmount(() => { mounted = false; revision++; hideDialog(); });
  return { selectedImage, imageCounter, dialogOpen, previewImages, linkNotice, openImage, closeImage, stepImage, onDialogClose, clearLink };
}
