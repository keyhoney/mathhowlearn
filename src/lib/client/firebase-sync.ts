import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  where,
  writeBatch,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
import { ensureAnonymousUid, watchAuthState } from './firebase-auth';
import { getClientDb, isFirebaseSyncEnabled } from './firebase-app';
import { STORAGE_KEYS } from '../storage-keys';

type SyncCollection = 'progress' | 'bookmarks' | 'wrongSummary' | 'focusDaily' | 'focusMonthly' | 'usageDaily';

type SyncQueueItem = {
  collection: SyncCollection;
  docId: string;
  data: Record<string, unknown>;
  increments?: Record<string, number>;
};

const queue = new Map<string, SyncQueueItem>();
const FLUSH_DELAY_MS = 5000;
const BATCH_LIMIT = 400;
const RETRY_QUEUE_STORAGE_KEY = 'howlearn-cloud-sync-queue-v1';
const SYNC_BACKOFF_STORAGE_KEY = 'howlearn-cloud-sync-backoff-v1';
const WRONG_SUMMARY_CACHE_KEY = 'howlearn-wrong-summary-cache';
const PROGRESS_SUMMARY_CACHE_KEY = 'howlearn-progress-summary-cache';
const FOCUS_DAILY_CACHE_KEY = 'howlearn-focus-daily-cache';
const FOCUS_MONTHLY_CACHE_KEY = 'howlearn-focus-monthly-cache';
const USAGE_DAILY_CACHE_KEY = 'howlearn-usage-daily-cache';
const BACKOFF_MIN_DELAY_MS = 15_000;
const BACKOFF_MAX_DELAY_MS = 120_000;
const PULL_LIMIT = 500;
let flushTimer: number | null = null;
let listenersBound = false;
let authListenerBound = false;
let flushing = false;
const MIGRATION_VERSION = 1;
let dynamicFlushDelayMs = FLUSH_DELAY_MS;
let pendingUsageReadOps = 0;

function queueKey(collection: SyncCollection, docId: string): string {
  return `${collection}:${docId}`;
}

function sanitizeDocId(value: string): string {
  return String(value || '').trim().replaceAll('/', '_').slice(0, 128);
}

function mapCollectionPath(collection: SyncCollection, uid: string, docId: string): string[] {
  return ['users', uid, collection, docId];
}

async function flushInternal(db: Firestore, uid: string): Promise<void> {
  if (queue.size === 0) return;

  const entries = Array.from(queue.values()).slice(0, BATCH_LIMIT);
  const batch = writeBatch(db);

  for (const item of entries) {
    const [root, userId, group, id] = mapCollectionPath(item.collection, uid, item.docId);
    const ref = doc(db, root, userId, group, id);
    const payload: Record<string, unknown> = { ...item.data };
    for (const [field, delta] of Object.entries(item.increments ?? {})) {
      if (!Number.isFinite(delta) || delta === 0) continue;
      payload[field] = increment(delta);
    }
    batch.set(ref, payload, { merge: true });
  }

  const writeOps = entries.length;
  const usageDateKey = toDateKey(Date.now());
  const usageRef = doc(db, 'users', uid, 'usageDaily', usageDateKey);
  batch.set(
    usageRef,
    {
      dateKey: usageDateKey,
      updatedAt: Date.now(),
      writeOps: increment(writeOps),
      readOps: increment(Math.max(0, pendingUsageReadOps)),
    },
    { merge: true },
  );
  await batch.commit();
  const usageCache = parseJson<{ v?: number; byDate?: Record<string, { readOps: number; writeOps: number }> }>(
    localStorage.getItem(USAGE_DAILY_CACHE_KEY),
    { v: 1, byDate: {} },
  );
  const usageByDate = usageCache.byDate ?? {};
  const currentUsage = usageByDate[usageDateKey] ?? { readOps: 0, writeOps: 0 };
  usageByDate[usageDateKey] = {
    readOps: Math.max(0, Number(currentUsage.readOps || 0) + Math.max(0, pendingUsageReadOps)),
    writeOps: Math.max(0, Number(currentUsage.writeOps || 0) + writeOps),
  };
  pendingUsageReadOps = 0;
  localStorage.setItem(USAGE_DAILY_CACHE_KEY, JSON.stringify({ v: 1, byDate: usageByDate }));

  for (const item of entries) {
    queue.delete(queueKey(item.collection, item.docId));
  }
  persistRetryQueue();

  if (queue.size > 0) {
    scheduleFlush(1200);
  }
}

