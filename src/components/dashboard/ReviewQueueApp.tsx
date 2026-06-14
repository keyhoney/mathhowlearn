import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDueReviewIds } from '../../lib/client/review-queue';
import { DASHBOARD_REFRESH_EVENT } from '../../lib/client/dashboard-stats';

type ReviewProblemSummary = {
  id: string;
  href: string;
  title: string;
  meta: string;
  concept: string;
};

export function ReviewQueueApp({ problems }: { problems: ReviewProblemSummary[] }) {
  const byId = useMemo(() => new Map(problems.map((problem) => [problem.id, problem])), [problems]);
  const [items, setItems] = useState<ReviewProblemSummary[]>([]);

  const refresh = useCallback(() => {
    if (typeof localStorage === 'undefined') return;
    setItems(getDueReviewIds(Date.now(), 6).map((id) => byId.get(id)).filter(Boolean) as ReviewProblemSummary[]);
  }, [byId]);

  useEffect(() => {
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith('howlearn')) refresh();
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

  return (
    <section className="hub-feature-card mt-8">
      <span className="hub-badge hub-badge--neutral">Review</span>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="type-subhead">오늘의 복습 큐</h2>
          <p className="type-caption chrome-muted mt-2">
            오답과 힌트 사용 기록을 바탕으로 다시 풀 시점이 된 문제를 모았습니다.
          </p>
        </div>
        <a href="/problems/wrong-note" className="app-btn-secondary">
          오답노트 보기
        </a>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-[var(--card-border)] p-4 type-caption chrome-muted">
          지금 당장 복습할 문제는 없습니다. 문제를 풀면 자동으로 복습 일정이 만들어집니다.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={item.href}
                className="block rounded-lg border border-[var(--card-border)] bg-[var(--surface-1)] p-4 transition-colors hover:bg-[var(--surface-2)]"
              >
                <h3 className="type-heading">{item.title}</h3>
                <p className="type-caption chrome-muted mt-2">{item.meta}</p>
                <p className="type-caption mt-2 text-indigo-600 dark:text-indigo-400">{item.concept}</p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
