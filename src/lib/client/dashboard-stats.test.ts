import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSparklinePoints,
  computeDashboardStats,
  computeHubHeroMock,
  formatDuration,
  formatDurationCompact,
  getRecentDaysMs,
  HUB_HERO_MOCK_DEMO,
  msValuesToBarHeights,
  toDateKey,
} from './dashboard-stats';

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    assert.equal(formatDuration(0), '0m');
    assert.equal(formatDuration(59 * 60 * 1000), '59m');
    assert.equal(formatDuration(90 * 60 * 1000), '1h 30m');
  });
});

describe('formatDurationCompact', () => {
  it('formats compact durations', () => {
    assert.equal(formatDurationCompact(45 * 60 * 1000), '45m');
    assert.equal(formatDurationCompact(2 * 60 * 60 * 1000), '2h 00m');
  });
});

describe('getRecentDaysMs', () => {
  it('returns seven day buckets ending today', () => {
    const now = new Date('2026-05-20T12:00:00').getTime();
    const today = toDateKey(now);
    const byDate = { [today]: 60000 };
    const values = getRecentDaysMs(byDate, 7, now);
    assert.equal(values.length, 7);
    assert.equal(values[6], 60000);
  });
});

describe('buildSparklinePoints', () => {
  it('builds line and fill for chart', () => {
    const { line, fill } = buildSparklinePoints([0, 1000, 2000]);
    assert.ok(line.includes(','));
    assert.ok(fill.startsWith('0,64'));
  });
});

describe('msValuesToBarHeights', () => {
  it('scales non-zero values against the weekly max', () => {
    assert.deepEqual(msValuesToBarHeights([0, 30 * 60 * 1000, 60 * 60 * 1000]), [0, 50, 100]);
  });
});

describe('computeHubHeroMock', () => {
  it('returns demo values when there is no activity', () => {
    const storage = new Map<string, string>();
    const original = globalThis.localStorage;
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
      key: () => null,
      length: 0,
    };
    Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true });

    try {
      const vm = computeHubHeroMock({
        problemIds: ['p1'],
        essayProblemIds: [],
        forceLocal: true,
      });
      assert.equal(vm.mode, 'demo');
      assert.equal(vm.badge, 'Demo');
      assert.equal(vm.todayLabel, HUB_HERO_MOCK_DEMO.todayLabel);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
    }
  });

  it('returns live values when activity exists', () => {
    const storage = new Map<string, string>();
    const original = globalThis.localStorage;
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
      key: () => null,
      length: 0,
    };
    Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true });

    try {
      storage.set(
        'howlearn-focus-history',
        JSON.stringify({ v: 1, byDate: { [toDateKey(Date.now())]: 42 * 60 * 1000 } }),
      );

      const vm = computeHubHeroMock({
        problemIds: ['p1'],
        essayProblemIds: [],
        forceLocal: true,
      });

      assert.equal(vm.mode, 'live');
      assert.equal(vm.badge, 'Live');
      if (vm.mode === 'live') {
        assert.equal(vm.todayLabel, '42m');
        assert.equal(vm.doneLabel, '0');
      }
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
    }
  });
});

describe('computeDashboardStats', () => {
  it('aggregates local fixtures', () => {
    const storage = new Map<string, string>();
    const original = globalThis.localStorage;
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
      key: () => null,
      length: 0,
    };
    Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true });

    try {
      storage.set(
        'howlearn-problem-progress',
        JSON.stringify({ v: 1, byId: { p1: 'done', p2: 'progress' } }),
      );
      storage.set(
        'howlearn-wrong-note',
        JSON.stringify({
          v: 1,
          byId: { p1: { entries: [{ ts: Date.now() }, { ts: Date.now() }] } },
        }),
      );
      storage.set(
        'howlearn-focus-history',
        JSON.stringify({ v: 1, byDate: { [toDateKey(Date.now())]: 30 * 60 * 1000 } }),
      );

      const vm = computeDashboardStats({
        problemIds: ['p1', 'p2'],
        essayProblemIds: [],
        forceLocal: true,
        now: Date.now(),
      });

      assert.equal(vm.progress.problemDone, 1);
      assert.equal(vm.review.priorityCount, 1);
      assert.ok(vm.focus.todayMs > 0);
      assert.equal(vm.progress.problemList.href, '/problems');
      assert.equal(vm.progress.essayList.href, '/essay-problems');
      assert.ok(vm.progress.problemList.rateLabel.includes('1/2'));
      assert.ok(vm.syncHint.includes('로컬'));
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
    }
  });
});
