import { deferNonCritical } from './defer-non-critical';

const AUTH_UI_CACHE_KEY = 'howlearn-auth-ui-logged-in';

function readCachedLoggedIn(): boolean | null {
  try {
    const raw = localStorage.getItem(AUTH_UI_CACHE_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    // no-op
  }
  return null;
}

function writeCachedLoggedIn(value: boolean): void {
  try {
    localStorage.setItem(AUTH_UI_CACHE_KEY, value ? '1' : '0');
  } catch {
    // no-op
  }
}

function initSidebarAuthUi(root: HTMLElement): void {
  const loginLink = root.querySelector<HTMLElement>('[data-auth-login-link]');
  const signupLink = root.querySelector<HTMLElement>('[data-auth-signup-link]');
  const logoutBtn = root.querySelector<HTMLButtonElement>('[data-auth-logout-btn]');

  const apply = (loggedIn: boolean) => {
    loginLink?.classList.toggle('hidden', loggedIn);
    signupLink?.classList.toggle('hidden', loggedIn);
    logoutBtn?.classList.toggle('hidden', !loggedIn);
  };

  const cached = readCachedLoggedIn();
  if (cached != null) {
    apply(cached);
  }

  logoutBtn?.addEventListener('click', async () => {
    try {
      const { signOutCurrentUser } = await import('./firebase-auth');
      await signOutCurrentUser();
    } finally {
      window.location.href = '/login';
    }
  });

  deferNonCritical(() => {
    void import('./firebase-auth').then(({ watchAuthState }) => {
      watchAuthState((user) => {
        const loggedIn = Boolean(user) && !user?.isAnonymous;
        apply(loggedIn);
        writeCachedLoggedIn(loggedIn);
      });
    });
  });
}

document.querySelectorAll<HTMLElement>('[data-sidebar-auth]').forEach((root) => {
  initSidebarAuthUi(root);
});
