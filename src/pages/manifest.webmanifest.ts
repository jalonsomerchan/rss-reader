import { defaultLocale, siteConfig } from '../config/site';
import { useTranslations } from '../i18n/ui';
import { getBasePath, withBasePath } from '../utils/paths';

export function GET() {
  const t = useTranslations(defaultLocale);

  const manifest = {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: t('site.description'),
    start_url: getBasePath(),
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      {
        src: withBasePath('favicon.svg'),
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
    },
  });
}
