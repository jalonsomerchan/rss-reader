const root = document.querySelector('[data-rss-reader]');

if (root) {
  const MAX_SEARCH_RESULTS = 10;
  const PROCESSING_PULSE_MS = 560;
  const MENU_SYNC_DELAY_MS = 0;

  const labels = JSON.parse(root.dataset.labels ?? '{}');
  const config = {
    apiBase: root.dataset.apiBase ?? '',
    storageKey: root.dataset.storageKey ?? 'rss-reader:selected-categories',
    ignoredSourcesStorageKey: `${root.dataset.storageKey ?? 'rss-reader:selected-categories'}:ignored-sources`,
    locale: root.dataset.locale ?? document.documentElement.lang ?? 'es',
  };

  const elements = {
    app: root.querySelector('[data-reader-app]'),
    loading: root.querySelector('[data-loading]'),
    processing: root.querySelector('[data-processing-indicator]'),
    loadMore: root.querySelector('[data-load-more]'),
    selectedCategories: root.querySelector('[data-selected-categories]'),
    menuPanel: root.querySelector('[data-menu-panel]'),
    menuToggle: root.querySelector('[data-menu-toggle]'),
    menuCategories: root.querySelector('[data-menu-categories]'),
    menuSources: root.querySelector('[data-menu-sources]'),
    menuSearchInput: root.querySelector('[data-menu-search-input]'),
    menuSearchResults: root.querySelector('[data-menu-search-results]'),
    menuSearchOptions: root.querySelector('[data-menu-search-options]'),
    menuPageCategories: root.querySelector('[data-menu-page-categories]'),
    menuPageSources: root.querySelector('[data-menu-page-sources]'),
    pages: [...root.querySelectorAll('[data-menu-page]')],
    pageButtons: [...root.querySelectorAll('[data-menu-view-target]')],
    pageBackButtons: [...root.querySelectorAll('[data-menu-view-back]')],
  };

  const state = {
    sources: [],
    categoryGroups: [],
    dataReady: false,
    dataPromise: null,
    processingTimer: 0,
  };

  const textSorter = new Intl.Collator(config.locale, { sensitivity: 'base' });

  bindEnhancements();

  function bindEnhancements() {
    elements.menuToggle?.addEventListener('click', () => {
      window.setTimeout(syncMenuEnhancements, MENU_SYNC_DELAY_MS);
    });

    elements.menuPanel && new MutationObserver(() => {
      if (!elements.menuPanel.hidden) {
        syncMenuEnhancements();
      }
    }).observe(elements.menuPanel, { attributes: true, attributeFilter: ['hidden'] });

    elements.pageButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setMenuPage(button.dataset.menuViewTarget ?? 'home');
        pulseProcessing();
      });
    });

    elements.pageBackButtons.forEach((button) => {
      button.addEventListener('click', () => setMenuPage('home'));
    });

    elements.menuSearchInput?.addEventListener('input', renderSearchResults);
    elements.menuSearchInput?.addEventListener('change', activateExactSearchMatch);
    elements.menuSearchInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        activateExactSearchMatch();
      }
    });

    elements.menuSearchResults?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const categoryButton = target?.closest('[data-enhanced-category-filter]');
      const sourceButton = target?.closest('[data-enhanced-source-filter]');

      if (categoryButton) {
        activateCategory(categoryButton.dataset.enhancedCategoryFilter);
      } else if (sourceButton) {
        activateSource(sourceButton.dataset.enhancedSourceFilter);
      }
    });

    elements.menuPageCategories?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('[data-enhanced-category-filter]');

      if (button) {
        activateCategory(button.dataset.enhancedCategoryFilter);
      }
    });

    elements.menuPageSources?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('[data-enhanced-source-filter]');

      if (button) {
        activateSource(button.dataset.enhancedSourceFilter);
      }
    });

    root.addEventListener('click', handleReaderClick, true);
    observeBusyState();
  }

  function handleReaderClick(event) {
    const target = event.target instanceof Element ? event.target : null;

    if (!target) {
      return;
    }

    if (target.closest('[data-tab]')) {
      clearActiveFilters();
      pulseProcessing();
      return;
    }

    if (target.closest('[data-menu-category-filter], [data-menu-source-filter], [data-save-categories], [data-load-more], .news-card__action')) {
      pulseProcessing();
    }
  }

  function observeBusyState() {
    const sync = () => {
      const isLoading = Boolean(elements.loading && !elements.loading.hidden);
      const isProcessing = Boolean(elements.processing && !elements.processing.hidden);
      const isLoadingMore = Boolean(elements.loadMore && elements.loadMore.disabled && !elements.loadMore.hidden);
      const isBusy = isLoading || isProcessing || isLoadingMore;

      elements.app?.setAttribute('aria-busy', String(isBusy));
      root.toggleAttribute('data-reader-busy', isBusy);
    };

    [elements.loading, elements.processing, elements.loadMore].filter(Boolean).forEach((element) => {
      new MutationObserver(sync).observe(element, { attributes: true, attributeFilter: ['hidden', 'disabled'] });
    });

    sync();
  }

  function pulseProcessing() {
    if (!elements.processing) {
      return;
    }

    window.clearTimeout(state.processingTimer);
    elements.processing.hidden = false;

    state.processingTimer = window.setTimeout(() => {
      elements.processing.hidden = true;
    }, PROCESSING_PULSE_MS);
  }

  function clearActiveFilters() {
    const allFilter = elements.selectedCategories?.querySelector('[data-category-filter=""]');

    if (allFilter && allFilter.getAttribute('aria-pressed') !== 'true') {
      allFilter.click();
    }
  }

  async function syncMenuEnhancements() {
    if (!elements.menuPanel || elements.menuPanel.hidden) {
      return;
    }

    try {
      await ensureCatalogData();
      renderMenuPages();
      updateSearchOptions();
      renderSearchResults();
    } catch {
      renderMenuPages();
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

  function renderMenuPages() {
    renderCategoryPage();
    renderSourcePage();
  }

  function renderCategoryPage() {
    if (!elements.menuPageCategories) {
      return;
    }

    const selectedCategories = new Set(readSelectedCategories());
    const groups = state.categoryGroups
      .map((group) => ({
        title: group.title,
        categories: group.categories.filter((category) => selectedCategories.has(category)),
      }))
      .filter((group) => group.categories.length > 0);

    elements.menuPageCategories.innerHTML = '';

    if (groups.length === 0) {
      elements.menuPageCategories.append(createEmptyMessage(getLabel('menuSearchEmpty', 'No hay resultados.')));
      return;
    }

    groups.forEach((group, index) => {
      const details = createAccordion(group.title, index === 0);
      const list = document.createElement('div');
      list.className = 'reader-menu-list';

      group.categories.forEach((category) => {
        list.append(createEnhancedFilterButton({ type: 'category', id: category, label: category }));
      });

      details.append(list);
      elements.menuPageCategories.append(details);
    });
  }

  function renderSourcePage() {
    if (!elements.menuPageSources) {
      return;
    }

    const sources = getMySources();
    const groups = groupSourcesBySupercategory(sources);
    elements.menuPageSources.innerHTML = '';

    if (groups.length === 0) {
      elements.menuPageSources.append(createEmptyMessage(getLabel('menuSearchEmpty', 'No hay resultados.')));
      return;
    }

    groups.forEach((group, index) => {
      const details = createAccordion(group.title, index === 0);
      const list = document.createElement('div');
      list.className = 'reader-menu-list';

      group.sources.forEach((source) => {
        list.append(createEnhancedFilterButton({ type: 'source', id: source.id, label: source.title ?? source.id }));
      });

      details.append(list);
      elements.menuPageSources.append(details);
    });
  }

  function updateSearchOptions() {
    if (!elements.menuSearchOptions) {
      return;
    }

    elements.menuSearchOptions.innerHTML = '';
    getSearchEntries().forEach((entry) => {
      const option = document.createElement('option');
      option.value = entry.label;
      elements.menuSearchOptions.append(option);
    });
  }

  function renderSearchResults() {
    if (!elements.menuSearchInput || !elements.menuSearchResults) {
      return;
    }

    const query = normalizeText(elements.menuSearchInput.value);
    elements.menuSearchResults.innerHTML = '';

    if (!query) {
      elements.menuSearchResults.hidden = true;
      return;
    }

    const results = getSearchEntries()
      .filter((entry) => normalizeText(entry.label).includes(query))
      .slice(0, MAX_SEARCH_RESULTS);

    elements.menuSearchResults.hidden = false;

    if (results.length === 0) {
      elements.menuSearchResults.append(createEmptyMessage(getLabel('menuSearchEmpty', 'No hay resultados.')));
      return;
    }

    const title = document.createElement('p');
    title.className = 'reader-menu-search__title';
    title.textContent = getLabel('menuSearchResults', 'Resultados');
    elements.menuSearchResults.append(title);

    results.forEach((entry) => {
      elements.menuSearchResults.append(createEnhancedFilterButton(entry));
    });
  }

  function activateExactSearchMatch() {
    const value = normalizeText(elements.menuSearchInput?.value ?? '');

    if (!value) {
      return;
    }

    const entries = getSearchEntries();
    const entry = entries.find((item) => normalizeText(item.label) === value)
      ?? entries.find((item) => normalizeText(item.label).includes(value));

    if (!entry) {
      return;
    }

    if (entry.type === 'category') {
      activateCategory(entry.id);
    } else {
      activateSource(entry.id);
    }
  }

  function getSearchEntries() {
    const selectedCategories = new Set(readSelectedCategories());
    const categories = state.categoryGroups
      .flatMap((group) => group.categories)
      .filter((category) => selectedCategories.has(category))
      .map((category) => ({
      type: 'category',
      id: category,
      label: category,
      meta: getLabel('menuCategoryResult', 'Categoría'),
    }));
    const sources = getMySources().map((source) => ({
      type: 'source',
      id: source.id,
      label: source.title ?? source.id,
      meta: getLabel('menuSourceResult', 'Fuente'),
    }));

    return [...categories, ...sources].sort((a, b) => textSorter.compare(a.label, b.label));
  }

  function createEnhancedFilterButton(entry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reader-menu-filter reader-menu-filter--enhanced';
    button.dataset[entry.type === 'category' ? 'enhancedCategoryFilter' : 'enhancedSourceFilter'] = entry.id;
    button.setAttribute('aria-label', entry.type === 'category' ? getCategoryFilterLabel(entry.label) : getSourceFilterLabel(entry.label));

    const text = document.createElement('span');
    text.textContent = entry.label;
    button.append(text);

    const meta = entry.meta ?? (entry.type === 'category' ? getLabel('menuCategoryResult', 'Categoría') : getLabel('menuSourceResult', 'Fuente'));
    if (meta) {
      const badge = document.createElement('small');
      badge.textContent = meta;
      button.append(badge);
    }

    return button;
  }

  function createAccordion(title, isOpen) {
    const details = document.createElement('details');
    details.className = 'reader-menu-accordion';
    details.open = isOpen;

    const summary = document.createElement('summary');
    summary.textContent = title;
    details.append(summary);

    return details;
  }

  function createEmptyMessage(message) {
    const empty = document.createElement('p');
    empty.className = 'reader-menu-empty';
    empty.textContent = message;
    return empty;
  }

  function activateCategory(category) {
    if (!category) {
      return;
    }

    const proxy = [...(elements.menuCategories?.querySelectorAll('[data-menu-category-filter]') ?? [])]
      .find((button) => button.dataset.menuCategoryFilter === category);

    proxy?.click();
    pulseProcessing();
  }

  function activateSource(sourceId) {
    if (!sourceId) {
      return;
    }

    const proxy = [...(elements.menuSources?.querySelectorAll('[data-menu-source-filter]') ?? [])]
      .find((button) => button.dataset.menuSourceFilter === sourceId);

    proxy?.click();
    pulseProcessing();
  }

  function setMenuPage(pageName) {
    elements.pages.forEach((page) => {
      page.hidden = page.dataset.menuPage !== pageName;
    });

    if (pageName !== 'home') {
      syncMenuEnhancements();
    }
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
