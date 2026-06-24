import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { refreshAllCachedJson } from '../public/scripts/rss-api.js';
import { getCachedJsonUrls, readCachedJson, writeCachedJson } from '../public/scripts/rss-cache.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const originalFetch = globalThis.fetch;

class MemoryStorage {
  constructor() {
    this.items = new Map();
  }

  get length() {
    return this.items.size;
  }

  getItem(key) {
    return this.items.has(key) ? this.items.get(key) : null;
  }

  setItem(key, value) {
    this.items.set(key, String(value));
  }

  removeItem(key) {
    this.items.delete(key);
  }

  key(index) {
    return [...this.items.keys()][index] ?? null;
  }
}

afterEach(() => {
  delete globalThis.window;

  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    delete globalThis.fetch;
  }
});

describe('RSS JSON cache helper', () => {
  it('does not require browser storage', () => {
    assert.equal(readCachedJson('https://example.com/indexes/portada.json'), null);
  });

  it('stores and returns cached JSON data', () => {
    globalThis.window = { localStorage: new MemoryStorage() };
    const url = 'https://example.com/indexes/portada.json';
    const data = { noticias: [{ titulo: 'Noticia guardada', url: 'https://example.com/noticia' }] };

    writeCachedJson(url, data, 1000);

    assert.deepEqual(readCachedJson(url, 1000 + ONE_DAY_MS), data);
  });

  it('lists cached JSON URLs', () => {
    globalThis.window = { localStorage: new MemoryStorage() };
    const url = 'https://example.com/indexes/categorias.json';

    writeCachedJson(url, { categorias: {} }, 1000);

    assert.deepEqual(getCachedJsonUrls(), [url]);
  });

  it('ignores expired cached JSON data', () => {
    globalThis.window = { localStorage: new MemoryStorage() };
    const url = 'https://example.com/indexes/categorias.json';

    writeCachedJson(url, { categorias: {} }, 0);

    assert.equal(readCachedJson(url, 8 * ONE_DAY_MS), null);
  });

  it('refreshes all cached JSON entries for the active API', async () => {
    globalThis.window = { localStorage: new MemoryStorage() };
    const currentApiUrl = 'https://example.com/indexes/portada.json';
    const otherApiUrl = 'https://other.example.com/indexes/portada.json';
    const requests = [];

    writeCachedJson(currentApiUrl, { noticias: [{ titulo: 'Antigua' }] }, 1000);
    writeCachedJson(otherApiUrl, { noticias: [{ titulo: 'Otra API' }] }, 1000);

    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });

      return {
        ok: true,
        json: async () => ({ noticias: [{ titulo: 'Nueva', url }] }),
      };
    };

    const result = await refreshAllCachedJson('https://example.com/');

    assert.deepEqual(result, { total: 1, refreshed: 1, failed: 0 });
    assert.deepEqual(requests, [{ url: currentApiUrl, options: { cache: 'reload' } }]);
    assert.deepEqual(readCachedJson(currentApiUrl), { noticias: [{ titulo: 'Nueva', url: currentApiUrl }] });
    assert.deepEqual(readCachedJson(otherApiUrl), { noticias: [{ titulo: 'Otra API' }] });
  });
});