function scheduleFlush(delayMs = FLUSH_DELAY_MS): void {
  if (flushTimer != null) {
    window.clearTimeout(flushTimer);
  }
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, Math.max(delayMs, dynamicFlushDelayMs));
}

function bindLifecycleListeners(): void {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;

  window.addEventListener('pagehide', () => {
    void flushQueue({ immediate: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushQueue({ immediate: true });
    }
  });

  window.addEventListener('online', () => {
    void flushQueue({ immediate: true });
  });
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toMonthKey(dateKeyOrTs: string | number): string {
  if (typeof dateKeyOrTs === 'number') {
    return toDateKey(dateKeyOrTs).slice(0, 7);
  }
  const value = String(dateKeyOrTs || '');
  return value.length >= 7 ? value.slice(0, 7) : toDateKey(Date.now()).slice(0, 7);
}

function getLastPullTs(uid: string, collectionName: SyncCollection): number {
  return Number(localStorage.getItem(`howlearn-cloud-last-pull:${uid}:${collectionName}`) || 0);
}

function setLastPullTs(uid: string, collectionName: SyncCollection, ts = Date.now()): void {
  localStorage.setItem(`howlearn-cloud-last-pull:${uid}:${collectionName}`, String(ts));
}

function persistRetryQueue(): void {
  if (typeof localStorage === 'undefined') return;
  const entries = Array.from(queue.values());
  if (entries.length === 0) {
    localStorage.removeItem(RETRY_QUEUE_STORAGE_KEY);
    return;
  }
  localStorage.setItem(RETRY_QUEUE_STORAGE_KEY, JSON.stringify({ v: 1, entries }));
}

function persistBackoffDelay(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SYNC_BACKOFF_STORAGE_KEY, String(dynamicFlushDelayMs));
}

function hydrateBackoffDelay(): void {
  if (typeof localStorage === 'undefined') return;
  const raw = Number(localStorage.getItem(SYNC_BACKOFF_STORAGE_KEY) || '');
  if (!Number.isFinite(raw)) return;
  dynamicFlushDelayMs = Math.min(BACKOFF_MAX_DELAY_MS, Math.max(FLUSH_DELAY_MS, raw));
}

function increaseBackoffDelay(): void {
  const next = Math.min(
    BACKOFF_MAX_DELAY_MS,
    Math.max(BACKOFF_MIN_DELAY_MS, Math.floor(dynamicFlushDelayMs * 1.8)),
  );
  dynamicFlushDelayMs = next;
  persistBackoffDelay();
}

function resetBackoffDelay(): void {
  if (dynamicFlushDelayMs === FLUSH_DELAY_MS) return;
  dynamicFlushDelayMs = FLUSH_DELAY_MS;
  persistBackoffDelay();
}

function isQuotaOrBusyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = String((error as { code?: string }).code || '').toLowerCase();
  if (
    code.includes('resource-exhausted') ||
    code.includes('quota') ||
    code.includes('unavailable') ||
    code.includes('deadline-exceeded')
  ) {
    return true;
  }
  const message = String((error as { message?: string }).message || '').toLowerCase();
  return (
    message.includes('resource exhausted') ||
    message.includes('quota') ||
    message.includes('too many requests')
  );
}

