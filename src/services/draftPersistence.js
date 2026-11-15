import { shallowReactive } from 'vue';
export const draftOwnerKey = 'hitori-room:sync-local-owner:v1';
export const draftConflicts = shallowReactive([]);
const plain = value => JSON.parse(JSON.stringify(value));
function safeStorage(storage) { try { return storage || globalThis.localStorage; } catch { return null; } }
// Editor persistence checks both raw storage and the account binding before every write.
export function createDraftPersistence({ key, read, replace, validate, storage, fallback, validateOnWrite = true, onExternal = () => {}, canFlush = () => true }) {
  const target = safeStorage(storage);
  let raw, owner, readable = false, stopped = false, conflict;
  const serialize = () => JSON.stringify(validateOnWrite ? validate(read()) : read());
  let lastValue = serialize();
  const fallbackValue = plain(validate(fallback ?? read()));
  function inspect() {
    try { if (!target) return null; return { raw: target.getItem(key), owner: target.getItem(draftOwnerKey) }; }
    catch { return null; }
  }
  const initial = inspect();
  if (initial) { raw = initial.raw; owner = initial.owner; readable = true; }
  function clearConflict() {
    if (!conflict) return;
    const index = draftConflicts.indexOf(conflict); if (index >= 0) draftConflicts.splice(index, 1); conflict = undefined;
  }
  function applyIncoming(current, incoming) {
    raw = current.raw; owner = current.owner; readable = true; lastValue = JSON.stringify(incoming);
    replace(incoming); onExternal({ invalid: false, key });
  }
  function adopt() {
    if (stopped) return false;
    const current = inspect();
    if (!current) { onExternal({ invalid: true, unavailable: true, key }); return true; }
    if (readable && current.raw === raw && current.owner === owner) return !!conflict;
    if (readable && !owner && current.raw === raw && current.owner) { owner = current.owner; return false; }
    let incoming;
    try { incoming = current.raw ? validate(JSON.parse(current.raw)) : plain(fallbackValue); }
    catch { onExternal({ invalid: true, key }); return true; }
    let currentValue;
    try { currentValue = serialize(); } catch { currentValue = JSON.stringify(plain(read())); }
    if (currentValue !== lastValue && current.raw !== raw) {
      // A real unsaved local edit and a new incoming draft both survive until an explicit choice.
      if (!conflict) {
        const local = plain(read());
        conflict = { key, local, incoming: plain(incoming), ownerChanged: owner !== current.owner,
          resolve(choice) {
            const latest = inspect();
            if (!latest || latest.raw !== current.raw || latest.owner !== current.owner) throw new Error('另一份草稿又有变化，请先保留当前 JSON，再重新打开编辑器。');
            if (choice === 'local') {
              if (owner !== latest.owner) throw new Error('账号已切换，请先导出原账号草稿，避免混入新账号。');
              const checked = validateOnWrite ? validate(local) : plain(local);
              target.setItem(key, JSON.stringify(checked)); raw = JSON.stringify(checked); lastValue = raw;
              replace(plain(checked));
              if (typeof window !== 'undefined') window.dispatchEvent(new StorageEvent('storage', { key, newValue: raw, storageArea: target }));
            } else if (choice === 'incoming') applyIncoming(latest, plain(incoming));
            else throw new Error('请选择保留哪份草稿。');
            clearConflict();
          } };
        draftConflicts.push(conflict);
      }
      onExternal({ conflict: true, key }); return true;
    }
    clearConflict(); applyIncoming(current, plain(incoming)); return true;
  }
  function write() {
    try {
      if (stopped || conflict || adopt()) return false;
      const value = serialize(); target.setItem(key, value); raw = value; lastValue = value; owner = target.getItem(draftOwnerKey); readable = true; return true;
    } catch { return false; }
  }
  function receive(event) { if (!event || event.type === 'hitori:sync-applied' || event.key === key || event.key === draftOwnerKey || event.key === null) adopt(); }
  function flush(event) {
    if (!canFlush()) return;
    if (!write() && event?.detail) event.detail.failed = true;
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', receive); window.addEventListener('hitori:sync-applied', receive); window.addEventListener('hitori:flush-drafts', flush);
  }
  return { write, receive, adopt, get conflicted() { return !!conflict; }, get available() { return readable; }, destroy() {
    stopped = true;
    if (typeof window !== 'undefined') { window.removeEventListener('storage', receive); window.removeEventListener('hitori:sync-applied', receive); window.removeEventListener('hitori:flush-drafts', flush); }
  } };
}
let broadcast, beforeUnloadSet = false;
const pendingFlush = new Map();
export function startDraftFlushBridge() {
  if (typeof window === 'undefined') return;
  if (!beforeUnloadSet) { beforeUnloadSet = true; window.addEventListener('beforeunload', event => { if (draftConflicts.length) { event.preventDefault(); event.returnValue = ''; } }); }
  if (broadcast || typeof BroadcastChannel === 'undefined') return;
  broadcast = new BroadcastChannel('hitori-room:draft-flush:v1');
  broadcast.addEventListener('message', event => {
    if (event.data?.type === 'flush') {
      const detail = {}; window.dispatchEvent(new CustomEvent('hitori:flush-drafts', { detail }));
      broadcast.postMessage({ type: 'flush-result', request: event.data.request, failed: !!detail.failed });
    } else if (event.data?.type === 'flush-result' && event.data.failed) pendingFlush.get(event.data.request)?.();
  });
}
export async function flushLiveDrafts() {
  const detail = {}; window.dispatchEvent(new CustomEvent('hitori:flush-drafts', { detail }));
  if (detail.failed || draftConflicts.length) throw new Error('有打开的草稿暂时无法保存或正在处理冲突，请先回到编辑器检查后重试同步。');
  startDraftFlushBridge();
  if (broadcast) {
    const request = crypto.randomUUID(); let failed = false;
    pendingFlush.set(request, () => { failed = true; }); broadcast.postMessage({ type: 'flush', request });
    await new Promise(resolve => setTimeout(resolve, 220)); pendingFlush.delete(request);
    if (failed) throw new Error('另一个标签页的草稿尚未保存，请先处理后重试同步。');
  }
}
