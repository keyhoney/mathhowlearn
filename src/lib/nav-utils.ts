export type NavItem =
  | { kind: 'internal'; href: string; label: string }
  | { kind: 'external'; href: string; label: string };

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  if (href === '/problems/wrong-note') return pathname.startsWith('/problems/wrong-note');
  if (href === '/problems/bookmarks') return pathname.startsWith('/problems/bookmarks');
  if (href === '/problems/concept-frequency') return pathname.startsWith('/problems/concept-frequency');
  if (href === '/problems/mock-exam') return pathname.startsWith('/problems/mock-exam');
  if (href === '/problems') {
    if (pathname === '/problems') return true;
    if (
      pathname.startsWith('/problems/wrong-note') ||
      pathname.startsWith('/problems/bookmarks') ||
      pathname.startsWith('/problems/concept-frequency') ||
      pathname.startsWith('/problems/mock-exam')
    ) {
      return false;
    }
    return pathname.startsWith('/problems/');
  }
  if (href === '/essay-problems') {
    if (pathname === '/essay-problems') return true;
    return pathname.startsWith('/essay-problems/');
  }
  if (href === '/search') return pathname === '/search' || pathname.startsWith('/search/');
  return pathname.startsWith(href);
}
