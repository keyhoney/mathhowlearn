import { STORAGE_KEYS } from '../storage-keys';

export type TimelineEventType = 'answer-correct' | 'answer-wrong' | 'solution-opened' | 'focus-finished';

export type LearningTimelineEvent = {
  id: string;
  type: TimelineEventType;
  problemId: string;
  ts: number;
  label: string;
};

type TimelineStore = {
  v: 1;
  events: LearningTimelineEvent[];
};

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function appendTimelineEvent(event: Omit<LearningTimelineEvent, 'id' | 'ts'> & { ts?: number }): void {
  const store = parse<TimelineStore>(localStorage.getItem(STORAGE_KEYS.LEARNING_TIMELINE), { v: 1, events: [] });
  const ts = event.ts ?? Date.now();
  store.events.unshift({
    ...event,
    ts,
    id: `${ts}:${event.type}:${event.problemId}`,
  });
  store.events = store.events.slice(0, 100);
  localStorage.setItem(STORAGE_KEYS.LEARNING_TIMELINE, JSON.stringify(store));
}

export function readTimelineEvents(limit = 10): LearningTimelineEvent[] {
  const store = parse<TimelineStore>(localStorage.getItem(STORAGE_KEYS.LEARNING_TIMELINE), { v: 1, events: [] });
  return store.events.slice(0, limit);
}
