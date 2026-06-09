function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function fmt(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

type FocusState = {
  v: number;
  status: string;
  elapsedMs: number;
  startedAt: number | null;
  targetMs: number | null;
  problemId: string | null;
};

function applyFocusUi(active: boolean): void {
  document.body.classList.toggle('exam-focus-active', active);
  document.body.classList.toggle('focus-mode', active);
  document.body.style.overflow = '';
}

function emitDashboardRefresh(): void {
  void import('./dashboard-stats').then(({ emitDashboardRefresh: refresh }) => refresh());
}

document.querySelectorAll<HTMLElement>('[data-focus-toolbar]').forEach((root) => {
  const focusKey = root.getAttribute('data-focus-key') || 'howlearn-focus-state';
  const focusHistoryKey = root.getAttribute('data-focus-history-key') || 'howlearn-focus-history';
  const bookmarkKey = root.getAttribute('data-bookmark-key') || 'howlearn-bookmark';
  const problemId = root.getAttribute('data-problem-id') || '';
  const timerEl = root.querySelector<HTMLElement>('[data-focus-timer]');
  const bookmarkBtn = root.querySelector<HTMLButtonElement>('[data-bookmark-toggle]');
  const bookmarkLabel = root.querySelector<HTMLElement>('[data-bookmark-label]');
  const toggleBtn = root.querySelector<HTMLButtonElement>('[data-focus-toggle]');
  const toggleLabel = root.querySelector<HTMLElement>('[data-focus-toggle-label]');
  const pauseBtn = root.querySelector<HTMLButtonElement>('[data-focus-pause]');
  const resumeBtn = root.querySelector<HTMLButtonElement>('[data-focus-resume]');
  const stopBtn = root.querySelector<HTMLButtonElement>('[data-focus-stop]');
  let hasCommittedOnLeave = false;

  const getState = (): FocusState =>
    parse(localStorage.getItem(focusKey), {
      v: 1,
      status: 'idle',
      elapsedMs: 0,
      startedAt: null,
      targetMs: null,
      problemId: null,
    });

  const saveState = (patch: Partial<FocusState>) => {
    const merged = { ...getState(), ...patch, v: 1 };
    localStorage.setItem(focusKey, JSON.stringify(merged));
    emitDashboardRefresh();
  };

  const isActiveForThisProblem = (state = getState()) =>
    state.problemId === problemId && (state.status === 'running' || state.status === 'paused');

  const getElapsed = (state: FocusState) => {
    if (state.status === 'running' && state.startedAt) {
      return (state.elapsedMs || 0) + (Date.now() - state.startedAt);
    }
    return state.elapsedMs || 0;
  };

  const toDateKey = (ts: number) => {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const pushFocusHistory = (deltaMs: number) => {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    const safeDelta = Math.max(0, Math.floor(deltaMs));
    const raw = parse(localStorage.getItem(focusHistoryKey), { v: 1, byDate: {} as Record<string, number> });
    const byDate = raw.byDate || {};
    const key = toDateKey(Date.now());
    byDate[key] = (byDate[key] || 0) + safeDelta;
    localStorage.setItem(focusHistoryKey, JSON.stringify({ v: 1, byDate }));
    void import('./firebase-sync').then(({ enqueueSyncPatch }) => {
      enqueueSyncPatch('focusDaily', key, {
        dateKey: key,
        totalMs: byDate[key],
      });
    });
    emitDashboardRefresh();
  };

  const commitAndStopSession = () => {
    if (hasCommittedOnLeave) return;
    const state = getState();
    if (!isActiveForThisProblem(state)) return;
    const elapsed = getElapsed(state);
    if (elapsed > 0) pushFocusHistory(elapsed);
    saveState({ status: 'finished', elapsedMs: 0, startedAt: null, targetMs: null, problemId: null });
    hasCommittedOnLeave = true;
    applyFocusUi(false);
  };

  const startFocusSession = () => {
    hasCommittedOnLeave = false;
    saveState({
      status: 'running',
      elapsedMs: 0,
      startedAt: Date.now(),
      targetMs: null,
      problemId: problemId || null,
    });
    applyFocusUi(true);
  };

  const refreshBookmark = () => {
    const bookmarks = parse(localStorage.getItem(bookmarkKey), { v: 1, byId: {} as Record<string, unknown> });
    const active = Boolean(bookmarks.byId?.[problemId]);
    if (bookmarkBtn) {
      if (bookmarkLabel) bookmarkLabel.textContent = active ? '스크랩됨' : '스크랩';
      bookmarkBtn.classList.toggle('is-active', active);
      bookmarkBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  };

  const refreshToolbarState = () => {
    const state = getState();
    const active = isActiveForThisProblem(state);

    applyFocusUi(active);

    if (timerEl) timerEl.textContent = fmt(active ? getElapsed(state) : 0);

    if (pauseBtn) {
      const show = active && state.status === 'running';
      pauseBtn.toggleAttribute('hidden', !show);
      pauseBtn.toggleAttribute('disabled', !show);
    }
    if (resumeBtn) {
      const show = active && state.status === 'paused';
      resumeBtn.toggleAttribute('hidden', !show);
      resumeBtn.toggleAttribute('disabled', !show);
    }
    if (stopBtn) {
      stopBtn.toggleAttribute('disabled', !active);
    }
    if (toggleBtn) {
      toggleBtn.toggleAttribute('disabled', active);
    }
    if (toggleLabel) {
      toggleLabel.textContent = active ? '집중 모드 진행 중' : '집중 모드 켜기';
    }
  };

  toggleBtn?.addEventListener('click', () => {
    if (isActiveForThisProblem()) return;
    startFocusSession();
    refreshToolbarState();
  });

  pauseBtn?.addEventListener('click', () => {
    const state = getState();
    if (!isActiveForThisProblem(state) || state.status !== 'running') return;
    saveState({
      status: 'paused',
      elapsedMs: getElapsed(state),
      startedAt: null,
    });
    refreshToolbarState();
  });

  resumeBtn?.addEventListener('click', () => {
    const state = getState();
    if (!isActiveForThisProblem(state) || state.status !== 'paused') return;
    saveState({
      status: 'running',
      startedAt: Date.now(),
    });
    refreshToolbarState();
  });

  stopBtn?.addEventListener('click', () => {
    commitAndStopSession();
    refreshToolbarState();
  });

  bookmarkBtn?.addEventListener('click', () => {
    const bookmarks = parse(localStorage.getItem(bookmarkKey), { v: 1, byId: {} as Record<string, { ts: number }> });
    bookmarks.byId = bookmarks.byId || {};
    const clickedAt = Date.now();
    const bookmarked = !bookmarks.byId[problemId];
    if (bookmarked) {
      bookmarks.byId[problemId] = { ts: clickedAt };
    } else {
      delete bookmarks.byId[problemId];
    }
    localStorage.setItem(bookmarkKey, JSON.stringify({ v: 1, byId: bookmarks.byId }));
    void import('./firebase-sync').then(({ enqueueSyncPatch }) => {
      enqueueSyncPatch('bookmarks', problemId, {
        bookmarked,
        ts: clickedAt,
      });
    });
    refreshBookmark();
  });

  refreshBookmark();
  refreshToolbarState();

  window.addEventListener('pagehide', commitAndStopSession);
  window.addEventListener('beforeunload', commitAndStopSession);

  setInterval(() => {
    const state = getState();
    if (!isActiveForThisProblem(state)) return;
    if (timerEl) timerEl.textContent = fmt(getElapsed(state));
  }, 500);
});
