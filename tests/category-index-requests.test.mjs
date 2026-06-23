import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('category index feed requests', () => {
  it('uses the category news index unless a source filter is active', () => {
    const flatCategories = readText('public/scripts/rss-flat-categories.js');

    assert.match(flatCategories, /CATEGORY_NEWS_INDEX_PATH = '\/indexes\/categorias\.json'/);
    assert.match(flatCategories, /FRONT_PAGE_INDEX_PATH = '\/indexes\/portada\.json'/);
    assert.match(flatCategories, /SOURCE_ARCHIVE_PATH_PATTERN/);
    assert.match(flatCategories, /isSourceArchiveRequest\(input\) && !hasActiveSourceFilter\(\)/);
    assert.match(flatCategories, /createStandaloneJsonResponse\(\[\]\)/);
  });
});
