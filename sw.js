/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
// The page and unversioned files: network first so updates arrive right away; cache when offline.
// Files with ?v= never change within a version: cache first, kept per version.
const CACHE = 'zhungli-v88';
// Scripts and styles are read from index.html with their ?v=, so they're listed only there.
const STATIC = ['privacy', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'fonts/nunito-cyrillic.woff2', 'fonts/nunito-latin.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const page = await fetch('./', { cache: 'no-cache' });
    if (!page.ok) throw new Error('index ' + page.status);
    const html = await page.clone().text();
    const versioned = [...html.matchAll(/(?:src|href)="([^":]+\?v=\d+)"/g)].map((m) => m[1]);
    await c.addAll([...versioned, ...STATIC]);
    await c.put(keyOf(new URL('./', self.location)), page);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// One cache entry per file, and per version for ?v= files: a failed request never gets a file
// from another version, whose scripts may not fit together with this one's.
const keyOf = (url) => url.origin + url.pathname + (url.searchParams.has('v') ? '?v=' + url.searchParams.get('v') : '');

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // The update check must always ask the server and is never worth caching.
  if (url.pathname.endsWith('/version.txt')) return;
  const key = keyOf(url);
  // cache: 'no-cache' revalidates with the server instead of the browser HTTP cache.
  const network = () => fetch(e.request.url, { cache: 'no-cache' })
    .then((r) => {
      // A followed redirect can't be handed to a page navigation: redirect the page itself.
      if (r.redirected) return e.request.mode === 'navigate' ? Response.redirect(r.url, 302) : r;
      if (!r.ok) return caches.match(key).then((c) => c || r);
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(key, copy)).catch(() => {});
      return r;
    })
    .catch(() => caches.match(key));
  e.respondWith(url.searchParams.has('v') ? caches.match(key).then((c) => c || network()) : network());
});
