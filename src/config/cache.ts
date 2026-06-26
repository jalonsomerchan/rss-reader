function createBuildCacheVersion() {
  return new Date().toISOString().replaceAll(/\D/g, '').slice(0, 12);
}

export const cacheVersion = import.meta.env.PUBLIC_CACHE_VERSION ?? createBuildCacheVersion();

export function withCacheVersion(url: string): string {
  const separator = url.includes('?') ? '&' : '?';

  return `${url}${separator}v=${encodeURIComponent(cacheVersion)}`;
}
