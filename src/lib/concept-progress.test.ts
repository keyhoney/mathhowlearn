import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildConceptIndex,
  resolveConceptStatus,
  summarizeConceptProgress,
} from './concept-progress.ts';

test('resolveConceptStatus marks conquered when all problems done', () => {
  assert.equal(resolveConceptStatus(3, 0, 3), 'conquered');
  assert.equal(resolveConceptStatus(2, 1, 3), 'in-progress');
  assert.equal(resolveConceptStatus(0, 0, 3), 'not-started');
});

test('summarizeConceptProgress aggregates by concept', () => {
  const index = buildConceptIndex([
    { id: '20261101', subject: '대수', chapter: '1장', subChapter: 'A', concept: '지수' },
    { id: '20261102', subject: '대수', chapter: '1장', subChapter: 'A', concept: '지수' },
    { id: '20261103', subject: '대수', chapter: '1장', subChapter: 'B', concept: '로그' },
  ]);

  const items = summarizeConceptProgress(index, {
    '20261101': 'done',
    '20261102': 'progress',
    '20261103': 'none',
  });

  assert.equal(items.length, 2);
  const exponent = items.find((item) => item.concept === '지수');
  const logarithm = items.find((item) => item.concept === '로그');
  assert.equal(exponent?.status, 'in-progress');
  assert.equal(exponent?.doneCount, 1);
  assert.equal(exponent?.nextProblemId, '20261102');
  assert.equal(logarithm?.status, 'not-started');
});
