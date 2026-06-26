const DEFAULT_CACHE_VERSION = '2026-06-26-1';
const CACHE_VERSION = new URL(self.location.href).searchParams.get('v') ?? DEFAULT_CACHE_VERSION;
const CACHE_NAME = `rss-reader-pwa-${CACHE_VERSION}`;
const PRECACHE_PAGES = ['./'];
const PRECACHE_ASSETS = [
  './manifest.webmanifest',
  './icons/android-chrome-192x192.png',
  './icons/android-chrome-512x512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32x32.png',
  './icons/favicon-16x16.png',
];

function toScopeUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

function withCacheVersion(url) {
  const versionedUrl = new URL(url);
  versionedUrl.searchParams.set('v', CACHE_VERSION);

  return versionedUrl.toString();
}

async function putInCache(request, response) {
  if (!response || response.status !== 200) {
    return;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function getCachedOrFetch(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  await putInCache(request, response);

  return response;
}

async function getNetworkOrCached(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    await putInCache(request, response);

    return response;
  } catch {
    return (await caches.match(request)) ?? Response.error();
  }
}

async function getNavigationResponse(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    await putInCache(request, response);

    return response;
  } catch {
    return (await caches.match(request)) ?? (await caches.match(toScopeUrl('./'))) ?? Response.error();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll([...PRECACHE_PAGES.map(toScopeUrl), ...PRECACHE_ASSETS.map(toScopeUrl).map(withCacheVersion)])
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(getNavigationResponse(request));
    return;
  }

  if (['script', 'style', 'font'].includes(request.destination) || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(getNetworkOrCached(request));
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(getCachedOrFetch(request));
  }
});
