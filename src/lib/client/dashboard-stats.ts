import { STORAGE_KEYS } from '../storage-keys';

type FocusSessionStateV1 = {
  v: number;
  status: string;
  elapsedMs: number;
  startedAt: number | null;
  targetMs: number | null;
  problemId: string | null;
};

export const DASHBOARD_REFRESH_EVENT = 'howlearn-dashboard-refresh';

const PROGRESS_SUMMARY_CACHE = 'howlearn-progress-summary-cache';
const WRONG_SUMMARY_CACHE = 'howlearn-wrong-summary-cache';
const FOCUS_DAILY_CACHE = 'howlearn-focus-daily-cache';
const FOCUS_MONTHLY_CACHE = 'howlearn-focus-monthly-cache';

export const DEFAULT_FOCUS_GOAL_MS = 2 * 60 * 60 * 1000;

export type DashboardCta = {
  href: string;
  label: string;
};

export function readFocusGoalMs(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_FOCUS_GOAL_MS;
  const raw = parseJson(localStorage.getItem(STORAGE_KEYS.FOCUS_GOAL_MS), {
    v: 1,
    ms: DEFAULT_FOCUS_GOAL_MS,
  });
  const ms = Number(raw.ms);
  return Number.isFinite(ms) && ms >= 15 * 60 * 1000 ? ms : DEFAULT_FOCUS_GOAL_MS;
}

export function writeFocusGoalMs(ms: number): void {
  if (typeof localStorage === 'undefined') return;
  const safe = Number.isFinite(ms) && ms >= 15 * 60 * 1000 ? Math.floor(ms) : DEFAULT_FOCUS_GOAL_MS;
  localStorage.setItem(STORAGE_KEYS.FOCUS_GOAL_MS, JSON.stringify({ v: 1, ms: safe }));
}
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor((ms || 0) / 60000));
  const days = Math.floor(totalMin / (60 * 24));
  const dayRemainder = totalMin % (60 * 24);
  const hours = Math.floor(dayRemainder / 60);
  const mins = dayRemainder % 60;
  if (days > 0) return `${days}d ${hours}h ${String(mins).padStart(2, '0')}m`;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

