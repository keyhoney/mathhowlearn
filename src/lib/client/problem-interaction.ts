import {
  appendWrongEntry,
  getProgressDetail,
  readProgressStore,
  readWrongStore,
  writeProgressStore,
} from './problem-state';
import { emitDashboardRefresh } from './dashboard-stats';

async function syncProgress(
  problemId: string,
  snapshot: {
    status: 'none' | 'progress' | 'done';
    hintRevealedCount: number;
    solutionRevealed: boolean;
    lastAnswer: string;
    lastSeenAt: number;
    attemptCount: number;
  },
  prevAttemptCount: number,
): Promise<void> {
  const { enqueueSyncPatch } = await import('./firebase-sync');
  enqueueSyncPatch(
    'progress',
    problemId,
    {
      status: snapshot.status,
      hintRevealedCount: snapshot.hintRevealedCount,
      solutionRevealed: snapshot.solutionRevealed,
      lastAnswer: snapshot.lastAnswer,
      lastSeenAt: snapshot.lastSeenAt,
      attemptCount: snapshot.attemptCount,
      attemptCountMax: snapshot.attemptCount,
    },
    {
      increments:
        snapshot.attemptCount > prevAttemptCount
          ? { attemptCount: snapshot.attemptCount - prevAttemptCount }
          : undefined,
    },
  );
}

