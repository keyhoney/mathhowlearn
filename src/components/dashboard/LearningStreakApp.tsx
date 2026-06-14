import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeLearningStreakViewModel,
  type HeatmapCell,
  type LearningStreakViewModel,
} from '../../lib/client/learning-streak';
import { DASHBOARD_REFRESH_EVENT, readForceLocalFromQuery } from '../../lib/client/dashboard-stats';
import { STORAGE_KEYS } from '../../lib/storage-keys';

function formatCellTitle(cell: HeatmapCell): string {
  if (cell.isFuture) return '';
  const y = cell.date.getFullYear();
  const m = cell.date.getMonth() + 1;
  const d = cell.date.getDate();
  const focusMin = Math.round(cell.focusMs / 60_000);
  const parts = [`${y}.${m}.${d}`];
  if (cell.problemCount > 0) parts.push(`문제 ${cell.problemCount}개`);
  if (focusMin > 0) parts.push(`집중 ${focusMin}분`);
  if (cell.problemCount === 0 && focusMin === 0) parts.push('기록 없음');
  return parts.join(' · ');
}

const COMPACT_HEATMAP_MQ = '(max-width: 640px)';
const COMPACT_WEEK_COUNT = 26;
const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function sliceHeatmapWeeks(
  vm: LearningStreakViewModel,
  maxWeeks: number,
): Pick<LearningStreakViewModel, 'cells' | 'monthLabels'> {
  if (vm.cells.length <= maxWeeks) {
    return { cells: vm.cells, monthLabels: vm.monthLabels };
  }
  const start = vm.cells.length - maxWeeks;
  return {
    cells: vm.cells.slice(start),
    monthLabels: vm.monthLabels
      .filter((month) => month.weekIndex >= start)
      .map((month) => ({ ...month, weekIndex: month.weekIndex - start })),
  };
}

export function LearningStreakApp() {
  const [vm, setVm] = useState<LearningStreakViewModel | null>(null);
  const [compactHeatmap, setCompactHeatmap] = useState(false);

  const refresh = useCallback(() => {
    if (typeof localStorage === 'undefined') return;
    setVm(computeLearningStreakViewModel({ forceLocal: readForceLocalFromQuery() }));
  }, []);

  useEffect(() => {
    const media = window.matchMedia(COMPACT_HEATMAP_MQ);
    const syncCompact = () => setCompactHeatmap(media.matches);
    syncCompact();
    media.addEventListener('change', syncCompact);
    return () => media.removeEventListener('change', syncCompact);
  }, []);

  useEffect(() => {
    refresh();

    const onStorage = (event: StorageEvent) => {
      if (
        !event.key ||
        event.key === STORAGE_KEYS.LEARNING_ACTIVITY ||
        event.key === STORAGE_KEYS.FOCUS_HISTORY ||
        event.key === 'howlearn-focus-daily-cache' ||
        event.key.startsWith('howlearn')
      ) {
        refresh();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(DASHBOARD_REFRESH_EVENT, refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, [refresh]);

  const heatmap = useMemo(() => {
    if (!vm) return null;
    if (!compactHeatmap) return { ...vm, periodLabel: '최근 1년' };
    const sliced = sliceHeatmapWeeks(vm, COMPACT_WEEK_COUNT);
    return { ...vm, ...sliced, periodLabel: '최근 6개월' };
  }, [vm, compactHeatmap]);

  if (!heatmap) return null;

  const weekCount = heatmap.cells.length;

  return (
    <article className="hub-feature-card mt-8" data-dashboard-card="streak">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="type-subhead m-0">학습 스트릭</h2>
          <p className="type-caption chrome-muted mt-1">
            매일 문제 1개 이상 풀면 불꽃이 유지됩니다. 색은 집중 시간, 테두리는 문제 풀이 날짜입니다.
          </p>
        </div>
        <div className="learning-streak-flame" aria-label={`현재 연속 학습 ${heatmap.currentStreak}일`}>
          <span className="learning-streak-flame__icon" aria-hidden="true">
            🔥
          </span>
          <span className="learning-streak-flame__count">{heatmap.currentStreak}</span>
          <span className="learning-streak-flame__label">일 연속</span>
        </div>
      </div>

      <div className="learning-streak-stats mt-4">
        <div className="learning-streak-stat">
          <span className="learning-streak-stat__label">오늘 푼 문제</span>
          <strong className="learning-streak-stat__value">{heatmap.todayProblemCount}개</strong>
        </div>
        <div className="learning-streak-stat">
          <span className="learning-streak-stat__label">최장 스트릭</span>
          <strong className="learning-streak-stat__value">{heatmap.longestStreak}일</strong>
        </div>
        <div className="learning-streak-stat">
          <span className="learning-streak-stat__label">올해 학습일</span>
          <strong className="learning-streak-stat__value">{heatmap.activeDaysThisYear}일</strong>
        </div>
        <div className="learning-streak-stat">
          <span className="learning-streak-stat__label">연간 집중</span>
          <strong className="learning-streak-stat__value">{heatmap.yearFocusTotalLabel}</strong>
        </div>
      </div>

      <div
        className="learning-heatmap mt-5"
        role="img"
        aria-label={`${heatmap.periodLabel} 학습 히트맵`}
        style={{ '--heatmap-weeks': weekCount } as React.CSSProperties}
      >
        <div className="learning-heatmap__head">
          <span className="learning-heatmap__period">{heatmap.periodLabel}</span>
        </div>
        <div className="learning-heatmap__months">
          <span className="learning-heatmap__month learning-heatmap__month--spacer" aria-hidden="true" />
          {Array.from({ length: weekCount }, (_, weekIndex) => {
            const month = heatmap.monthLabels.find((m) => m.weekIndex === weekIndex);
            return (
              <span key={weekIndex} className="learning-heatmap__month">
                {month?.label ?? ''}
              </span>
            );
          })}
        </div>
        <div className="learning-heatmap__body">
          {DOW_LABELS.map((label, dowIndex) => (
            <div key={label} className="learning-heatmap__row">
              <span
                className={`learning-heatmap__dow-label${dowIndex % 2 === 1 ? ' learning-heatmap__dow-label--muted' : ''}`}
                aria-hidden="true"
              >
                {label}
              </span>
              {heatmap.cells.map((week, weekIndex) => {
                const cell = week[dowIndex];
                return (
                  <div
                    key={`${weekIndex}-${cell.dateKey}`}
                    className={`learning-heatmap__cell learning-heatmap__cell--l${cell.isFuture ? 0 : cell.level}${
                      cell.problemCount > 0 ? ' learning-heatmap__cell--active' : ''
                    }`}
                    title={formatCellTitle(cell)}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="learning-heatmap__legend" aria-hidden="true">
          <span>적음</span>
          <span className="learning-heatmap__cell learning-heatmap__cell--l0" />
          <span className="learning-heatmap__cell learning-heatmap__cell--l1" />
          <span className="learning-heatmap__cell learning-heatmap__cell--l2" />
          <span className="learning-heatmap__cell learning-heatmap__cell--l3" />
          <span className="learning-heatmap__cell learning-heatmap__cell--l4" />
          <span>많음</span>
          <span className="learning-heatmap__legend-active">□ 문제 풀이</span>
        </div>
      </div>
    </article>
  );
}
