const CACHE_VERSION = 'v2';
const CACHE_PREFIX = `rss-reader:json-cache:${CACHE_VERSION}:`;
const CACHE_INDEX_KEY = `${CACHE_PREFIX}index`;
const CACHE_MAX_ENTRIES = 80;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function readCachedJson(url, now = Date.now()) {
  const storage = getStorage();
  const key = getCacheKey(url);

  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(key);

    if (!rawValue) {
      return null;
    }

    const entry = JSON.parse(rawValue);

    if (!entry || typeof entry.createdAt !== 'number' || !Object.hasOwn(entry, 'data')) {
      storage.removeItem(key);
      return null;
    }

    if (now - entry.createdAt > CACHE_MAX_AGE_MS) {
      storage.removeItem(key);
      forgetCacheKey(storage, key);
      return null;
    }

    return entry.data;
  } catch {
    storage.removeItem(key);
    forgetCacheKey(storage, key);
    return null;
  }
}

export function writeCachedJson(url, data, now = Date.now()) {
  const storage = getStorage();
  const key = getCacheKey(url);

  if (!storage || data === undefined) {
    return;
  }

  const value = JSON.stringify({ createdAt: now, data });

  try {
    storage.setItem(key, value);
    rememberCacheKey(storage, key, now);
  } catch {
    pruneCache(storage, Math.floor(CACHE_MAX_ENTRIES / 2));

    try {
      storage.setItem(key, value);
      rememberCacheKey(storage, key, now);
    } catch {
      // localStorage can be disabled or full; the reader must still work without persistent cache.
    }
  }
}

export function getCachedJsonUrls() {
  const storage = getStorage();

  if (!storage) {
    return [];
  }

  const indexedKeys = readCacheIndex(storage).map((entry) => entry.key);
  const storedKeys = getStoredCacheKeys(storage);
  const cacheKeys = [...new Set([...indexedKeys, ...storedKeys])];

  return cacheKeys.map(getUrlFromCacheKey).filter(Boolean);
}

function getStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function getCacheKey(url) {
  return `${CACHE_PREFIX}${url}`;
}

function getUrlFromCacheKey(key) {
  if (!key.startsWith(CACHE_PREFIX) || key === CACHE_INDEX_KEY) {
    return null;
  }

  return key.slice(CACHE_PREFIX.length);
}

function readCacheIndex(storage) {
  try {
    const index = JSON.parse(storage.getItem(CACHE_INDEX_KEY) ?? '[]');

    return Array.isArray(index)
      ? index.filter((entry) => typeof entry?.key === 'string' && typeof entry?.updatedAt === 'number')
      : [];
  } catch {
    return [];
  }
}

function writeCacheIndex(storage, index) {
  storage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
}

function rememberCacheKey(storage, key, updatedAt) {
  const index = readCacheIndex(storage).filter((entry) => entry.key !== key);
  index.unshift({ key, updatedAt });
  writeCacheIndex(storage, index);
  pruneCache(storage, CACHE_MAX_ENTRIES);
}

function forgetCacheKey(storage, key) {
  writeCacheIndex(storage, readCacheIndex(storage).filter((entry) => entry.key !== key));
}

function pruneCache(storage, maxEntries) {
  const index = readCacheIndex(storage).sort((a, b) => b.updatedAt - a.updatedAt);
  const keep = index.slice(0, maxEntries);
  const remove = index.slice(maxEntries);

  remove.forEach((entry) => storage.removeItem(entry.key));
  writeCacheIndex(storage, keep);
}

function getStoredCacheKeys(storage) {
  if (typeof storage.length !== 'number' || typeof storage.key !== 'function') {
    return [];
  }

  const keys = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (typeof key === 'string' && getUrlFromCacheKey(key)) {
      keys.push(key);
    }
  }

  return keys;
}
