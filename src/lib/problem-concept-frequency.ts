export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;
export type AnswerType = 'mcq' | 'short';
export type ExamType = '수능' | '모의평가';
export type ExamScope = 'mock' | 'csat' | 'all';

export const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = [1, 2, 3, 4, 5];
export const ANSWER_TYPES: readonly AnswerType[] = ['short', 'mcq'];

export type ConceptFrequencyRow = {
  id: string;
  source: string;
  subject: string;
  chapter: string;
  subChapter: string;
  concept: string;
  year: number;
  month: number;
  examType: ExamType;
  difficulty: DifficultyLevel;
  answerType: AnswerType;
};

const MONTH_PRIORITY = new Map<number, number>([
  [11, 0],
  [9, 1],
  [6, 2],
]);

export type ConceptFrequencyTaxonomy = {
  subject: string;
  chapter: string;
  subChapter: string;
  concept: string;
};

export type ConceptFrequencyFilters = {
  taxonomy: ConceptFrequencyTaxonomy;
  examScope: ExamScope;
  yearMin: number;
  yearMax: number;
};

export type ConceptFrequencyMatrix = {
  cells: Record<DifficultyLevel, Record<AnswerType, number>>;
  rowTotals: Record<DifficultyLevel, number>;
  colTotals: Record<AnswerType, number>;
  grandTotal: number;
};

function emptyCells(): Record<DifficultyLevel, Record<AnswerType, number>> {
  return {
    1: { mcq: 0, short: 0 },
    2: { mcq: 0, short: 0 },
    3: { mcq: 0, short: 0 },
    4: { mcq: 0, short: 0 },
    5: { mcq: 0, short: 0 },
  };
}

function emptyDifficultyTotals(): Record<DifficultyLevel, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

function emptyAnswerTotals(): Record<AnswerType, number> {
  return { mcq: 0, short: 0 };
}

function normalizeDifficulty(value: number): DifficultyLevel | null {
  const d = Math.trunc(value);
  if (d >= 1 && d <= 5) return d as DifficultyLevel;
  return null;
}

function matchesExamScope(examType: ExamType, scope: ExamScope): boolean {
  if (scope === 'all') return true;
  if (scope === 'mock') return examType === '모의평가';
  return examType === '수능';
}

export function normalizeYearRange(yearMin: number, yearMax: number): { yearMin: number; yearMax: number } {
  const min = Math.trunc(yearMin);
  const max = Math.trunc(yearMax);
  if (min <= max) return { yearMin: min, yearMax: max };
  return { yearMin: max, yearMax: min };
}

export function filterConceptFrequencyRows(
  rows: ConceptFrequencyRow[],
  filters: ConceptFrequencyFilters,
): ConceptFrequencyRow[] {
  const { taxonomy, examScope } = filters;
  const { yearMin, yearMax } = normalizeYearRange(filters.yearMin, filters.yearMax);

  return rows.filter((row) => {
    if (row.subject !== taxonomy.subject) return false;
    if (row.chapter !== taxonomy.chapter) return false;
    if (row.subChapter !== taxonomy.subChapter) return false;
    if (row.concept !== taxonomy.concept) return false;
    if (row.year < yearMin || row.year > yearMax) return false;
    if (!matchesExamScope(row.examType, examScope)) return false;
    return true;
  });
}

export function buildConceptFrequencyMatrix(rows: ConceptFrequencyRow[]): ConceptFrequencyMatrix {
  const cells = emptyCells();
  const rowTotals = emptyDifficultyTotals();
  const colTotals = emptyAnswerTotals();
  let grandTotal = 0;

  for (const row of rows) {
    const difficulty = normalizeDifficulty(row.difficulty);
    if (!difficulty) continue;
    const answerType = row.answerType === 'mcq' || row.answerType === 'short' ? row.answerType : null;
    if (!answerType) continue;

    cells[difficulty][answerType] += 1;
    rowTotals[difficulty] += 1;
    colTotals[answerType] += 1;
    grandTotal += 1;
  }

  return { cells, rowTotals, colTotals, grandTotal };
}

export function buildConceptFrequencyResult(
  rows: ConceptFrequencyRow[],
  filters: ConceptFrequencyFilters,
): ConceptFrequencyMatrix {
  return buildConceptFrequencyMatrix(filterConceptFrequencyRows(rows, filters));
}

/** 최신 시험·문항 순 (문제 목록과 동일 우선순위) */
export function sortConceptFrequencyRows(rows: ConceptFrequencyRow[]): ConceptFrequencyRow[] {
  return [...rows].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    const aMonthOrder = MONTH_PRIORITY.get(a.month) ?? 999;
    const bMonthOrder = MONTH_PRIORITY.get(b.month) ?? 999;
    if (aMonthOrder !== bMonthOrder) return aMonthOrder - bMonthOrder;
    if (a.month !== b.month) return b.month - a.month;
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    return a.source.localeCompare(b.source, 'ko');
  });
}
