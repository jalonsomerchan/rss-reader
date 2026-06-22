const root = document.querySelector('[data-rss-reader]');

if (root) {
  const sidebar = root.querySelector('[data-selected-categories]');
  const menuPanel = root.querySelector('[data-menu-panel]');
  const sourcesUrl = root.dataset.sourcesUrl ?? '';
  const sourcesLabel = root.dataset.sourcesLabel ?? 'Fuentes';

  if (sidebar && menuPanel) {
    const mobileMenu = document.createElement('nav');
    mobileMenu.className = 'reader-mobile-sidebar-menu';
    mobileMenu.dataset.mobileSidebarMenu = 'true';
    mobileMenu.setAttribute('aria-label', sidebar.getAttribute('aria-label') ?? sourcesLabel);
    menuPanel.append(mobileMenu);

    syncSidebarMenus();

    new MutationObserver(syncSidebarMenus).observe(sidebar, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-pressed'],
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
    root.querySelector('[data-menu-toggle]')?.setAttribute('aria-expanded', 'false');
  }
}
