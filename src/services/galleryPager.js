// A small metadata cache only. It never stores image files or user creations.
const caches = new Map();
export const galleryCacheTTL = 5 * 60 * 1000;

export function mergeGalleryPages(items, incoming) {
  const records = new Map(items.map(item => [item.id, item]));
  for (const item of incoming) if (item?.id) records.set(item.id, item);
  return [...records.values()].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
    || String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || b.id.localeCompare(a.id));
}

export function createGalleryPager({ fetchPage, cacheKey = '', pageSize = 36, ttl = galleryCacheTTL, now = Date.now, onChange = () => {} }) {
  const cached = caches.get(cacheKey);
  let state = { items: cached?.items || [], cursor: cached?.cursor || null, hasMore: cached?.hasMore ?? true,
    loading: false, error: null, updatedAt: cached?.updatedAt || 0, complete: cached?.complete || false };
  let epoch = 0;
  let active;
  let stopped = false;
  const emit = changes => { state = { ...state, ...changes }; onChange({ ...state, items: [...state.items] }); };
  const save = () => { if (cacheKey) caches.set(cacheKey, { ...state, items: [...state.items], loading: false, error: null }); };
  const snapshot = () => ({ ...state, items: [...state.items] });
  async function request(reset = false) {
    if (stopped) return snapshot();
    if (active && !reset) return active.promise;
    if (!reset && !state.hasMore) return snapshot();
    if (reset) { epoch++; active?.controller.abort(); }
    const requestEpoch = epoch;
    const controller = new AbortController();
    const cursor = reset ? null : state.cursor;
    emit({ loading: true, error: null });
    const promise = Promise.resolve().then(() => fetchPage({ cursor, limit: pageSize, signal: controller.signal })).then(page => {
      if (stopped || requestEpoch !== epoch) return snapshot();
      if (!page || !Array.isArray(page.items)) throw new Error('收藏数据格式不正确。');
      if (page.hasMore && (!page.cursor || (cursor && JSON.stringify(page.cursor) === JSON.stringify(cursor)))) throw new Error('云端分页位置没有前进，请刷新收藏后重试。');
      const items = mergeGalleryPages(reset ? [] : state.items, page.items);
      emit({ items, cursor: page.cursor || null, hasMore: Boolean(page.hasMore), complete: !page.hasMore, updatedAt: now() });
      save();
      return snapshot();
    }).catch(error => {
      if (!stopped && requestEpoch === epoch && error?.name !== 'AbortError') emit({ error });
      return snapshot();
    }).finally(() => {
      if (!stopped && requestEpoch === epoch) { active = undefined; emit({ loading: false }); }
    });
    active = { controller, promise };
    return promise;
  }
  async function start() {
    emit({});
    if (!state.updatedAt || now() - state.updatedAt >= ttl) return request(true);
    return snapshot();
  }
  // Searching a subset would quietly omit matching records. Explicit filters
  // exhaust the metadata pages, exposing progress until coverage is complete.
  async function ensureComplete() {
    if (active) await active.promise;
    while (!stopped && state.hasMore && !state.error) await request();
    return snapshot();
  }
  function add(item) { emit({ items: mergeGalleryPages(state.items, [item]) }); }
  function dispose() { stopped = true; epoch++; active?.controller.abort(); active = undefined; }
  return { start, loadMore: () => request(), refresh: () => request(true), ensureComplete, add, snapshot, dispose };
}

export function clearGalleryMetadataCache(cacheKey) { cacheKey ? caches.delete(cacheKey) : caches.clear(); }
