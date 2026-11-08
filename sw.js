/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
// Network first so updates arrive right away; cache when offline.
const CACHE = 'zhungli-v26';
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'plants.js', 'shapes.js', 'changelog.js', 'privacy', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  // cache: 'no-cache' revalidates with the server instead of the browser HTTP cache.
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) return caches.match(e.request, { ignoreSearch: true }).then((c) => c || r);
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
