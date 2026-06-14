import { useEffect, useState } from 'react';
import { readTimelineEvents, type LearningTimelineEvent } from '../../lib/client/learning-timeline';
import { DASHBOARD_REFRESH_EVENT } from '../../lib/client/dashboard-stats';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function LearningTimelineApp() {
  const [events, setEvents] = useState<LearningTimelineEvent[]>([]);

  useEffect(() => {
    const refresh = () => setEvents(readTimelineEvents(8));
    refresh();
    window.addEventListener(DASHBOARD_REFRESH_EVENT, refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  return (
    <section className="hub-feature-card mt-8">
      <span className="hub-badge hub-badge--neutral">Timeline</span>
      <h2 className="type-subhead mt-3">최근 풀이 타임라인</h2>
      {events.length === 0 ? (
        <p className="type-caption chrome-muted mt-3">아직 기록된 풀이 이벤트가 없습니다.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="rounded-lg border border-[var(--card-border)] bg-[var(--surface-1)] p-3">
              <p className="type-caption chrome-muted">{formatTime(event.ts)} · {event.problemId}</p>
              <p className="type-body mt-1">{event.label}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