function mergeProgressFromCloud(uid: string, docs: Array<{ id: string; data: Record<string, unknown> }>): void {
  const progressStore = parseJson<{ v?: number; byId?: Record<string, unknown> }>(
    localStorage.getItem(STORAGE_KEYS.PROBLEM_PROGRESS),
    { v: 1, byId: {} },
  );
  const byId = progressStore.byId ?? {};
  const rank: Record<'none' | 'progress' | 'done', number> = { none: 0, progress: 1, done: 2 };
  for (const row of docs) {
    const problemId = sanitizeDocId(row.id);
    if (!problemId) continue;
    const cloud = row.data;
    const cloudStatus =
      cloud.status === 'done' ? 'done' : cloud.status === 'progress' ? 'progress' : 'none';
    const current = byId[problemId];
    if (!current || typeof current === 'string') {
      byId[problemId] = {
        status: cloudStatus,
        hintRevealedCount: Number(cloud.hintRevealedCount || 0),
        solutionRevealed: Boolean(cloud.solutionRevealed),
        lastAnswer: String(cloud.lastAnswer || ''),
        attemptCount: Number(cloud.attemptCount || 0),
        lastSeenAt: Number(cloud.lastSeenAt || Date.now()),
      };
      continue;
    }
    const local = current as Record<string, unknown>;
    const localStatus = local.status === 'done' ? 'done' : local.status === 'progress' ? 'progress' : 'none';
    byId[problemId] = {
      ...local,
      status: rank[cloudStatus] >= rank[localStatus] ? cloudStatus : localStatus,
      hintRevealedCount: Math.max(Number(local.hintRevealedCount || 0), Number(cloud.hintRevealedCount || 0)),
      solutionRevealed: Boolean(local.solutionRevealed) || Boolean(cloud.solutionRevealed),
      attemptCount: Math.max(Number(local.attemptCount || 0), Number(cloud.attemptCount || 0)),
      lastSeenAt: Math.max(Number(local.lastSeenAt || 0), Number(cloud.lastSeenAt || 0), Date.now()),
      lastAnswer:
        Number(cloud.lastSeenAt || 0) >= Number(local.lastSeenAt || 0)
          ? String(cloud.lastAnswer || '')
          : String(local.lastAnswer || ''),
    };
  }
  localStorage.setItem(STORAGE_KEYS.PROBLEM_PROGRESS, JSON.stringify({ v: 1, byId }));
  localStorage.setItem(PROGRESS_SUMMARY_CACHE_KEY, JSON.stringify({ v: 1, byId }));
  setLastPullTs(uid, 'progress');
}

function mergeBookmarksFromCloud(uid: string, docs: Array<{ id: string; data: Record<string, unknown> }>): void {
  const bookmarkStore = parseJson<{ v?: number; byId?: Record<string, { ts?: number }> }>(
    localStorage.getItem(STORAGE_KEYS.BOOKMARK),
    { v: 1, byId: {} },
  );
  const byId = bookmarkStore.byId ?? {};
  for (const row of docs) {
    const problemId = sanitizeDocId(row.id);
    if (!problemId) continue;
    const cloudTs = Number(row.data.ts || row.data.updatedAt || Date.now());
    const localTs = Number(byId[problemId]?.ts || 0);
    const bookmarked = Boolean(row.data.bookmarked);
    if (cloudTs < localTs) continue;
    if (!bookmarked) {
      delete byId[problemId];
      continue;
    }
    byId[problemId] = { ts: cloudTs };
  }
  localStorage.setItem(STORAGE_KEYS.BOOKMARK, JSON.stringify({ v: 1, byId }));
  setLastPullTs(uid, 'bookmarks');
}

function mergeFocusDailyFromCloud(uid: string, docs: Array<{ id: string; data: Record<string, unknown> }>): void {
  const focusHistory = parseJson<{ v?: number; byDate?: Record<string, number> }>(
    localStorage.getItem(STORAGE_KEYS.FOCUS_HISTORY),
    { v: 1, byDate: {} },
  );
  const byDate = focusHistory.byDate ?? {};
  for (const row of docs) {
    const dateKey = String(row.data.dateKey || row.id || '').trim();
    if (!dateKey) continue;
    const cloudTotalMs = Math.max(0, Number(row.data.totalMs || 0));
    byDate[dateKey] = Math.max(Number(byDate[dateKey] || 0), cloudTotalMs);
  }
  localStorage.setItem(STORAGE_KEYS.FOCUS_HISTORY, JSON.stringify({ v: 1, byDate }));
  localStorage.setItem(FOCUS_DAILY_CACHE_KEY, JSON.stringify({ v: 1, byDate }));
  setLastPullTs(uid, 'focusDaily');
}

