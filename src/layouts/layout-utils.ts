export function getLayoutContext(url: URL) {
  const pathname = url.pathname;
  const editParams = new URLSearchParams(url.searchParams);
  editParams.set('tina', '1');
  const editQuery = editParams.toString();
  const tinaTargetPath = (() => {
    if (pathname.startsWith('/problems/')) return `/edit${pathname}`;
    if (pathname.startsWith('/essay-problems/')) return `/edit${pathname}`;
    return pathname;
  })();
  const tinaVisualHref = `/admin/index.html#/~${tinaTargetPath}${editQuery ? `?${editQuery}` : ''}`;

  return { pathname, tinaVisualHref };
}
