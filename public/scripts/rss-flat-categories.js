const FLAT_CATEGORY_ROOT_ATTRIBUTE = 'data-flat-category-catalog';
const originalFetch = window.fetch.bind(window);

window.fetch = async (input, init) => {
  const response = await originalFetch(input, init);

  if (!isCategoriesCatalogRequest(input)) {
    return response;
  }

  try {
    const catalog = await response.clone().json();
    const categories = normalizeFlatCategories(catalog);

    if (categories.length === 0) {
      return response;
    }

    markFlatCategoryCatalog();

    return new Response(JSON.stringify({
      ...catalog,
      supercategorias: [
        {
          id: 'categorias',
          title: '',
          categorias: categories,
        },
      ],
    }), {
      status: response.status,
      statusText: response.statusText,
      headers: getJsonHeaders(response.headers),
    });
  } catch {
    return response;
  }
};

function isCategoriesCatalogRequest(input) {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input?.url ?? '';

  return new URL(url, window.location.href).pathname.endsWith('/categories.json');
}

function normalizeFlatCategories(catalog) {
  if (!Array.isArray(catalog?.categorias) || Array.isArray(catalog.supercategorias)) {
    return [];
  }

  return [...new Set(catalog.categorias
    .map((category) => typeof category === 'string' ? category : category?.title)
    .filter(Boolean))];
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
