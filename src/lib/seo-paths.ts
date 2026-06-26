/** sitemap·robots noindex에서 제외할 경로 (정확 일치) */
const NOINDEX_EXACT = new Set([
  '/login',
  '/signup',
  '/dashboard',
  '/problems/wrong-note',
  '/problems/bookmarks',
]);

/** sitemap·robots noindex에서 제외할 경로 접두사 */
const NOINDEX_PREFIXES = ['/admin/', '/essay-problems'] as const;

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/** 크롤러 noindex 대상 페이지인지 */
export function shouldNoIndexPathname(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (NOINDEX_EXACT.has(path)) return true;
  return NOINDEX_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** sitemap.xml에 포함하지 않을 페이지인지 */
export function shouldExcludeFromSitemap(pageUrl: string): boolean {
  try {
    return shouldNoIndexPathname(new URL(pageUrl).pathname);
  } catch {
    return false;
  }
}
