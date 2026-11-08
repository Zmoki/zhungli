/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
// Network first so updates arrive right away; cache when offline.
const CACHE = 'zhungli-v39';
const ASSETS = ['./', 'style.css', 'app.js', 'plants.js', 'shapes.js', 'changelog.js', 'telegram.js', 'privacy', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'fonts/nunito-cyrillic.woff2', 'fonts/nunito-latin.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // The update check must always ask the server and is never worth caching.
  if (url.pathname.endsWith('/version.txt')) return;
  // One cache entry per file: ?v= only busts the browser cache.
  const key = url.origin + url.pathname;
  // cache: 'no-cache' revalidates with the server instead of the browser HTTP cache.
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache' })
      .then((r) => {
        // A followed redirect can't be handed to a page navigation: redirect the page itself.
        if (r.redirected) return e.request.mode === 'navigate' ? Response.redirect(r.url, 302) : r;
        if (!r.ok) return caches.match(key).then((c) => c || r);
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(key, copy)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(key))
  );
});
