// TeerOnline Pages service worker: cleanup only.
// Cloudflare CDN handles static caching. Live result JSON must never be intercepted.
const CACHE_NAME = 'teer-pages-v5';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Intentionally no fetch handler.
// Requests to results.teeronline.com always go directly to the network/Cloudflare edge.
