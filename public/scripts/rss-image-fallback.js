const FALLBACK_IMAGE_URL = 'https://dummyimage.com/480x480/e2e8f0/475569.png&text=RSS';

document.addEventListener(
  'error',
  (event) => {
    const image = event.target instanceof HTMLImageElement ? event.target : null;

    if (!image?.closest('[data-rss-reader]') || image.dataset.fallbackImage === 'true') {
      return;
    }

    image.dataset.fallbackImage = 'true';
    image.src = FALLBACK_IMAGE_URL;
  },
  true
);
