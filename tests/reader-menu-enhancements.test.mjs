import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

describe('reader menu enhancements', () => {
  it('wires the enhanced menu and processing indicators', () => {
    const reader = readText('src/components/RssReaderApp.astro');
    const script = readText('public/scripts/rss-menu-enhancements.js');
    const sidebarScript = readText('public/scripts/rss-sidebar-menu.js');
    const sidebarStyles = readText('src/styles/reader-sidebar-menu.css');

    assert.match(reader, /reader-menu-pages\.css/);
    assert.match(reader, /reader-sticky-header\.css/);
    assert.match(reader, /rss-menu-enhancements\.js/);
    assert.match(reader, /id="reader-sidebar-menu"/);
    assert.match(reader, /data-menu-search-input/);
    assert.match(reader, /data-main-view-target="my-sources"/);
    assert.match(reader, /data-main-view-target="my-categories"/);
    assert.doesNotMatch(reader, /data-menu-page="my-sources"/);
    assert.doesNotMatch(reader, /data-menu-page="my-categories"/);
    assert.match(reader, /data-processing-indicator/);
    assert.match(script, /clearActiveFilters/);
    assert.match(script, /pulseProcessing/);
    assert.match(script, /data-enhanced-source-filter/);
    assert.match(sidebarScript, /dataset\.sidebarCollapsed/);
    assert.match(sidebarStyles, /reader-shell\[data-sidebar-collapsed="true"\]/);
    assert.match(sidebarStyles, /\.reader-menu\s*{\s*display: inline-flex;/);
  });

  it('keeps enhanced reader menu translations available in every locale', () => {
    const es = readJson('src/i18n/translations/es.json');
    const en = readJson('src/i18n/translations/en.json');
    const keys = [
      'reader.menu.search',
      'reader.menu.myCategories',
      'reader.menu.mySources',
      'reader.menu.back',
      'reader.processing',
    ];

    keys.forEach((key) => {
      assert.equal(typeof es[key], 'string', `${key} should exist in es.json`);
      assert.equal(typeof en[key], 'string', `${key} should exist in en.json`);
    });
  });
});
