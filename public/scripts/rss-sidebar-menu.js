const root = document.querySelector('[data-rss-reader]');

if (root) {
  const sidebar = root.querySelector('[data-selected-categories]');
  const menuPanel = root.querySelector('[data-menu-panel]');
  const menuToggle = root.querySelector('[data-menu-toggle]');
  const sourcesUrl = root.dataset.sourcesUrl ?? '';
  const sourcesLabel = root.dataset.sourcesLabel ?? 'Fuentes';
  const sidebarTitle = sidebar?.dataset.categorySidebarTitle ?? sidebar?.getAttribute('aria-label') ?? 'Categorías';

  if (sidebar && menuPanel) {
    const mobileMenu = document.createElement('nav');
    mobileMenu.className = 'reader-mobile-sidebar-menu';
    mobileMenu.dataset.mobileSidebarMenu = 'true';
    mobileMenu.setAttribute('aria-label', sidebarTitle);
    menuPanel.append(mobileMenu);

    syncSidebarMenus();

    new MutationObserver(syncSidebarMenus).observe(sidebar, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-pressed'],
    });

    menuPanel.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;

      if (target?.closest('[data-mobile-sidebar-close]')) {
        closeMenu();
      }
    });
  }

  function syncSidebarMenus() {
    ensureSourcesLink(sidebar, 'reader-sidebar-link');
    renderMobileSidebarMenu();
  }

  function ensureSourcesLink(container, className) {
    if (!container || !sourcesUrl) {
      return null;
    }

    const existing = container.querySelector('[data-sidebar-sources-link]');
    if (existing) {
      existing.href = sourcesUrl;
      existing.textContent = sourcesLabel;
      return existing;
    }

    const link = createSourcesLink(className);
    container.prepend(link);
    return link;
  }

  function renderMobileSidebarMenu() {
    const mobileMenu = menuPanel.querySelector('[data-mobile-sidebar-menu]');

    if (!mobileMenu || !sidebar) {
      return;
    }

    mobileMenu.innerHTML = '';
    mobileMenu.append(createMobileHeader());
    mobileMenu.append(createSourcesLink('reader-mobile-sidebar-menu__link'));

    const filters = [...sidebar.querySelectorAll('[data-category-filter], [data-source-filter]')];
    filters.forEach((filter) => {
      const clone = filter.cloneNode(true);
      clone.className = 'reader-mobile-sidebar-menu__filter';
      clone.addEventListener('click', () => {
        filter.click();
        closeMenu();
      });
      mobileMenu.append(clone);
    });
  }

  function createMobileHeader() {
    const header = document.createElement('div');
    header.className = 'reader-mobile-sidebar-menu__header';

    const title = document.createElement('p');
    title.className = 'reader-mobile-sidebar-menu__title';
    title.textContent = sidebarTitle;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'reader-mobile-sidebar-menu__close';
    close.dataset.mobileSidebarClose = 'true';
    close.setAttribute('aria-label', 'Cerrar menú');
    close.textContent = 'Cerrar';

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

  function closeMenu() {
    menuPanel.hidden = true;
    menuToggle?.setAttribute('aria-expanded', 'false');
  }
}
