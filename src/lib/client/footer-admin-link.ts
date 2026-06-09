function parseAllowlist(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function revealAdminLinksIfAllowed(): Promise<void> {
  const footer = document.querySelector<HTMLElement>('#app-site-footer');
  if (!footer) return;

  const allowlist = parseAllowlist(footer.dataset.adminUidAllowlist || '');
  const adminOnlyEls = Array.from(document.querySelectorAll<HTMLElement>('[data-admin-only-link]'));
  if (allowlist.length === 0 || adminOnlyEls.length === 0) return;

  try {
    const { ensureAnonymousUid } = await import('./firebase-auth');
    const uid = await ensureAnonymousUid();
    const allowed = Boolean(uid) && allowlist.includes(uid);
    adminOnlyEls.forEach((el) => el.classList.toggle('hidden', !allowed));
  } catch {
    adminOnlyEls.forEach((el) => el.classList.add('hidden'));
  }
}

/** 푸터가 보일 때만 Firebase를 로드해 초기 네트워크 체인에서 분리한다. */
export function scheduleFooterAdminLinkCheck(): void {
  const footer = document.querySelector<HTMLElement>('#app-site-footer');
  if (!footer) return;

  const allowlist = parseAllowlist(footer.dataset.adminUidAllowlist || '');
  if (allowlist.length === 0) return;

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    void revealAdminLinksIfAllowed();
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(footer);
    return;
  }

  window.setTimeout(start, 8000);
}
