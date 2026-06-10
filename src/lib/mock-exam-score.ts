/**
 * 수능 수학 문항별 배점
 * 1~2: 2점 | 3~13: 3점 | 14~15: 4점 | 16~17: 2점 | 18~21: 3점 | 22: 4점
 * 23~27: 3점 | 28~30: 4점
 */
export const SAT_MATH_POINTS: Record<number, number> = {
  1: 2,
  2: 2,
  3: 3,
  4: 3,
  5: 3,
  6: 3,
  7: 3,
  8: 3,
  9: 3,
  10: 3,
  11: 3,
  12: 3,
  13: 3,
  14: 4,
  15: 4,
  16: 2,
  17: 2,
  18: 3,
  19: 3,
  20: 3,
  21: 3,
  22: 4,
  23: 3,
  24: 3,
  25: 3,
  26: 3,
  27: 3,
  28: 4,
  29: 4,
  30: 4,
};

export const COMMON_RAW_MAX = Object.entries(SAT_MATH_POINTS)
  .filter(([n]) => Number(n) <= 22)
  .reduce((sum, [, pts]) => sum + pts, 0);

export const ELECTIVE_RAW_MAX = Object.entries(SAT_MATH_POINTS)
  .filter(([n]) => Number(n) > 22)
  .reduce((sum, [, pts]) => sum + pts, 0);

/** 표준점수 환산표(74/26 척도) 조회용 스케일 변환 */
export function scaleRawForConversion(raw: { common: number; elective: number }): {
  common: number;
  elective: number;
} {
  const common =
    COMMON_RAW_MAX > 0
      ? Math.min(74, Math.floor((raw.common * 74) / COMMON_RAW_MAX + 0.5))
      : 0;
  const elective =
    ELECTIVE_RAW_MAX > 0
      ? Math.min(26, Math.floor((raw.elective * 26) / ELECTIVE_RAW_MAX + 0.5))
      : 0;
  return { common, elective };
}

export const MOCK_EXAM_DURATION_MS = 100 * 60 * 1000;

export type ConversionRow = {
  common: number;
  elective: number;
  total: number;
  standard: number;
  percentile: string;
  grade: string;
};

export type GradeCutRow = {
  grade: string;
  minStandard: number;
  percentile: string;
  /** 해당 등급 달성에 필요한 최소 합산 원점수(공통+선택) */
  minTotalRaw: number;
  exampleCommon: number;
  exampleElective: number;
};

export type SessionConversionBundle = {
  examKey: string;
  label: string;
  coefficients: { a: number; b: number; c: number };
  lookup: Record<string, ConversionRow>;
  gradeCuts: GradeCutRow[];
};

type ProbStatExam = {
  key: string;
  label: string;
  coefficients: { a: number; b: number; c: number };
  conversions: ConversionRow[];
};

type ProbStatFile = {
  exams: ProbStatExam[];
};

export function isAnswerCorrect(
  answerType: 'mcq' | 'short',
  userAnswer: string,
  correctAnswer: number,
): boolean {
  const trimmed = userAnswer.trim();
  if (!trimmed) return false;
  if (answerType === 'mcq') {
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) && n === correctAnswer;
  }
  return Number(trimmed) === Number(correctAnswer);
}

export function calcRawScores(
  results: Array<{ number: number; correct: boolean }>,
): { common: number; elective: number; total: number } {
  let common = 0;
  let elective = 0;
  for (const { number, correct } of results) {
    if (!correct) continue;
    const pts = SAT_MATH_POINTS[number] ?? 0;
    if (number <= 22) common += pts;
    else elective += pts;
  }
  return { common, elective, total: common + elective };
}

export function lookupConversion(
  lookup: Record<string, ConversionRow>,
  common: number,
  elective: number,
): ConversionRow | null {
  return lookup[`${common},${elective}`] ?? null;
}

export function buildSessionConversionBundle(
  probStat: ProbStatFile,
  examKey: string,
): SessionConversionBundle | null {
  const exam = probStat.exams.find((e) => e.key === examKey);
  if (!exam) return null;

  const lookup: Record<string, ConversionRow> = {};
  for (const row of exam.conversions) {
    lookup[`${row.common},${row.elective}`] = row;
  }

  const gradeCuts = buildGradeCuts(exam.conversions);

  return {
    examKey: exam.key,
    label: exam.label,
    coefficients: exam.coefficients,
    lookup,
    gradeCuts,
  };
}

function buildGradeCuts(conversions: ConversionRow[]): GradeCutRow[] {
  const byGrade = new Map<string, ConversionRow[]>();
  for (const row of conversions) {
    const list = byGrade.get(row.grade) ?? [];
    list.push(row);
    byGrade.set(row.grade, list);
  }

  const grades = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const cuts: GradeCutRow[] = [];

  for (const grade of grades) {
    const rows = byGrade.get(grade);
    if (!rows?.length) continue;
    const best = rows.reduce((min, row) => (row.standard < min.standard ? row : min));
    const minTotal = rows.reduce((min, row) => (row.total < min.total ? row : min));
    cuts.push({
      grade,
      minStandard: best.standard,
      percentile: best.percentile,
      minTotalRaw: minTotal.total,
      exampleCommon: minTotal.common,
      exampleElective: minTotal.elective,
    });
  }

  return cuts;
}

export type QuestionResult = {
  number: number;
  problemId: string;
  answerType: 'mcq' | 'short';
  points: number;
  userAnswer: string;
  correctAnswer: number;
  correct: boolean;
  earned: number;
};

export function gradeMockExam(
  problems: Array<{
    id: string;
    number: number;
    answerType: 'mcq' | 'short';
    answer: number;
  }>,
  answers: Record<string, string>,
): {
  questions: QuestionResult[];
  raw: { common: number; elective: number; total: number };
} {
  const questions: QuestionResult[] = problems.map((p) => {
    const userAnswer = answers[p.id] ?? '';
    const correct = isAnswerCorrect(p.answerType, userAnswer, p.answer);
    const points = SAT_MATH_POINTS[p.number] ?? 0;
    return {
      number: p.number,
      problemId: p.id,
      answerType: p.answerType,
      points,
      userAnswer,
      correctAnswer: p.answer,
      correct,
      earned: correct ? points : 0,
    };
  });

  const raw = calcRawScores(
    questions.map((q) => ({ number: q.number, correct: q.correct })),
  );

  return { questions, raw };
}
