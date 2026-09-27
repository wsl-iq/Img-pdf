const CACHE_NAME = 'img2pdf-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/animations.css',
  './css/mobile.css',
  './css/ipad.css',
  './css/computer.css',
  './js/app.js',
  './js/utils.js',
  './js/storage.js',
  './js/idb.js',
  './js/history.js',
  './js/theme.js',
  './js/fonts.js',
  './js/sizeScreen.js',
  './js/haptics.js',
  './js/shortcuts.js',
  './js/badge.js',
  './js/cache.js',
  './js/duplicates.js',
  './js/suggest.js',
  './js/stats.js',
  './js/exportImport.js',
  './js/editor.js',
  './js/images.js',
  './js/pdf.js',
  './js/docx.js',
  './js/ui.js',
  './workers/imageWorker.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isFont = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');

  if (isFont) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request))
  );
});