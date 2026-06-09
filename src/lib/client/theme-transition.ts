import { THEME_STORAGE_KEY } from '../theme';

function applyTheme(nextDark: boolean) {
  localStorage.setItem(THEME_STORAGE_KEY, nextDark ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', nextDark);
}

/** serene-ink 스타일: 클릭 위치에서 원형으로 퍼지는 View Transition */
export function toggleThemeWithTransition(event?: Pick<MouseEvent, 'clientX' | 'clientY'>) {
  const nextDark = !document.documentElement.classList.contains('dark');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (
    prefersReduced ||
    typeof document.startViewTransition !== 'function' ||
    !event
  ) {
    applyTheme(nextDark);
    return;
  }

  const x = event.clientX;
  const y = event.clientY;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  document.documentElement.classList.add('theme-transition');

  const transition = document.startViewTransition(() => {
    applyTheme(nextDark);
  });

  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 500,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    .catch(() => {
      /* ready rejected — theme already toggled */
    });

  transition.finished.finally(() => {
    document.documentElement.classList.remove('theme-transition');
  });
}
