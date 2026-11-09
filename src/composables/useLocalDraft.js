import { onBeforeUnmount, ref, watch } from 'vue';
import { loadLocal, saveLocal } from '../room/storage.js';

export function useLocalDraft(key, fallback, validate) {
  const state = ref(loadLocal(key, fallback, validate));
  const saved = ref(true);
  let timer;
  const persist = () => { clearTimeout(timer); saved.value = saveLocal(key, state.value); };
  watch(state, () => { clearTimeout(timer); timer = setTimeout(persist, 150); }, { deep: true });
  window.addEventListener('pagehide', persist);
  onBeforeUnmount(() => { persist(); window.removeEventListener('pagehide', persist); });
  return { state, saved, persist };
}
