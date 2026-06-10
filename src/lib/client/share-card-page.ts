import type { ConceptIndexEntry } from '../concept-progress';
import { computeShareCardStats, type ShareCardViewModel } from '../share-card-stats';
import { computeCurrentStreak, readLearningActivity } from './learning-streak';
import {
  DASHBOARD_REFRESH_EVENT,
  parseJson,
  readForceLocalFromQuery,
  toDateKey,
} from './dashboard-stats';
import { STORAGE_KEYS } from '../storage-keys';

const PROGRESS_SUMMARY_CACHE = 'howlearn-progress-summary-cache';
const FOCUS_DAILY_CACHE = 'howlearn-focus-daily-cache';

export type ShareCardPageConfig = {
  conceptIndex: Record<string, ConceptIndexEntry>;
  siteTitle: string;
  siteUrl: string;
};

function readProgressById(forceLocal: boolean): Record<string, string | { status?: string; lastSeenAt?: number }> {
  const local = parseJson(localStorage.getItem(STORAGE_KEYS.PROBLEM_PROGRESS), { v: 1, byId: {} as Record<string, unknown> });
  const summary = parseJson(localStorage.getItem(PROGRESS_SUMMARY_CACHE), { v: 1, byId: {} as Record<string, unknown> });
  const hasCloud = Object.keys(summary.byId ?? {}).length > 0;
  return (!forceLocal && hasCloud ? summary.byId : local.byId) as Record<
    string,
    string | { status?: string; lastSeenAt?: number }
  >;
}

function readFocusByDate(forceLocal: boolean): Record<string, number> {
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

function readWrongById(): Record<string, { entries?: { ts?: number }[] }> {
  return parseJson(localStorage.getItem(STORAGE_KEYS.WRONG_NOTE), {
    v: 1,
    byId: {} as Record<string, { entries?: { ts?: number }[] }>,
  }).byId ?? {};
}

export function computeShareCardViewModel(config: ShareCardPageConfig): ShareCardViewModel {
  const forceLocal = readForceLocalFromQuery();
  const activity = readLearningActivity();
  return computeShareCardStats({
    conceptIndex: config.conceptIndex,
    progressById: readProgressById(forceLocal),
    wrongById: readWrongById(),
    focusByDate: readFocusByDate(forceLocal),
    currentStreak: computeCurrentStreak(activity),
    siteTitle: config.siteTitle,
    siteUrl: config.siteUrl,
  });
}

export function defaultShareFilename(vm: ShareCardViewModel): string {
  const month = vm.monthLabel.replace(/\s/g, '');
  return `howlearn-${month}-${toDateKey(Date.now())}.png`;
}

export { DASHBOARD_REFRESH_EVENT };