function mergeWrongSummaryFromCloud(uid: string, docs: Array<{ id: string; data: Record<string, unknown> }>): void {
  const cache = parseJson<{ v?: number; byId?: Record<string, Record<string, unknown>> }>(
    localStorage.getItem(WRONG_SUMMARY_CACHE_KEY),
    { v: 1, byId: {} },
  );
  const byId = cache.byId ?? {};
  for (const row of docs) {
    const problemId = sanitizeDocId(row.id);
    if (!problemId) continue;
    byId[problemId] = {
      wrongCount: Math.max(0, Number(row.data.wrongCount || 0)),
      lastWrongAt: Number(row.data.lastWrongAt || 0),
      isRepeatWrong: Boolean(row.data.isRepeatWrong),
      updatedAt: Number(row.data.updatedAt || Date.now()),
    };
  }
  localStorage.setItem(WRONG_SUMMARY_CACHE_KEY, JSON.stringify({ v: 1, byId }));
  setLastPullTs(uid, 'wrongSummary');
}

function mergeFocusMonthlyFromCloud(uid: string, docs: Array<{ id: string; data: Record<string, unknown> }>): void {
  const cache = parseJson<{ v?: number; byMonth?: Record<string, number> }>(
    localStorage.getItem(FOCUS_MONTHLY_CACHE_KEY),
    { v: 1, byMonth: {} },
  );
  const byMonth = cache.byMonth ?? {};
  for (const row of docs) {
    const monthKey = String(row.data.monthKey || row.id || '').trim();
    if (!monthKey) continue;
    byMonth[monthKey] = Math.max(Number(byMonth[monthKey] || 0), Math.max(0, Number(row.data.totalMs || 0)));
  }
  localStorage.setItem(FOCUS_MONTHLY_CACHE_KEY, JSON.stringify({ v: 1, byMonth }));
  setLastPullTs(uid, 'focusMonthly');
}

function addUsageReadEstimate(uid: string, readDocs: number): void {
  const safeReads = Math.max(0, Math.floor(readDocs));
  if (safeReads <= 0) return;
  const dateKey = toDateKey(Date.now());
  const cache = parseJson<{ v?: number; byDate?: Record<string, { readOps: number; writeOps: number }> }>(
    localStorage.getItem(USAGE_DAILY_CACHE_KEY),
    { v: 1, byDate: {} },
  );
  const byDate = cache.byDate ?? {};
  const current = byDate[dateKey] ?? { readOps: 0, writeOps: 0 };
  byDate[dateKey] = {
    readOps: Math.max(0, Number(current.readOps || 0) + safeReads),
    writeOps: Math.max(0, Number(current.writeOps || 0)),
  };
  localStorage.setItem(USAGE_DAILY_CACHE_KEY, JSON.stringify({ v: 1, byDate }));
  pendingUsageReadOps += safeReads;
  setLastPullTs(uid, 'usageDaily');
}

async function readSummaryDocs(
  db: Firestore,
  uid: string,
  collectionName: SyncCollection,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const since = getLastPullTs(uid, collectionName);
  const constraints: QueryConstraint[] = [orderBy('updatedAt', 'desc'), limit(PULL_LIMIT)];
  if (since > 0) {
    constraints.unshift(where('updatedAt', '>', since));
  }
  const snapshot = await getDocs(query(collection(db, 'users', uid, collectionName), ...constraints));
  return snapshot.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
}