function initProblemInteraction(root: Element): void {
  const problemId = root.getAttribute('data-problem-id') || '';
  const totalHints = Number(root.getAttribute('data-total-hints') || '0');
  const answerType = root.getAttribute('data-answer-type') || 'short';
  const answer = root.getAttribute('data-answer') || '';
  const progressKey = root.getAttribute('data-progress-key') || 'howlearn-problem-progress';
  const wrongKey = root.getAttribute('data-wrong-note-key') || 'howlearn-wrong-note';

  const resultEl = root.querySelector<HTMLElement>('[data-answer-result]');
  const wrongNoteLink = root.querySelector<HTMLElement>('[data-go-wrong-note]');
  const hintIsland = root.querySelector('[data-hint-reveal-island]');
  const revealHintBtn = root.querySelector<HTMLButtonElement>('[data-reveal-hint]');
  const revealSolutionBtn = root.querySelector<HTMLButtonElement>('[data-reveal-solution]');
  const solutionGateEl = root.querySelector<HTMLElement>('[data-solution-gate]');
  const solutionEl = root.querySelector<HTMLElement>('[data-solution]');
  const hintEls = hintIsland ? [] : Array.from(root.querySelectorAll<HTMLElement>('[data-hint-step]'));
  const hintTriggers = hintIsland
    ? []
    : Array.from(root.querySelectorAll<HTMLButtonElement>('[data-hint-trigger]'));
  const mcqRadios = Array.from(root.querySelectorAll<HTMLInputElement>('input[data-answer-choice]'));
  const statusRank: Record<'none' | 'progress' | 'done', number> = {
    none: 0,
    progress: 1,
    done: 2,
  };

  const persist = (
    patch: Partial<{
      status: 'none' | 'progress' | 'done';
      hintRevealedCount: number;
      solutionRevealed: boolean;
      lastAnswer: string;
      attemptCount: number;
      lastSeenAt: number;
    }>,
  ) => {
    const store = readProgressStore(progressKey);
    const prev = getProgressDetail(store, problemId);
    const nextStatus = patch.status
      ? (statusRank[patch.status] > statusRank[prev.status] ? patch.status : prev.status)
      : prev.status;
    store.byId[problemId] = {
      ...prev,
      ...patch,
      status: nextStatus,
      lastSeenAt: patch.lastSeenAt ?? Date.now(),
    };
    writeProgressStore(progressKey, store);
    const snapshot = getProgressDetail(store, problemId);
    void syncProgress(problemId, snapshot, prev.attemptCount);
    emitDashboardRefresh();
  };

  const current = getProgressDetail(readProgressStore(progressKey), problemId);
  if (current.status === 'none') {
    persist({ status: 'progress' });
  } else {
    persist({});
  }

  let revealedHintCount = Math.min(
    hintEls.length,
    Math.max(0, Number(current.hintRevealedCount || 0)),
  );

  const syncHintUi = () =>
    hintEls.forEach((el, idx) => {
      const content = el.querySelector<HTMLElement>('[data-hint-content]');
      const stateEl = el.querySelector<HTMLElement>('[data-hint-step-state]');
      const iconEl = el.querySelector<HTMLElement>('[data-hint-step-icon]');
      const eyeIconEl = el.querySelector<HTMLElement>('[data-icon-eye]');
      const checkIconEl = el.querySelector<HTMLElement>('[data-icon-check]');
      const trigger = el.querySelector<HTMLButtonElement>('[data-hint-trigger]');
      const visible = idx < revealedHintCount;
      const current = idx === revealedHintCount && revealedHintCount < hintEls.length;
      const locked = idx > revealedHintCount;
      if (content) content.classList.toggle('hidden', !visible);
      if (trigger) {
        trigger.disabled = locked;
        trigger.setAttribute('aria-expanded', visible ? 'true' : 'false');
      }
      el.classList.toggle('is-revealed', visible);
      el.classList.toggle('is-current', current);
      el.classList.toggle('is-locked', locked);
      if (stateEl) {
        stateEl.textContent = visible ? '공개됨' : current ? '클릭해서 열기' : '잠김';
      }
      if (iconEl) {
        iconEl.classList.toggle('hidden', locked);
      }
      if (eyeIconEl) {
        eyeIconEl.classList.toggle('hidden', !current);
      }
      if (checkIconEl) {
        checkIconEl.classList.toggle('hidden', !visible);
      }
    });

  const syncSolutionGate = () => {
    if (!revealSolutionBtn) return;
    const canReveal = totalHints === 0 || revealedHintCount >= totalHints;
    if (!canReveal) {
      revealSolutionBtn.disabled = true;
      const left = Math.max(0, totalHints - revealedHintCount);
      revealSolutionBtn.textContent = `풀이 공개 (${left}개 힌트 남음)`;
      if (solutionGateEl) {
        solutionGateEl.textContent = `모든 STEP 힌트를 공개하면 풀이를 열 수 있습니다. (남은 힌트 ${left}개)`;
      }
      return;
    }
    revealSolutionBtn.disabled = false;
    const opened = !solutionEl?.classList.contains('hidden');
    revealSolutionBtn.textContent = opened ? '풀이 닫기' : '풀이 공개';
    if (solutionGateEl) {
      solutionGateEl.textContent =
        totalHints === 0
          ? '이 문제는 힌트 없이 바로 풀이를 확인할 수 있습니다.'
          : '모든 STEP 힌트를 확인했습니다. 최종 풀이를 열 수 있습니다.';
    }
  };

  if (!hintIsland) syncHintUi();
  const showResult = (message: string, tone: 'warning' | 'success' | 'danger') => {
    if (!resultEl) return;
    resultEl.classList.remove('hidden');
    resultEl.textContent = message;
    resultEl.className = `learn-callout learn-callout--${tone} motion-fade-in not-prose`;
  };

  const revealNextHint = () => {
    if (revealedHintCount >= hintEls.length) return;
    const target = hintEls.find((el) => {
      const content = el.querySelector<HTMLElement>('[data-hint-content]');
      return Boolean(content?.classList.contains('hidden'));
    });
    if (!target) return;
    const content = target?.querySelector<HTMLElement>('[data-hint-content]');
    if (content) {
      content.classList.remove('hidden');
      content.classList.add('motion-hint-expand');
    }
    revealedHintCount += 1;
    persist({ status: 'progress', hintRevealedCount: revealedHintCount });
    if (revealHintBtn && revealedHintCount >= hintEls.length) {
      revealHintBtn.disabled = true;
      revealHintBtn.textContent = '힌트 모두 공개됨';
    }
    syncHintUi();
    syncSolutionGate();
  };

  const checkAnswer = (userValue: string) => {
    if (!userValue) {
      showResult('답을 입력(선택)해 주세요.', 'warning');
      return;
    }

    const isCorrect = String(Number(userValue)) === String(Number(answer));
    showResult(isCorrect ? '정답입니다.' : '오답입니다. 힌트를 확인해 보세요.', isCorrect ? 'success' : 'danger');
    wrongNoteLink?.classList.toggle('hidden', isCorrect);
    const latest = getProgressDetail(readProgressStore(progressKey), problemId);
    persist({
      status: isCorrect ? 'done' : 'progress',
      lastAnswer: userValue,
      attemptCount: latest.attemptCount + 1,
    });

    if (!isCorrect) {
      const wrongTs = Date.now();
      appendWrongEntry(
        wrongKey,
        problemId,
        answerType === 'mcq'
          ? { t: 'mcq', choice: Number(userValue) || 0, ts: wrongTs }
          : { t: 'short', value: userValue, ts: wrongTs },
      );
      const wrongStore = readWrongStore(wrongKey);
      const wrongCount = wrongStore.byId?.[problemId]?.entries?.length ?? 0;
      void import('./firebase-sync').then(({ enqueueSyncPatch }) => {
        enqueueSyncPatch(
          'wrongSummary',
          problemId,
          {
            wrongCount,
            lastWrongAt: wrongTs,
            isRepeatWrong: wrongCount >= 2,
          },
          { increments: { wrongCount: 1 } },
        );
      });
    }
  };

  mcqRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      root.querySelectorAll('.choice-item').forEach((item) => item.classList.remove('app-choice-active'));
      radio.closest('.choice-item')?.classList.add('app-choice-active');
      checkAnswer(radio.value);
    });
  });

  root.querySelector('[data-check-answer]')?.addEventListener('click', () => {
    if (answerType === 'mcq') return;
    const userValue = (root.querySelector<HTMLInputElement>('[data-answer-short]')?.value || '').trim();
    checkAnswer(userValue);
  });

  revealHintBtn?.addEventListener('click', revealNextHint);
  hintTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const idx = Number(trigger.getAttribute('data-step-index') || '-1');
      if (idx !== revealedHintCount) return;
      revealNextHint();
    });
  });
  revealSolutionBtn?.addEventListener('click', () => {
    if (!solutionEl) return;
    if (revealSolutionBtn.disabled) {
      syncSolutionGate();
      return;
    }
    const isHidden = solutionEl.classList.contains('hidden');
    if (isHidden) {
      solutionEl.classList.remove('hidden');
      solutionEl.classList.add('motion-block-reveal');
      persist({ status: 'done', solutionRevealed: true });
      syncSolutionGate();
      return;
    }

    solutionEl.classList.add('hidden');
    syncSolutionGate();
  });

  if (revealHintBtn && hintEls.length === 0) {
    revealHintBtn.disabled = true;
    revealHintBtn.textContent = '힌트 없음';
  } else if (revealHintBtn && revealedHintCount >= hintEls.length) {
    revealHintBtn.disabled = true;
    revealHintBtn.textContent = '힌트 모두 공개됨';
  }

  if (
    !hintIsland &&
    solutionEl &&
    current.solutionRevealed &&
    (totalHints === 0 || revealedHintCount >= totalHints)
  ) {
    solutionEl.classList.remove('hidden');
    solutionEl.classList.add('motion-block-reveal');
  }
  if (!hintIsland) {
    syncHintUi();
    syncSolutionGate();
  }

}

document.querySelectorAll('[data-problem-interaction]').forEach((root) => {
  initProblemInteraction(root);
});
