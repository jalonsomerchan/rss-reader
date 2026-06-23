const FLAT_CATEGORY_ROOT_ATTRIBUTE = 'data-flat-category-catalog';
const CATEGORY_NEWS_INDEX_PATH = '/indexes/categorias.json';
const FRONT_PAGE_INDEX_PATH = '/indexes/portada.json';
const SOURCE_ARCHIVE_PATH_PATTERN = /\/data\/[^/]+\/\d{4}\/\d{2}\.json$/;
const ACTIVE_SOURCE_FILTER_SELECTOR = '[data-source-filter][aria-pressed="true"], [data-menu-source-filter][aria-pressed="true"]';
const CATEGORY_TITLE_BY_KEY = new Map();
const CATEGORY_ID_BY_KEY = new Map();
const originalFetch = window.fetch.bind(window);

installFlatCategoryStyles();
window.__normalizeRssCategoryCatalog = normalizeCategoryCatalog;
window.__normalizeRssCategoryIndex = normalizeCategoryIndex;

window.fetch = async (input, init) => {
  if (isSourceArchiveRequest(input) && !hasActiveSourceFilter()) {
    return createStandaloneJsonResponse([]);
  }

  if (isFrontPageIndexRequest(input)) {
    return fetchFrontPageFromCategoryIndex(input, init);
  }

  const response = await originalFetch(input, init);

  if (isCategoriesCatalogRequest(input)) {
    return normalizeResponseJson(response, normalizeCategoryCatalog);
  }

  if (isCategoryNewsIndexRequest(input)) {
    return normalizeResponseJson(response, normalizeCategoryIndex);
  }

  return response;
};

async function normalizeResponseJson(response, normalizer) {
  try {
    const data = await response.clone().json();
    const normalizedData = normalizer(data);

    if (normalizedData === data) {
      return response;
    }

    return createJsonResponse(normalizedData, response);
  } catch {
    return response;
  }
}

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
  const categories = normalizeCategoryIndex(categoryIndex)?.categorias;

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
  const categorias = Array.isArray(item.categorias) ? item.categorias.map(getCategoryTitle) : [];

  return getUniqueValues([...categorias, getCategoryTitle(category)].filter(Boolean));
}

function normalizeCategoryIndex(categoryIndex) {
  const categories = categoryIndex?.categorias;

  if (!categories || typeof categories !== 'object' || Array.isArray(categories)) {
    return categoryIndex;
  }

  const normalizedCategories = {};

  Object.entries(categories).forEach(([category, items]) => {
    if (!Array.isArray(items)) {
      normalizedCategories[category] = items;
      return;
    }

    const aliases = getCategoryAliases(category);
    const normalizedItems = items.map((item) => normalizeCategoryIndexItem(item, aliases.title));

    aliases.keys.forEach((key) => {
      normalizedCategories[key] = mergeCategoryItemLists(normalizedCategories[key], normalizedItems);
    });
  });

  return {
    ...categoryIndex,
    categorias: normalizedCategories,
  };
}

function normalizeCategoryIndexItem(item, category) {
  if (!item || typeof item !== 'object') {
    return item;
  }

  return {
    ...item,
    categorias: getItemCategories(item, category),
  };
}

function mergeCategoryItemLists(currentItems, nextItems) {
  if (!Array.isArray(currentItems)) {
    return [...nextItems];
  }

  const itemsByUrl = new Map();

  currentItems.forEach((item) => {
    if (item?.url) {
      itemsByUrl.set(item.url, item);
    }
  });

  nextItems.forEach((item) => {
    if (!item?.url) {
      return;
    }

    const existingItem = itemsByUrl.get(item.url);

    if (existingItem) {
      existingItem.categorias = getUniqueValues([...(existingItem.categorias ?? []), ...(item.categorias ?? [])]);
      return;
    }

    currentItems.push(item);
    itemsByUrl.set(item.url, item);
  });

  return currentItems;
}

function getCategoryAliases(category) {
  const key = normalizeCategoryAlias(category);
  const title = CATEGORY_TITLE_BY_KEY.get(key) ?? category;
  const id = CATEGORY_ID_BY_KEY.get(key) ?? category;

  return {
    id,
    title,
    keys: getUniqueValues([category, id, title].filter(Boolean)),
  };
}

function getCategoryTitle(category) {
  return CATEGORY_TITLE_BY_KEY.get(normalizeCategoryAlias(category)) ?? category;
}

function setCategoryAliases(categories) {
  CATEGORY_TITLE_BY_KEY.clear();
  CATEGORY_ID_BY_KEY.clear();

  categories.forEach(({ id, title }) => {
    const aliases = getUniqueValues([id, title].filter(Boolean));

    aliases.forEach((alias) => {
      const key = normalizeCategoryAlias(alias);
      CATEGORY_TITLE_BY_KEY.set(key, title);
      CATEGORY_ID_BY_KEY.set(key, id);
    });
  });
}

function normalizeCategoryAlias(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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

function isSourceArchiveRequest(input) {
  return SOURCE_ARCHIVE_PATH_PATTERN.test(getRequestPathname(input));
}

function hasActiveSourceFilter() {
  return Boolean(document.querySelector(ACTIVE_SOURCE_FILTER_SELECTOR));
}

function isFrontPageIndexRequest(input) {
  return getRequestPathname(input).endsWith(FRONT_PAGE_INDEX_PATH);
}

function isCategoryNewsIndexRequest(input) {
  return getRequestPathname(input).endsWith(CATEGORY_NEWS_INDEX_PATH);
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

  setCategoryAliases(categories);
  markFlatCategoryCatalog();

  return {
    ...catalog,
    supercategorias: [
      {
        id: 'categorias',
        title: '',
        categorias: categories.map((category) => category.title),
      },
    ],
  };
}

function normalizeFlatCategories(catalog) {
  if (!Array.isArray(catalog?.categorias) || Array.isArray(catalog.supercategorias)) {
    return [];
  }

  const seenCategories = new Set();
  const categories = [];

  catalog.categorias.forEach((category) => {
    const id = typeof category === 'string' ? category : category?.id ?? category?.title;
    const title = typeof category === 'string' ? category : category?.title ?? category?.id;

    if (!id || !title) {
      return;
    }

    const key = normalizeCategoryAlias(title);

    if (seenCategories.has(key)) {
      return;
    }

    seenCategories.add(key);
    categories.push({
      id: String(id),
      title: String(title),
    });
  });

  return categories;
}

function createJsonResponse(data, response) {
  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers: getJsonHeaders(response.headers),
  });
}

function createStandaloneJsonResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    statusText: 'OK',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
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
