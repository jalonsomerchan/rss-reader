import { readCachedJson, writeCachedJson } from './rss-cache.js';

const MONTH_FORMATTER = new Intl.NumberFormat('en', {
  minimumIntegerDigits: 2,
  useGrouping: false,
});

const JSON_CACHE = new Map();

export function getCleanApiBase(apiBase) {
  return apiBase.endsWith('/') ? apiBase : `${apiBase}/`;
}

export async function fetchJson(apiBase, path, options = {}) {
  const url = `${getCleanApiBase(apiBase)}${path}`;
  const cachedData = options.refresh ? null : readCachedJson(url);

  if (cachedData) {
    queueJsonRefresh(url, path).catch(() => {
      // Stale cache is enough for the first paint; transient refresh errors should not break it.
    });

    return normalizeFetchedJson(path, cachedData);
  }

  return queueJsonRefresh(url, path).then((data) => normalizeFetchedJson(path, data));
}

function queueJsonRefresh(url, path) {
  if (!JSON_CACHE.has(url)) {
    const request = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not fetch ${path}`);
        }

        return response.json();
      })
      .then((data) => {
        writeCachedJson(url, data);
        return data;
      })
      .catch((error) => {
        throw error;
      })
      .finally(() => {
        JSON_CACHE.delete(url);
      });

    JSON_CACHE.set(url, request);
  }

  return JSON_CACHE.get(url);
}

function normalizeFetchedJson(path, data) {
  if (!path.endsWith('categories.json')) {
    return data;
  }

  return typeof window.__normalizeRssCategoryCatalog === 'function'
    ? window.__normalizeRssCategoryCatalog(data)
    : data;
}

export function getAllCategories(sources) {
  const collator = new Intl.Collator('es', { sensitivity: 'base' });
  const categories = new Set();

  sources.forEach((source) => {
    source.categorias?.forEach((category) => categories.add(category));
  });

  return [...categories].sort((a, b) => collator.compare(a, b));
}

export function getSourcesForTab(sources, tab, selectedCategories) {
  if (tab === 'all') {
    return sources;
  }

  const selected = new Set(selectedCategories);

  return sources.filter((source) => source.categorias?.some((category) => selected.has(category)));
}

export function normalizeNews(item, source) {
  return {
    titulo: item.titulo ?? '',
    url: item.url ?? '',
    imagen: item.imagen ?? '',
    fecha: item.fecha ?? '',
    fuenteId: item.fuenteId ?? source?.id ?? '',
    fuenteTitle: item.fuenteTitle ?? source?.title ?? '',
    categorias: item.categorias ?? source?.categorias ?? [],
    idioma: item.idioma ?? source?.idioma ?? 'es',
  };
}

export function sortNews(items) {
  return items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}

export function addUniqueNews(feed, items) {
  let added = 0;

  items.forEach((item) => {
    if (!item.url || feed.seenUrls.has(item.url)) {
      return;
    }

    feed.seenUrls.add(item.url);
    feed.items.push(item);
    added += 1;
  });

  sortNews(feed.items);

  return added;
}

export function getCurrentMonthCursor() {
  const now = new Date();

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function getPreviousMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
}

export function getArchivePath(sourceId, date) {
  const year = date.getUTCFullYear();
  const month = MONTH_FORMATTER.format(date.getUTCMonth() + 1);

  return `data/${sourceId}/${year}/${month}.json`;
}
