const MONTH_FORMATTER = new Intl.NumberFormat('en', {
  minimumIntegerDigits: 2,
  useGrouping: false,
});

export function getCleanApiBase(apiBase) {
  return apiBase.endsWith('/') ? apiBase : `${apiBase}/`;
}

export async function fetchJson(apiBase, path) {
  const response = await fetch(`${getCleanApiBase(apiBase)}${path}`);

  if (!response.ok) {
    throw new Error(`Could not fetch ${path}`);
  }

  return response.json();
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
