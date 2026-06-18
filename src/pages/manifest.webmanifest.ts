import { defaultLocale, siteConfig } from '../config/site';
import { useTranslations } from '../i18n/ui';
import { withBasePath } from '../utils/paths';

export function GET() {
  const t = useTranslations(defaultLocale);

  const manifest = {
    id: withBasePath('/'),
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: t('site.description'),
    start_url: withBasePath('/'),
    scope: withBasePath('/'),
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    categories: ['news', 'productivity'],
    icons: [
      {
        src: withBasePath('icons/android-chrome-192x192.png'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: withBasePath('icons/android-chrome-512x512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
    },
  });
}
