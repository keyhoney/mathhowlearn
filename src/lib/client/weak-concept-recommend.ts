import { getProblemProgressStatus, makeConceptKey, parseConceptKey } from '../concept-progress';
import { STORAGE_KEYS } from '../storage-keys';

export type WeakConceptProblem = {
  id: string;
  href: string;
  title: string;
  subject: string;
  chapter: string;
  subChapter: string;
  concept: string;
  year: number;
  difficulty: number;
};

export type WeakConceptRecommendation = {
  key: string;
  subject: string;
  chapter: string;
  subChapter: string;
  concept: string;
  score: number;
  wrongCount14d: number;
  incompleteCount: number;
  recentCount: number;
  averageDifficulty: number;
  nextProblems: WeakConceptProblem[];
};

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function buildWeakConceptRecommendations(
  problems: WeakConceptProblem[],
  options?: { now?: number; limit?: number },
): WeakConceptRecommendation[] {
  const now = options?.now ?? Date.now();
  const limit = options?.limit ?? 3;
  const progress = parse<{ byId?: Record<string, string | { status?: string }> }>(
    localStorage.getItem(STORAGE_KEYS.PROBLEM_PROGRESS),
    { byId: {} },
  );
  const wrongStore = parse<{ byId?: Record<string, { entries?: Array<{ ts?: number }> }> }>(
    localStorage.getItem(STORAGE_KEYS.WRONG_NOTE),
    { byId: {} },
  );
  const latestYear = problems.reduce((max, p) => Math.max(max, Number(p.year || 0)), 0);
  const recentMinYear = latestYear > 0 ? latestYear - 2 : 0;
  const last14d = now - 1000 * 60 * 60 * 24 * 14;
  const byConcept = new Map<string, WeakConceptProblem[]>();

  for (const problem of problems) {
    const key = makeConceptKey(problem.subject, problem.chapter, problem.subChapter, problem.concept);
    const bucket = byConcept.get(key) ?? [];
    bucket.push(problem);
    byConcept.set(key, bucket);
  }

  return Array.from(byConcept.entries())
    .map(([key, rows]) => {
      const wrongCount14d = rows.reduce((sum, row) => {
        const entries = wrongStore.byId?.[row.id]?.entries ?? [];
        return sum + entries.filter((entry) => Number(entry?.ts || 0) >= last14d).length;
      }, 0);
      const incomplete = rows.filter(
        (row) => getProblemProgressStatus(progress.byId ?? {}, row.id) !== 'done',
      );
      const recentCount = rows.filter((row) => Number(row.year || 0) >= recentMinYear).length;
      const averageDifficulty =
        rows.reduce((sum, row) => sum + Math.max(1, Math.min(5, Number(row.difficulty || 3))), 0) /
        Math.max(1, rows.length);
      const incompleteCount = incomplete.length;
      const score = wrongCount14d * 12 + incompleteCount * 2 + recentCount * 1.5 + averageDifficulty;
      const parsed = parseConceptKey(key);
      return {
        key,
        ...parsed,
        score,
        wrongCount14d,
        incompleteCount,
        recentCount,
        averageDifficulty,
        nextProblems: incomplete
          .sort((a, b) => {
            if (b.year !== a.year) return b.year - a.year;
            return b.difficulty - a.difficulty;
          })
          .slice(0, 3),
      };
    })
    .filter((item) => item.score > 0 && item.nextProblems.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
