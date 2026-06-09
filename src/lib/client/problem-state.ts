export type ProgressStatus = 'none' | 'progress' | 'done';

export interface ProgressDetail {
  status: ProgressStatus;
  hintRevealedCount: number;
  solutionRevealed: boolean;
  lastAnswer: string;
  attemptCount: number;
  lastSeenAt: number;
}

export interface ProgressStore {
  v: 1;
  byId: Record<string, ProgressStatus | ProgressDetail>;
}

export interface WrongEntryMcq {
  t: 'mcq';
  choice: number;
  ts: number;
}

export interface WrongEntryShort {
  t: 'short';
  value: string;
  ts: number;
}

export type WrongEntry = WrongEntryMcq | WrongEntryShort;

export interface WrongStore {
  v: 1;
  byId: Record<string, { entries: WrongEntry[] }>;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readProgressStore(key: string): ProgressStore {
  return parseJson<ProgressStore>(localStorage.getItem(key), { v: 1, byId: {} });
}

export function writeProgressStore(key: string, store: ProgressStore): void {
  localStorage.setItem(key, JSON.stringify(store));
}

export function readWrongStore(key: string): WrongStore {
  return parseJson<WrongStore>(localStorage.getItem(key), { v: 1, byId: {} });
}

export function appendWrongEntry(
  key: string,
  problemId: string,
  entry: WrongEntry,
  maxPerProblem = 40,
): void {
  const store = readWrongStore(key);
  const bucket = store.byId[problemId] ?? { entries: [] };
  bucket.entries.unshift(entry);
  bucket.entries = bucket.entries.slice(0, maxPerProblem);
  store.byId[problemId] = bucket;
  localStorage.setItem(key, JSON.stringify(store));
}

export function getProgressDetail(store: ProgressStore, problemId: string): ProgressDetail {
  const current = store.byId[problemId];
  if (!current) {
    return {
      status: 'none',
      hintRevealedCount: 0,
      solutionRevealed: false,
      lastAnswer: '',
      attemptCount: 0,
      lastSeenAt: Date.now(),
    };
  }
  if (typeof current === 'string') {
    return {
      status: current,
      hintRevealedCount: 0,
      solutionRevealed: false,
      lastAnswer: '',
      attemptCount: 0,
      lastSeenAt: Date.now(),
    };
  }
  return {
    status: current.status ?? 'none',
    hintRevealedCount: Number(current.hintRevealedCount || 0),
    solutionRevealed: Boolean(current.solutionRevealed),
    lastAnswer: String(current.lastAnswer || ''),
    attemptCount: Number(current.attemptCount || 0),
    lastSeenAt: Number(current.lastSeenAt || Date.now()),
  };
}
