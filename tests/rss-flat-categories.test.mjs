import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scriptPath = new URL('../public/scripts/rss-flat-categories.js', import.meta.url);

test('el script normaliza el índice de noticias por categorías', async () => {
  const source = await readFile(scriptPath, 'utf8');

  assert.match(source, /window\.__normalizeRssCategoryCatalog = normalizeCategoryCatalog/);
  assert.match(source, /window\.__normalizeRssCategoryIndex = normalizeCategoryIndex/);
  assert.match(source, /function normalizeCategoryIndex\(categoryIndex\)/);
  assert.match(source, /categories\.map\(\(category\) => category\.title\)/);
  assert.match(source, /function getCategoryTitle\(category\)/);
});

test('el script conserva alias de categoría por id y por título', async () => {
  const source = await readFile(scriptPath, 'utf8');

  assert.match(source, /CATEGORY_TITLE_BY_KEY/);
  assert.match(source, /CATEGORY_ID_BY_KEY/);
  assert.match(source, /function getCategoryAliases\(category\)/);
  assert.match(source, /keys: getUniqueValues\(\[category, id, title\]/);
});
