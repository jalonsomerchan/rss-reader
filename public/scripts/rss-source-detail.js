import { fetchJson, getArchivePath, getCurrentMonthCursor, getPreviousMonth, normalizeNews, sortNews } from './rss-api.js';

const root = document.querySelector('[data-source-detail]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}');
  const apiBase = root.dataset.apiBase ?? '';
  const sourceId = root.dataset.sourceId ?? '';
  const storageKey = root.dataset.storageKey ?? 'rss-reader:selected-categories';
  const ignoredSourcesStorageKey = `${storageKey}:ignored-sources`;
  const elements = {
    actions: root.querySelector('[data-source-actions]'),
    categories: root.querySelector('[data-source-categories]'),
    content: root.querySelector('[data-source-content]'),
    description: root.querySelector('[data-source-description]'),
    feedLink: root.querySelector('[data-source-feed-link]'),
    news: root.querySelector('[data-source-news]'),
    newsCount: root.querySelector('[data-source-news-count]'),
    status: root.querySelector('[data-source-status]'),
    title: root.querySelector('[data-source-title]'),
    toggle: root.querySelector('[data-source-toggle]'),
    url: root.querySelector('[data-source-url]'),
  };
  const state = {
    source: null,
    ignoredSourceIds: readIgnoredSourceIds(),
  };

  init().catch(() => setStatus(labels.error ?? 'No se ha podido cargar la fuente.'));

  async function init() {
    setStatus(labels.loading ?? 'Cargando fuente…');
    const sources = await fetchJson(apiBase, 'sources.json');
    state.source = Array.isArray(sources) ? sources.find((source) => source?.id === sourceId) : null;

    if (!state.source) {
      renderNotFound();
      return;
    }

    renderSource();
    bindEvents();
    const news = await loadLatestNews(state.source);
    renderNews(news);
    setStatus('');
  }

  function bindEvents() {
    elements.toggle?.addEventListener('click', () => {
      if (!state.source?.id) {
        return;
      }

      if (state.ignoredSourceIds.has(state.source.id)) {
        state.ignoredSourceIds.delete(state.source.id);
        setStatus(labels.statusFollowed ?? 'Fuente seguida.');
      } else {
        state.ignoredSourceIds.add(state.source.id);
        setStatus(labels.statusIgnored ?? 'Fuente ignorada.');
      }

      persistIgnoredSourceIds();
      renderToggle();
    });
  }

  function renderSource() {
    const source = state.source;
    document.title = `${source.title ?? source.id} · ${document.title}`;

    if (elements.title) {
      elements.title.textContent = source.title ?? source.id;
    }

    if (elements.description) {
      elements.description.textContent = source.id;
    }

    if (elements.url) {
      elements.url.href = source.source;
      elements.url.textContent = source.source;
    }

    if (elements.feedLink) {
      elements.feedLink.href = source.source;
    }

    if (elements.categories) {
      elements.categories.innerHTML = '';
      (source.categorias ?? []).filter(Boolean).forEach((category) => {
        const tag = document.createElement('span');
        tag.textContent = category;
        elements.categories.append(tag);
      });
    }

    if (elements.actions) {
      elements.actions.hidden = false;
    }

    if (elements.content) {
      elements.content.hidden = false;
    }

    renderToggle();
  }

  function renderToggle() {
    if (!elements.toggle || !state.source?.id) {
      return;
    }

    const isIgnored = state.ignoredSourceIds.has(state.source.id);
    elements.toggle.dataset.ignored = String(isIgnored);
    elements.toggle.textContent = isIgnored ? labels.follow ?? 'Seguir' : labels.ignore ?? 'Ignorar';
    elements.toggle.setAttribute('aria-pressed', String(isIgnored));
    elements.toggle.setAttribute('aria-label', isIgnored ? labels.follow ?? 'Seguir' : labels.ignore ?? 'Ignorar');
  }

  function renderNotFound() {
    if (elements.title) {
      elements.title.textContent = labels.sourceNotFound ?? 'Fuente no encontrada';
    }

    if (elements.description) {
      elements.description.textContent = sourceId;
    }

    setStatus(labels.sourceNotFound ?? 'Fuente no encontrada');
  }

  async function loadLatestNews(source) {
    const news = [];

    try {
      const frontPage = await fetchJson(apiBase, 'indexes/portada.json');
      news.push(...(frontPage.noticias ?? [])
        .filter((item) => item.fuenteId === source.id)
        .map((item) => normalizeNews(item, source)));
    } catch {
      // The archive below is enough if the front page is temporarily unavailable.
    }

    let cursor = getCurrentMonthCursor();
    for (let index = 0; index < 3; index += 1) {
      try {
        const items = await fetchJson(apiBase, getArchivePath(source.id, cursor));
        if (Array.isArray(items)) {
          news.push(...items.map((item) => normalizeNews(item, source)));
        }
      } catch {
        // Older months may not exist for every source.
      }
      cursor = getPreviousMonth(cursor);
    }

    return sortNews(dedupeNews(news)).slice(0, 24);
  }

  function renderNews(news) {
    if (!elements.news) {
      return;
    }

    elements.news.innerHTML = '';

    if (elements.newsCount) {
      elements.newsCount.textContent = news.length ? String(news.length) : '';
    }

    if (news.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'source-detail__empty';
      empty.textContent = labels.emptyNews ?? 'No hay noticias recientes de esta fuente.';
      elements.news.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    news.forEach((item) => fragment.append(createNewsCard(item)));
    elements.news.append(fragment);
  }

  function createNewsCard(item) {
    const article = document.createElement('article');
    article.className = 'source-news-card';

    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${labels.openNews ?? 'Abrir noticia'}: ${item.titulo}`);

    if (item.imagen) {
      const image = document.createElement('img');
      image.src = item.imagen;
      image.alt = item.titulo;
      image.loading = 'lazy';
      image.decoding = 'async';
      link.append(image);
    }

    const body = document.createElement('span');
    body.className = 'source-news-card__body';

    const title = document.createElement('strong');
    title.textContent = item.titulo;

    const date = document.createElement('span');
    date.textContent = formatDate(item.fecha);

    body.append(title, date);
    link.append(body);
    article.append(link);
    return article;
  }

  function dedupeNews(news) {
    const seen = new Set();
    return news.filter((item) => {
      if (!item.url || seen.has(item.url)) {
        return false;
      }

      seen.add(item.url);
      return true;
    });
  }

  function readIgnoredSourceIds() {
    try {
      const value = JSON.parse(localStorage.getItem(ignoredSourcesStorageKey) ?? '[]');
      return new Set(Array.isArray(value) ? value.filter(Boolean) : []);
    } catch {
      return new Set();
    }
  }

  function persistIgnoredSourceIds() {
    localStorage.setItem(ignoredSourcesStorageKey, JSON.stringify([...state.ignoredSourceIds]));
  }

  function setStatus(message) {
    if (elements.status) {
      elements.status.textContent = message;
      elements.status.hidden = !message;
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat(document.documentElement.lang || 'es', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }
}
