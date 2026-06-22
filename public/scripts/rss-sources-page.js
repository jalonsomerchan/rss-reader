const root = document.querySelector('[data-sources-page]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}');
  const apiBase = root.dataset.apiBase ?? '';
  const elements = {
    content: root.querySelector('[data-sources-content]'),
    list: root.querySelector('[data-sources-list]'),
    nav: root.querySelector('[data-sources-nav]'),
    search: root.querySelector('[data-sources-search]'),
    status: root.querySelector('[data-sources-status]'),
  };
  const state = {
    categories: [],
    sources: [],
    query: '',
  };
  const sorter = new Intl.Collator(document.documentElement.lang || 'es', { sensitivity: 'base' });

  init().catch(() => setStatus(labels.error ?? 'No se han podido cargar las fuentes.'));

  async function init() {
    setStatus(labels.loading ?? 'Cargando fuentes…');
    const [sources, catalog] = await Promise.all([
      fetchApiJson('sources.json'),
      fetchApiJson('categories.json').catch(() => ({})),
    ]);

    state.sources = Array.isArray(sources) ? sources.filter((source) => source?.id && source?.title) : [];
    state.categories = normalizeCategories(catalog, getAvailableCategories());
    bindEvents();
    render();
    setStatus('');
    if (elements.content) {
      elements.content.hidden = false;
    }
  }

  function bindEvents() {
    elements.search?.addEventListener('input', () => {
      state.query = normalizeText(elements.search.value);
      render();
    });
  }

  function render() {
    const sections = getVisibleSections();
    renderNav(sections);
    renderSections(sections);
  }

  function renderNav(sections) {
    if (!elements.nav) {
      return;
    }

    elements.nav.innerHTML = '';
    sections.forEach((section) => {
      const link = document.createElement('a');
      link.href = `#${section.id}`;
      link.textContent = section.category;

      const count = document.createElement('span');
      count.textContent = String(section.sources.length);
      link.append(count);
      elements.nav.append(link);
    });
  }

  function renderSections(sections) {
    if (!elements.list) {
      return;
    }

    elements.list.innerHTML = '';

    if (sections.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'sources-page__empty';
      empty.textContent = labels.empty ?? 'No hay fuentes para mostrar.';
      elements.list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    sections.forEach((section) => fragment.append(createCategorySection(section)));
    elements.list.append(fragment);
  }

  function createCategorySection(section) {
    const sectionElement = document.createElement('section');
    sectionElement.className = 'sources-category';
    sectionElement.id = section.id;

    const header = document.createElement('header');
    header.className = 'sources-category__header';

    const title = document.createElement('h2');
    title.textContent = section.category;

    const count = document.createElement('p');
    count.textContent = getSourceCountLabel(section.sources.length);

    header.append(title, count);

    const list = document.createElement('div');
    list.className = 'sources-category__list';
    section.sources.forEach((source) => list.append(createSourceCard(source, section.category)));

    sectionElement.append(header, list);
    return sectionElement;
  }

  function createSourceCard(source, category) {
    const article = document.createElement('article');
    article.className = 'source-card';

    const title = document.createElement('h3');
    const link = document.createElement('a');
    link.href = source.source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = source.title ?? source.id;
    link.setAttribute('aria-label', `${labels.openSource ?? 'Abrir fuente'}: ${source.title ?? source.id}`);
    title.append(link);

    const meta = document.createElement('p');
    meta.className = 'source-card__meta';
    meta.textContent = getFeedHost(source.source);

    const categories = document.createElement('div');
    categories.className = 'source-card__categories';
    getSourceCategories(source, category).forEach((item) => {
      const tag = document.createElement('span');
      tag.textContent = item;
      categories.append(tag);
    });

    article.append(title, meta, categories);
    return article;
  }

  function getVisibleSections() {
    return state.categories
      .map((category) => ({
        category,
        id: `categoria-${slugify(category)}`,
        sources: getSourcesForCategory(category),
      }))
      .filter((section) => section.sources.length > 0);
  }

  function getSourcesForCategory(category) {
    return state.sources
      .filter((source) => source.categorias?.includes(category))
      .filter(matchesSearch)
      .sort((a, b) => sorter.compare(a.title ?? a.id, b.title ?? b.id));
  }

  function matchesSearch(source) {
    if (!state.query) {
      return true;
    }

    return [source.title, source.id, source.source, ...(source.categorias ?? [])]
      .some((value) => normalizeText(value).includes(state.query));
  }

  function normalizeCategories(catalog, availableCategories) {
    const rawCategories = Array.isArray(catalog?.categorias)
      ? catalog.categorias
      : Array.isArray(catalog?.supercategorias)
        ? catalog.supercategorias.flatMap((group) => group.categorias ?? [])
        : [];
    const available = new Set(availableCategories);
    const ordered = [...new Set(rawCategories)].filter((category) => available.has(category));
    const remaining = availableCategories.filter((category) => !ordered.includes(category));

    return [...ordered, ...remaining];
  }

  function getAvailableCategories() {
    return [...new Set(state.sources.flatMap((source) => source.categorias ?? []).filter(Boolean))]
      .sort((a, b) => sorter.compare(a, b));
  }

  function getSourceCategories(source, currentCategory) {
    return [currentCategory, ...(source.categorias ?? []).filter((category) => category !== currentCategory)].slice(0, 4);
  }

  async function fetchApiJson(path) {
    const response = await fetch(new URL(path, apiBase || window.location.href), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Unable to load ${path}`);
    }

    return response.json();
  }

  function setStatus(message) {
    if (elements.status) {
      elements.status.textContent = message;
      elements.status.hidden = !message;
    }
  }

  function getSourceCountLabel(count) {
    const template = count === 1
      ? labels.sourceCount ?? '{{count}} fuente'
      : labels.sourceCountPlural ?? '{{count}} fuentes';

    return template.replaceAll('{{count}}', String(count)).replaceAll('{count}', String(count));
  }

  function getFeedHost(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url ?? '';
    }
  }

  function normalizeText(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function slugify(value) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'categoria';
  }
}
