/* Generated with a complete, immutable module graph for one production build. */
const manifest = __HITORI_MANIFEST__;
const prefix = 'hitori-offline-';
const cacheName = `${prefix}${manifest.version}`;
const preferencesName = 'hitori-offline-preferences';
const root = new URL(manifest.base, self.location.origin).href;
const absolute = file => new URL(file, root).href;
const stateRequest = new Request(absolute('__offline_selection__'));
const allAllowed = new Set([...manifest.core, ...Object.values(manifest.groups).flatMap(group => group.files)].map(absolute));
async function selection() {
  const response = await (await caches.open(preferencesName)).match(stateRequest);
  return response ? response.json() : { groups: [], enabled: false };
}
async function storeSelection(value) { await (await caches.open(preferencesName)).put(stateRequest, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })); }
async function notify(message) { for (const client of await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })) client.postMessage(message); }
async function cacheFiles(files, requestId) {
  const cache = await caches.open(cacheName), unique = [...new Set(files.map(absolute))];
  let done = 0;
  // Two in flight avoids a large decompression/upload spike on a phone.
  const next = async () => {
    while (unique.length) {
      const url = unique.shift();
      if (!await cache.match(url)) {
        const response = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
        if (!response.ok || response.type === 'opaque') throw new Error(`未能缓存 ${new URL(url).pathname.split('/').pop()}`);
        if (url === absolute('index.html') && manifest.entry && !(await response.clone().text()).includes(manifest.entry)) throw new Error('网站正在更新，请稍后重新下载离线玩法。');
        await cache.put(url, response);
      }
      done++; await notify({ type: 'HITORI_OFFLINE_PROGRESS', requestId, done, total: files.length });
    }
  };
  await Promise.all([next(), next()]);
}
self.addEventListener('install', event => event.waitUntil((async () => {
  // Initial install is tiny. A visitor must explicitly select gameplay downloads.
  const cache = await caches.open(cacheName);
  await cache.add(new Request(absolute('offline.html'), { cache: 'reload' }));
  const saved = await selection();
  if (saved.enabled) {
    const files = [...manifest.core, ...saved.groups.flatMap(id => manifest.groups[id]?.files || [])];
    await cacheFiles(files, 'update');
  }
  // Keep the old worker controlling open tabs until a visitor explicitly accepts the update.
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Keep one prior generation for existing tabs still importing its hashed modules.
  const names = (await caches.keys()).filter(name => name.startsWith(prefix) && name !== preferencesName && name !== cacheName);
  for (const name of names.slice(0, -1)) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  const message = event.data || {};
  if (message.type === 'HITORI_ACTIVATE_UPDATE') { self.skipWaiting(); return; }
  event.waitUntil((async () => {
    const reply = payload => event.ports[0]?.postMessage(payload);
    try {
      if (message.type === 'HITORI_CACHE_SELECTION') {
        const groups = [...new Set(message.groups || [])];
        if (groups.some(id => !Object.hasOwn(manifest.groups, id))) throw new Error('选择了无法离线的玩法。');
        const files = [...new Set([...manifest.core, ...groups.flatMap(id => manifest.groups[id].files)])];
        await cacheFiles(files, message.requestId);
        // Mark success only when the entire selected graph is available.
        await storeSelection({ groups, enabled: true, version: manifest.version });
        const keep = new Set(files.map(absolute));
        const cache = await caches.open(cacheName);
        for (const request of await cache.keys()) if (!keep.has(request.url)) await cache.delete(request);
        reply({ ok: true, version: manifest.version, groups });
      } else if (message.type === 'HITORI_CLEAR_OFFLINE') {
        const fallbacks = [];
        for (const name of await caches.keys()) if (name.startsWith(prefix) && name !== preferencesName) {
          const fallback = await (await caches.open(name)).match(absolute('offline.html'));
          if (fallback) fallbacks.push([name, fallback]);
          await caches.delete(name);
        }
        // Keep the tiny base page for current and waiting worker generations.
        for (const [name, fallback] of fallbacks) await (await caches.open(name)).put(absolute('offline.html'), fallback);
        await storeSelection({ groups: [], enabled: false, version: manifest.version });
        // This operation never touches IndexedDB, localStorage, drafts, or works.
        reply({ ok: true });
      } else if (message.type === 'HITORI_OFFLINE_STATUS') {
        let bytes = 0, count = 0;
        for (const name of await caches.keys()) if (name.startsWith(prefix) && name !== preferencesName) {
          const cache = await caches.open(name);
          for (const request of await cache.keys()) { const response = await cache.match(request); bytes += (await response.arrayBuffer()).byteLength; count++; }
        }
        reply({ ok: true, ...(await selection()), bytes, count, version: manifest.version, manifest });
      }
    } catch (error) { reply({ ok: false, error: error.message || '离线下载失败，已完成的缓存仍保留，请联网重试。' }); }
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(manifest.base)) return;
  // Never cache Supabase/auth/gallery or arbitrary large media, even after an online visit.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const saved = await selection(), cache = await caches.open(cacheName);
      if (saved.enabled) {
        // A selected offline session always uses its matching HTML/chunks until an explicit update.
        const html = await cache.match(absolute('index.html'));
        if (html) {
          // A plain bookmark opened offline should reach the cached activity home,
          // before Vue attempts to import an uncached homepage scene.
          const headers = new Headers(html.headers); headers.delete('Content-Length');
          const bootstrap = '<script>if(!navigator.onLine&&(!location.hash||location.hash==="#/"||location.hash==="#"))location.replace("#/room/play");<\/script>';
          return new Response((await html.text()).replace('</head>', bootstrap + '</head>'), { headers });
        }
      }
      try { return await fetch(request); }
      catch { return await cache.match(absolute('offline.html')) || Response.error(); }
    })());
    return;
  }
  if (allAllowed.has(request.url) || /\/assets\/[^/]+-[\w-]+\.(?:js|css)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const current = await (await caches.open(cacheName)).match(request);
      if (current) return current;
      // Existing tabs may still import a prior build's hashed chunk.
      for (const name of await caches.keys()) if (name.startsWith(prefix) && name !== preferencesName && name !== cacheName) {
        const prior = await (await caches.open(name)).match(request); if (prior) return prior;
      }
      return fetch(request);
    })());
  }
});
