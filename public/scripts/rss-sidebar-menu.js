const root = document.querySelector('[data-rss-reader]');

if (root) {
  const sidebar = root.querySelector('[data-selected-categories]');
  const menuPanel = root.querySelector('[data-menu-panel]');
  const menuToggle = root.querySelector('[data-menu-toggle]');
  const menuClose = root.querySelector('[data-menu-close]');
  const categoriesUrl = root.dataset.categoriesUrl ?? '';
  const categoriesLabel = root.dataset.categoriesLabel ?? 'Categorías';
  const sourcesUrl = root.dataset.sourcesUrl ?? '';
  const sourcesLabel = root.dataset.sourcesLabel ?? 'Fuentes';
  const categoryTitle = sidebar?.dataset.categorySidebarTitle ?? 'Categorías';
  const sourceTitle = sidebar?.dataset.sourceSidebarTitle ?? 'Fuentes';
  const closeLabel = menuClose?.textContent?.trim() || 'Cerrar';
  const drawer = createDrawer();
  const drawerContent = drawer.querySelector('[data-mobile-sidebar-drawer-content]');
  const drawerBackdrop = drawer.querySelector('[data-mobile-sidebar-drawer-backdrop]');

  if (sidebar && menuToggle && drawerContent && drawerBackdrop) {
    document.body.append(drawer);
    ensureDesktopSidebarLinks();
    bindUnifiedDrawer();
  }

  function bindUnifiedDrawer() {
    menuToggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      closeLegacyMenuPanel();

      if (isMobileDrawerMode()) {
        openDrawer();
      } else {
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    }, true);

    drawer.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return;
      }

      if (target.closest('[data-mobile-sidebar-drawer-close]') || target === drawerBackdrop) {
        closeDrawer();
        return;
      }

      const filterButton = target.closest('[data-mobile-sidebar-filter]');
      if (filterButton) {
        const sourceId = filterButton.dataset.mobileSidebarSourceFilter;
        const category = filterButton.dataset.mobileSidebarCategoryFilter;
        const proxy = sourceId
          ? findSourceFilter(sourceId)
          : findCategoryFilter(category ?? '');

        proxy?.click();
        closeDrawer();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isDrawerOpen()) {
        closeDrawer();
      }
    });
  }

  function ensureDesktopSidebarLinks() {
    if (!sidebar) {
      return;
    }

    removeOldSidebarLinks(sidebar);

    const categoryLink = createNavLink({
      className: 'reader-sidebar-link reader-sidebar-link--categories',
      href: categoriesUrl,
      text: categoriesLabel,
    });
    const sourcesLink = createNavLink({
      className: 'reader-sidebar-link reader-sidebar-link--sources',
      href: sourcesUrl,
      text: sourcesLabel,
    });
    const separator = document.createElement('span');
    separator.className = 'reader-sidebar-separator';
    separator.setAttribute('aria-hidden', 'true');

    if (categoriesUrl) {
      sidebar.append(categoryLink);
    }
    sidebar.append(separator);
    if (sourcesUrl) {
      sidebar.append(sourcesLink);
    }
  }

  function removeOldSidebarLinks(container) {
    container.querySelectorAll(':scope > [data-sidebar-extra-link], :scope > [data-sidebar-sources-link], :scope > .reader-sidebar-separator')
      .forEach((item) => item.remove());
  }

  function renderMobileSidebarDrawer() {
    if (!drawerContent || !sidebar) {
      return;
    }

    const fragment = document.createDocumentFragment();
    fragment.append(createDrawerHeader());
    fragment.append(createDrawerSection(categoryTitle, getCategoryFilters(), categoriesUrl, categoriesLabel));
    fragment.append(createDrawerSeparator());
    fragment.append(createDrawerSection(sourceTitle, getSourceFilters(), sourcesUrl, sourcesLabel));
    drawerContent.replaceChildren(fragment);
  }

  function getCategoryFilters() {
    if (!sidebar) {
      return [];
    }

    return [...sidebar.querySelectorAll('[data-category-filter]')]
      .filter((filter) => !filter.closest('[data-sidebar-extra-link]'))
      .map((filter) => ({
        type: 'category',
        id: filter.dataset.categoryFilter ?? '',
        label: filter.textContent?.trim() || categoriesLabel,
        pressed: filter.getAttribute('aria-pressed') === 'true',
      }));
  }

  function getSourceFilters() {
    return [...root.querySelectorAll('[data-menu-source-filter]')]
      .map((filter) => ({
        type: 'source',
        id: filter.dataset.menuSourceFilter ?? '',
        label: filter.textContent?.trim() || sourcesLabel,
        pressed: filter.getAttribute('aria-pressed') === 'true',
      }))
      .filter((filter) => filter.id);
  }

  function createDrawerSection(title, filters, moreUrl, moreLabel) {
    const section = document.createElement('section');
    section.className = 'reader-mobile-sidebar-drawer__section';

    const heading = document.createElement('h2');
    heading.className = 'reader-mobile-sidebar-drawer__section-title';
    heading.textContent = title;
    section.append(heading);

    const list = document.createElement('div');
    list.className = 'reader-mobile-sidebar-drawer__list';

    if (filters.length > 0) {
      filters.forEach((filter) => list.append(createFilterButton(filter)));
    }

    if (moreUrl) {
      list.append(createNavLink({
        className: 'reader-mobile-sidebar-drawer__link reader-mobile-sidebar-drawer__link--more',
        href: moreUrl,
        text: moreLabel,
      }));
    }

    section.append(list);
    return section;
  }

  function createFilterButton(filter) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reader-mobile-sidebar-drawer__filter';
    button.dataset.mobileSidebarFilter = 'true';
    button.setAttribute('aria-pressed', String(filter.pressed));
    button.textContent = filter.label;

    if (filter.type === 'source') {
      button.dataset.mobileSidebarSourceFilter = filter.id;
    } else {
      button.dataset.mobileSidebarCategoryFilter = filter.id;
    }

    return button;
  }

  function createDrawer() {
    const wrapper = document.createElement('div');
    wrapper.className = 'reader-mobile-sidebar-drawer';
    wrapper.dataset.mobileSidebarDrawer = 'true';
    wrapper.dataset.open = 'false';
    wrapper.setAttribute('aria-hidden', 'true');

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'reader-mobile-sidebar-drawer__backdrop';
    backdrop.dataset.mobileSidebarDrawerBackdrop = 'true';
    backdrop.setAttribute('aria-label', closeLabel);

    const panel = document.createElement('aside');
    panel.className = 'reader-mobile-sidebar-drawer__panel';
    panel.setAttribute('aria-label', categoryTitle);

    const content = document.createElement('nav');
    content.className = 'reader-mobile-sidebar-drawer__content';
    content.dataset.mobileSidebarDrawerContent = 'true';
    content.setAttribute('aria-label', categoryTitle);

    panel.append(content);
    wrapper.append(backdrop, panel);
    return wrapper;
  }

  function createDrawerHeader() {
    const header = document.createElement('div');
    header.className = 'reader-mobile-sidebar-drawer__header';

    const title = document.createElement('p');
    title.className = 'reader-mobile-sidebar-drawer__title';
    title.textContent = categoryTitle;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'reader-mobile-sidebar-drawer__close';
    close.dataset.mobileSidebarDrawerClose = 'true';
    close.setAttribute('aria-label', closeLabel);
    close.textContent = closeLabel;

    header.append(title, close);
    return header;
  }

  function createNavLink({ className, href, text }) {
    const link = document.createElement('a');
    link.className = className;
    link.dataset.sidebarExtraLink = 'true';
    link.href = href;
    link.textContent = text;
    return link;
  }

  function createDrawerSeparator() {
    const separator = document.createElement('span');
    separator.className = 'reader-mobile-sidebar-drawer__separator';
    separator.setAttribute('aria-hidden', 'true');
    return separator;
  }

  function openDrawer() {
    closeLegacyMenuPanel();
    renderMobileSidebarDrawer();
    drawer.dataset.open = 'true';
    drawer.setAttribute('aria-hidden', 'false');
    menuToggle.setAttribute('aria-expanded', 'true');
    document.documentElement.dataset.mobileSidebarDrawerOpen = 'true';
    drawer.querySelector('a, button')?.focus({ preventScroll: true });
  }

  function closeDrawer() {
    drawer.dataset.open = 'false';
    drawer.setAttribute('aria-hidden', 'true');
    menuToggle.setAttribute('aria-expanded', 'false');
    delete document.documentElement.dataset.mobileSidebarDrawerOpen;
    drawerContent?.replaceChildren();
  }

  function isDrawerOpen() {
    return drawer.dataset.open === 'true';
  }

  function closeLegacyMenuPanel() {
    if (menuPanel) {
      menuPanel.hidden = true;
    }
  }

  function findCategoryFilter(category) {
    return [...root.querySelectorAll('[data-category-filter], [data-menu-category-filter]')]
      .find((button) => (button.dataset.categoryFilter ?? button.dataset.menuCategoryFilter ?? '') === category) ?? null;
  }

  function findSourceFilter(sourceId) {
    return [...root.querySelectorAll('[data-source-filter], [data-menu-source-filter]')]
      .find((button) => (button.dataset.sourceFilter ?? button.dataset.menuSourceFilter ?? '') === sourceId) ?? null;
  }

  function isMobileDrawerMode() {
    return window.matchMedia('(max-width: 47.999rem)').matches;
  }
}
