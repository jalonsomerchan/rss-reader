const root = document.querySelector('[data-rss-reader]');

if (root) {
  const HISTORY_SYNC_DELAY_MS = 0;
  const HISTORY_RESTORE_RETRY_MS = 80;
  const HISTORY_RESTORE_MAX_ATTEMPTS = 25;
  const labels = JSON.parse(root.dataset.labels ?? '{}');
  let isRestoringHistory = false;
  let lastSyncedUrl = window.location.href;

  enhanceNewsCards();
  observeNewsCards();
  bindFilterHistory();
  bindHeaderScrollTop();
  restoreFilterFromUrl({ replace: true });

  function bindFilterHistory() {
    root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return;
      }

      if (target.closest('[data-card-source-filter]')) {
        return;
      }

      const filterButton = target.closest(
        '[data-category-filter], [data-source-filter], [data-menu-category-filter], [data-menu-source-filter], [data-tab]'
      );

      if (filterButton) {
        queueHistorySync();
      }
    });

    window.addEventListener('popstate', () => restoreFilterFromUrl());
  }

  function bindHeaderScrollTop() {
    const header = root.querySelector('.reader-appbar');

    header?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;

      if (target?.closest('button, a, input, select, textarea, summary, [data-reader-menu], [data-menu-panel]')) {
        return;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function observeNewsCards() {
    const lists = root.querySelectorAll('[data-list]');

    lists.forEach((list) => {
      new MutationObserver(enhanceNewsCards).observe(list, { childList: true });
    });
  }

  function enhanceNewsCards() {
    root.querySelectorAll('.news-card[data-source-id]:not([data-source-filter-ready="true"])').forEach((card) => {
      const sourceId = card.dataset.sourceId;
      const sourceTitle = card.querySelector('.news-card__source')?.textContent?.trim() || sourceId;
      const actions = card.querySelector('.news-card__actions');

      if (!sourceId || !actions) {
        return;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'news-card__action news-card__source-action';
      button.dataset.cardSourceFilter = sourceId;
      button.setAttribute('aria-label', getSourceButtonLabel(sourceTitle));
      button.textContent = labels.viewSource ?? 'Ver fuente';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        activateSource(sourceId);
      });

      actions.prepend(button);
      card.dataset.sourceFilterReady = 'true';
    });
  }

  function activateSource(sourceId) {
    const sourceButton = findFilterButton('[data-menu-source-filter]', 'menuSourceFilter', sourceId);

    if (!sourceButton) {
      return;
    }

    sourceButton.click();
    queueHistorySync();
  }

  function restoreFilterFromUrl({ replace = false } = {}) {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('source');
    const category = params.get('category');

    isRestoringHistory = true;
    tryRestoreFilter({ source, category, attempt: 0, replace });
  }

  function tryRestoreFilter({ source, category, attempt, replace }) {
    const button = source
      ? findFilterButton('[data-menu-source-filter]', 'menuSourceFilter', source)
      : findCategoryRestoreButton(category);

    if (button) {
      button.click();
      window.setTimeout(() => {
        isRestoringHistory = false;
        syncFilterUrl({ replace });
      }, HISTORY_SYNC_DELAY_MS);
      return;
    }

    if (attempt < HISTORY_RESTORE_MAX_ATTEMPTS) {
      window.setTimeout(() => {
        tryRestoreFilter({ source, category, attempt: attempt + 1, replace });
      }, HISTORY_RESTORE_RETRY_MS);
      return;
    }

    isRestoringHistory = false;
  }

  function findCategoryRestoreButton(category) {
    if (category) {
      return findFilterButton('[data-menu-category-filter]', 'menuCategoryFilter', category);
    }

    return root.querySelector('[data-category-filter=""]');
  }

  function queueHistorySync() {
    if (isRestoringHistory) {
      return;
    }

    window.setTimeout(() => syncFilterUrl(), HISTORY_SYNC_DELAY_MS);
  }

  function syncFilterUrl({ replace = false } = {}) {
    const url = new URL(window.location.href);
    const { category, source } = getActiveFilters();

    if (source) {
      url.searchParams.set('source', source);
      url.searchParams.delete('category');
    } else if (category) {
      url.searchParams.set('category', category);
      url.searchParams.delete('source');
    } else {
      url.searchParams.delete('category');
      url.searchParams.delete('source');
    }

    const nextUrl = url.toString();
    if (nextUrl === lastSyncedUrl) {
      return;
    }

    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({ category, source }, '', nextUrl);
    lastSyncedUrl = nextUrl;
  }

  function getActiveFilters() {
    const sourceButton = root.querySelector('[data-source-filter][aria-pressed="true"], [data-menu-source-filter][aria-pressed="true"]');
    const source = sourceButton?.dataset.sourceFilter || sourceButton?.dataset.menuSourceFilter || '';

    if (source) {
      return { category: '', source };
    }

    const categoryButton = root.querySelector('[data-category-filter][aria-pressed="true"], [data-menu-category-filter][aria-pressed="true"]');
    const category = categoryButton?.dataset.categoryFilter || categoryButton?.dataset.menuCategoryFilter || '';

    return { category, source: '' };
  }

  function findFilterButton(selector, datasetKey, value) {
    return [...root.querySelectorAll(selector)].find((button) => button.dataset[datasetKey] === value) ?? null;
  }

  function getSourceButtonLabel(sourceTitle) {
    return (labels.viewSourceAria ?? 'Ver solo noticias de {{source}}')
      .replaceAll('{{source}}', sourceTitle)
      .replaceAll('{source}', sourceTitle);
  }
}
