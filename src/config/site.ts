export const defaultLocale = 'es' as const;
export const locales = ['es', 'en'] as const;

export type Locale = (typeof locales)[number];

export const localeLabels: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
};

export const siteConfig = {
  name: 'RSS Reader',
  description: 'Lector RSS móvil con categorías personalizadas.',
  url: import.meta.env.PUBLIC_SITE_URL ?? 'https://rss.alon.one',
  base: import.meta.env.BASE_URL ?? '/',
  repositoryUrl: import.meta.env.PUBLIC_REPOSITORY_URL ?? 'https://github.com/jalonsomerchan/rss-reader',
  author: 'Jorge Alonso',
  defaultLocale,
  locales,
};

export type SiteConfig = typeof siteConfig;
