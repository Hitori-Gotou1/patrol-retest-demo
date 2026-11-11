import { onBeforeUnmount, ref, watch } from 'vue';
import { loadLocal, saveLocal } from '../room/storage.js';

export function useLocalDraft(key, fallback, validate) {
  const state = ref(loadLocal(key, fallback, validate));
  const saved = ref(true);
  let timer;
  const persist = () => { clearTimeout(timer); saved.value = saveLocal(key, state.value); };
  watch(state, () => { clearTimeout(timer); timer = setTimeout(persist, 150); }, { deep: true });
  function capture(event) {
    if (event.detail?.key !== key) return;
    try { event.detail.snapshot = validate(state.value); }
    catch (error) { event.detail.error = error.message; }
  }
  window.addEventListener('hitori:capture-draft', capture);
  window.addEventListener('pagehide', persist);
  onBeforeUnmount(() => { persist(); window.removeEventListener('pagehide', persist); window.removeEventListener('hitori:capture-draft', capture); });
  return { state, saved, persist };
}
