import { reactive } from 'vue';
import { startDraftFlushBridge } from './draftPersistence.js';
export const deviceState = reactive({ supported: false, ready: false, installing: false, canInstall: false,
  installed: false, updateAvailable: false, changedVersion: false, online: true, error: '', progress: null });
let registration, installPrompt, started = false;
const settingsKey = 'hitori-room:sync-settings:v1';
export async function startDeviceServices() {
  if (started || typeof window === 'undefined') return;
  started = true; startDraftFlushBridge();
  deviceState.supported = 'serviceWorker' in navigator && window.isSecureContext;
  deviceState.online = navigator.onLine;
  const online = () => { deviceState.online = navigator.onLine; };
  window.addEventListener('online', online); window.addEventListener('offline', online);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; deviceState.canInstall = true; });
  window.addEventListener('appinstalled', () => { installPrompt = undefined; deviceState.canInstall = false; deviceState.installed = true; });
  deviceState.installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (deviceState.supported && import.meta.env.PROD) {
    try {
      registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' });
      const notice = () => { deviceState.updateAvailable = !!registration.waiting; };
      notice();
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', notice);
      });
      let controlled = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (controlled) deviceState.changedVersion = true;
        controlled = true; deviceState.updateAvailable = false;
      });
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'HITORI_OFFLINE_PROGRESS') deviceState.progress = event.data;
      });
      await navigator.serviceWorker.ready;
    } catch { deviceState.error = '离线服务暂时无法启动。作品和草稿仍可在本机使用，联网后可重试。'; }
  }
  deviceState.ready = true;
  // Only an explicitly enabled account starts the auth SDK and background sync.
  try {
    const settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
    if (settings.enabled) void import('./cloudSync.js').then(module => module.initializeSync()).catch(() => {});
  } catch { /* Invalid optional preferences must never block startup. */ }
}
export async function installDeviceApp() {
  if (!installPrompt) return false;
  deviceState.installing = true;
  try { await installPrompt.prompt(); const result = await installPrompt.userChoice; installPrompt = undefined; deviceState.canInstall = false; return result.outcome === 'accepted'; }
  finally { deviceState.installing = false; }
}
async function workerRequest(type, data = {}) {
  if (!registration) await startDeviceServices();
  if (!registration) throw new Error(import.meta.env.DEV ? '离线缓存需在生产构建预览中使用。' : '此浏览器暂不支持离线缓存，请使用 HTTPS 下的较新浏览器。');
  const worker = navigator.serviceWorker.controller || registration.active;
  if (!worker) throw new Error('离线服务正在准备，请稍后重试。');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('离线操作等待过久，已保存的缓存仍保留，请联网重试。')); }, 120000);
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); event.data?.ok ? resolve(event.data) : reject(new Error(event.data?.error || '离线操作未完成，请重试。')); };
    worker.postMessage({ type, ...data }, [channel.port2]);
  });
}
export const offlineStatus = () => workerRequest('HITORI_OFFLINE_STATUS');
export async function cacheOfflineSelection(groups) {
  deviceState.progress = { done: 0, total: 1 };
  try { return await workerRequest('HITORI_CACHE_SELECTION', { groups: Array.from(groups), requestId: crypto.randomUUID() }); }
  finally { deviceState.progress = null; }
}
export const clearOfflineCache = () => workerRequest('HITORI_CLEAR_OFFLINE');
export async function checkDeviceUpdate() {
  if (!registration) await startDeviceServices();
  if (!registration) throw new Error('离线服务尚未准备好。');
  await registration.update(); deviceState.updateAvailable = !!registration.waiting;
}
export async function acceptDeviceUpdate() {
  if (!registration?.waiting) return;
  // The new worker already cached a full new resource graph before it became waiting.
  const changed = new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  registration.waiting.postMessage({ type: 'HITORI_ACTIVATE_UPDATE' });
  await changed;
  location.reload();
}
