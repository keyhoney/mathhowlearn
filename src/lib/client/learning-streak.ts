import { STORAGE_KEYS } from '../storage-keys';
import { emitDashboardRefresh, formatDurationCompact, parseJson, toDateKey } from './dashboard-stats';

const FOCUS_DAILY_CACHE = 'howlearn-focus-daily-cache';

export type LearningActivityStore = {
  v: 1;
  byDate: Record<string, { problemIds: string[] }>;
};

export type HeatmapCell = {
  dateKey: string;
  date: Date;
  focusMs: number;
  problemCount: number;
  level: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
};

export type LearningStreakViewModel = {
  currentStreak: number;
  longestStreak: number;
  todayProblemCount: number;
  todayFocusLabel: string;
  yearFocusTotalLabel: string;
  activeDaysThisYear: number;
  cells: HeatmapCell[][];
  monthLabels: Array<{ label: string; weekIndex: number }>;
};

function emptyStore(): LearningActivityStore {
  return { v: 1, byDate: {} };
}

export function readLearningActivity(): LearningActivityStore {
  if (typeof localStorage === 'undefined') return emptyStore();
  return parseJson(localStorage.getItem(STORAGE_KEYS.LEARNING_ACTIVITY), emptyStore());
}

export function writeLearningActivity(store: LearningActivityStore): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.LEARNING_ACTIVITY, JSON.stringify(store));
}

/** 오늘 해당 문제를 풀었음을 기록 (하루 1문제 이상이면 스트릭 유지) */
export function recordProblemActivity(problemId: string, ts = Date.now()): void {
  if (!problemId || typeof localStorage === 'undefined') return;
  const store = readLearningActivity();
  const key = toDateKey(ts);
  const bucket = store.byDate[key] ?? { problemIds: [] };
  if (!bucket.problemIds.includes(problemId)) {
    bucket.problemIds.push(problemId);
    store.byDate[key] = bucket;
    writeLearningActivity(store);
    emitDashboardRefresh();
  }
}

export function readFocusByDate(forceLocal = false): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  const focusHistory = parseJson(localStorage.getItem(STORAGE_KEYS.FOCUS_HISTORY), {
    v: 1,
    byDate: {} as Record<string, number>,
  });
  const focusDaily = parseJson(localStorage.getItem(FOCUS_DAILY_CACHE), {
    v: 1,
    byDate: {} as Record<string, number>,
  });
  const hasCloud = Object.keys(focusDaily.byDate ?? {}).length > 0;
  return !forceLocal && hasCloud ? (focusDaily.byDate ?? {}) : (focusHistory.byDate ?? {});
}

function isActiveDay(
  dateKey: string,
  activity: LearningActivityStore,
): boolean {
  return (activity.byDate[dateKey]?.problemIds.length ?? 0) > 0;
}

function activeDateKeys(activity: LearningActivityStore): string[] {
  return Object.entries(activity.byDate)
    .filter(([, bucket]) => (bucket.problemIds?.length ?? 0) > 0)
    .map(([key]) => key)
    .sort();
}

export function computeCurrentStreak(
  activity: LearningActivityStore,
  now = Date.now(),
): number {
  const keys = new Set(activeDateKeys(activity));
  if (keys.size === 0) return 0;

  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(cursor.getTime());

  if (!keys.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (keys.has(toDateKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeLongestStreak(activity: LearningActivityStore): number {
  const keys = activeDateKeys(activity);
  if (keys.length === 0) return 0;

  let longest = 1;
  let current = 1;
  for (let i = 1; i < keys.length; i += 1) {
    const prev = new Date(`${keys[i - 1]}T00:00:00`);
    const next = new Date(`${keys[i]}T00:00:00`);
    const diffDays = Math.round((next.getTime() - prev.getTime()) / 86_400_000);
    if (diffDays === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

function focusLevel(ms: number): 0 | 1 | 2 | 3 | 4 {
  if (ms <= 0) return 0;
  const minutes = ms / 60_000;
  if (minutes < 15) return 1;
  if (minutes < 45) return 2;
  if (minutes < 90) return 3;
  return 4;
}

function startOfWeekSunday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function buildAnnualHeatmap(
  focusByDate: Record<string, number>,
  activity: LearningActivityStore,
  now = Date.now(),
): { cells: HeatmapCell[][]; monthLabels: Array<{ label: string; weekIndex: number }> } {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 364);

  const gridStart = startOfWeekSunday(start);
  const gridEnd = startOfWeekSunday(end);
  gridEnd.setDate(gridEnd.getDate() + 6);

  const weeks: HeatmapCell[][] = [];
  const monthLabels: Array<{ label: string; weekIndex: number }> = [];
  let lastMonth = -1;

  const cursor = new Date(gridStart);
  let weekIndex = 0;
  while (cursor <= gridEnd) {
    const week: HeatmapCell[] = [];
    for (let dow = 0; dow < 7; dow += 1) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + dow);
      const dateKey = toDateKey(date.getTime());
      const isFuture = date.getTime() > end.getTime();
      const inRange = date >= start && date <= end;
      const focusMs = inRange && !isFuture ? Number(focusByDate[dateKey] || 0) : 0;
      const problemCount = inRange && !isFuture
        ? (activity.byDate[dateKey]?.problemIds.length ?? 0)
        : 0;

      if (inRange && !isFuture && date.getMonth() !== lastMonth && dow === 0) {
        monthLabels.push({
          label: `${date.getMonth() + 1}월`,
          weekIndex,
        });
        lastMonth = date.getMonth();
      }

      week.push({
        dateKey,
        date,
        focusMs,
        problemCount,
        level: inRange && !isFuture ? focusLevel(focusMs) : 0,
        isFuture,
      });
    }
    weeks.push(week);
    cursor.setDate(cursor.getDate() + 7);
    weekIndex += 1;
  }

  return { cells: weeks, monthLabels };
}

export function computeLearningStreakViewModel(
  options: { forceLocal?: boolean; now?: number } = {},
): LearningStreakViewModel {
  const now = options.now ?? Date.now();
  const activity = readLearningActivity();
  const focusByDate = readFocusByDate(options.forceLocal);
  const todayKey = toDateKey(now);
  const { cells, monthLabels } = buildAnnualHeatmap(focusByDate, activity, now);

  const yearStartKey = toDateKey(new Date(now).setDate(new Date(now).getDate() - 364));
  let yearFocusTotal = 0;
  let activeDaysThisYear = 0;
  for (const [key, ms] of Object.entries(focusByDate)) {
    if (key >= yearStartKey && key <= todayKey) {
      yearFocusTotal += Number(ms) || 0;
    }
  }
  for (const key of activeDateKeys(activity)) {
    if (key >= yearStartKey && key <= todayKey) activeDaysThisYear += 1;
  }

  return {
    currentStreak: computeCurrentStreak(activity, now),
    longestStreak: computeLongestStreak(activity),
    todayProblemCount: activity.byDate[todayKey]?.problemIds.length ?? 0,
    todayFocusLabel: formatDurationCompact(Number(focusByDate[todayKey] || 0)),
    yearFocusTotalLabel: formatDurationCompact(yearFocusTotal),
    activeDaysThisYear,
    cells,
    monthLabels,
  };
}
