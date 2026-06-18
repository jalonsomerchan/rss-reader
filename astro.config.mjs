// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'astro-template';
const site = process.env.ASTRO_SITE ?? `https://${process.env.GITHUB_REPOSITORY_OWNER ?? 'jalonsomerchan'}.github.io`;
const base = process.env.ASTRO_BASE ?? (process.env.GITHUB_ACTIONS ? `/${repositoryName}` : '/');

// https://astro.build/config
export default defineConfig({
  site,
  base,

  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [mdx(), sitemap(), icon()]

});
