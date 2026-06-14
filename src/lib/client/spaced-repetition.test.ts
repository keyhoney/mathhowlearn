import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveNextReview } from './spaced-repetition';

describe('resolveNextReview', () => {
  it('schedules wrong answers for the next day', () => {
    const now = Date.UTC(2026, 0, 1);
    const next = resolveNextReview('p1', 'wrong', undefined, now);
    assert.equal(next.intervalDays, 1);
    assert.equal(next.nextReviewAt, now + 24 * 60 * 60 * 1000);
  });

  it('schedules correct answers without hints at least a week later', () => {
    const now = Date.UTC(2026, 0, 1);
    const next = resolveNextReview('p1', 'correct-no-hint', undefined, now);
    assert.equal(next.intervalDays, 7);
  });

  it('keeps repeat wrong answers due today', () => {
    const now = Date.UTC(2026, 0, 1);
    const next = resolveNextReview('p1', 'repeat-wrong', undefined, now);
    assert.equal(next.intervalDays, 0);
    assert.equal(next.nextReviewAt, now);
  });
});
