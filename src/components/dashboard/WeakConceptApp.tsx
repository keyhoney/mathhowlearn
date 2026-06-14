import { useCallback, useEffect, useState } from 'react';
import {
  buildWeakConceptRecommendations,
  type WeakConceptProblem,
  type WeakConceptRecommendation,
} from '../../lib/client/weak-concept-recommend';
import { DASHBOARD_REFRESH_EVENT } from '../../lib/client/dashboard-stats';

export function WeakConceptApp({ problems }: { problems: WeakConceptProblem[] }) {
  const [items, setItems] = useState<WeakConceptRecommendation[]>([]);

  const refresh = useCallback(() => {
    if (typeof localStorage === 'undefined') return;
    setItems(buildWeakConceptRecommendations(problems, { limit: 3 }));
  }, [problems]);

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
      <span className="hub-badge hub-badge--neutral">Weak concepts</span>
      <h2 className="type-subhead mt-3">약점 개념 추천</h2>
      <p className="type-caption chrome-muted mt-2">
        최근 오답, 미완료 문제 수, 최근 출제 여부, 난이도를 합산해 우선 복습할 개념을 추천합니다.
      </p>
      {items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-[var(--card-border)] p-4 type-caption chrome-muted">
          아직 약점 개념을 계산할 학습 기록이 부족합니다.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.key} className="rounded-lg border border-[var(--card-border)] bg-[var(--surface-1)] p-4">
              <h3 className="type-heading">{item.concept}</h3>
              <p className="type-caption chrome-muted mt-1">
                {item.subject} · {item.chapter} · {item.subChapter}
              </p>
              <p className="type-caption mt-3 text-[var(--fg-muted)]">
                최근 오답 {item.wrongCount14d}회 · 미완료 {item.incompleteCount}문항 · 최근 출제 {item.recentCount}문항
              </p>
              <ul className="mt-3 space-y-2">
                {item.nextProblems.map((problem) => (
                  <li key={problem.id}>
                    <a href={problem.href} className="type-caption font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                      {problem.title}
                    </a>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
