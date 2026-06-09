import { useCallback, useEffect } from 'react';
import {
  computeDashboardStats,
  DASHBOARD_REFRESH_EVENT,
  readForceLocalFromQuery,
  writeFocusGoalMs,
  type DashboardViewModel,
} from '../../lib/client/dashboard-stats';

type DashboardAppProps = {
  problemIds: string[];
  essayProblemIds: string[];
  focusHelpHref?: string;
};

function setText(selector: string, value: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.textContent = value;
  });
}

function setHidden(selector: string, hidden: boolean): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    if (hidden) el.setAttribute('hidden', '');
    else el.removeAttribute('hidden');
  });
}

function setBarWidth(selector: string, percent: number): void {
  const clamped = Math.max(0, Math.min(100, percent));
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.style.width = `${clamped}%`;
  });
}

function applyViewModel(vm: DashboardViewModel): void {
  setText('[data-dashboard-insight]', vm.insightLine);

  const weeklyEl = document.querySelector<HTMLElement>('[data-dashboard-weekly]');
  if (weeklyEl) {
    if (vm.weeklyLine) {
      weeklyEl.textContent = vm.weeklyLine;
      weeklyEl.removeAttribute('hidden');
    } else {
      weeklyEl.textContent = '';
      weeklyEl.setAttribute('hidden', '');
    }
  }

  const syncHint = document.querySelector<HTMLElement>('[data-dashboard-sync-hint]');
  if (syncHint) {
    syncHint.textContent = vm.syncHint;
    syncHint.removeAttribute('hidden');
  }

  setHidden('[data-focus-running-badge]', !vm.focus.running);
  setText('[data-focus-subtitle]', vm.focus.subtitle);
  setText('[data-focus-today]', vm.focus.todayLabel);
  setText('[data-focus-week]', vm.focus.weekLabel);
  setText('[data-focus-total]', vm.focus.totalLabel);

  const applyDelta = (selector: string, label: string | null) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      if (label) {
        el.textContent = label;
        el.removeAttribute('hidden');
      } else {
        el.textContent = '';
        el.setAttribute('hidden', '');
      }
    });
  };
  applyDelta('[data-focus-today-delta]', vm.focus.todayDeltaLabel);
  applyDelta('[data-focus-week-delta]', vm.focus.weekDeltaLabel);
  setText('[data-focus-goal-meta]', `오늘 목표 대비 ${Math.round(vm.focus.goalPercent)}%`);
  setHidden('[data-focus-empty]', !vm.focus.empty);
  setHidden('[data-focus-empty-help]', !vm.focus.empty);

  const focusGoalInput = document.querySelector<HTMLInputElement>('[data-focus-goal-minutes]');
  if (focusGoalInput) focusGoalInput.value = String(vm.focusGoalMinutes);

  const focusCta = document.querySelector<HTMLAnchorElement>('[data-focus-cta]');
  if (focusCta) {
    focusCta.href = vm.focus.ctaHref;
    focusCta.textContent = vm.focus.ctaLabel;
  }

  const sparkWrap = document.querySelector<HTMLElement>('[data-focus-sparkline-wrap]');
  const sparkFill = document.querySelector('[data-focus-sparkline-fill]');
  const sparkLine = document.querySelector('[data-focus-sparkline-line]');
  const sparkSvg = document.querySelector('[data-focus-sparkline-svg]');
  if (sparkFill) sparkFill.setAttribute('points', vm.focus.sparkline.fill);
  if (sparkLine) sparkLine.setAttribute('points', vm.focus.sparkline.line);
  if (sparkSvg) sparkSvg.setAttribute('aria-label', vm.focus.sparklineAria);
  if (sparkWrap) {
    sparkWrap.classList.toggle('is-expanded', sparkWrap.getAttribute('data-sparkline-expanded') === 'true');
  }

  setText('[data-review-priority-count]', String(vm.review.priorityCount));
  setText('[data-review-normal-count]', String(vm.review.normalCount));
  setBarWidth('[data-review-priority-bar]', vm.review.priorityPercent);
  setHidden('[data-review-empty]', !vm.review.empty);

  const reviewCta = document.querySelector<HTMLAnchorElement>('[data-review-cta]');
  if (reviewCta) {
    reviewCta.href = vm.review.ctaHref;
    reviewCta.textContent = vm.review.ctaLabel;
  }

  setText('[data-progress-subtitle]', vm.progress.subtitle);
  setHidden('[data-progress-empty]', !vm.progress.empty);

  const applyProgressListCard = (
    kind: 'problem' | 'essay',
    card: (typeof vm)['progress']['problemList'],
  ) => {
    const root = document.querySelector<HTMLAnchorElement>(`[data-progress-list="${kind}"]`);
    if (!root) return;
    root.href = card.href;
    const meta = root.querySelector('[data-progress-list-meta]');
    if (meta) meta.textContent = card.rateLabel;
    const bar = root.querySelector<HTMLElement>('[data-progress-list-bar]');
    if (bar) {
      const clamped = Math.max(0, Math.min(100, card.rate));
      bar.style.width = `${Math.round(clamped)}%`;
    }
  };
  applyProgressListCard('problem', vm.progress.problemList);
  applyProgressListCard('essay', vm.progress.essayList);
}

function bindFocusGoalDialog(refresh: () => void): void {
  const openBtn = document.querySelector<HTMLButtonElement>('[data-focus-goal-open]');
  const dialog = document.querySelector<HTMLDialogElement>('[data-focus-goal-dialog]');
  const form = document.querySelector<HTMLFormElement>('[data-focus-goal-form]');
  const input = document.querySelector<HTMLInputElement>('[data-focus-goal-minutes]');

  openBtn?.addEventListener('click', () => dialog?.showModal());
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const minutes = Number.parseInt(input?.value || '120', 10);
    if (Number.isFinite(minutes) && minutes >= 15 && minutes <= 480) {
      writeFocusGoalMs(minutes * 60 * 1000);
      refresh();
    }
    dialog?.close();
  });
}

export function DashboardApp({
  problemIds,
  essayProblemIds,
  focusHelpHref,
}: DashboardAppProps) {
  const refresh = useCallback(() => {
    if (typeof localStorage === 'undefined') return;
    const vm = computeDashboardStats({
      problemIds,
      essayProblemIds,
      forceLocal: readForceLocalFromQuery(),
    });
    applyViewModel(vm);
  }, [problemIds, essayProblemIds]);

  useEffect(() => {
    const helpLink = document.querySelector<HTMLAnchorElement>('[data-focus-help-link]');
    if (helpLink && focusHelpHref) helpLink.href = focusHelpHref;

    refresh();
    bindFocusGoalDialog(refresh);

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
  }, [refresh, focusHelpHref]);

  return null;
}
