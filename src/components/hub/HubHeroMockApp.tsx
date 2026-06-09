import { useCallback, useEffect } from 'react';
import {
  computeHubHeroMock,
  DASHBOARD_REFRESH_EVENT,
  readForceLocalFromQuery,
  type HubHeroMockViewModel,
} from '../../lib/client/dashboard-stats';

type HubHeroMockAppProps = {
  problemIds: string[];
  essayProblemIds: string[];
};

function setText(selector: string, value: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.textContent = value;
  });
}

function applyDelta(selector: string, label: string | null): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    if (label) {
      el.textContent = label;
      el.removeAttribute('hidden');
    } else {
      el.textContent = '';
      el.setAttribute('hidden', '');
    }
  });
}

function applyHeroMock(vm: HubHeroMockViewModel): void {
  const badge = document.querySelector<HTMLElement>('[data-hub-hero-badge]');
  if (badge) {
    badge.textContent = vm.badge;
    badge.classList.toggle('hub-badge--primary', vm.mode === 'live');
    badge.classList.toggle('hub-badge--neutral', vm.mode === 'demo');
  }

  const liveDot = document.querySelector<HTMLElement>('[data-hub-hero-live-dot]');
  if (liveDot) {
    if (vm.mode === 'live') liveDot.removeAttribute('hidden');
    else liveDot.setAttribute('hidden', '');
  }

  setText('[data-hub-hero-today]', vm.todayLabel);
  setText('[data-hub-hero-week]', vm.weekLabel);
  setText('[data-hub-hero-done]', vm.doneLabel);
  setText('[data-hub-hero-review]', vm.reviewLabel);

  applyDelta('[data-hub-hero-today-delta]', vm.todayDelta);
  applyDelta('[data-hub-hero-week-delta]', vm.weekDelta);
  applyDelta('[data-hub-hero-done-delta]', vm.doneDelta);
  applyDelta('[data-hub-hero-review-delta]', vm.reviewDelta);

  document.querySelectorAll<HTMLElement>('[data-hub-hero-bar]').forEach((bar, index) => {
    const height = vm.barHeights[index] ?? 0;
    bar.style.height = height > 0 ? `${height}%` : '';
    bar.classList.toggle('bg-indigo-500/45', index === vm.barHeights.length - 1 && height > 0);
    bar.classList.toggle('bg-indigo-500/25', index !== vm.barHeights.length - 1 || height <= 0);
  });
}

export function HubHeroMockApp({ problemIds, essayProblemIds }: HubHeroMockAppProps) {
  const refresh = useCallback(() => {
    if (typeof localStorage === 'undefined') return;
    const vm = computeHubHeroMock({
      problemIds,
      essayProblemIds,
      forceLocal: readForceLocalFromQuery(),
    });
    applyHeroMock(vm);
  }, [problemIds, essayProblemIds]);

  useEffect(() => {
    refresh();

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith('howlearn')) refresh();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(DASHBOARD_REFRESH_EVENT, refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);

    let timer: ReturnType<typeof setInterval> | undefined;
    if (readForceLocalFromQuery()) {
      timer = window.setInterval(refresh, 2000);
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      if (timer) window.clearInterval(timer);
    };
  }, [refresh]);

  return null;
}
