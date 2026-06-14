import { STORAGE_KEYS } from '../storage-keys';
import {
  isReviewDue,
  resolveNextReview,
  type ReviewOutcome,
  type ReviewScheduleEntry,
} from './spaced-repetition';

export type ReviewScheduleStore = {
  v: 1;
  byId: Record<string, ReviewScheduleEntry>;
};

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readReviewSchedule(): ReviewScheduleStore {
  return parse<ReviewScheduleStore>(localStorage.getItem(STORAGE_KEYS.REVIEW_SCHEDULE), {
    v: 1,
    byId: {},
  });
}

export function writeReviewSchedule(store: ReviewScheduleStore): void {
  localStorage.setItem(STORAGE_KEYS.REVIEW_SCHEDULE, JSON.stringify(store));
}

export function updateReviewSchedule(problemId: string, outcome: ReviewOutcome, now = Date.now()): ReviewScheduleEntry {
  const store = readReviewSchedule();
  const next = resolveNextReview(problemId, outcome, store.byId[problemId], now);
  store.byId[problemId] = next;
  writeReviewSchedule(store);
  return next;
}

export function getDueReviewIds(now = Date.now(), limit = 12): string[] {
  const store = readReviewSchedule();
  return Object.values(store.byId)
    .filter((entry) => isReviewDue(entry, now))
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
    .slice(0, limit)
    .map((entry) => entry.problemId);
}
