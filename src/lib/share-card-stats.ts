import type { ConceptIndexEntry } from './concept-progress';

export type ShareProgressDetail = {
  status?: string;
  lastSeenAt?: number;
};

export type ShareWrongEntry = { ts?: number };

export type ShareCardStatsInput = {
  conceptIndex: Record<string, ConceptIndexEntry>;
  progressById: Record<string, string | ShareProgressDetail>;
  wrongById: Record<string, { entries?: ShareWrongEntry[] }>;
  focusByDate?: Record<string, number>;
  currentStreak?: number;
  siteTitle: string;
  siteUrl: string;
  now?: number;
};

export type ShareCardViewModel = {
  monthLabel: string;
  monthDoneCount: number;
  monthFocusLabel: string;
  currentStreak: number;
  strengthLabel: string;
  weaknessLabel: string;
  strengthIsFallback: boolean;
  weaknessIsFallback: boolean;
  hasEnoughData: boolean;
  headline: string;
  siteTitle: string;
  siteUrl: string;
};

function getMonthRange(now: number): { start: number; end: number; label: string } {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  return { start, end, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월` };
}

function getProgressStatus(item: string | ShareProgressDetail | undefined): string {
  if (!item) return 'none';
  return typeof item === 'string' ? item : (item.status ?? 'none');
}

function getLastSeenAt(item: string | ShareProgressDetail | undefined): number {
  if (!item || typeof item === 'string') return 0;
  return Number(item.lastSeenAt || 0);
}

export function buildProblemConceptKeyMap(
  conceptIndex: Record<string, ConceptIndexEntry>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, entry] of Object.entries(conceptIndex)) {
    for (const problemId of entry.problemIds) {
      map[problemId] = key;
    }
  }
  return map;
}

export function formatConceptShareLabel(entry: ConceptIndexEntry): string {
  const concept = entry.concept.trim();
  const subChapter = entry.subChapter.replace(/^[A-Z]\.\s*/, '').trim();
  if (!concept) return subChapter || entry.chapter;
  const compactSub = subChapter.replace(/\s+/g, '');
  const compactConcept = concept.replace(/\s+/g, '');
  if (
    !subChapter ||
    subChapter.includes(concept) ||
    concept.includes(subChapter) ||
    compactSub.includes(compactConcept) ||
    compactConcept.includes(compactSub)
  ) {
    return concept;
  }
  if (concept.length >= 8) return concept;
  return `${subChapter} · ${concept}`;
}

function formatFocusMinutes(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}시간 ${mins}분`;
  return `${mins}분`;
}

function countMonthlyDone(
  progressById: Record<string, string | ShareProgressDetail>,
  monthStart: number,
  monthEnd: number,
): number {
  let count = 0;
  for (const item of Object.values(progressById)) {
    if (getProgressStatus(item) !== 'done') continue;
    const seenAt = getLastSeenAt(item);
    if (seenAt >= monthStart && seenAt <= monthEnd) count += 1;
  }
  return count;
}

function sumMonthlyFocus(
  focusByDate: Record<string, number>,
  monthStart: number,
  monthEnd: number,
): number {
  let total = 0;
  for (const [dateKey, ms] of Object.entries(focusByDate)) {
    const ts = new Date(`${dateKey}T12:00:00`).getTime();
    if (ts >= monthStart && ts <= monthEnd) total += Number(ms) || 0;
  }
  return total;
}

function scoreConceptsByDone(
  conceptIndex: Record<string, ConceptIndexEntry>,
  progressById: Record<string, string | ShareProgressDetail>,
  filter?: (seenAt: number, status: string) => boolean,
): Array<{ key: string; score: number; label: string }> {
  const scores = new Map<string, number>();
  for (const [key, entry] of Object.entries(conceptIndex)) {
    let done = 0;
    for (const problemId of entry.problemIds) {
      const item = progressById[problemId];
      const status = getProgressStatus(item);
      const seenAt = getLastSeenAt(item);
      if (status !== 'done') continue;
      if (filter && !filter(seenAt, status)) continue;
      done += 1;
    }
    if (done > 0) {
      scores.set(key, done);
    }
  }
  return [...scores.entries()]
    .map(([key, score]) => ({
      key,
      score,
      label: formatConceptShareLabel(conceptIndex[key]),
    }))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'ko'));
}

