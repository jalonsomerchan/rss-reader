import {
  addUniqueNews,
  fetchJson,
  getAllCategories,
  getArchivePath,
  getCurrentMonthCursor,
  getPreviousMonth,
  normalizeNews,
} from './rss-api.js';

const AUTO_LOAD_COOLDOWN_MS = 900;
const AUTO_LOAD_ROOT_MARGIN = '180px 0px';
const AUTO_OBSERVER_RESUME_DELAY_MS = 350;

const root = document.querySelector('[data-rss-reader]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}');
  const storageKey = root.dataset.storageKey ?? 'rss-reader:selected-categories';
  const config = {
    apiBase: root.dataset.apiBase ?? '',
    storageKey,
    ignoredSourcesStorageKey: `${storageKey}:ignored-sources`,
    favoriteSourcesStorageKey: `${storageKey}:favorite-sources`,
    savedStorageKey: `${storageKey}:saved-news`,
    pageSize: Number(root.dataset.pageSize ?? 8),
    archiveMonthLookback: Number(root.dataset.archiveMonthLookback ?? 12),
    archiveSourceBatchSize: Number(root.dataset.archiveSourceBatchSize ?? 2),
    locale: root.dataset.locale ?? document.documentElement.lang ?? 'es',
  };

  const elements = {
    app: root.querySelector('[data-reader-app]'),
    onboarding: root.querySelector('[data-onboarding]'),
    setupCategories: root.querySelector('[data-category-list="setup"]'),
    settingsCategories: root.querySelector('[data-category-list="settings"]'),
    favoriteSources: root.querySelector('[data-favorite-source-list="settings"]'),
    favoriteSourcesEmpty: root.querySelector('[data-empty-favorite-sources]'),
    ignoredSources: root.querySelector('[data-source-list="settings"]'),
    ignoredSourcesEmpty: root.querySelector('[data-empty-ignored-sources]'),
    menuToggle: root.querySelector('[data-menu-toggle]'),
    menuClose: root.querySelector('[data-menu-close]'),
    menuPanel: root.querySelector('[data-menu-panel]'),
    menuCategories: root.querySelector('[data-menu-categories]'),
    menuSources: root.querySelector('[data-menu-sources]'),
    saveSetup: root.querySelector('[data-save-categories="setup"]'),
    saveSettings: root.querySelector('[data-save-categories="settings"]'),
    tabs: [...root.querySelectorAll('[data-tab]')],
    panels: [...root.querySelectorAll('[data-panel]')],
    lists: {
      mine: root.querySelector('[data-list="mine"]'),
      all: root.querySelector('[data-list="all"]'),
      favorites: root.querySelector('[data-list="favorites"]'),
      saved: root.querySelector('[data-list="saved"]'),
    },
    empty: {
      mine: root.querySelector('[data-empty="mine"]'),
      all: root.querySelector('[data-empty="all"]'),
      favorites: root.querySelector('[data-empty="favorites"]'),
      saved: root.querySelector('[data-empty="saved"]'),
    },
    selectedCategories: root.querySelector('[data-selected-categories]'),
    sourceActionsPanel: root.querySelector('[data-source-action-panel]'),
    status: root.querySelector('[data-status]'),
    loading: root.querySelector('[data-loading]'),
    loadMore: root.querySelector('[data-load-more]'),
    sentinel: root.querySelector('[data-sentinel]'),
  };

  const state = {
    activeTab: 'mine',
    activeCategoryFilter: null,
    activeSourceFilter: null,
    refreshMode: false,
    sources: [],
    sourceMap: new Map(),
    categoryGroups: [],
    categories: [],
    selectedCategories: [],
    favoriteSourceIds: new Set(),
    draftFavoriteSourceIds: new Set(),
    ignoredSourceIds: new Set(),
    draftIgnoredSourceIds: new Set(),
    savedItems: [],
    savedUrls: new Set(),
    observer: null,
    autoLoadTimer: 0,
    lastAutoLoadAt: 0,
    feeds: {
      mine: createFeed('mine'),
      all: createFeed('all'),
      favorites: createFeed('favorites'),
    },
  };

  const relativeTimeFormatter = new Intl.RelativeTimeFormat(config.locale, { numeric: 'auto' });
  const sourceTitleSorter = new Intl.Collator(config.locale, { sensitivity: 'base' });

  init().catch(() => {
    setStatus(labels.errorLoading, 'error');
    setLoading(false);
  });

  function createFeed(tab) {
    return {
      tab,
      items: [],
      seenUrls: new Set(),
      visible: config.pageSize,
      renderedCount: 0,
      archiveSources: null,
      pendingLoad: null,
      seeded: false,
      loading: false,
      loadingMore: false,
      exhausted: false,
      monthCursor: getCurrentMonthCursor(),
      sourceIndex: 0,
      monthsScanned: 0,
    };
  }

  async function init() {
    setLoading(true);
    state.sources = await loadJson('sources.json');
    state.sourceMap = new Map(state.sources.map((source) => [source.id, source]).filter(([id]) => Boolean(id)));
    state.categoryGroups = await loadCategoryGroups();
    state.categories = state.categoryGroups.flatMap((group) => group.categorias);
    state.selectedCategories = readSelectedCategories().filter((category) => state.categories.includes(category));
    state.ignoredSourceIds = readIgnoredSourceIds();
    state.draftIgnoredSourceIds = new Set(state.ignoredSourceIds);
    state.favoriteSourceIds = readFavoriteSourceIds();
    state.draftFavoriteSourceIds = new Set(state.favoriteSourceIds);
    state.savedItems = readSavedItems();
    state.savedUrls = new Set(state.savedItems.map((item) => item.url).filter(Boolean));

    renderCategoryPickers();
    renderSelectedCategories();
    renderFilterMenu();
    bindEvents();

    if (state.selectedCategories.length === 0) {
      showOnboarding();
      setLoading(false);
      return;
    }

    await showApp('mine');
    setLoading(false);
    scheduleInitialRefresh();
  }

  async function loadCategoryGroups() {
    const availableCategories = getAllCategories(state.sources);

    try {
      const catalog = await loadJson('categories.json');
      const groups = normalizeCategoryGroups(catalog.supercategorias, availableCategories);

      return groups.length > 0 ? groups : createFallbackCategoryGroups(availableCategories);
    } catch {
      return createFallbackCategoryGroups(availableCategories);
    }
  }

  function normalizeCategoryGroups(supercategories = [], availableCategories = []) {
    const available = new Set(availableCategories);
    const used = new Set();
    const groups = [];

    supercategories.forEach((group) => {
      const categorias = [...new Set(group.categorias ?? [])].filter((category) => {
        if (!available.has(category) || used.has(category)) {
          return false;
        }

        used.add(category);
        return true;
      });

      if (categorias.length > 0) {
        groups.push({
          id: group.id ?? slugify(group.title ?? categorias[0]),
          title: group.title ?? labels.otherCategories ?? 'Otras categorías',
          categorias,
        });
      }
    });

    const remainingCategories = availableCategories.filter((category) => !used.has(category));

    if (remainingCategories.length > 0) {
      groups.push({
        id: 'other-categories',
        title: labels.otherCategories ?? 'Otras categorías',
        categorias: remainingCategories,
      });
    }

    return groups;
  }

  function createFallbackCategoryGroups(categories) {
    return [
      {
        id: 'all-categories',
        title: labels.allCategories ?? 'Todas',
        categorias: categories,
      },
    ];
  }

  function slugify(value) {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'grupo';
  }

  function bindEvents() {
    elements.tabs.forEach((tab) => {
      tab.addEventListener('click', () => showApp(tab.dataset.tab));
    });

    elements.saveSetup?.addEventListener('click', () => saveCategoriesFrom(elements.setupCategories));
    elements.saveSettings?.addEventListener('click', () => saveCategoriesFrom(elements.settingsCategories));
    elements.loadMore?.addEventListener('click', () => loadMoreActiveItems({ source: 'manual' }));
    elements.menuToggle?.addEventListener('click', () => setMenuOpen(elements.menuPanel?.hidden ?? true));
    elements.menuClose?.addEventListener('click', () => setMenuOpen(false));

    elements.setupCategories?.addEventListener('change', updateCategoryActions);
    elements.settingsCategories?.addEventListener('change', () => {
      updateCategoryActions();
      renderFavoriteSourcePicker(getCheckedCategories(elements.settingsCategories));
      renderIgnoredSourcePicker(getCheckedCategories(elements.settingsCategories));
    });
    elements.favoriteSources?.addEventListener('change', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const input = target?.closest('input[data-favorite-source]');

      if (!input) {
        return;
      }

      updateDraftFavoriteSource(input.value, input.checked);
      updateSourcePreferenceSummary(elements.favoriteSources, 'favoriteSourceSummary', labels.favoriteSourcesSummary);
    });
    elements.ignoredSources?.addEventListener('change', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const input = target?.closest('input[data-ignore-source]');

      if (!input) {
        return;
      }

      updateDraftIgnoredSource(input.value, input.checked);
      updateSourcePreferenceSummary(elements.ignoredSources, 'ignoredSourceSummary', labels.ignoredSourcesSummary);
    });
    elements.selectedCategories?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const categoryButton = target?.closest('[data-category-filter]');
      const sourceButton = target?.closest('[data-source-filter]');

      if (handleSourceActionClick(event)) {
        return;
      }

      if (categoryButton) {
        setCategoryFilter(categoryButton.dataset.categoryFilter || null);
      } else if (sourceButton) {
        setSourceFilter(sourceButton.dataset.sourceFilter || null);
      }
    });
    elements.sourceActionsPanel?.addEventListener('click', handleSourceActionClick);
    elements.menuCategories?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('[data-menu-category-filter]');

      if (!button) {
        return;
      }

      setCategoryFilter(button.dataset.menuCategoryFilter || null);
      setMenuOpen(false);
    });
    elements.menuSources?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('[data-menu-source-filter]');

      if (!button) {
        return;
      }

      setSourceFilter(button.dataset.menuSourceFilter || null);
      setMenuOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    });

    if ('IntersectionObserver' in window && elements.sentinel) {
      state.observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          queueAutoLoad();
        }
      }, { rootMargin: AUTO_LOAD_ROOT_MARGIN });
    }
  }

  function setMenuOpen(isOpen) {
    if (!elements.menuPanel || !elements.menuToggle) {
      return;
    }

    elements.menuPanel.hidden = !isOpen;
    elements.menuToggle.setAttribute('aria-expanded', String(isOpen));

    if (isOpen) {
      renderFilterMenu();
    }
  }

  function showOnboarding() {
    pauseAutoObserver();
    elements.onboarding.hidden = false;
    elements.app.hidden = true;
    setMenuOpen(false);
    setStatus('');
    updateCategoryActions();
  }

  async function showApp(tab = 'mine') {
    elements.onboarding.hidden = true;
    elements.app.hidden = false;
    state.activeTab = tab;

    elements.tabs.forEach((button) => {
      const isActive = button.dataset.tab === tab;
      button.setAttribute('aria-selected', String(isActive));
    });

    elements.panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab;
    });

    elements.loadMore.hidden = tab === 'settings' || tab === 'saved';
    elements.sentinel.hidden = tab === 'settings' || tab === 'saved';

    if (tab === 'settings') {
      pauseAutoObserver();
      state.draftIgnoredSourceIds = new Set(state.ignoredSourceIds);
      state.draftFavoriteSourceIds = new Set(state.favoriteSourceIds);
      renderCategoryPicker(elements.settingsCategories);
      renderFavoriteSourcePicker(getCheckedCategories(elements.settingsCategories));
      renderIgnoredSourcePicker(getCheckedCategories(elements.settingsCategories));
      setStatus(labels.settingsHint);
      updateCategoryActions();
      return;
    }

    if (tab === 'saved') {
      pauseAutoObserver();
      renderSavedFeed();
      return;
    }

    pauseAutoObserver();
    await ensureFeed(tab);
    scheduleAutoObserverResume(tab);
  }

  function renderCategoryPickers() {
    renderCategoryPicker(elements.setupCategories);
    renderCategoryPicker(elements.settingsCategories);
    renderFavoriteSourcePicker(state.selectedCategories);
    renderIgnoredSourcePicker(state.selectedCategories);
    updateCategoryActions();
  }

  function renderCategoryPicker(container) {
    if (!container) {
      return;
    }

    container.innerHTML = '';

    state.categoryGroups.forEach((group, groupIndex) => {
      const details = document.createElement('details');
      details.className = 'reader-category-group';
      details.open = true;

      const summary = document.createElement('summary');
      summary.className = 'reader-category-group__summary';
      summary.textContent = group.title;

      const list = document.createElement('div');
      list.className = 'reader-category-group__items';

      group.categorias.forEach((category, categoryIndex) => {
        const id = `${container.dataset.categoryList}-category-${groupIndex}-${categoryIndex}`;
        list.append(createCategoryCheckbox(category, id));
      });

      details.append(summary, list);
      container.append(details);
    });
  }

  function createCategoryCheckbox(category, id) {
    const label = document.createElement('label');
    label.className = 'category-pill';
    label.htmlFor = id;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.value = category;
    input.checked = state.selectedCategories.includes(category);

    const text = document.createElement('span');
    text.textContent = category;

    label.append(input, text);
    return label;
  }

  function renderIgnoredSourcePicker(categories) {
    renderSourcePreferencePicker({
      container: elements.ignoredSources,
      empty: elements.ignoredSourcesEmpty,
      categories,
      selectedIds: state.draftIgnoredSourceIds,
      inputDataName: 'ignoreSource',
      idPrefix: 'ignored-source',
      searchText: labels.ignoredSourcesSearch ?? 'Buscar fuentes',
      searchPlaceholder: labels.ignoredSourcesSearchPlaceholder ?? 'Busca una fuente...',
      summaryDataName: 'ignoredSourceSummary',
      summaryTemplate: labels.ignoredSourcesSummary,
    });
  }

  function renderFavoriteSourcePicker(categories) {
    renderSourcePreferencePicker({
      container: elements.favoriteSources,
      empty: elements.favoriteSourcesEmpty,
      categories,
      selectedIds: state.draftFavoriteSourceIds,
      inputDataName: 'favoriteSource',
      idPrefix: 'favorite-source',
      searchText: labels.favoriteSourcesSearch ?? 'Buscar fuentes',
      searchPlaceholder: labels.favoriteSourcesSearchPlaceholder ?? 'Busca una fuente...',
      summaryDataName: 'favoriteSourceSummary',
      summaryTemplate: labels.favoriteSourcesSummary,
    });
  }

  function renderSourcePreferencePicker({
    container,
    empty,
    categories,
    selectedIds,
    inputDataName,
    idPrefix,
    searchText,
    searchPlaceholder,
    summaryDataName,
    summaryTemplate,
  }) {
    if (!container) {
      return;
    }

    const sources = getSourcesForCategories(categories);
    container.innerHTML = '';

    if (empty) {
      empty.hidden = sources.length > 0;
    }

    if (sources.length === 0) {
      return;
    }

    const controls = document.createElement('div');
    controls.className = 'reader-source-picker__controls';

    const searchLabel = document.createElement('label');
    searchLabel.className = 'reader-source-picker__search';

    const searchLabelText = document.createElement('span');
    searchLabelText.textContent = searchText;

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.autocomplete = 'off';
    searchInput.placeholder = searchPlaceholder;
    searchInput.dataset.sourcePreferenceSearch = 'true';

    searchLabel.append(searchLabelText, searchInput);

    const summary = document.createElement('p');
    summary.className = 'reader-source-picker__summary';
    summary.dataset[summaryDataName] = 'true';

    controls.append(searchLabel, summary);

    const list = document.createElement('div');
    list.className = 'reader-source-picker__list';
    list.dataset.sourcePreferenceItems = 'true';

    sources.forEach((source, index) => {
      const id = `${idPrefix}-${index}`;
      const label = document.createElement('label');
      label.className = `source-pill source-pill--${idPrefix}`;
      label.htmlFor = id;
      label.dataset.sourceTitle = normalizeText(source.title ?? source.id);

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = id;
      input.value = source.id;
      input.dataset[inputDataName] = 'true';
      input.checked = selectedIds.has(source.id);

      const text = document.createElement('span');
      text.textContent = source.title ?? source.id;

      label.append(input, text);
      list.append(label);
    });

    container.append(controls, list);
    updateSourcePreferenceSummary(container, summaryDataName, summaryTemplate);

    searchInput.addEventListener('input', () => {
      filterSourcePreferencePicker(container, searchInput.value);
      updateSourcePreferenceSummary(container, summaryDataName, summaryTemplate);
    });
  }

  function renderFilterMenu() {
    renderMenuCategories();
    renderMenuSources();
  }

  function renderMenuCategories() {
    if (!elements.menuCategories) {
      return;
    }

    elements.menuCategories.innerHTML = '';

    state.categoryGroups.forEach((group, groupIndex) => {
      const details = document.createElement('details');
      details.className = 'reader-menu-accordion';
      details.open = groupIndex === 0;

      const summary = document.createElement('summary');
      summary.textContent = group.title;

      const list = document.createElement('div');
      list.className = 'reader-menu-list';

      group.categorias.forEach((category) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'reader-menu-filter';
        button.dataset.menuCategoryFilter = category;
        button.setAttribute('aria-pressed', String(state.activeCategoryFilter === category));
        button.setAttribute('aria-label', getCategoryFilterLabel(category));
        button.textContent = category;
        list.append(button);
      });

      details.append(summary, list);
      elements.menuCategories.append(details);
    });
  }

  function renderMenuSources() {
    if (!elements.menuSources) {
      return;
    }

    elements.menuSources.innerHTML = '';

    getSourceGroups().forEach((group, groupIndex) => {
      const details = document.createElement('details');
      details.className = 'reader-menu-accordion';
      details.open = groupIndex === 0;

      const summary = document.createElement('summary');
      summary.textContent = group.title;

      const list = document.createElement('div');
      list.className = 'reader-menu-list';

      group.sources.forEach((source) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'reader-menu-filter';
        button.dataset.menuSourceFilter = source.id;
        button.setAttribute('aria-pressed', String(state.activeSourceFilter === source.id));
        button.setAttribute('aria-label', getSourceFilterLabel(source.title ?? source.id));
        button.textContent = source.title ?? source.id;
        list.append(button);
      });

      details.append(summary, list);
      elements.menuSources.append(details);
    });
  }

  function getSourceGroups() {
    const groupItems = state.categoryGroups.map((group) => ({
      id: group.id,
      title: group.title,
      categorySet: new Set(group.categorias),
      sources: [],
    }));
    const otherGroup = {
      id: 'other-sources',
      title: labels.otherSources ?? 'Otras fuentes',
      categorySet: new Set(),
      sources: [],
    };

    getSelectedVisibleSources().forEach((source) => {
      const group = groupItems.find((item) => source.categorias?.some((category) => item.categorySet.has(category)));
      (group ?? otherGroup).sources.push(source);
    });

    return [...groupItems, otherGroup]
      .map((group) => ({
        id: group.id,
        title: group.title,
        sources: group.sources.sort(sortSourcesByTitle),
      }))
      .filter((group) => group.sources.length > 0);
  }

  function getVisibleSources() {
    return state.sources
      .filter((source) => source.id && !isIgnoredSource(source.id))
      .sort(sortSourcesByTitle);
  }

  function getSelectedVisibleSources() {
    const selected = new Set(state.selectedCategories);

    return getVisibleSources()
      .filter((source) => source.categorias?.some((category) => selected.has(category)))
      .sort(sortSourcesByTitle);
  }

  function loadJson(path) {
    return fetchJson(config.apiBase, path, { refresh: state.refreshMode });
  }

  function filterSourcePreferencePicker(container, query) {
    const normalizedQuery = normalizeText(query);
    const sourceItems = [...(container?.querySelectorAll('.source-pill') ?? [])];

    sourceItems.forEach((item) => {
      item.hidden = Boolean(normalizedQuery) && !item.dataset.sourceTitle?.includes(normalizedQuery);
    });
  }

  function updateSourcePreferenceSummary(container, summaryDataName, summaryTemplate) {
    const summary = container?.querySelector(`[data-${kebabCase(summaryDataName)}]`);

    if (!summary) {
      return;
    }

    const sourceItems = [...container.querySelectorAll('.source-pill')];
    const visibleCount = sourceItems.filter((item) => !item.hidden).length;
    const selectedCount = [...container.querySelectorAll('input:checked')].length;
    const template = summaryTemplate ?? '{{visible}} fuentes visibles · {{selected}} seleccionadas';

    summary.textContent = template
      .replaceAll('{{visible}}', String(visibleCount))
      .replaceAll('{visible}', String(visibleCount))
      .replaceAll('{{selected}}', String(selectedCount))
      .replaceAll('{selected}', String(selectedCount))
      .replaceAll('{{ignored}}', String(selectedCount))
      .replaceAll('{ignored}', String(selectedCount))
      .replaceAll('{{favorites}}', String(selectedCount))
      .replaceAll('{favorites}', String(selectedCount));
  }

  function kebabCase(value) {
    return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }

  function normalizeText(value) {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function updateCategoryActions() {
    const setupCount = getCheckedCategories(elements.setupCategories).length;
    const settingsCount = getCheckedCategories(elements.settingsCategories).length;

    if (elements.saveSetup) {
      elements.saveSetup.disabled = setupCount === 0;
    }

    if (elements.saveSettings) {
      elements.saveSettings.disabled = settingsCount === 0;
    }
  }

  function getCheckedCategories(container) {
    if (!container) {
      return [];
    }

    return [...container.querySelectorAll('input:checked')].map((input) => input.value);
  }

  function getSourcesForCategories(categories) {
    const selected = new Set(categories);

    return state.sources
      .filter((source) => source.id && source.categorias?.some((category) => selected.has(category)))
      .sort(sortSourcesByTitle);
  }

  function sortSourcesByTitle(a, b) {
    return sourceTitleSorter.compare(a.title ?? a.id, b.title ?? b.id);
  }

  function updateDraftIgnoredSource(sourceId, isIgnored) {
    if (!sourceId) {
      return;
    }

    if (isIgnored) {
      state.draftIgnoredSourceIds.add(sourceId);
    } else {
      state.draftIgnoredSourceIds.delete(sourceId);
    }
  }

  function updateDraftFavoriteSource(sourceId, isFavorite) {
    if (!sourceId) {
      return;
    }

    if (isFavorite) {
      state.draftFavoriteSourceIds.add(sourceId);
    } else {
      state.draftFavoriteSourceIds.delete(sourceId);
    }
  }

  function toggleFavoriteSource(sourceId) {
    if (!sourceId || !state.sourceMap.has(sourceId)) {
      return;
    }

    if (state.favoriteSourceIds.has(sourceId)) {
      state.favoriteSourceIds.delete(sourceId);
    } else {
      state.favoriteSourceIds.add(sourceId);
    }

    state.draftFavoriteSourceIds = new Set(state.favoriteSourceIds);
    persistFavoriteSourceIds();
    resetFeeds();
    renderSelectedCategories();
    renderFilterMenu();

    if (state.activeTab === 'favorites') {
      showApp('favorites');
    }
  }

  function toggleIgnoredSource(sourceId) {
    if (!sourceId || !state.sourceMap.has(sourceId)) {
      return;
    }

    if (state.ignoredSourceIds.has(sourceId)) {
      state.ignoredSourceIds.delete(sourceId);
    } else {
      state.ignoredSourceIds.add(sourceId);
      if (state.activeSourceFilter === sourceId) {
        state.activeSourceFilter = null;
      }
    }

    state.draftIgnoredSourceIds = new Set(state.ignoredSourceIds);
    persistIgnoredSourceIds();
    resetFeeds();
    renderSelectedCategories();
    renderFilterMenu();
    showApp(state.activeTab === 'settings' ? 'mine' : state.activeTab);
  }

  function getVisibleIgnoredSourceIds(categories) {
    const visibleSourceIds = new Set(getSourcesForCategories(categories).map((source) => source.id));

    return [...state.draftIgnoredSourceIds].filter((sourceId) => visibleSourceIds.has(sourceId));
  }

  function getVisibleFavoriteSourceIds(categories) {
    const visibleSourceIds = new Set(getSourcesForCategories(categories).map((source) => source.id));

    return [...state.draftFavoriteSourceIds].filter((sourceId) => visibleSourceIds.has(sourceId));
  }

  function saveCategoriesFrom(container) {
    const categories = getCheckedCategories(container);

    if (categories.length === 0) {
      setStatus(labels.selectOneCategory, 'error');
      return;
    }

    const isSettings = container === elements.settingsCategories;
    state.selectedCategories = categories;

    if (isSettings) {
      state.favoriteSourceIds = new Set(getVisibleFavoriteSourceIds(categories));
      persistFavoriteSourceIds();
      state.ignoredSourceIds = new Set(getVisibleIgnoredSourceIds(categories));
      persistIgnoredSourceIds();

      if (state.activeSourceFilter && state.ignoredSourceIds.has(state.activeSourceFilter)) {
        state.activeSourceFilter = null;
      }
    }

    localStorage.setItem(config.storageKey, JSON.stringify(categories));
    resetFeeds();
    renderCategoryPickers();
    renderSelectedCategories();
    renderFilterMenu();
    setStatus(labels.savedCategories, 'success');
    showApp('mine');
  }

  function readSelectedCategories() {
    try {
      const value = JSON.parse(localStorage.getItem(config.storageKey) ?? '[]');

      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function readIgnoredSourceIds() {
    try {
      const value = JSON.parse(localStorage.getItem(config.ignoredSourcesStorageKey) ?? '[]');
      const sourceIds = new Set(state.sources.map((source) => source.id).filter(Boolean));

      return new Set(Array.isArray(value) ? value.filter((sourceId) => sourceIds.has(sourceId)) : []);
    } catch {
      return new Set();
    }
  }

  function persistIgnoredSourceIds() {
    localStorage.setItem(config.ignoredSourcesStorageKey, JSON.stringify([...state.ignoredSourceIds]));
  }

  function readFavoriteSourceIds() {
    try {
      const value = JSON.parse(localStorage.getItem(config.favoriteSourcesStorageKey) ?? '[]');
      const sourceIds = new Set(state.sources.map((source) => source.id).filter(Boolean));

      return new Set(Array.isArray(value) ? value.filter((sourceId) => sourceIds.has(sourceId)) : []);
    } catch {
      return new Set();
    }
  }

  function persistFavoriteSourceIds() {
    localStorage.setItem(config.favoriteSourcesStorageKey, JSON.stringify([...state.favoriteSourceIds]));
  }

  function readSavedItems() {
    try {
      const value = JSON.parse(localStorage.getItem(config.savedStorageKey) ?? '[]');

      return Array.isArray(value) ? value.filter((item) => item?.url && item?.titulo) : [];
    } catch {
      return [];
    }
  }

  function persistSavedItems() {
    localStorage.setItem(config.savedStorageKey, JSON.stringify(state.savedItems));
  }

  function renderSelectedCategories() {
    if (!elements.selectedCategories) {
      return;
    }

    elements.selectedCategories.innerHTML = '';

    if (state.selectedCategories.length === 0) {
      return;
    }

    const fragment = document.createDocumentFragment();
    fragment.append(createCategoryFilterChip('', labels.allCategories ?? 'Todas'));

    state.selectedCategories.forEach((category) => {
      fragment.append(createCategoryFilterChip(category, category));
    });

    if (state.activeCategoryFilter && !state.selectedCategories.includes(state.activeCategoryFilter)) {
      fragment.append(createCategoryFilterChip(state.activeCategoryFilter, state.activeCategoryFilter));
    }

    const visibleSources = getSelectedVisibleSources();
    if (visibleSources.length > 0) {
      fragment.append(createFilterSectionLabel(labels.menuSources ?? 'Fuentes'));
      visibleSources.forEach((source) => {
        fragment.append(createSourceFilterChip(source.id, source.title ?? source.id));
      });
    }

    elements.selectedCategories.append(fragment);
    renderSourceActionPanel();
  }

  function renderSourceActionPanel() {
    if (!elements.sourceActionsPanel) {
      return;
    }

    elements.sourceActionsPanel.replaceChildren();

    if (!state.activeSourceFilter) {
      elements.sourceActionsPanel.hidden = true;
      return;
    }

    const source = state.sourceMap.get(state.activeSourceFilter);

    if (!source) {
      elements.sourceActionsPanel.hidden = true;
      return;
    }

    const title = document.createElement('p');
    title.className = 'reader-source-action-panel__title';
    title.textContent = source.title ?? source.id;

    elements.sourceActionsPanel.append(title, createSourceActionGroup(source));
    elements.sourceActionsPanel.hidden = false;
  }

  function createFilterSectionLabel(text) {
    const label = document.createElement('span');
    label.className = 'reader-topic-strip__section-label';
    label.textContent = text;
    return label;
  }

  function createCategoryFilterChip(category, text) {
    const button = document.createElement('button');
    const isAllFilter = !category;
    const isActive = isAllFilter
      ? !state.activeCategoryFilter && !state.activeSourceFilter
      : state.activeCategoryFilter === category;

    button.type = 'button';
    button.className = 'reader-topic-chip';
    button.dataset.categoryFilter = category;
    button.setAttribute('aria-pressed', String(isActive));
    button.textContent = text;

    if (category) {
      button.setAttribute('aria-label', getCategoryFilterLabel(category));
    }

    return button;
  }

  function createSourceFilterChip(sourceId, text) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reader-topic-chip reader-topic-chip--source';
    button.dataset.sourceFilter = sourceId;
    button.setAttribute('aria-pressed', String(state.activeSourceFilter === sourceId));
    button.setAttribute('aria-label', getSourceFilterLabel(text));
    button.textContent = text;

    return button;
  }

  function createSourceActionGroup(source) {
    const group = document.createElement('div');
    group.className = 'reader-source-actions';
    group.setAttribute('aria-label', source.title ?? source.id);

    const favoriteButton = document.createElement('button');
    const isFavorite = state.favoriteSourceIds.has(source.id);
    favoriteButton.type = 'button';
    favoriteButton.className = 'reader-topic-chip reader-source-action reader-source-action--favorite';
    favoriteButton.dataset.sourceFavoriteToggle = source.id;
    favoriteButton.setAttribute('aria-pressed', String(isFavorite));
    favoriteButton.textContent = isFavorite
      ? labels.removeFavoriteSource ?? 'Quitar favorita'
      : labels.addFavoriteSource ?? 'Añadir favorita';

    const blockButton = document.createElement('button');
    const isIgnored = state.ignoredSourceIds.has(source.id);
    blockButton.type = 'button';
    blockButton.className = 'reader-topic-chip reader-source-action reader-source-action--block';
    blockButton.dataset.sourceBlockToggle = source.id;
    blockButton.setAttribute('aria-pressed', String(isIgnored));
    blockButton.textContent = isIgnored
      ? labels.unblockSource ?? 'Desbloquear'
      : labels.blockSource ?? 'Bloquear';

    group.append(favoriteButton, blockButton);
    return group;
  }

  function handleSourceActionClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const favoriteButton = target?.closest('[data-source-favorite-toggle]');
    const blockButton = target?.closest('[data-source-block-toggle]');

    if (favoriteButton) {
      event.preventDefault();
      event.stopPropagation();
      toggleFavoriteSource(favoriteButton.dataset.sourceFavoriteToggle);
      return true;
    }

    if (blockButton) {
      event.preventDefault();
      event.stopPropagation();
      toggleIgnoredSource(blockButton.dataset.sourceBlockToggle);
      return true;
    }

    return false;
  }

  function getCategoryFilterLabel(category) {
    return (labels.filterCategory ?? 'Filtrar por {{category}}')
      .replaceAll('{{category}}', category)
      .replaceAll('{category}', category);
  }

  function getSourceFilterLabel(source) {
    return (labels.filterSource ?? 'Filtrar por {{source}}')
      .replaceAll('{{source}}', source)
      .replaceAll('{source}', source);
  }

  function setCategoryFilter(category) {
    const nextCategory = category || null;

    if (state.activeCategoryFilter === nextCategory && !state.activeSourceFilter) {
      return;
    }

    state.activeCategoryFilter = nextCategory;
    state.activeSourceFilter = null;
    applyFilterChange();
  }

  function setSourceFilter(sourceId) {
    const nextSource = sourceId || null;

    if (nextSource && !state.sourceMap.has(nextSource)) {
      return;
    }

    if (state.activeSourceFilter === nextSource && !state.activeCategoryFilter) {
      return;
    }

    state.activeSourceFilter = nextSource;
    state.activeCategoryFilter = null;
    applyFilterChange();
  }

  function scheduleInitialRefresh() {
    window.setTimeout(() => {
      refreshActiveFeedFromNetwork().catch(() => {
        // Cached news remains available when the background refresh cannot reach the network.
      });
    }, 0);
  }

  async function refreshActiveFeedFromNetwork() {
    if (state.selectedCategories.length === 0 || state.activeTab === 'settings' || state.activeTab === 'saved') {
      return;
    }

    const tab = state.activeTab;
    state.refreshMode = true;
    resetFeeds();

    try {
      await ensureFeed(tab);
    } finally {
      state.refreshMode = false;
    }
  }

  function applyFilterChange() {
    resetFeeds();
    renderSelectedCategories();
    renderFilterMenu();

    const nextTab = state.activeTab === 'settings' ? 'mine' : state.activeTab;
    showApp(nextTab);
  }

  function resetFeeds() {
    state.feeds.mine = createFeed('mine');
    state.feeds.all = createFeed('all');
    state.feeds.favorites = createFeed('favorites');
  }

  async function ensureFeed(tab) {
    const feed = state.feeds[tab];

    if (feed.pendingLoad) {
      return feed.pendingLoad;
    }

    feed.pendingLoad = (async () => {
      setLoading(true);

      try {
        if (!feed.seeded) {
          await seedFeed(tab);
        }

        await fillFeedUntilNeeded(tab);
        renderFeed(tab);
      } finally {
        feed.pendingLoad = null;

        if (state.activeTab === tab) {
          setLoading(false);
        }
      }
    })();

    return feed.pendingLoad;
  }

  async function seedFeed(tab) {
    const feed = state.feeds[tab];
    const sourceMap = state.sourceMap;

    try {
      if (state.activeCategoryFilter) {
        const data = await loadJson('indexes/categorias.json');
        const items = data.categorias?.[state.activeCategoryFilter] ?? [];
        addUniqueNews(feed, items.map((item) => normalizeNews(item, sourceMap.get(item.fuenteId))).filter(matchesVisibleItem));
      } else if (tab === 'all' || tab === 'favorites' || state.activeSourceFilter) {
        const data = await loadJson('indexes/portada.json');
        addUniqueNews(feed, (data.noticias ?? []).map((item) => normalizeNews(item, sourceMap.get(item.fuenteId))).filter(matchesVisibleItem));
      } else {
        const data = await loadJson('indexes/categorias.json');
        const items = state.selectedCategories.flatMap((category) => data.categorias?.[category] ?? []);
        addUniqueNews(feed, items.map((item) => normalizeNews(item, sourceMap.get(item.fuenteId))).filter(matchesVisibleItem));
      }
    } catch {
      setStatus(labels.errorLoading, 'error');
    } finally {
      feed.seeded = true;
    }
  }

  async function fillFeedUntilNeeded(tab) {
    const feed = state.feeds[tab];
    const sourceCount = getArchiveSources(feed).length || 1;
    const maxArchiveBatches = Math.max(
      1,
      Math.ceil(sourceCount / config.archiveSourceBatchSize) * config.archiveMonthLookback
    );
    let attempts = 0;

    while (feed.items.length < feed.visible && !feed.exhausted && attempts < maxArchiveBatches) {
      const added = await loadArchiveBatch(tab);
      attempts += 1;

      if (added === 0 && feed.exhausted) {
        break;
      }
    }

    if (attempts >= maxArchiveBatches && feed.items.length < feed.visible) {
      feed.exhausted = true;
    }
  }

  async function loadArchiveBatch(tab) {
    const feed = state.feeds[tab];
    const archiveSources = getArchiveSources(feed);

    if (feed.loading || archiveSources.length === 0) {
      feed.exhausted = archiveSources.length === 0;
      return 0;
    }

    feed.loading = true;

    try {
      while (feed.monthsScanned < config.archiveMonthLookback) {
        const batch = archiveSources.slice(feed.sourceIndex, feed.sourceIndex + config.archiveSourceBatchSize);
        feed.sourceIndex += config.archiveSourceBatchSize;

        if (batch.length === 0) {
          feed.monthCursor = getPreviousMonth(feed.monthCursor);
          feed.sourceIndex = 0;
          feed.monthsScanned += 1;
          continue;
        }

        const results = await Promise.allSettled(
          batch.map(async (source) => {
            const items = await loadJson(getArchivePath(source.id, feed.monthCursor));

            return Array.isArray(items) ? items.map((item) => normalizeNews(item, source)) : [];
          })
        );

        const news = results
          .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
          .filter(matchesVisibleItem);

        return addUniqueNews(feed, news);
      }

      feed.exhausted = true;
      return 0;
    } finally {
      feed.loading = false;
    }
  }

  function getArchiveSources(feed) {
    if (!feed.archiveSources) {
      if (state.activeSourceFilter) {
        const source = state.sourceMap.get(state.activeSourceFilter);
        feed.archiveSources = source && !isIgnoredSource(source.id) ? [source] : [];
        return feed.archiveSources;
      }

      if (feed.tab === 'favorites') {
        feed.archiveSources = [...state.favoriteSourceIds]
          .map((sourceId) => state.sourceMap.get(sourceId))
          .filter((source) => source?.id && !isIgnoredSource(source.id))
          .sort(sortSourcesByTitle);
        return feed.archiveSources;
      }

      const categoryFilters = getFeedCategoryFilters(feed.tab);
      const sources = categoryFilters.length === 0
        ? state.sources
        : state.sources.filter((source) => source.categorias?.some((category) => categoryFilters.includes(category)));

      feed.archiveSources = sources.filter((source) => !isIgnoredSource(source.id));
    }

    return feed.archiveSources;
  }

  function getFeedCategoryFilters(tab) {
    if (state.activeCategoryFilter) {
      return [state.activeCategoryFilter];
    }

    return tab === 'mine' ? state.selectedCategories : [];
  }

  function matchesVisibleItem(item) {
    return matchesActiveCategory(item) && matchesActiveSource(item) && matchesFavoriteSource(item) && !isIgnoredSource(item.fuenteId);
  }

  function matchesActiveCategory(item) {
    return !state.activeCategoryFilter || item.categorias?.includes(state.activeCategoryFilter);
  }

  function matchesActiveSource(item) {
    return !state.activeSourceFilter || item.fuenteId === state.activeSourceFilter;
  }

  function matchesFavoriteSource(item) {
    return state.activeTab !== 'favorites' || state.favoriteSourceIds.has(item.fuenteId);
  }

  function isIgnoredSource(sourceId) {
    return Boolean(sourceId && state.ignoredSourceIds.has(sourceId));
  }

  function queueAutoLoad() {
    if (!isAutoLoadReady() || state.autoLoadTimer) {
      return;
    }

    const elapsed = Date.now() - state.lastAutoLoadAt;
    const delay = Math.max(0, AUTO_LOAD_COOLDOWN_MS - elapsed);

    state.autoLoadTimer = window.setTimeout(() => {
      state.autoLoadTimer = 0;

      if (!isAutoLoadReady()) {
        return;
      }

      state.lastAutoLoadAt = Date.now();
      loadMoreActiveItems({ source: 'auto' });
    }, delay);
  }

  function isAutoLoadReady() {
    const feed = state.feeds[state.activeTab];

    return Boolean(
      feed &&
        state.activeTab !== 'settings' &&
        state.activeTab !== 'saved' &&
        !document.hidden &&
        !elements.app.hidden &&
        !elements.sentinel.hidden &&
        feed.seeded &&
        !feed.pendingLoad &&
        !feed.loading &&
        !feed.loadingMore &&
        !(feed.exhausted && feed.visible >= feed.items.length)
    );
  }

  async function loadMoreActiveItems({ source = 'manual' } = {}) {
    if (state.activeTab === 'settings' || state.activeTab === 'saved') {
      return;
    }

    const tab = state.activeTab;
    const feed = state.feeds[tab];

    if (feed.pendingLoad || feed.loadingMore || (feed.exhausted && feed.visible >= feed.items.length)) {
      return;
    }

    feed.loadingMore = true;
    setLoadMoreEnabled(false);

    if (source === 'auto') {
      pauseAutoObserver();
    }

    try {
      feed.visible += config.pageSize;
      await ensureFeed(tab);
    } finally {
      feed.loadingMore = false;
      setLoadMoreEnabled(true);

      if (source === 'auto') {
        scheduleAutoObserverResume(tab);
      }
    }
  }

  function renderFeed(tab) {
    const feed = state.feeds[tab];
    const list = elements.lists[tab];
    const empty = elements.empty[tab];

    if (!list || !empty) {
      return;
    }

    const visibleItems = feed.items.slice(0, feed.visible);

    if (feed.renderedCount === 0 && list.childElementCount > 0) {
      list.innerHTML = '';
    }

    if (hasRenderOrderChanged(list, visibleItems, feed.renderedCount)) {
      list.innerHTML = '';
      feed.renderedCount = 0;
    }

    const fragment = document.createDocumentFragment();

    visibleItems.slice(feed.renderedCount).forEach((item, offset) => {
      fragment.append(createNewsCard(item, feed.renderedCount + offset));
    });

    if (fragment.childNodes.length > 0) {
      list.append(fragment);
    }

    feed.renderedCount = visibleItems.length;
    empty.hidden = visibleItems.length > 0;
    elements.loadMore.hidden = tab === 'settings' || tab === 'saved' || (feed.exhausted && feed.visible >= feed.items.length);

    if (visibleItems.length > 0) {
      setStatus(feed.exhausted ? labels.noMoreNews : labels.readyStatus);
    }
  }

  function renderSavedFeed() {
    const list = elements.lists.saved;
    const empty = elements.empty.saved;

    if (!list || !empty) {
      return;
    }

    list.innerHTML = '';

    const visibleItems = state.savedItems.filter(matchesVisibleItem);
    const fragment = document.createDocumentFragment();
    visibleItems.forEach((item) => {
      fragment.append(createNewsCard(item));
    });

    list.append(fragment);
    empty.hidden = visibleItems.length > 0;
    setStatus(visibleItems.length > 0 ? labels.readyStatus : '');
  }

  function hasRenderOrderChanged(list, visibleItems, renderedCount) {
    if (renderedCount === 0 || renderedCount > visibleItems.length) {
      return renderedCount > visibleItems.length;
    }

    for (let index = 0; index < renderedCount; index += 1) {
      if (list.children[index]?.dataset.url !== visibleItems[index]?.url) {
        return true;
      }
    }

    return false;
  }

  function createNewsCard(item, index) {
    const article = document.createElement('article');
    article.className = 'news-card';
    article.dataset.url = item.url;
    article.dataset.sourceId = item.fuenteId;

    const link = document.createElement('a');
    link.className = 'news-card__link';
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const media = document.createElement('div');
    media.className = 'news-card__media';

    if (item.imagen) {
      const image = document.createElement('img');
      image.src = item.imagen;
      image.alt = item.titulo;
      image.loading = index === 0 ? 'eager' : 'lazy';
      image.decoding = 'async';

      if (index === 0) {
        image.fetchPriority = 'high';
      }

      media.append(image);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'news-card__placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      media.append(placeholder);
    }

    const body = document.createElement('div');
    body.className = 'news-card__body';

    const meta = document.createElement('p');
    meta.className = 'news-card__meta';

    const time = document.createElement('span');
    time.className = 'news-card__time';
    time.textContent = formatRelativeTime(item.fecha);

    const source = document.createElement('span');
    source.className = 'news-card__source';
    source.textContent = item.fuenteTitle;

    [time, source].forEach((node) => {
      if (node.textContent) {
        meta.append(node);
      }
    });

    const title = document.createElement('h2');
    title.className = 'news-card__title';
    title.textContent = item.titulo;

    body.append(meta, title);

    const tags = createCategoryTags(item.categorias);
    if (tags) {
      body.append(tags);
    }

    link.append(media, body);

    const actions = document.createElement('div');
    actions.className = 'news-card__actions';

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'news-card__action';
    updateSaveButton(save, item);
    save.addEventListener('click', () => toggleSavedItem(item));

    const share = document.createElement('button');
    share.type = 'button';
    share.className = 'news-card__action';
    share.setAttribute('aria-label', `${labels.share}: ${item.titulo}`);
    share.addEventListener('click', () => shareNews(item));

    const shareIcon = document.createElement('span');
    shareIcon.className = 'news-card__action-icon';
    shareIcon.textContent = '↗';
    shareIcon.setAttribute('aria-hidden', 'true');

    const shareText = document.createElement('span');
    shareText.textContent = labels.share;

    share.append(shareIcon, shareText);
    actions.append(save, share);
    article.append(link, actions);

    return article;
  }

  function toggleSavedItem(item) {
    if (!item.url) {
      return;
    }

    if (state.savedUrls.has(item.url)) {
      state.savedItems = state.savedItems.filter((savedItem) => savedItem.url !== item.url);
      state.savedUrls.delete(item.url);
    } else {
      state.savedItems = [getStorableItem(item), ...state.savedItems].slice(0, 100);
      state.savedUrls = new Set(state.savedItems.map((savedItem) => savedItem.url));
      setStatus(labels.savedArticle, 'success');
    }

    persistSavedItems();
    refreshSaveButtons(item.url);

    if (state.activeTab === 'saved') {
      renderSavedFeed();
    }
  }

  function getStorableItem(item) {
    return {
      titulo: item.titulo,
      url: item.url,
      imagen: item.imagen,
      fecha: item.fecha,
      fuenteId: item.fuenteId,
      fuenteTitle: item.fuenteTitle,
      categorias: item.categorias,
      idioma: item.idioma,
    };
  }

  function refreshSaveButtons(url) {
    root.querySelectorAll('.news-card__action[data-save]').forEach((button) => {
      if (button.closest('.news-card')?.dataset.url === url) {
        updateSaveButton(button, { url });
      }
    });
  }

  function updateSaveButton(button, item) {
    const isSaved = state.savedUrls.has(item.url);
    button.dataset.save = 'true';
    button.dataset.saved = String(isSaved);
    button.setAttribute('aria-label', `${isSaved ? labels.removeSaved : labels.saveArticle}: ${item.titulo ?? ''}`);
    button.textContent = isSaved ? labels.saved : labels.saveArticle;
  }

  function createCategoryTags(categories = []) {
    const visibleCategories = categories.filter(Boolean).slice(0, 2);

    if (visibleCategories.length === 0) {
      return null;
    }

    const tags = document.createElement('div');
    tags.className = 'news-card__tags';

    visibleCategories.forEach((category) => {
      const tag = document.createElement('span');
      tag.className = 'news-card__tag';
      tag.textContent = category;
      tags.append(tag);
    });

    return tags;
  }

  function formatRelativeTime(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const absSeconds = Math.abs(seconds);
    const units = [
      ['year', 31536000],
      ['month', 2592000],
      ['week', 604800],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];

    if (absSeconds < 60) {
      return labels.justNow;
    }

    const [unit, unitSeconds] = units.find(([, value]) => absSeconds >= value);

    return relativeTimeFormatter.format(Math.round(seconds / unitSeconds), unit);
  }

  async function shareNews(item) {
    try {
      if (navigator.share) {
        await navigator.share({ title: item.titulo, url: item.url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(item.url);
        setStatus(labels.copiedLink, 'success');
      }
    } catch {
      setStatus(labels.shareError, 'error');
    }
  }

  function pauseAutoObserver() {
    if (state.observer && elements.sentinel) {
      state.observer.unobserve(elements.sentinel);
    }
  }

  function scheduleAutoObserverResume(tab) {
    window.setTimeout(() => {
      if (state.activeTab === tab && isAutoLoadReady()) {
        resumeAutoObserver();
      }
    }, AUTO_OBSERVER_RESUME_DELAY_MS);
  }

  function resumeAutoObserver() {
    if (state.observer && elements.sentinel && !elements.sentinel.hidden && !elements.app.hidden) {
      state.observer.observe(elements.sentinel);
    }
  }

  function setLoadMoreEnabled(isEnabled) {
    if (elements.loadMore) {
      elements.loadMore.disabled = !isEnabled;
    }
  }

  function setStatus(message, tone = 'neutral') {
    if (!elements.status) {
      return;
    }

    elements.status.textContent = message;
    elements.status.dataset.tone = tone;
  }

  function setLoading(isLoading) {
    if (elements.loading) {
      elements.loading.hidden = !isLoading;
    }
  }
}
