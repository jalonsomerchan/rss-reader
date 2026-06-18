import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('reader main menu pages', () => {
  it('loads my categories and my sources in the main reader area', () => {
    const component = readText('src/components/RssReaderApp.astro');
    const script = readText('public/scripts/rss-main-menu-pages.js');

    assert.equal(existsSync(join(root, 'src/styles/reader-main-menu-pages.css')), true);
    assert.equal(existsSync(join(root, 'public/scripts/rss-main-menu-pages.js')), true);

    assert.match(component, /reader-main-menu-pages\.css/);
    assert.match(component, /rss-main-menu-pages\.js/);
    assert.match(component, /data-main-view-target="my-categories"/);
    assert.match(component, /data-main-view-target="my-sources"/);
    assert.match(component, /data-main-view="my-categories"/);
    assert.match(component, /data-main-view="my-sources"/);
    assert.match(component, /data-main-page-categories/);
    assert.match(component, /data-main-page-sources/);
    assert.doesNotMatch(component, /data-menu-page="my-categories"/);
    assert.doesNotMatch(component, /data-menu-page="my-sources"/);

    assert.match(script, /showMainPage/);
    assert.match(script, /hideMainPages/);
    assert.match(script, /data-menu-category-filter/);
    assert.match(script, /data-menu-source-filter/);
  });
});
