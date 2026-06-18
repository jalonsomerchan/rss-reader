import { siteConfig } from '../config/site';
import { getAbsoluteUrl, withBasePath } from '../utils/paths';

export function GET() {
  const sitemapUrl = getAbsoluteUrl(withBasePath('sitemap-index.xml'), siteConfig.url);

  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