function scoreConceptsByWrong(
  conceptIndex: Record<string, ConceptIndexEntry>,
  wrongById: Record<string, { entries?: ShareWrongEntry[] }>,
  problemConceptMap: Record<string, string>,
  filter?: (ts: number) => boolean,
): Array<{ key: string; score: number; label: string }> {
  const scores = new Map<string, number>();
  for (const [problemId, bucket] of Object.entries(wrongById)) {
    const conceptKey = problemConceptMap[problemId];
    if (!conceptKey) continue;
    for (const entry of bucket.entries ?? []) {
      const ts = Number(entry.ts || 0);
      if (filter && !filter(ts)) continue;
      scores.set(conceptKey, (scores.get(conceptKey) ?? 0) + 1);
    }
  }
  return [...scores.entries()]
    .map(([key, score]) => ({
      key,
      score,
      label: formatConceptShareLabel(conceptIndex[key]),
    }))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'ko'));
}

function pickTopLabel(
  rows: Array<{ label: string }>,
  fallback: string,
): { label: string; isFallback: boolean } {
  if (rows.length > 0) return { label: rows[0].label, isFallback: false };
  return { label: fallback, isFallback: true };
}

export function computeShareCardStats(input: ShareCardStatsInput): ShareCardViewModel {
  const now = input.now ?? Date.now();
  const { start, end, label: monthLabel } = getMonthRange(now);
  const focusByDate = input.focusByDate ?? {};
  const problemConceptMap = buildProblemConceptKeyMap(input.conceptIndex);

  const monthDoneCount = countMonthlyDone(input.progressById, start, end);
  const monthFocusMs = sumMonthlyFocus(focusByDate, start, end);
  const currentStreak = Math.max(0, input.currentStreak ?? 0);

  const monthlyStrength = scoreConceptsByDone(input.conceptIndex, input.progressById, (seenAt) =>
    seenAt >= start && seenAt <= end,
  );
  const allTimeStrength = scoreConceptsByDone(input.conceptIndex, input.progressById);
  const strengthPick = pickTopLabel(
    monthlyStrength,
    pickTopLabel(allTimeStrength, '아직 기록 없음').label,
  );
  const strengthIsFallback = monthlyStrength.length === 0 && allTimeStrength.length === 0;

  const monthlyWeakness = scoreConceptsByWrong(
    input.conceptIndex,
    input.wrongById,
    problemConceptMap,
    (ts) => ts >= start && ts <= end,
  );
  const allTimeWeakness = scoreConceptsByWrong(
    input.conceptIndex,
    input.wrongById,
    problemConceptMap,
  );
  const weaknessPick = pickTopLabel(
    monthlyWeakness,
    pickTopLabel(allTimeWeakness, '아직 기록 없음').label,
  );
  const weaknessIsFallback = monthlyWeakness.length === 0 && allTimeWeakness.length === 0;

  const hasEnoughData =
    monthDoneCount > 0 || currentStreak > 0 || monthFocusMs > 0 || !strengthIsFallback || !weaknessIsFallback;

  return {
    monthLabel,
    monthDoneCount,
    monthFocusLabel: formatFocusMinutes(monthFocusMs),
    currentStreak,
    strengthLabel: strengthPick.label,
    weaknessLabel: weaknessPick.label,
    strengthIsFallback,
    weaknessIsFallback,
    hasEnoughData,
    headline: `이번 달 ${monthDoneCount}문제 완료`,
    siteTitle: input.siteTitle,
    siteUrl: input.siteUrl,
  };
}
