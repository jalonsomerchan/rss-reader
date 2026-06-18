import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

function parseConstString(source, name) {
  const match = source.match(new RegExp(`export\s+const\s+${name}\s*=\s*['"]([^'"]+)['"]`));
  assert.ok(match, `Could not find exported const ${name}`);

  return match[1];
}

function parseConstStringArray(source, name) {
  const match = source.match(new RegExp(`export\s+const\s+${name}\s*=\s*\[([^\]]+)\]`));
  assert.ok(match, `Could not find exported array const ${name}`);

  const values = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(([, value]) => value);
  assert.ok(values.length > 0, `${name} should contain at least one value`);

  return values;
}

function getConfiguredI18n() {
  const siteConfig = readText('src/config/site.ts');

  return {
    defaultLocale: parseConstString(siteConfig, 'defaultLocale'),
    locales: parseConstStringArray(siteConfig, 'locales'),
  };
}

describe('project smoke checks', () => {
  it('has the minimum files needed by Astro', () => {
    [
      'package.json',
      'astro.config.mjs',
      'src/pages/index.astro',
      'src/pages/[locale]/index.astro',
      'src/pages/404.astro',
      'src/pages/manifest.webmanifest.ts',
      'src/pages/robots.txt.ts',
      'src/layouts/BaseLayout.astro',
      'src/config/site.ts',
      'src/i18n/ui.ts',
      'src/i18n/translations',
      'src/utils/paths.ts',
      'src/styles/global.css',
      'public/sw.js',
      'public/scripts/register-sw.js',
    ].forEach((path) => {
      assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
    });
  });

  it('keeps template metadata files available', () => {
    ['.nvmrc', '.env.example', '.gitignore', '.prettierrc', '.prettierignore', 'README.md'].forEach(
      (path) => {
        assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
      }
    );
  });

  it('keeps the expected npm scripts available', () => {
    const pkg = readJson('package.json');

    assert.equal(pkg.scripts?.dev, 'astro dev');
    assert.equal(pkg.scripts?.build, 'astro build');
    assert.equal(pkg.scripts?.preview, 'astro preview');
    assert.ok(pkg.scripts?.test?.includes('node --test'));
    assert.ok(pkg.scripts?.clean?.includes('scripts/clean.mjs'));
  });

  it('keeps basic template components available', () => {
    ['Button', 'Container', 'Footer', 'Header'].forEach((component) => {
      assert.equal(
        existsSync(join(root, `src/components/${component}.astro`)),
        true,
        `${component}.astro should exist`
      );
    });
  });

  it('keeps Astro i18n enabled and aligned with site config', () => {
    const astroConfig = readText('astro.config.mjs');
    const readme = readText('README.md');
    const { defaultLocale, locales } = getConfiguredI18n();

    assert.match(astroConfig, /i18n/);
    assert.match(astroConfig, new RegExp(`defaultLocale:\s*['"]${defaultLocale}['"]`));

    locales.forEach((locale) => {
      assert.match(
        astroConfig,
        new RegExp(`['"]${locale}['"]`),
        `${locale} should be configured in Astro i18n locales`
      );
      assert.equal(
        existsSync(join(root, `src/i18n/translations/${locale}.json`)),
        true,
        `${locale}.json should exist`
      );
    });

    assert.match(readme, /Traducciones e idiomas/);
    assert.match(readme, /src\/i18n\/translations/);
  });

  it('keeps translation files aligned with configured locales', () => {
    const { defaultLocale, locales } = getConfiguredI18n();
    const defaultTranslations = readJson(`src/i18n/translations/${defaultLocale}.json`);
    const expectedKeys = Object.keys(defaultTranslations).sort();
    const translationFiles = readdirSync(join(root, 'src/i18n/translations'))
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace(/\.json$/, ''));

    assert.deepEqual(
      [...translationFiles].sort(),
      [...locales].sort(),
      'translation JSON files should match configured locales'
    );

    locales.forEach((locale) => {
      const translations = readJson(`src/i18n/translations/${locale}.json`);
      assert.deepEqual(
        Object.keys(translations).sort(),
        expectedKeys,
        `${locale}.json keys should match ${defaultLocale}.json`
      );
      assert.ok(translations['home.title'], `${locale}.json should include home.title`);
      assert.ok(translations['nav.main'], `${locale}.json should include nav.main`);
      assert.ok(translations['reader.ignoredSources.title'], `${locale}.json should include reader.ignoredSources.title`);
    });
  });

  it('keeps routing and assets compatible with root and subpath deployments', () => {
    const layout = readText('src/layouts/BaseLayout.astro');
    const manifest = readText('src/pages/manifest.webmanifest.ts');
    const robots = readText('src/pages/robots.txt.ts');
    const i18nHelper = readText('src/i18n/ui.ts');
    const pathHelpers = readText('src/utils/paths.ts');

    [layout, manifest, robots, i18nHelper].forEach((source) => {
      assert.match(source, /withBasePath|getLocalizedPath|stripBasePath/);
      assert.doesNotMatch(source, /href="\//);
      assert.doesNotMatch(source, /src="\//);
    });

    assert.match(pathHelpers, /withBasePath/);
    assert.match(pathHelpers, /stripBasePath/);
    assert.match(pathHelpers, /getAbsoluteUrl/);
    assert.match(pathHelpers, /lastPart\.endsWith\('\/'\)/);
    assert.match(manifest, /start_url/);
    assert.match(manifest, /scope/);
    assert.match(robots, /sitemap-index\.xml/);
  });

  it('keeps PWA install metadata wired to public icons', () => {
    const layout = readText('src/layouts/BaseLayout.astro');
    const manifest = readText('src/pages/manifest.webmanifest.ts');
    const serviceWorker = readText('public/sw.js');
    const registerServiceWorker = readText('public/scripts/register-sw.js');

    [
      'public/icons/android-chrome-192x192.png',
      'public/icons/android-chrome-512x512.png',
      'public/icons/apple-touch-icon.png',
      'public/icons/favicon-32x32.png',
      'public/icons/favicon-16x16.png',
    ].forEach((path) => {
      assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
    });

    assert.match(layout, /apple-touch-icon/);
    assert.match(layout, /theme-color/);
    assert.match(layout, /scripts\/register-sw\.js/);
    assert.match(manifest, /android-chrome-192x192\.png/);
    assert.match(manifest, /android-chrome-512x512\.png/);
    assert.match(manifest, /purpose:\s*'any maskable'/);
    assert.match(serviceWorker, /CACHE_NAME/);
    assert.match(serviceWorker, /self\.registration\.scope/);
    assert.match(serviceWorker, /manifest\.webmanifest/);
    assert.match(registerServiceWorker, /serviceWorker\.register/);
  });

  it('keeps GitHub Pages deployment explicit and static', () => {
    const astroConfig = readText('astro.config.mjs');
    const pagesWorkflow = readText('.github/workflows/pages.yml');
    const readme = readText('README.md');

    assert.match(astroConfig, /output:\s*['"]static['"]/);
    assert.equal(existsSync(join(root, 'public/.nojekyll')), true, 'public/.nojekyll should exist');
    assert.match(pagesWorkflow, /actions\/upload-pages-artifact@v3/);
    assert.match(pagesWorkflow, /path:\s*.\/dist/);
    assert.match(pagesWorkflow, /ASTRO_SITE:\s*https:\/\/rss\.alon\.one/);
    assert.match(pagesWorkflow, /PUBLIC_SITE_URL:\s*https:\/\/rss\.alon\.one/);
    assert.match(pagesWorkflow, /ASTRO_BASE:\s*\//);
    assert.equal(existsSync(join(root, 'public/CNAME')), true, 'public/CNAME should exist');
    assert.match(readme, /https:\/\/jalonsomerchan\.github\.io\/rss-reader\//);
  });

  it('keeps the RSS reader protected against runaway infinite scroll', () => {
    const reader = readText('public/scripts/rss-reader.js');
    const api = readText('public/scripts/rss-api.js');

    assert.match(reader, /AUTO_LOAD_COOLDOWN_MS/);
    assert.match(reader, /loadingMore/);
    assert.match(reader, /pendingLoad/);
    assert.match(reader, /isAutoLoadReady/);
    assert.match(reader, /scheduleAutoObserverResume/);
    assert.match(reader, /pauseAutoObserver/);
    assert.match(reader, /DocumentFragment/);
    assert.match(reader, /renderedCount/);
    assert.match(reader, /savedStorageKey/);
    assert.match(reader, /renderSavedFeed/);
    assert.match(reader, /ignoredSourcesStorageKey/);
    assert.match(reader, /renderIgnoredSourcePicker/);
    assert.match(reader, /matchesVisibleItem/);
    assert.match(api, /JSON_CACHE/);
  });

  it('keeps starter links and labels configurable or translated', () => {
    const siteConfig = readText('src/config/site.ts');
    const header = readText('src/components/Header.astro');
    const home = readText('src/pages/index.astro');
    const localizedHome = readText('src/pages/[locale]/index.astro');
    const envExample = readText('.env.example');

    assert.match(siteConfig, /repositoryUrl/);
    assert.match(envExample, /PUBLIC_REPOSITORY_URL/);
    assert.match(header, /t\('nav\.main'\)/);
    assert.match(home, /siteConfig\.repositoryUrl/);
    assert.match(localizedHome, /siteConfig\.repositoryUrl/);
    assert.doesNotMatch(home, /https:\/\/github\.com\/jalonsomerchan\/astro-template/);
    assert.doesNotMatch(localizedHome, /https:\/\/github\.com\/jalonsomerchan\/astro-template/);
  });

  it('includes GitHub workflows for CI and Pages', () => {
    const pagesWorkflow = readText('.github/workflows/pages.yml');
    const ciWorkflow = readText('.github/workflows/ci.yml');

    assert.match(pagesWorkflow, /actions\/deploy-pages@v4/);
    assert.match(pagesWorkflow, /npm run build/);
    assert.match(pagesWorkflow, /npm test/);
    assert.match(ciWorkflow, /pull_request/);
    assert.match(ciWorkflow, /npm run build/);
    assert.match(ciWorkflow, /npm test/);
  });

  it('keeps useful project documentation available', () => {
    const readme = readText('README.md');

    assert.match(readme, /\S/, 'README.md should not be empty');
    assert.equal(existsSync(join(root, 'agents.md')), true, 'agents.md should exist');
    assert.equal(existsSync(join(root, 'docs/design-system.md')), true, 'docs/design-system.md should exist');
  });
});
