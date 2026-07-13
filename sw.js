// sw.js - Safe caching for static assets and live result JSON
const CACHE_NAME = 'teer-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/styles.css',
  '/assets/img/logo.webp'
];

const LIVE_JSON_PATHS = new Set([
  '/latest-results.json',
  '/recent-results.json',
  '/all-results.json'
]);

function isLiveResultJson(requestUrl) {
  try {
    const url = new URL(requestUrl);
    return (
      url.hostname === 'results.teeronline.com' &&
      LIVE_JSON_PATHS.has(url.pathname)
    );
  } catch (_) {
    return false;
  }
}

async function networkFirst(request) {
  try {
    return await fetch(request, { cache: 'no-store' });
  } catch (error) {
    // Live result JSON must never fall back to a stale cached copy.
    return new Response(
      JSON.stringify({ error: 'Live result data is temporarily unavailable.' }),
      {
        status: 503,
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'cache-control': 'no-store'
        }
      }
    );
  }
}

async function staleWhileRevalidate(request, event) {
  const cached = await caches.match(request);
  const refresh = fetch(request).then(async response => {
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  });

  if (cached) {
    event.waitUntil(refresh.catch(() => undefined));
    return cached;
  }

  return refresh;
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  if (isLiveResultJson(request.url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(staleWhileRevalidate(request, event));
});