export function formatDurationCompact(ms: number): string {
  const totalMin = Math.max(0, Math.floor((ms || 0) / 60000));
  const days = Math.floor(totalMin / (60 * 24));
  const dayRemainder = totalMin % (60 * 24);
  const hours = Math.floor(dayRemainder / 60);
  const mins = dayRemainder % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
  return `${mins}m`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value)}%`;
}

export function formatDeltaPercent(current: number, previous: number): string | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return '0%';
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

function getDayMs(byDate: Record<string, number>, dayOffset: number, now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return Number(byDate?.[toDateKey(d.getTime())] || 0);
}

function getWeekRangeMs(byDate: Record<string, number>, endOffset: number, days: number, now = Date.now()): number {
  let total = 0;
  for (let i = days - 1; i >= 0; i -= 1) {
    total += getDayMs(byDate, endOffset - i, now);
  }
  return total;
}

export function toDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getRecentDaysMs(byDate: Record<string, number>, days = 7, now = Date.now()): number[] {
  const list: number[] = [];
  const today = new Date(now);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(today.getDate() - i);
    const key = toDateKey(d.getTime());
    list.push(Number(byDate?.[key] || 0));
  }
  return list;
}

export function msValuesToBarHeights(pointsMs: number[]): number[] {
  const max = Math.max(1, ...pointsMs);
  return pointsMs.map((ms) => {
    if (ms <= 0) return 0;
    return Math.max(8, Math.round((ms / max) * 100));
  });
}

export const HUB_HERO_MOCK_DEMO = {
  mode: 'demo' as const,
  badge: 'Demo',
  todayLabel: '42m',
  todayDelta: '+18%',
  weekLabel: '3h 18m',
  weekDelta: '+12%',
  doneLabel: '28',
  doneDelta: '+6%',
  reviewLabel: '5',
  reviewDelta: '+2',
  barHeights: [35, 52, 41, 68, 55, 82, 74] as const,
};

export type HubHeroMockViewModel =
  | typeof HUB_HERO_MOCK_DEMO
  | {
      mode: 'live';
      badge: 'Live';
      todayLabel: string;
      todayDelta: string | null;
      weekLabel: string;
      weekDelta: string | null;
      doneLabel: string;
      doneDelta: null;
      reviewLabel: string;
      reviewDelta: null;
      barHeights: number[];
    };

export function computeHubHeroMock(input: DashboardStatsInput): HubHeroMockViewModel {
  const vm = computeDashboardStats(input);
  const hasData = !(vm.focus.empty && vm.progress.empty && vm.review.empty);
  if (!hasData) return HUB_HERO_MOCK_DEMO;

  return {
    mode: 'live',
    badge: 'Live',
    todayLabel: vm.focus.todayLabel,
    todayDelta: vm.focus.todayDeltaLabel,
    weekLabel: vm.focus.weekLabel,
    weekDelta: vm.focus.weekDeltaLabel,
    doneLabel: String(vm.progress.problemDone + vm.progress.essayDone),
    doneDelta: null,
    reviewLabel: String(vm.review.totalCount),
    reviewDelta: null,
    barHeights: msValuesToBarHeights(vm.focus.recentSevenDaysMs),
  };
}

export function buildSparklinePoints(pointsMs: number[], width = 260, height = 64): { line: string; fill: string } {
  const max = Math.max(1, ...pointsMs);
  const stepX = pointsMs.length > 1 ? width / (pointsMs.length - 1) : width;
  const pointPairs = pointsMs.map((val, idx) => {
    const x = Math.round(idx * stepX);
    const ratio = Math.max(0, Math.min(1, val / max));
    const y = Math.round(height - ratio * (height - 8));
    return `${x},${y}`;
  });
  const linePoints = pointPairs.join(' ');
  return { line: linePoints, fill: `0,64 ${linePoints} ${width},64` };
}

function getProgressStatus(
  progressById: Record<string, string | { status?: string }>,
  id: string,
): string {
  const item = progressById?.[id];
  return typeof item === 'string' ? item : (item?.status ?? 'none');
}

export type DashboardProblemListCard = {
  href: string;
  label: string;
  done: number;
  total: number;
  rate: number;
  rateLabel: string;
};

function countActiveFocusDays(byDate: Record<string, number>, days = 7, now = Date.now()): number {
  const recent = getRecentDaysMs(byDate, days, now);
  return recent.filter((ms) => ms > 0).length;
}

function countWrongReviewDays(wrongById: Record<string, { entries?: { ts?: number }[] }>, days = 7, now = Date.now()): number {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const dayKeys = new Set<string>();
  for (const bucket of Object.values(wrongById)) {
    for (const entry of bucket?.entries ?? []) {
      const ts = Number(entry?.ts || 0);
      if (ts >= cutoff) dayKeys.add(toDateKey(ts));
    }
  }
  return dayKeys.size;
}

export type DashboardStatsInput = {
  problemIds: string[];
  essayProblemIds: string[];
  forceLocal?: boolean;
  now?: number;
};

export type DashboardViewModel = {
  weekdayLabel: string;
  insightLine: string;
  weeklyLine: string | null;
  focusRunning: boolean;
  focus: {
    todayMs: number;
    weekMs: number;
    totalMs: number;
    recentSevenDaysMs: number[];
    goalPercent: number;
    todayLabel: string;
    weekLabel: string;
    totalLabel: string;
    subtitle: string;
    ctaHref: string;
    ctaLabel: string;
    empty: boolean;
    sparkline: { line: string; fill: string };
    sparklineAria: string;
    todayDeltaLabel: string | null;
    weekDeltaLabel: string | null;
  };
  review: {
    priorityCount: number;
    normalCount: number;
    totalCount: number;
    priorityPercent: number;
    subtitle: string;
    ctaHref: string;
    ctaLabel: string;
    empty: boolean;
  };
  progress: {
    problemDone: number;
    problemTotal: number;
    problemRate: number;
    essayDone: number;
    essayTotal: number;
    essayRate: number;
    subtitle: string;
    problemList: DashboardProblemListCard;
    essayList: DashboardProblemListCard;
    empty: boolean;
  };
  dataSource: 'cloud' | 'local';
  syncHint: string;
  focusGoalMinutes: number;
};

export function emitDashboardRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_REFRESH_EVENT));
}

export function computeDashboardStats(input: DashboardStatsInput): DashboardViewModel {
  const now = input.now ?? Date.now();
  const forceLocal = Boolean(input.forceLocal);
  const essaySet = new Set(input.essayProblemIds);
  const problemIds = input.problemIds;
  const essayProblemIds = input.essayProblemIds;

  const progress = parseJson(localStorage.getItem(STORAGE_KEYS.PROBLEM_PROGRESS), { v: 1, byId: {} as Record<string, unknown> });
  const progressSummary = parseJson(localStorage.getItem(PROGRESS_SUMMARY_CACHE), { v: 1, byId: {} as Record<string, unknown> });
  const wrong = parseJson(localStorage.getItem(STORAGE_KEYS.WRONG_NOTE), { v: 1, byId: {} as Record<string, { entries?: { ts?: number }[] }> });
  const wrongSummary = parseJson(localStorage.getItem(WRONG_SUMMARY_CACHE), { v: 1, byId: {} as Record<string, { isRepeatWrong?: boolean; wrongCount?: number }> });
  const focus = parseJson<FocusSessionStateV1>(localStorage.getItem(STORAGE_KEYS.FOCUS_STATE), {
    v: 1,
    status: 'idle',
    elapsedMs: 0,
    startedAt: null,
    targetMs: null,
    problemId: null,
  });
  const focusHistory = parseJson(localStorage.getItem(STORAGE_KEYS.FOCUS_HISTORY), { v: 1, byDate: {} as Record<string, number> });
  const focusDaily = parseJson(localStorage.getItem(FOCUS_DAILY_CACHE), { v: 1, byDate: {} as Record<string, number> });
  const focusMonthly = parseJson(localStorage.getItem(FOCUS_MONTHLY_CACHE), { v: 1, byMonth: {} as Record<string, number> });

  const hasCloudProgress = Object.keys(progressSummary.byId || {}).length > 0;
  const progressById = (!forceLocal && hasCloudProgress ? progressSummary.byId : progress.byId) as Record<
    string,
    string | { status?: string }
  >;

  const getDoneCount = (ids: string[]) =>
    ids.filter((id) => getProgressStatus(progressById, id) === 'done').length;

  const problemDone = getDoneCount(problemIds);
  const essayDone = getDoneCount(essayProblemIds);
  const problemTotal = problemIds.length;
  const essayTotal = essayProblemIds.length;
  const problemRate = problemTotal > 0 ? (problemDone / problemTotal) * 100 : 0;
  const essayRate = essayTotal > 0 ? (essayDone / essayTotal) * 100 : 0;

  const wrongSummaryRows = Object.values(wrongSummary.byId || {});
  const hasCloudWrong = wrongSummaryRows.length > 0;
  const wrongRows = Object.values(wrong.byId || {});
  const useCloudWrong = !forceLocal && hasCloudWrong;
  const wrongCount = useCloudWrong ? wrongSummaryRows.length : wrongRows.length;
  const priorityCount = useCloudWrong
    ? wrongSummaryRows.filter((row) => Boolean(row?.isRepeatWrong) || Number(row?.wrongCount || 0) >= 2).length
    : wrongRows.filter((bucket) => (bucket?.entries?.length || 0) >= 2).length;
  const normalCount = Math.max(0, wrongCount - priorityCount);
  const reviewTotal = wrongCount;
  const priorityPercent = reviewTotal > 0 ? (priorityCount / reviewTotal) * 100 : 0;

  const runningDeltaMs = focus.status === 'running' && focus.startedAt ? now - focus.startedAt : 0;
  const hasCloudFocusDaily = Object.keys(focusDaily.byDate || {}).length > 0;
  const focusByDate = !forceLocal && hasCloudFocusDaily ? focusDaily.byDate || {} : focusHistory.byDate || {};
  const todayKey = toDateKey(now);
  const todayAccumulatedMs = Number(focusByDate?.[todayKey] || 0);
  const todayMs = todayAccumulatedMs + (forceLocal ? runningDeltaMs : 0);
  const recentSevenDays = getRecentDaysMs(focusByDate, 7, now);
  if (recentSevenDays.length) recentSevenDays[recentSevenDays.length - 1] = todayMs;
  const weekMs = recentSevenDays.reduce((acc, cur) => acc + cur, 0);
  const prevWeekMs = getWeekRangeMs(focusByDate, -7, 7, now);
  const yesterdayMs = getDayMs(focusByDate, -1, now);
  const weekDeltaLabel = formatDeltaPercent(weekMs, prevWeekMs);
  const todayDeltaLabel = formatDeltaPercent(todayMs, yesterdayMs);

  const cloudTotalFocusMs = Object.values(focusMonthly.byMonth || {}).reduce((acc, cur) => acc + (Number(cur) || 0), 0);
  const localTotalFocusMs = Object.values(focusByDate).reduce((acc, cur) => acc + (Number(cur) || 0), 0);
  const totalFocusMs =
    (!forceLocal && cloudTotalFocusMs > 0 ? cloudTotalFocusMs : localTotalFocusMs) + (forceLocal ? runningDeltaMs : 0);

  const focusGoalMs = readFocusGoalMs();
  const focusGoalMinutes = Math.round(focusGoalMs / 60000);
  const goalPercent = Math.min(100, Math.max(0, (todayMs / focusGoalMs) * 100));

  const focusProblemId = focus.problemId?.trim() || '';
  const focusResumeId =
    focusProblemId && (problemIds.includes(focusProblemId) || essayProblemIds.includes(focusProblemId))
      ? focusProblemId
      : null;
  const focusCtaHref = focusResumeId ? problemHref(focusResumeId, essaySet) : '/problems';
  const focusRunning = focus.status === 'running';
  const focusEmpty = todayMs <= 0 && weekMs <= 0 && totalFocusMs <= 0 && !focusRunning;

  const progressEmpty = problemDone + essayDone === 0;
  const problemList: DashboardProblemListCard = {
    href: '/problems',
    label: '수능 문제',
    done: problemDone,
    total: problemTotal,
    rate: problemRate,
    rateLabel: `${formatPercent(problemRate)} · ${problemDone}/${problemTotal}`,
  };
  const essayList: DashboardProblemListCard = {
    href: '/essay-problems',
    label: '논술 문제',
    done: essayDone,
    total: essayTotal,
    rate: essayRate,
    rateLabel: `${formatPercent(essayRate)} · ${essayDone}/${essayTotal}`,
  };

  const weekday = WEEKDAY_KO[new Date(now).getDay()];
  const weekdayLabel = `${weekday}요일`;

  let insightLine = `${weekdayLabel} — 오늘의 학습을 이어가 보세요.`;
  if (focusRunning) {
    insightLine = `${weekdayLabel} — 집중 모드가 진행 중입니다.`;
  } else if (todayMs > 0 || priorityCount > 0) {
    const parts: string[] = [];
    if (todayMs > 0) parts.push(`집중 ${formatDurationCompact(todayMs)}`);
    if (priorityCount > 0) parts.push(`우선 오답 ${priorityCount}개`);
    insightLine = `${weekdayLabel} — ${parts.join(', ')}${priorityCount > 0 ? '가 기다립니다' : ' 기록됨'}.`;
  }

  const focusDays = countActiveFocusDays(focusByDate, 7, now);
  const wrongDays = countWrongReviewDays(wrong.byId || {}, 7, now);
  const weeklyLine =
    focusDays > 0 || wrongDays > 0
      ? `이번 주 집중 ${focusDays}일 · 오답 복습 ${wrongDays}일`
      : null;

  const dataSource: 'cloud' | 'local' =
    !forceLocal && (hasCloudProgress || hasCloudWrong || hasCloudFocusDaily) ? 'cloud' : 'local';

  const syncHint = forceLocal
    ? '디버그: 로컬 데이터만 표시 중'
    : dataSource === 'cloud'
      ? '클라우드 요약이 반영되었습니다'
      : '로컬 데이터만 표시 중';

  return {
    weekdayLabel,
    insightLine,
    weeklyLine,
    focusRunning,
    dataSource,
    syncHint,
    focusGoalMinutes,
    focus: {
      todayMs,
      weekMs,
      totalMs: totalFocusMs,
      recentSevenDaysMs: recentSevenDays,
      goalPercent,
      todayLabel: formatDurationCompact(todayMs),
      weekLabel: formatDurationCompact(weekMs),
      totalLabel: formatDurationCompact(totalFocusMs),
      subtitle: focusRunning
        ? '집중 모드가 켜져 있습니다. 마지막 문제로 돌아가 이어갈 수 있어요.'
        : `오늘 목표 ${focusGoalMinutes}분 기준으로 집중 시간을 확인하세요.`,
      ctaHref: focusCtaHref,
      ctaLabel: focusEmpty ? '첫 문제 풀기' : '문제 풀러가기',
      empty: focusEmpty,
      sparkline: buildSparklinePoints(recentSevenDays),
      sparklineAria: `최근 7일 집중 시간 추이, 오늘 ${formatDurationCompact(todayMs)}`,
      todayDeltaLabel,
      weekDeltaLabel,
    },
    review: {
      priorityCount,
      normalCount,
      totalCount: reviewTotal,
      priorityPercent,
      subtitle: '우선 복습 = 같은 문제에 2회 이상 오답',
      ctaHref: '/problems/wrong-note',
      ctaLabel: reviewTotal > 0 ? '오답 노트 열기' : '오답 노트 보기',
      empty: reviewTotal === 0,
    },
    progress: {
      problemDone,
      problemTotal,
      problemRate,
      essayDone,
      essayTotal,
      essayRate,
      subtitle: `수능 ${problemDone}/${problemTotal} · 논술 ${essayDone}/${essayTotal}`,
      problemList,
      essayList,
      empty: progressEmpty,
    },
  };
}

export function readForceLocalFromQuery(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('local') === '1';
}
