/* Gerbil Atlas Explorer: offline after the first visit.
   The shell (index.html) is cached on install; every plate image, the meshes and the
   database are cached the first time they are fetched, so a rig computer that opened
   the page once keeps working without a network.

   The cache is named for the build: the page registers this worker as sw.js?v=<commit>
   (tools/build_app.py stamps it), so a new build is a new worker with a cache of its
   own, and activating it drops the old one -- plates, meshes and all. That is what lets
   a rebuilt data/ file reach a returning visitor: data/ is served cache-first below,
   and a cache that outlived the build it was filled from would serve the old meshes
   for ever. */
const VERSION = 'gae-' + (new URL(self.location.href).searchParams.get('v') || '1');
const SHELL = ['./', 'index.html', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* network first for the shell, so a new build is picked up when there is a network;
   cache first for everything under data/, which never changes for a given build */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/data\//.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  /* the copy for the cache is taken before the response is handed back: once it is,
     the browser holds its body, and a clone taken later throws instead of caching */
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