async function pullCloudSummariesToLocal(db: Firestore, uid: string): Promise<void> {
  const [progressDocs, bookmarkDocs, focusDailyDocs, wrongSummaryDocs, focusMonthlyDocs] =
    await Promise.all([
      readSummaryDocs(db, uid, 'progress'),
      readSummaryDocs(db, uid, 'bookmarks'),
      readSummaryDocs(db, uid, 'focusDaily'),
      readSummaryDocs(db, uid, 'wrongSummary'),
      readSummaryDocs(db, uid, 'focusMonthly'),
    ]);
  mergeProgressFromCloud(uid, progressDocs);
  mergeBookmarksFromCloud(uid, bookmarkDocs);
  mergeFocusDailyFromCloud(uid, focusDailyDocs);
  mergeWrongSummaryFromCloud(uid, wrongSummaryDocs);
  mergeFocusMonthlyFromCloud(uid, focusMonthlyDocs);
  addUsageReadEstimate(
    uid,
    progressDocs.length +
      bookmarkDocs.length +
      focusDailyDocs.length +
      wrongSummaryDocs.length +
      focusMonthlyDocs.length,
  );
}

async function syncAfterLogin(uid: string): Promise<void> {
  if (!uid || typeof localStorage === 'undefined') return;
  const db = getClientDb();
  if (db) {
    try {
      await pullCloudSummariesToLocal(db, uid);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('howlearn-dashboard-refresh'));
      }
    } catch {
      // Pull failures should not block local-first flow.
    }
  }
  runBootstrapMigration(uid);
  await flushQueue({ immediate: true });
}

function bindAuthListener(): void {
  if (authListenerBound || typeof window === 'undefined') return;
  authListenerBound = true;
  watchAuthState((user) => {
    if (!user?.uid) return;
    void syncAfterLogin(user.uid);
  });
}

function hydrateRetryQueue(): void {
  if (typeof localStorage === 'undefined' || queue.size > 0) return;
  const raw = parseJson<{ v?: number; entries?: SyncQueueItem[] }>(
    localStorage.getItem(RETRY_QUEUE_STORAGE_KEY),
    { entries: [] },
  );
  for (const item of raw.entries ?? []) {
    const safeDocId = sanitizeDocId(item.docId);
    if (!safeDocId) continue;
    queue.set(queueKey(item.collection, safeDocId), {
      collection: item.collection,
      docId: safeDocId,
      data: { ...(item.data ?? {}), updatedAt: Number(item.data?.updatedAt || Date.now()) },
    });
  }
}

type ProgressSnapshot = {
  status: 'none' | 'progress' | 'done';
  hintRevealedCount: number;
  solutionRevealed: boolean;
  attemptCount: number;
  lastSeenAt: number;
};

function readProgressSnapshotById(): Record<string, ProgressSnapshot> {
  const rawStore = parseJson<{ byId?: Record<string, unknown> }>(
    localStorage.getItem(STORAGE_KEYS.PROBLEM_PROGRESS),
    { byId: {} },
  );
  const out: Record<string, ProgressSnapshot> = {};
  for (const [problemId, raw] of Object.entries(rawStore.byId ?? {})) {
    if (!raw) continue;
    if (typeof raw === 'string') {
      out[problemId] = {
        status: raw === 'done' ? 'done' : raw === 'progress' ? 'progress' : 'none',
        hintRevealedCount: 0,
        solutionRevealed: false,
        attemptCount: 0,
        lastSeenAt: Date.now(),
      };
      continue;
    }
    const detail = raw as Record<string, unknown>;
    out[problemId] = {
      status:
        detail.status === 'done'
          ? 'done'
          : detail.status === 'progress'
            ? 'progress'
            : 'none',
      hintRevealedCount: Number(detail.hintRevealedCount || 0),
      solutionRevealed: Boolean(detail.solutionRevealed),
      attemptCount: Number(detail.attemptCount || 0),
      lastSeenAt: Number(detail.lastSeenAt || Date.now()),
    };
  }
  return out;
}

