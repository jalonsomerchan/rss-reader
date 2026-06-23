const FLAT_CATEGORY_ROOT_ATTRIBUTE = 'data-flat-category-catalog';
const CATEGORY_NEWS_INDEX_PATH = '/indexes/categorias.json';
const FRONT_PAGE_INDEX_PATH = '/indexes/portada.json';
const originalFetch = window.fetch.bind(window);

installFlatCategoryStyles();
window.__normalizeRssCategoryCatalog = normalizeCategoryCatalog;

window.fetch = async (input, init) => {
  if (isFrontPageIndexRequest(input)) {
    return fetchFrontPageFromCategoryIndex(input, init);
  }

  const response = await originalFetch(input, init);

  if (!isCategoriesCatalogRequest(input)) {
    return response;
  }

  try {
    const catalog = await response.clone().json();
    const normalizedCatalog = normalizeCategoryCatalog(catalog);

    if (normalizedCatalog === catalog) {
      return response;
    }

    return createJsonResponse(normalizedCatalog, response);
  } catch {
    return response;
  }
};

async function fetchFrontPageFromCategoryIndex(input, init) {
  const response = await originalFetch(getCategoryNewsIndexUrl(input), init);

  if (!response.ok) {
    return response;
  }

  try {
    const categoryIndex = await response.clone().json();

    return createJsonResponse({ noticias: getCategoryIndexNews(categoryIndex) }, response);
  } catch {
    return response;
  }
}

function getCategoryNewsIndexUrl(input) {
  const url = new URL(getRequestUrl(input), window.location.href);
  url.pathname = url.pathname.replace(/\/indexes\/portada\.json$/, CATEGORY_NEWS_INDEX_PATH);
  url.search = '';

  return url.href;
}

function getCategoryIndexNews(categoryIndex) {
  const categories = categoryIndex?.categorias;

  if (!categories || typeof categories !== 'object' || Array.isArray(categories)) {
    return [];
  }

  const newsByUrl = new Map();

  Object.entries(categories).forEach(([category, items]) => {
    if (!Array.isArray(items)) {
      return;
    }

    items.forEach((item) => mergeCategoryNews(newsByUrl, item, category));
  });

  return [...newsByUrl.values()].sort(sortNewsByDate);
}

function mergeCategoryNews(newsByUrl, item, category) {
  if (!item || typeof item !== 'object' || !item.url) {
    return;
  }

  const categorias = getItemCategories(item, category);
  const existingItem = newsByUrl.get(item.url);

  if (existingItem) {
    existingItem.categorias = getUniqueValues([...(existingItem.categorias ?? []), ...categorias]);
    return;
  }

  newsByUrl.set(item.url, {
    ...item,
    categorias,
  });
}

function getItemCategories(item, category) {
  const categorias = Array.isArray(item.categorias) ? item.categorias : [];

  return getUniqueValues([...categorias, category].filter(Boolean));
}

function getUniqueValues(values) {
  return [...new Set(values)];
}

function sortNewsByDate(a, b) {
  const dateA = Date.parse(a.fecha ?? '');
  const dateB = Date.parse(b.fecha ?? '');

  return (Number.isNaN(dateB) ? 0 : dateB) - (Number.isNaN(dateA) ? 0 : dateA);
}

function installFlatCategoryStyles() {
  const style = document.createElement('style');
  style.textContent = `
    [${FLAT_CATEGORY_ROOT_ATTRIBUTE}] .reader-category-group__summary,
    [${FLAT_CATEGORY_ROOT_ATTRIBUTE}] [data-menu-categories] .reader-menu-accordion > summary,
    [${FLAT_CATEGORY_ROOT_ATTRIBUTE}] [data-menu-sources] .reader-menu-accordion > summary,
    [${FLAT_CATEGORY_ROOT_ATTRIBUTE}] [data-main-page-categories] summary,
    [${FLAT_CATEGORY_ROOT_ATTRIBUTE}] [data-main-page-sources] summary {
      display: none;
    }

    [${FLAT_CATEGORY_ROOT_ATTRIBUTE}] .reader-category-group,
    [${FLAT_CATEGORY_ROOT_ATTRIBUTE}] [data-menu-categories] .reader-menu-accordion,
    [${FLAT_CATEGORY_ROOT_ATTRIBUTE}] [data-menu-sources] .reader-menu-accordion,
    [${FLAT_CATEGORY_ROOT_ATTRIBUTE}] [data-main-page-categories] details,
    [${FLAT_CATEGORY_ROOT_ATTRIBUTE}] [data-main-page-sources] details {
      border: 0;
      padding: 0;
    }
  `;
  document.head.append(style);
}

function isFrontPageIndexRequest(input) {
  return getRequestPathname(input).endsWith(FRONT_PAGE_INDEX_PATH);
}

function isCategoriesCatalogRequest(input) {
  return getRequestPathname(input).endsWith('/categories.json');
}

function getRequestPathname(input) {
  return new URL(getRequestUrl(input), window.location.href).pathname;
}

function getRequestUrl(input) {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input?.url ?? '';
}

function normalizeCategoryCatalog(catalog) {
  const categories = normalizeFlatCategories(catalog);

  if (categories.length === 0) {
    return catalog;
  }

  markFlatCategoryCatalog();

  return {
    ...catalog,
    supercategorias: [
      {
        id: 'categorias',
        title: '',
        categorias: categories,
      },
    ],
  };
}

function normalizeFlatCategories(catalog) {
  if (!Array.isArray(catalog?.categorias) || Array.isArray(catalog.supercategorias)) {
    return [];
  }

  return [...new Set(catalog.categorias
    .map((category) => typeof category === 'string' ? category : category?.title)
    .filter(Boolean))];
}

function createJsonResponse(data, response) {
  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers: getJsonHeaders(response.headers),
  });
}

function getJsonHeaders(headers) {
  const nextHeaders = new Headers(headers);
  nextHeaders.set('Content-Type', 'application/json; charset=utf-8');
  return nextHeaders;
}

function markFlatCategoryCatalog() {
  const root = document.querySelector('[data-rss-reader]');
  root?.setAttribute(FLAT_CATEGORY_ROOT_ATTRIBUTE, 'true');
}
