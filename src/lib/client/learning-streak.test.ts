import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeCurrentStreak,
  computeLongestStreak,
  type LearningActivityStore,
} from './learning-streak.ts';
import { toDateKey } from './dashboard-stats.ts';

function storeWithDays(dateKeys: string[]): LearningActivityStore {
  const byDate: LearningActivityStore['byDate'] = {};
  for (const key of dateKeys) {
    byDate[key] = { problemIds: ['p1'] };
  }
  return { v: 1, byDate };
}

test('computeCurrentStreak counts consecutive days through today', () => {
  const now = new Date('2026-06-10T12:00:00').getTime();
  const today = toDateKey(now);
  const yesterday = toDateKey(now - 86_400_000);
  const twoDaysAgo = toDateKey(now - 2 * 86_400_000);
  const streak = computeCurrentStreak(
    storeWithDays([twoDaysAgo, yesterday, today]),
    now,
  );
  assert.equal(streak, 3);
});

test('computeCurrentStreak continues from yesterday when today is empty', () => {
  const now = new Date('2026-06-10T12:00:00').getTime();
  const yesterday = toDateKey(now - 86_400_000);
  const streak = computeCurrentStreak(storeWithDays([yesterday]), now);
  assert.equal(streak, 1);
});

test('computeLongestStreak finds best run', () => {
  const activity = storeWithDays(['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-06']);
  assert.equal(computeLongestStreak(activity), 3);
});
