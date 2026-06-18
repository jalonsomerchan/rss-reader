if ('serviceWorker' in navigator) {
  const scriptUrl = new URL(import.meta.url);
  const appBaseUrl = new URL('../', scriptUrl);
  const serviceWorkerUrl = new URL('sw.js', appBaseUrl);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(serviceWorkerUrl, { scope: appBaseUrl.pathname }).catch(() => {});
  });
}
