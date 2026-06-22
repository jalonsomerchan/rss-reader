const PULL_THRESHOLD_PX = 72;
const MAX_PULL_PX = 104;
const PULL_DAMPING = 0.55;
const MIN_PULL_START_PX = 12;
const RELOAD_DELAY_MS = 180;
const RESET_DELAY_MS = 220;
const SCROLLABLE_SELECTOR = '[data-menu-panel], .reader-topic-strip, .source-grid, .news-card__actions';

const root = document.querySelector('[data-rss-reader]');
const indicator = root?.querySelector('[data-pull-refresh]');
const supportsTouch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;

if (root && indicator && supportsTouch) {
  let startX = 0;
  let startY = 0;
  let isTracking = false;
  let isPulling = false;
  let isArmed = false;
  let isRefreshing = false;
  let resetTimer = 0;

  root.addEventListener('touchstart', handleTouchStart, { passive: true });
  root.addEventListener('touchmove', handleTouchMove, { passive: false });
  root.addEventListener('touchend', handleTouchEnd);
  root.addEventListener('touchcancel', resetPull);

  function handleTouchStart(event) {
    const target = event.target instanceof Element ? event.target : null;

    if (event.touches.length !== 1 || isInsideScrollableArea(target) || !canStartPull()) {
      isTracking = false;
      return;
    }

    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    isTracking = true;
    isPulling = false;
    isArmed = false;
    clearTimeout(resetTimer);
  }

  function handleTouchMove(event) {
    if (!isTracking || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const isMostlyVerticalPull = deltaY >= MIN_PULL_START_PX && Math.abs(deltaY) > Math.abs(deltaX) * 1.4;

    if (!isMostlyVerticalPull) {
      if (isPulling) {
        resetPull();
      }

      return;
    }

    if (!canStartPull()) {
      resetPull();
      return;
    }

    isPulling = true;
    event.preventDefault();

    const pullDistance = Math.min(MAX_PULL_PX, deltaY * PULL_DAMPING);
    isArmed = pullDistance >= PULL_THRESHOLD_PX;

    indicator.hidden = false;
    root.dataset.pullState = isArmed ? 'ready' : 'pulling';
    root.style.setProperty('--reader-pull-offset', `${pullDistance}px`);
  }

  function handleTouchEnd() {
    if (!isPulling) {
      isTracking = false;
      return;
    }

    if (isArmed) {
      refreshPage();
    } else {
      resetPull();
    }
  }

  function refreshPage() {
    isTracking = false;
    isPulling = false;
    isArmed = false;
    isRefreshing = true;
    indicator.hidden = false;
    root.dataset.pullState = 'refreshing';
    root.style.setProperty('--reader-pull-offset', '3.25rem');

    window.setTimeout(() => {
      window.location.reload();
    }, RELOAD_DELAY_MS);
  }

  function resetPull() {
    isTracking = false;
    isPulling = false;
    isArmed = false;

    if (isRefreshing) {
      return;
    }

    root.dataset.pullState = 'settling';
    root.style.setProperty('--reader-pull-offset', '0px');

    clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      if (root.dataset.pullState === 'settling') {
        delete root.dataset.pullState;
        indicator.hidden = true;
      }
    }, RESET_DELAY_MS);
  }

  function canStartPull() {
    return getScrollTop() <= 0 && !isRefreshing && !isMenuOpen();
  }

  function getScrollTop() {
    return window.scrollY || document.scrollingElement?.scrollTop || document.documentElement.scrollTop || 0;
  }

  function isMenuOpen() {
    return Boolean(root.querySelector('[data-menu-panel]:not([hidden])'));
  }

  function isInsideScrollableArea(target) {
    return Boolean(target?.closest(SCROLLABLE_SELECTOR));
  }
}
