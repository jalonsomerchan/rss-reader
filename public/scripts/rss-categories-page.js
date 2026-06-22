const root = document.querySelector('[data-categories-page]');

if (root) {
  const labels = JSON.parse(root.dataset.labels ?? '{}');
  const apiBase = root.dataset.apiBase ?? '';
  const sourcesUrl = root.dataset.sourcesUrl ?? '';
  const elements = {
    content: root.querySelector('[data-categories-content]'),
    list: root.querySelector('[data-categories-list]'),
    nav: root.querySelector('[data-categories-nav]'),
    search: root.querySelector('[data-categories-search]'),
    status: root.querySelector('[data-categories-status]'),
  };
  const state = {
    categories: [],
    sources: [],
    query: '',
  };
  const sorter = new Intl.Collator(document.documentElement.lang || 'es', { sensitivity: 'base' });

  init().catch(() => setStatus(labels.error ?? 'No se han podido cargar las categorías.'));

  async function init() {
    setStatus(labels.loading ?? 'Cargando categorías…');
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
    const categories = getVisibleCategories();
    renderNav(categories);
    renderCategories(categories);
  }

  function renderNav(categories) {
    if (!elements.nav) {
      return;
    }

    elements.nav.innerHTML = '';
    categories.forEach((category) => {
      const link = document.createElement('a');
      link.href = `#${category.id}`;
      link.textContent = category.name;

      const count = document.createElement('span');
      count.textContent = String(category.sources.length);
      link.append(count);
      elements.nav.append(link);
    });
  }

  function renderCategories(categories) {
    if (!elements.list) {
      return;
    }

    elements.list.innerHTML = '';

    if (categories.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'sources-page__empty';
      empty.textContent = labels.empty ?? 'No hay categorías para mostrar.';
      elements.list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    categories.forEach((category) => fragment.append(createCategoryCard(category)));
    elements.list.append(fragment);
  }

  function createCategoryCard(category) {
    const section = document.createElement('section');
    section.className = 'sources-category sources-category--summary';
    section.id = category.id;

    const header = document.createElement('header');
    header.className = 'sources-category__header';

    const title = document.createElement('h2');
    title.textContent = category.name;

    const count = document.createElement('p');
    count.textContent = getSourceCountLabel(category.sources.length);

    header.append(title, count);

    const preview = document.createElement('div');
    preview.className = 'source-card__categories';
    category.sources.slice(0, 8).forEach((source) => {
      const tag = document.createElement('span');
      tag.textContent = source.title ?? source.id;
      preview.append(tag);
    });

    const link = document.createElement('a');
    link.className = 'sources-category__action';
    link.href = sourcesUrl ? `${sourcesUrl}#${category.id.replace('categoria-', 'categoria-')}` : '#';
    link.textContent = labels.viewSources ?? 'Ver fuentes';

    section.append(header, preview, link);
    return section;
  }

  function getVisibleCategories() {
    return state.categories
      .map((name) => ({
        name,
        id: `categoria-${slugify(name)}`,
        sources: getSourcesForCategory(name),
      }))
      .filter((category) => category.sources.length > 0)
      .filter(matchesSearch);
  }

  function getSourcesForCategory(category) {
    return state.sources
      .filter((source) => source.categorias?.includes(category))
      .sort((a, b) => sorter.compare(a.title ?? a.id, b.title ?? b.id));
  }

  function matchesSearch(category) {
    if (!state.query) {
      return true;
    }

    return [category.name, ...category.sources.flatMap((source) => [source.title, source.id, source.source])]
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
