const CACHE_VERSION_PARAM = 'v';

if ('serviceWorker' in navigator) {
  const scriptUrl = new URL(import.meta.url);
  const appBaseUrl = new URL('../', scriptUrl);
  const serviceWorkerUrl = new URL('sw.js', appBaseUrl);
  const cacheVersion = scriptUrl.searchParams.get(CACHE_VERSION_PARAM);

  if (cacheVersion) {
    serviceWorkerUrl.searchParams.set(CACHE_VERSION_PARAM, cacheVersion);
  }

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register(serviceWorkerUrl, { scope: appBaseUrl.pathname });
      await registration.update();
    } catch {
      // The PWA layer is an enhancement. The app must remain usable if registration fails.
    }
  }

  window.addEventListener('load', () => {
    void registerServiceWorker();
  });
}
