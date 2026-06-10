import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConceptIndexEntry } from './concept-progress.ts';
import { computeShareCardStats } from './share-card-stats.ts';

const conceptIndex: Record<string, ConceptIndexEntry> = {
  'k1': {
    subject: '기하',
    chapter: '2. 도형의 방정식',
    subChapter: 'B. 그래프에서 도형의 성질',
    concept: '그래프에서 도형의 성질',
    problemIds: ['p-graph-1', 'p-graph-2'],
  },
  'k2': {
    subject: '확률과 통계',
    chapter: '3. 경우의 수',
    subChapter: 'C. 중복조합',
    concept: '중복 조합',
    problemIds: ['p-comb-1', 'p-comb-2', 'p-comb-3'],
  },
};

const now = new Date('2026-06-10T12:00:00').getTime();
const monthStart = new Date('2026-06-01T00:00:00').getTime();

test('computeShareCardStats highlights monthly done count and concept strengths', () => {
  const vm = computeShareCardStats({
    conceptIndex,
    progressById: {
      'p-graph-1': { status: 'done', lastSeenAt: monthStart + 86_400_000 },
      'p-graph-2': { status: 'done', lastSeenAt: monthStart + 2 * 86_400_000 },
      'p-comb-1': { status: 'done', lastSeenAt: monthStart + 3 * 86_400_000 },
    },
    wrongById: {
      'p-comb-1': { entries: [{ ts: monthStart + 4 * 86_400_000 }] },
      'p-comb-2': { entries: [{ ts: monthStart + 5 * 86_400_000 }, { ts: monthStart + 6 * 86_400_000 }] },
    },
    focusByDate: {
      '2026-06-01': 3_600_000,
      '2026-06-09': 7_200_000,
    },
    currentStreak: 5,
    siteTitle: 'GaeSaeGi Math',
    siteUrl: 'https://math.howlearn.kr',
    now,
  });

  assert.equal(vm.monthDoneCount, 3);
  assert.equal(vm.headline, '이번 달 3문제 완료');
  assert.equal(vm.strengthLabel, '그래프에서 도형의 성질');
  assert.equal(vm.weaknessLabel, '중복 조합');
  assert.equal(vm.currentStreak, 5);
  assert.equal(vm.hasEnoughData, true);
});

test('computeShareCardStats falls back to all-time concept stats', () => {
  const vm = computeShareCardStats({
    conceptIndex,
    progressById: {
      'p-graph-1': { status: 'done', lastSeenAt: new Date('2026-01-05T12:00:00').getTime() },
    },
    wrongById: {
      'p-comb-3': { entries: [{ ts: new Date('2026-02-01T12:00:00').getTime() }] },
    },
    siteTitle: 'GaeSaeGi Math',
    siteUrl: 'https://math.howlearn.kr',
    now,
  });

  assert.equal(vm.monthDoneCount, 0);
  assert.equal(vm.strengthLabel, '그래프에서 도형의 성질');
  assert.equal(vm.weaknessLabel, '중복 조합');
  assert.equal(vm.strengthIsFallback, false);
  assert.equal(vm.weaknessIsFallback, false);
});
