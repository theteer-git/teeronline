// sw.js - resilient static caching and last-known-good live result fallback
const CACHE_NAME = 'teer-v5-last-known-results';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/game-unified-page.css',
  '/assets/css/task4b-seo.css',
  '/assets/css/task13-homepage.css',
  '/assets/img/logo.webp'
];

async function cacheSuccessfulResponse(request, response) {
  if (!response || !response.ok) return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
}

async function staleResultResponse(request, reason) {
  const cached = await caches.match(request);
  if (!cached) {
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

  const headers = new Headers(cached.headers);
  headers.set('x-teeronline-stale', '1');
  headers.set('warning', '110 - "Response is stale"');
  headers.set('cache-control', 'no-store');
  headers.set('x-teeronline-fallback-reason', String(reason || 'network-error').slice(0, 80));
  return new Response(await cached.clone().arrayBuffer(), {
    status: 200,
    statusText: 'OK (last known result)',
    headers
  });
}

async function navigationNetworkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) await cacheSuccessfulResponse(request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('The page is temporarily unavailable.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=UTF-8' }
    });
  }
}

async function staleWhileRevalidate(request, event) {
  const cached = await caches.match(request);
  const refresh = fetch(request).then(response => cacheSuccessfulResponse(request, response));
  if (cached) {
    event.waitUntil(refresh.catch(() => undefined));
    return cached;
  }
  return refresh;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // One missing optional asset must not abort installation of the complete SW.
    await Promise.allSettled(STATIC_ASSETS.map(asset => cache.add(asset)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, event));
});
