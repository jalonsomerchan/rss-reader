import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { readCachedJson, writeCachedJson } from '../public/scripts/rss-cache.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

class MemoryStorage {
  constructor() {
    this.items = new Map();
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
}

afterEach(() => {
  delete globalThis.window;
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

  it('ignores expired cached JSON data', () => {
    globalThis.window = { localStorage: new MemoryStorage() };
    const url = 'https://example.com/indexes/categorias.json';

    writeCachedJson(url, { categorias: {} }, 0);

    assert.equal(readCachedJson(url, 8 * ONE_DAY_MS), null);
  });
});
