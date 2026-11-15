import { onBeforeUnmount, ref, watch } from 'vue';
import { loadLocal } from '../room/storage.js';
import { createDraftPersistence, startDraftFlushBridge } from '../services/draftPersistence.js';
export function useLocalDraft(key, fallback, validate, { validateOnSave = false } = {}) {
  const state = ref(loadLocal(key, fallback, validate));
  const saved = ref(true);
  let timer;
  startDraftFlushBridge();
  const guard = createDraftPersistence({ key, read: () => state.value, validate, fallback, validateOnWrite: validateOnSave,
    replace: incoming => { clearTimeout(timer); state.value = incoming; saved.value = true; },
    onExternal: result => { if (result.invalid || result.conflict) saved.value = false; } });
  const persist = () => { clearTimeout(timer); const success = guard.write(); saved.value = success; return success; };
  watch(state, () => { clearTimeout(timer); timer = setTimeout(persist, 150); }, { deep: true });
  function capture(event) {
    if (event.detail?.key !== key) return;
    guard.adopt();
    try { event.detail.snapshot = validate(state.value); }
    catch (error) { event.detail.error = error.message; }
  }
  window.addEventListener('hitori:capture-draft', capture);
  window.addEventListener('pagehide', persist);
  onBeforeUnmount(() => { persist(); guard.destroy(); window.removeEventListener('pagehide', persist); window.removeEventListener('hitori:capture-draft', capture); });
  return { state, saved, persist };
}
