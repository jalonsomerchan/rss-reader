const root = document.querySelector('[data-rss-reader]');

if (root) {
  const sidebar = root.querySelector('[data-selected-categories]');
  const menuPanel = root.querySelector('[data-menu-panel]');
  const menuToggle = root.querySelector('[data-menu-toggle]');
  const menuClose = root.querySelector('[data-menu-close]');
  const sourcesUrl = root.dataset.sourcesUrl ?? '';
  const sourcesLabel = root.dataset.sourcesLabel ?? 'Fuentes';
  const sidebarTitle = sidebar?.dataset.categorySidebarTitle ?? sidebar?.getAttribute('aria-label') ?? 'Categorías';
  const closeLabel = menuClose?.textContent?.trim() || 'Cerrar';
  const drawer = createDrawer();
  const drawerContent = drawer.querySelector('[data-mobile-sidebar-drawer-content]');
  const drawerBackdrop = drawer.querySelector('[data-mobile-sidebar-drawer-backdrop]');

  if (sidebar && menuToggle && drawerContent && drawerBackdrop) {
    document.body.append(drawer);
    ensureSourcesLink();
    bindMobileDrawer();
  }

  function bindMobileDrawer() {
    menuToggle.addEventListener('click', (event) => {
      if (!isMobileDrawerMode()) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      openDrawer();
    }, true);

    drawer.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return;
      }

      if (target.closest('[data-mobile-sidebar-drawer-close]') || target === drawerBackdrop) {
        closeDrawer();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isDrawerOpen()) {
        closeDrawer();
      }
    });
  }

  function ensureSourcesLink() {
    if (!sidebar || !sourcesUrl || sidebar.querySelector(':scope > [data-sidebar-sources-link]')) {
      return;
    }

    const link = createSourcesLink('reader-sidebar-link');
    sidebar.prepend(link);
  }

  function renderMobileSidebarDrawer() {
    if (!drawerContent || !sidebar) {
      return;
    }

    const fragment = document.createDocumentFragment();
    fragment.append(createDrawerHeader());

    if (sourcesUrl) {
      fragment.append(createSourcesLink('reader-mobile-sidebar-drawer__link'));
    }

    getSidebarFilters().forEach((filter) => {
      const clone = filter.cloneNode(true);
      clone.className = 'reader-mobile-sidebar-drawer__filter';
      clone.type = 'button';
      clone.addEventListener('click', () => {
        filter.click();
        closeDrawer();
      }, { once: true });
      fragment.append(clone);
    });

    drawerContent.replaceChildren(fragment);
  }

  function getSidebarFilters() {
    if (!sidebar) {
      return [];
    }

    return [...sidebar.querySelectorAll('[data-category-filter], [data-source-filter]')]
      .filter((filter) => !filter.matches('[data-sidebar-sources-link]'));
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
    panel.setAttribute('aria-label', sidebarTitle);

    const content = document.createElement('nav');
    content.className = 'reader-mobile-sidebar-drawer__content';
    content.dataset.mobileSidebarDrawerContent = 'true';
    content.setAttribute('aria-label', sidebarTitle);

    panel.append(content);
    wrapper.append(backdrop, panel);
    return wrapper;
  }

  function createDrawerHeader() {
    const header = document.createElement('div');
    header.className = 'reader-mobile-sidebar-drawer__header';

    const title = document.createElement('p');
    title.className = 'reader-mobile-sidebar-drawer__title';
    title.textContent = sidebarTitle;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'reader-mobile-sidebar-drawer__close';
    close.dataset.mobileSidebarDrawerClose = 'true';
    close.setAttribute('aria-label', closeLabel);
    close.textContent = closeLabel;

    header.append(title, close);
    return header;
  }

  function createSourcesLink(className) {
    const link = document.createElement('a');
    link.className = className;
    link.dataset.sidebarSourcesLink = 'true';
    link.href = sourcesUrl;
    link.textContent = sourcesLabel;
    return link;
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

  function isMobileDrawerMode() {
    return window.matchMedia('(max-width: 47.999rem)').matches;
  }
}