function runBootstrapMigration(uid: string): void {
  const migrationKey = `howlearn-cloud-migration-v${MIGRATION_VERSION}:${uid}`;
  if (localStorage.getItem(migrationKey)) return;

  const now = Date.now();
  const progressById = readProgressSnapshotById();
  for (const [problemId, snapshot] of Object.entries(progressById)) {
    enqueueSyncPatch('progress', problemId, {
      status: snapshot.status,
      hintRevealedCount: snapshot.hintRevealedCount,
      solutionRevealed: snapshot.solutionRevealed,
      attemptCount: snapshot.attemptCount,
      lastSeenAt: snapshot.lastSeenAt,
    });
  }

  const bookmarks = parseJson<{ byId?: Record<string, { ts?: number }> }>(
    localStorage.getItem(STORAGE_KEYS.BOOKMARK),
    { byId: {} },
  );
  for (const [problemId, entry] of Object.entries(bookmarks.byId ?? {})) {
    enqueueSyncPatch('bookmarks', problemId, {
      bookmarked: true,
      ts: Number(entry?.ts || now),
    });
  }

  const wrongStore = parseJson<{ byId?: Record<string, { entries?: Array<{ ts?: number }> }> }>(
    localStorage.getItem(STORAGE_KEYS.WRONG_NOTE),
    { byId: {} },
  );
  for (const [problemId, bucket] of Object.entries(wrongStore.byId ?? {})) {
    const entries = bucket?.entries ?? [];
    if (entries.length === 0) continue;
    const lastWrongAt = Number(entries[0]?.ts || now);
    enqueueSyncPatch('wrongSummary', problemId, {
      wrongCount: entries.length,
      lastWrongAt,
      isRepeatWrong: entries.length >= 2,
    });
  }

  const focusHistory = parseJson<{ byDate?: Record<string, number> }>(
    localStorage.getItem(STORAGE_KEYS.FOCUS_HISTORY),
    { byDate: {} },
  );
  for (const [dateKey, totalMs] of Object.entries(focusHistory.byDate ?? {})) {
    enqueueSyncPatch('focusDaily', dateKey, {
      dateKey,
      totalMs: Math.max(0, Number(totalMs || 0)),
    });
  }

  localStorage.setItem(migrationKey, String(now));
}

export async function flushQueue(options?: { immediate?: boolean }): Promise<void> {
  if (!isFirebaseSyncEnabled()) return;
  hydrateRetryQueue();
  if (queue.size === 0 || flushing) return;

  if (options?.immediate && flushTimer != null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }

  const db = getClientDb();
  if (!db) return;
  const uid = await ensureAnonymousUid();
  if (!uid) return;

  flushing = true;
  try {
    await flushInternal(db, uid);
    resetBackoffDelay();
  } catch (error) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('howlearn-sync-last-error', String((error as { message?: string })?.message || error));
    }
    console.error('[firebase-sync] flush failed', error);
    persistRetryQueue();
    if (isQuotaOrBusyError(error)) {
      increaseBackoffDelay();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('howlearn-sync-alert:last-resource-exhausted-at', String(Date.now()));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('howlearn-sync-resource-exhausted'));
      }
    } else {
      dynamicFlushDelayMs = Math.max(FLUSH_DELAY_MS, Math.floor(dynamicFlushDelayMs * 1.2));
      persistBackoffDelay();
    }
    scheduleFlush(dynamicFlushDelayMs);
  } finally {
    flushing = false;
  }
}

