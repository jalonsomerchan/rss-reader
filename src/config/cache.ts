export const cacheVersion = '2026-06-24-1';

export function withCacheVersion(url: string): string {
  const separator = url.includes('?') ? '&' : '?';

  return `${url}${separator}v=${encodeURIComponent(cacheVersion)}`;
}
