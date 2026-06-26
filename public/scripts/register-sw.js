const CACHE_VERSION_PARAM = 'v';
const RELOAD_STORAGE_KEY = 'rss-reader:pwa-reloaded-for-version';

if ('serviceWorker' in navigator) {
  const scriptUrl = new URL(import.meta.url);
  const appBaseUrl = new URL('../', scriptUrl);
  const serviceWorkerUrl = new URL('sw.js', appBaseUrl);
  const cacheVersion = scriptUrl.searchParams.get(CACHE_VERSION_PARAM);
  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;

  if (cacheVersion) {
    serviceWorkerUrl.searchParams.set(CACHE_VERSION_PARAM, cacheVersion);
  }

  function requestWaitingWorkerActivation(registration) {
    if (!registration.waiting) {
      return;
    }

    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  function shouldReloadForVersion() {
    if (!cacheVersion) {
      return false;
    }

    return sessionStorage.getItem(RELOAD_STORAGE_KEY) !== cacheVersion;
  }

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register(serviceWorkerUrl, { scope: appBaseUrl.pathname });
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;

        if (!worker) {
          return;
        }

        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            requestWaitingWorkerActivation(registration);
          }
        });
      });

      await registration.update();
      requestWaitingWorkerActivation(registration);
    } catch {
      // The PWA layer is an enhancement. The app must remain usable if registration fails.
    }
  }

  function updateServiceWorkerWhenVisible() {
    if (document.visibilityState !== 'visible') {
      return;
    }

    navigator.serviceWorker.getRegistration(appBaseUrl.pathname).then((registration) => {
      if (registration) {
        void registration.update();
      }
    });
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing || !shouldReloadForVersion()) {
      return;
    }

    refreshing = true;
    sessionStorage.setItem(RELOAD_STORAGE_KEY, cacheVersion);
    window.location.reload();
  });

  document.addEventListener('visibilitychange', updateServiceWorkerWhenVisible);
  window.addEventListener('focus', updateServiceWorkerWhenVisible);
  window.addEventListener('load', () => {
    void registerServiceWorker();
  });
}