export function enqueueSyncPatch(
  collection: SyncCollection,
  docId: string,
  patch: Record<string, unknown>,
  options?: { increments?: Record<string, number> },
): void {
  if (!isFirebaseSyncEnabled()) return;
  const safeDocId = sanitizeDocId(docId);
  if (!safeDocId) return;

  bindLifecycleListeners();

  const key = queueKey(collection, safeDocId);
  const prev = queue.get(key);
  const base = prev?.data ?? {};
  const prevIncrements = prev?.increments ?? {};
  const mergedIncrements: Record<string, number> = { ...prevIncrements };
  for (const [field, delta] of Object.entries(options?.increments ?? {})) {
    if (!Number.isFinite(delta) || delta === 0) continue;
    mergedIncrements[field] = Number(mergedIncrements[field] || 0) + delta;
  }
  queue.set(key, {
    collection,
    docId: safeDocId,
    data: {
      ...base,
      ...patch,
      updatedAt: Date.now(),
    },
    increments: mergedIncrements,
  });

  if (collection === 'wrongSummary' && typeof localStorage !== 'undefined') {
    const cache = parseJson<{ v?: number; byId?: Record<string, Record<string, unknown>> }>(
      localStorage.getItem(WRONG_SUMMARY_CACHE_KEY),
      { v: 1, byId: {} },
    );
    const byId = cache.byId ?? {};
    const current = byId[safeDocId] ?? {};
    const wrongCountDelta = Number(mergedIncrements.wrongCount || 0);
    const nextWrongCount =
      'wrongCount' in patch
        ? Math.max(Number(patch.wrongCount || 0), Number(current.wrongCount || 0) + wrongCountDelta)
        : Math.max(0, Number(current.wrongCount || 0) + wrongCountDelta);
    byId[safeDocId] = {
      ...current,
      ...patch,
      wrongCount: nextWrongCount,
      updatedAt: Date.now(),
    };
    localStorage.setItem(WRONG_SUMMARY_CACHE_KEY, JSON.stringify({ v: 1, byId }));
  }

  if (collection === 'progress' && typeof localStorage !== 'undefined') {
    const cache = parseJson<{ v?: number; byId?: Record<string, Record<string, unknown>> }>(
      localStorage.getItem(PROGRESS_SUMMARY_CACHE_KEY),
      { v: 1, byId: {} },
    );
    const byId = cache.byId ?? {};
    byId[safeDocId] = {
      ...(byId[safeDocId] ?? {}),
      ...patch,
      updatedAt: Date.now(),
    };
    localStorage.setItem(PROGRESS_SUMMARY_CACHE_KEY, JSON.stringify({ v: 1, byId }));
  }

  if (collection === 'focusDaily' && typeof localStorage !== 'undefined') {
    const cache = parseJson<{ v?: number; byDate?: Record<string, number> }>(
      localStorage.getItem(FOCUS_DAILY_CACHE_KEY),
      { v: 1, byDate: {} },
    );
    const byDate = cache.byDate ?? {};
    const prevMs = Math.max(0, Number(byDate[safeDocId] || 0));
    const nextMs = Number(patch.totalMs || 0);
    const nextSafeMs = Math.max(prevMs, Math.max(0, nextMs));
    byDate[safeDocId] = nextSafeMs;
    localStorage.setItem(FOCUS_DAILY_CACHE_KEY, JSON.stringify({ v: 1, byDate }));
    const deltaMs = nextSafeMs - prevMs;
    if (deltaMs > 0) {
      const monthKey = toMonthKey(safeDocId);
      enqueueSyncPatch(
        'focusMonthly',
        monthKey,
        { monthKey, updatedAt: Date.now() },
        { increments: { totalMs: deltaMs } },
      );
      const monthCache = parseJson<{ v?: number; byMonth?: Record<string, number> }>(
        localStorage.getItem(FOCUS_MONTHLY_CACHE_KEY),
        { v: 1, byMonth: {} },
      );
      const byMonth = monthCache.byMonth ?? {};
      byMonth[monthKey] = Math.max(0, Number(byMonth[monthKey] || 0) + deltaMs);
      localStorage.setItem(FOCUS_MONTHLY_CACHE_KEY, JSON.stringify({ v: 1, byMonth }));
    }
  }
  persistRetryQueue();

  scheduleFlush();
}

export async function bootstrapFirebaseSync(): Promise<void> {
  if (!isFirebaseSyncEnabled()) return;
  bindLifecycleListeners();
  bindAuthListener();
  hydrateRetryQueue();
  hydrateBackoffDelay();
  const uid = await ensureAnonymousUid();
  if (!uid || typeof localStorage === 'undefined') return;
  await syncAfterLogin(uid);
}

if (typeof window !== 'undefined') {
  void bootstrapFirebaseSync();
}
