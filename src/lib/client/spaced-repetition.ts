export type ReviewOutcome = 'correct-no-hint' | 'correct-with-hint' | 'wrong' | 'repeat-wrong';

export type ReviewScheduleEntry = {
  problemId: string;
  nextReviewAt: number;
  intervalDays: number;
  ease: number;
  lastReviewedAt: number;
  lastOutcome: ReviewOutcome;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function resolveNextReview(
  problemId: string,
  outcome: ReviewOutcome,
  previous?: ReviewScheduleEntry,
  now = Date.now(),
): ReviewScheduleEntry {
  const prevEase = previous?.ease ?? 2.3;
  const prevInterval = previous?.intervalDays ?? 0;
  const intervalDays =
    outcome === 'wrong'
      ? 1
      : outcome === 'repeat-wrong'
        ? 0
        : outcome === 'correct-with-hint'
          ? Math.max(3, Math.round(prevInterval * 1.4))
          : Math.max(7, Math.round(prevInterval * prevEase));
  const ease =
    outcome === 'wrong' || outcome === 'repeat-wrong'
      ? Math.max(1.3, prevEase - 0.2)
      : outcome === 'correct-with-hint'
        ? Math.max(1.5, prevEase - 0.05)
        : Math.min(2.8, prevEase + 0.05);

  return {
    problemId,
    nextReviewAt: now + intervalDays * DAY_MS,
    intervalDays,
    ease,
    lastReviewedAt: now,
    lastOutcome: outcome,
  };
}

export function isReviewDue(entry: ReviewScheduleEntry, now = Date.now()): boolean {
  return entry.nextReviewAt <= now;
}
