const root = document.querySelector('[data-rss-reader]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}');
  const config = {
    apiBase: root.dataset.apiBase ?? '',
    storageKey: root.dataset.storageKey ?? 'rss-reader:selected-categories',
    ignoredSourcesStorageKey: `${root.dataset.storageKey ?? 'rss-reader:selected-categories'}:ignored-sources`,
    locale: root.dataset.locale ?? document.documentElement.lang ?? 'es',
  };

  const elements = {
    panels: [...root.querySelectorAll('[data-panel]')],
    tabs: [...root.querySelectorAll('[data-tab]')],
    mainPages: [...root.querySelectorAll('[data-main-view]')],
    mainPageButtons: [...root.querySelectorAll('[data-main-view-target]')],
    mainCategories: root.querySelector('[data-main-page-categories]'),
    mainSources: root.querySelector('[data-main-page-sources]'),
    menuPanel: root.querySelector('[data-menu-panel]'),
    menuToggle: root.querySelector('[data-menu-toggle]'),
    loadMore: root.querySelector('[data-load-more]'),
    sentinel: root.querySelector('[data-sentinel]'),
    status: root.querySelector('[data-status]'),
  };

  const state = {
    sources: [],
    categoryGroups: [],
    dataPromise: null,
    dataReady: false,
  };

  const textSorter = new Intl.Collator(config.locale, { sensitivity: 'base' });

  bindMainPageNavigation();

  function bindMainPageNavigation() {
    elements.mainPageButtons.forEach((button) => {
      button.addEventListener('click', () => showMainPage(button.dataset.mainViewTarget));
    });

    elements.mainCategories?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('[data-main-category-filter]');

      if (!button) {
        return;
      }

      activateProxyFilter('category', button.dataset.mainCategoryFilter);
    });

    elements.mainSources?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('[data-main-source-filter]');

      if (!button) {
        return;
      }

      activateProxyFilter('source', button.dataset.mainSourceFilter);
    });

    root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return;
      }

      if (target.closest('[data-tab]')) {
        hideMainPages();
        return;
      }

      if (target.closest('[data-menu-category-filter], [data-menu-source-filter], [data-enhanced-category-filter], [data-enhanced-source-filter], [data-category-filter], [data-source-filter]')) {
        hideMainPages();
      }
    }, true);
  }

  async function showMainPage(pageName) {
    const page = elements.mainPages.find((item) => item.dataset.mainView === pageName);

    if (!page) {
      return;
    }

    closeMenu();
    setStatus('');
    setMainLoading(page, true);
    showOnlyMainPage(page);

    try {
      await ensureCatalogData();
      renderMainPages();
    } catch {
      renderMainPages();
    } finally {
      setMainLoading(page, false);
      page.focus({ preventScroll: true });
    }
  }

  function showOnlyMainPage(activePage) {
    elements.panels.forEach((panel) => {
      panel.hidden = true;
    });
    elements.mainPages.forEach((page) => {
      page.hidden = page !== activePage;
    });
    elements.tabs.forEach((tab) => {
      tab.setAttribute('aria-selected', 'false');
    });

    if (elements.loadMore) {
      elements.loadMore.hidden = true;
    }

    if (elements.sentinel) {
      elements.sentinel.hidden = true;
    }
  }

  function hideMainPages() {
    elements.mainPages.forEach((page) => {
      page.hidden = true;
      page.removeAttribute('aria-busy');
    });
  }

  function setMainLoading(page, isLoading) {
    page.setAttribute('aria-busy', String(isLoading));
  }

  function closeMenu() {
    if (elements.menuPanel) {
      elements.menuPanel.hidden = true;
    }

    elements.menuToggle?.setAttribute('aria-expanded', 'false');
  }

  function setStatus(message) {
    if (elements.status) {
      elements.status.textContent = message;
      elements.status.dataset.tone = 'neutral';
    }
  }

  async function ensureCatalogData() {
    if (state.dataReady) {
      return;
    }

    if (!state.dataPromise) {
      state.dataPromise = Promise.all([
        fetchApiJson('sources.json'),
        fetchApiJson('categories.json').catch(() => ({})),
      ]).then(([sources, categoriesCatalog]) => {
        state.sources = Array.isArray(sources) ? sources : [];
        state.categoryGroups = normalizeCategoryGroups(categoriesCatalog.supercategorias, getAllCategories());
        state.dataReady = true;
      });
    }

    await state.dataPromise;
  }

  async function fetchApiJson(path) {
    const response = await fetch(new URL(path, config.apiBase || window.location.href), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Unable to load ${path}`);
    }

    return response.json();
  }

  function renderMainPages() {
    renderMainCategories();
    renderMainSources();
  }

  function renderMainCategories() {
    if (!elements.mainCategories) {
      return;
    }

    const selectedCategories = new Set(readSelectedCategories());
    const groups = state.categoryGroups
      .map((group) => ({
        title: group.title,
        categories: group.categories.filter((category) => selectedCategories.has(category)),
      }))
      .filter((group) => group.categories.length > 0);

    elements.mainCategories.innerHTML = '';

    if (groups.length === 0) {
      elements.mainCategories.append(createEmptyMessage());
      return;
    }

    groups.forEach((group, index) => {
      elements.mainCategories.append(createMainGroup({
        title: group.title,
        isOpen: index === 0,
        items: group.categories.map((category) => ({
          type: 'category',
          id: category,
          label: category,
          meta: getLabel('menuCategoryResult', 'Categoría'),
        })),
      }));
    });
  }

  function renderMainSources() {
    if (!elements.mainSources) {
      return;
    }

    const sources = getMySources();
    const groups = groupSourcesBySupercategory(sources);

    elements.mainSources.innerHTML = '';

    if (groups.length === 0) {
      elements.mainSources.append(createEmptyMessage());
      return;
    }

    groups.forEach((group, index) => {
      elements.mainSources.append(createMainGroup({
        title: group.title,
        isOpen: index === 0,
        items: group.sources.map((source) => ({
          type: 'source',
          id: source.id,
          label: source.title ?? source.id,
          meta: getLabel('menuSourceResult', 'Fuente'),
        })),
      }));
    });
  }

  function createMainGroup({ title, isOpen, items }) {
    const details = document.createElement('details');
    details.className = 'reader-main-filter-group';
    details.open = isOpen;

    const summary = document.createElement('summary');
    summary.textContent = title;

    const list = document.createElement('div');
    list.className = 'reader-main-filter-grid';

    items.forEach((item) => {
      list.append(createMainFilterButton(item));
    });

    details.append(summary, list);
    return details;
  }

  function createMainFilterButton(item) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reader-main-filter-button';
    button.dataset[item.type === 'category' ? 'mainCategoryFilter' : 'mainSourceFilter'] = item.id;
    button.setAttribute('aria-label', item.type === 'category' ? getCategoryFilterLabel(item.label) : getSourceFilterLabel(item.label));

    const label = document.createElement('span');
    label.textContent = item.label;

    const meta = document.createElement('small');
    meta.textContent = item.meta;

    button.append(label, meta);
    return button;
  }

  function createEmptyMessage() {
    const empty = document.createElement('p');
    empty.className = 'reader-empty reader-empty--compact';
    empty.textContent = getLabel('menuSearchEmpty', 'No hay resultados.');
    return empty;
  }

  function activateProxyFilter(type, value) {
    if (!value) {
      return;
    }

    hideMainPages();

    const selector = type === 'category' ? '[data-menu-category-filter]' : '[data-menu-source-filter]';
    const dataKey = type === 'category' ? 'menuCategoryFilter' : 'menuSourceFilter';
    const proxy = [...root.querySelectorAll(selector)].find((button) => button.dataset[dataKey] === value);

    proxy?.click();
  }

  function normalizeCategoryGroups(supercategories = [], availableCategories = []) {
    const available = new Set(availableCategories);
    const used = new Set();
    const groups = [];

    supercategories.forEach((group) => {
      const categories = [...new Set(group.categorias ?? [])].filter((category) => {
        if (!available.has(category) || used.has(category)) {
          return false;
        }

        used.add(category);
        return true;
      });

      if (categories.length > 0) {
        groups.push({
          id: group.id ?? slugify(group.title ?? categories[0]),
          title: group.title ?? getLabel('otherCategories', 'Otras categorías'),
          categories,
        });
      }
    });

    const remaining = availableCategories.filter((category) => !used.has(category));

    if (remaining.length > 0) {
      groups.push({
        id: 'other-categories',
        title: getLabel('otherCategories', 'Otras categorías'),
        categories: remaining,
      });
    }

    return groups.length > 0 ? groups : [{ id: 'all-categories', title: getLabel('allCategories', 'Todas'), categories: availableCategories }];
  }

  function getAllCategories() {
    return [...new Set(state.sources.flatMap((source) => source.categorias ?? []).filter(Boolean))]
      .sort((a, b) => textSorter.compare(a, b));
  }

  function getMySources() {
    const selected = new Set(readSelectedCategories());

    return getVisibleSources()
      .filter((source) => source.categorias?.some((category) => selected.has(category)))
      .sort(sortSourcesByTitle);
  }

  function getVisibleSources() {
    const ignored = readIgnoredSourceIds();

    return state.sources
      .filter((source) => source.id && !ignored.has(source.id))
      .sort(sortSourcesByTitle);
  }

  function groupSourcesBySupercategory(sources) {
    const groups = state.categoryGroups.map((group) => ({
      id: group.id,
      title: group.title,
      categorySet: new Set(group.categories),
      sources: [],
    }));
    const other = {
      id: 'other-sources',
      title: getLabel('otherSources', 'Otras fuentes'),
      categorySet: new Set(),
      sources: [],
    };

    sources.forEach((source) => {
      const group = groups.find((item) => source.categorias?.some((category) => item.categorySet.has(category)));
      (group ?? other).sources.push(source);
    });

    return [...groups, other]
      .map((group) => ({ ...group, sources: group.sources.sort(sortSourcesByTitle) }))
      .filter((group) => group.sources.length > 0);
  }

  function readSelectedCategories() {
    try {
      const value = JSON.parse(localStorage.getItem(config.storageKey) ?? '[]');
      return Array.isArray(value) ? value.filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function readIgnoredSourceIds() {
    try {
      const value = JSON.parse(localStorage.getItem(config.ignoredSourcesStorageKey) ?? '[]');
      return new Set(Array.isArray(value) ? value.filter(Boolean) : []);
    } catch {
      return new Set();
    }
  }

  function sortSourcesByTitle(a, b) {
    return textSorter.compare(a.title ?? a.id, b.title ?? b.id);
  }

  function getCategoryFilterLabel(category) {
    return (getLabel('filterCategory', 'Filtrar por {{category}}'))
      .replaceAll('{{category}}', category)
      .replaceAll('{category}', category);
  }

  function getSourceFilterLabel(source) {
    return (getLabel('filterSource', 'Filtrar por la fuente {{source}}'))
      .replaceAll('{{source}}', source)
      .replaceAll('{source}', source);
  }

  function getLabel(key, fallback) {
    return labels[key] ?? fallback;
  }

  function normalizeText(value) {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function slugify(value) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'grupo';
  }
}
