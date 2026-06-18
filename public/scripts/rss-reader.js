import {
  addUniqueNews,
  fetchJson,
  getAllCategories,
  getArchivePath,
  getCurrentMonthCursor,
  getPreviousMonth,
  getSourcesForTab,
  normalizeNews,
} from './rss-api.js';

const root = document.querySelector('[data-rss-reader]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}');
  const config = {
    apiBase: root.dataset.apiBase ?? '',
    storageKey: root.dataset.storageKey ?? 'rss-reader:selected-categories',
    pageSize: Number(root.dataset.pageSize ?? 12),
    archiveMonthLookback: Number(root.dataset.archiveMonthLookback ?? 12),
    archiveSourceBatchSize: Number(root.dataset.archiveSourceBatchSize ?? 4),
    locale: root.dataset.locale ?? document.documentElement.lang ?? 'es',
  };

  const elements = {
    app: root.querySelector('[data-reader-app]'),
    onboarding: root.querySelector('[data-onboarding]'),
    setupCategories: root.querySelector('[data-category-list="setup"]'),
    settingsCategories: root.querySelector('[data-category-list="settings"]'),
    saveSetup: root.querySelector('[data-save-categories="setup"]'),
    saveSettings: root.querySelector('[data-save-categories="settings"]'),
    tabs: [...root.querySelectorAll('[data-tab]')],
    panels: [...root.querySelectorAll('[data-panel]')],
    lists: {
      mine: root.querySelector('[data-list="mine"]'),
      all: root.querySelector('[data-list="all"]'),
    },
    empty: {
      mine: root.querySelector('[data-empty="mine"]'),
      all: root.querySelector('[data-empty="all"]'),
    },
    status: root.querySelector('[data-status]'),
    loading: root.querySelector('[data-loading]'),
    loadMore: root.querySelector('[data-load-more]'),
    sentinel: root.querySelector('[data-sentinel]'),
  };

  const state = {
    activeTab: 'mine',
    sources: [],
    categories: [],
    selectedCategories: [],
    feeds: {
      mine: createFeed('mine'),
      all: createFeed('all'),
    },
  };

  const relativeTimeFormatter = new Intl.RelativeTimeFormat(config.locale, { numeric: 'auto' });

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
      seeded: false,
      loading: false,
      exhausted: false,
      monthCursor: getCurrentMonthCursor(),
      sourceIndex: 0,
      monthsScanned: 0,
    };
  }

  async function init() {
    setLoading(true);
    state.sources = await fetchJson(config.apiBase, 'sources.json');
    state.categories = getAllCategories(state.sources);
    state.selectedCategories = readSelectedCategories().filter((category) => state.categories.includes(category));

    renderCategoryPickers();
    bindEvents();

    if (state.selectedCategories.length === 0) {
      showOnboarding();
      setLoading(false);
      return;
    }

    await showApp('mine');
    setLoading(false);
  }

  function bindEvents() {
    elements.tabs.forEach((tab) => {
      tab.addEventListener('click', () => showApp(tab.dataset.tab));
    });

    elements.saveSetup?.addEventListener('click', () => saveCategoriesFrom(elements.setupCategories));
    elements.saveSettings?.addEventListener('click', () => saveCategoriesFrom(elements.settingsCategories));
    elements.loadMore?.addEventListener('click', () => loadMoreActiveItems());

    elements.setupCategories?.addEventListener('change', updateCategoryActions);
    elements.settingsCategories?.addEventListener('change', updateCategoryActions);

    if ('IntersectionObserver' in window && elements.sentinel) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreActiveItems();
        }
      }, { rootMargin: '360px 0px' });

      observer.observe(elements.sentinel);
    }
  }

  function showOnboarding() {
    elements.onboarding.hidden = false;
    elements.app.hidden = true;
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

    elements.loadMore.hidden = tab === 'settings';
    elements.sentinel.hidden = tab === 'settings';

    if (tab === 'settings') {
      setStatus(labels.settingsHint);
      updateCategoryActions();
      return;
    }

    await ensureFeed(tab);
  }

  function renderCategoryPickers() {
    renderCategoryPicker(elements.setupCategories);
    renderCategoryPicker(elements.settingsCategories);
    updateCategoryActions();
  }

  function renderCategoryPicker(container) {
    if (!container) {
      return;
    }

    container.innerHTML = '';

    state.categories.forEach((category, index) => {
      const id = `${container.dataset.categoryList}-category-${index}`;
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
      container.append(label);
    });
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

  function saveCategoriesFrom(container) {
    const categories = getCheckedCategories(container);

    if (categories.length === 0) {
      setStatus(labels.selectOneCategory, 'error');
      return;
    }

    state.selectedCategories = categories;
    localStorage.setItem(config.storageKey, JSON.stringify(categories));
    state.feeds.mine = createFeed('mine');
    renderCategoryPickers();
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

  async function ensureFeed(tab) {
    const feed = state.feeds[tab];

    setLoading(true);

    if (!feed.seeded) {
      await seedFeed(tab);
    }

    await fillFeedUntilNeeded(tab);
    renderFeed(tab);
    setLoading(false);
  }

  async function seedFeed(tab) {
    const feed = state.feeds[tab];
    const sourceMap = new Map(state.sources.map((source) => [source.id, source]));

    try {
      if (tab === 'all') {
        const data = await fetchJson(config.apiBase, 'indexes/portada.json');
        addUniqueNews(feed, (data.noticias ?? []).map((item) => normalizeNews(item, sourceMap.get(item.fuenteId))));
      } else {
        const data = await fetchJson(config.apiBase, 'indexes/categorias.json');
        const items = state.selectedCategories.flatMap((category) => data.categorias?.[category] ?? []);
        addUniqueNews(feed, items.map((item) => normalizeNews(item, sourceMap.get(item.fuenteId))));
      }
    } catch {
      setStatus(labels.errorLoading, 'error');
    } finally {
      feed.seeded = true;
    }
  }

  async function fillFeedUntilNeeded(tab) {
    const feed = state.feeds[tab];

    while (feed.items.length < feed.visible && !feed.exhausted) {
      const added = await loadArchiveBatch(tab);

      if (added === 0 && feed.exhausted) {
        break;
      }
    }
  }

  async function loadArchiveBatch(tab) {
    const feed = state.feeds[tab];
    const archiveSources = getSourcesForTab(state.sources, tab, state.selectedCategories);

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
            const items = await fetchJson(config.apiBase, getArchivePath(source.id, feed.monthCursor));

            return Array.isArray(items) ? items.map((item) => normalizeNews(item, source)) : [];
          })
        );

        const news = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

        return addUniqueNews(feed, news);
      }

      feed.exhausted = true;
      return 0;
    } finally {
      feed.loading = false;
    }
  }

  async function loadMoreActiveItems() {
    if (state.activeTab === 'settings') {
      return;
    }

    const feed = state.feeds[state.activeTab];
    feed.visible += config.pageSize;
    await ensureFeed(state.activeTab);
  }

  function renderFeed(tab) {
    const feed = state.feeds[tab];
    const list = elements.lists[tab];
    const empty = elements.empty[tab];

    if (!list || !empty) {
      return;
    }

    list.innerHTML = '';

    const visibleItems = feed.items.slice(0, feed.visible);
    visibleItems.forEach((item) => list.append(createNewsCard(item)));

    empty.hidden = visibleItems.length > 0;
    elements.loadMore.hidden = feed.exhausted && feed.visible >= feed.items.length;

    if (visibleItems.length > 0) {
      setStatus(feed.exhausted ? labels.noMoreNews : labels.readyStatus);
    }
  }

  function createNewsCard(item) {
    const article = document.createElement('article');
    article.className = 'news-card';

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
      image.loading = 'lazy';
      image.decoding = 'async';
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
    meta.textContent = [formatRelativeTime(item.fecha), item.fuenteTitle].filter(Boolean).join(' · ');

    const title = document.createElement('h2');
    title.className = 'news-card__title';
    title.textContent = item.titulo;

    body.append(meta, title);
    link.append(media, body);

    const share = document.createElement('button');
    share.type = 'button';
    share.className = 'news-card__share';
    share.textContent = labels.share;
    share.setAttribute('aria-label', `${labels.share}: ${item.titulo}`);
    share.addEventListener('click', () => shareNews(item));

    article.append(link, share);

    return article;
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
