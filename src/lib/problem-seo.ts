import { SAT_MATH_POINTS } from './mock-exam-score';

export type ProblemSeoInput = {
  id: string;
  source: string;
  year: number;
  month: number;
  examType: string;
  subject: string;
  concept: string;
  hintCount: number;
};

export function extractProblemQuestionNumber(id: string, source: string): number {
  const fromId = Number.parseInt(id.slice(-2), 10);
  if (Number.isFinite(fromId) && fromId >= 1 && fromId <= 30) return fromId;
  const matched = source.match(/(\d+)\s*번(?!.*\d+\s*번)/);
  return matched ? Number.parseInt(matched[1] ?? '', 10) : 0;
}

export function buildProblemPageTitle(input: ProblemSeoInput): string {
  const number = extractProblemQuestionNumber(input.id, input.source);
  return `${input.year} ${input.examType} 수학 ${number}번 단계별 힌트·해설 | ${input.concept}`;
}

export function buildProblemPageDescription(input: ProblemSeoInput): string {
  const number = extractProblemQuestionNumber(input.id, input.source);
  const points = SAT_MATH_POINTS[number];
  const pointsLabel = points ? `(${points}점)` : '';
  const hintPrefix = input.hintCount > 0 ? `힌트 ${input.hintCount}개와 ` : '';
  return `${input.year}년 ${input.month}월 ${input.examType} 수학 ${number}번${pointsLabel} ${input.concept}(${input.subject}). ${hintPrefix}단계별 해설과 정답 확인.`;
}
