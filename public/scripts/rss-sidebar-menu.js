const root = document.querySelector('[data-rss-reader]');

if (root) {
  const sidebar = root.querySelector('[data-selected-categories]');
  const menuPanel = root.querySelector('[data-menu-panel]');
  const menuToggle = root.querySelector('[data-menu-toggle]');
  const sourcesUrl = root.dataset.sourcesUrl ?? '';
  const sourcesLabel = root.dataset.sourcesLabel ?? 'Fuentes';
  const sidebarTitle = sidebar?.dataset.categorySidebarTitle ?? sidebar?.getAttribute('aria-label') ?? 'Categorías';
  const closeLabel = root.querySelector('[data-menu-close]')?.textContent?.trim() || 'Cerrar';
  const drawer = createDrawer();
  const drawerContent = drawer.querySelector('[data-mobile-sidebar-drawer-content]');
  const drawerBackdrop = drawer.querySelector('[data-mobile-sidebar-drawer-backdrop]');
  let syncFrame = 0;

  if (sidebar && menuToggle && drawerContent && drawerBackdrop) {
    document.body.append(drawer);
    syncSidebarMenus();
    bindMobileDrawer();

    new MutationObserver(queueSidebarSync).observe(sidebar, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-pressed'],
    });
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
      if (event.key === 'Escape' && drawer.dataset.open === 'true') {
        closeDrawer();
      }
    });
  }

  function queueSidebarSync() {
    if (syncFrame) {
      return;
    }

    syncFrame = window.requestAnimationFrame(() => {
      syncFrame = 0;
      syncSidebarMenus();
    });
  }

  function syncSidebarMenus() {
    ensureSourcesLink(sidebar, 'reader-sidebar-link');

    if (drawer.dataset.open === 'true' || drawerContent.childElementCount === 0) {
      renderMobileSidebarDrawer();
    }
  }

  function ensureSourcesLink(container, className) {
    if (!container || !sourcesUrl) {
      return null;
    }

    const existing = container.querySelector(':scope > [data-sidebar-sources-link]');
    if (existing) {
      if (existing.getAttribute('href') !== sourcesUrl) {
        existing.href = sourcesUrl;
      }

      if (existing.textContent !== sourcesLabel) {
        existing.textContent = sourcesLabel;
      }

      if (!existing.classList.contains(className)) {
        existing.className = className;
      }

      return existing;
    }

    const link = createSourcesLink(className);
    container.prepend(link);
    return link;
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

    const filters = [...sidebar.querySelectorAll('[data-category-filter], [data-source-filter]')];
    filters.forEach((filter) => {
      const clone = filter.cloneNode(true);
      clone.className = 'reader-mobile-sidebar-drawer__filter';
      clone.addEventListener('click', () => {
        filter.click();
        closeDrawer();
      });
      fragment.append(clone);
    });

    drawerContent.replaceChildren(fragment);
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
