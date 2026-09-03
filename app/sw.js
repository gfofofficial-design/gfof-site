// Galactic Federation of Finance — service worker
// Cache name is version-stamped. Bump CACHE_VERSION on each site deploy
// so installed PWAs rotate out old assets instead of serving stale ones.

const CACHE_VERSION = 'v18.0-2026-09-03';
const CACHE = 'gfof-' + CACHE_VERSION;
const ASSETS = ['/app', '/app/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  // Delete ANY older gfof-* cache so old installs clear out.
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('gfof-') && k !== CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Network-first for API / external live-data calls; cache-first for static assets.
  const url = e.request.url;
  if (url.includes('/api/') || url.includes('dexscreener') || url.includes('solscan') || url.includes('helius')) {
    e.respondWith(
      fetch(e.request).catch(
        () => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  if (e.request.method !== 'GET') {
    return; // let the browser handle non-GET requests untouched
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        // Clone IMMEDIATELY, before the response is returned or read anywhere.
        // Only cache successful, same-origin responses to avoid polluting the
        // cache with redirects, opaque errors, or third-party resources.
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE)
            .then((c) => c.put(e.request, clone))
            .catch(() => {}); // cache write failures must never break the page
        }
        return res;
      });
    })
  );
});
