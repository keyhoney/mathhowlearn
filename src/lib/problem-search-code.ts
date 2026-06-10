import type { SearchResultItem } from './search-result-card';

export type ProblemSearchIndex = {
  problems: Record<string, string>;
  essayProblems: Record<string, string>;
};

/** YYYYMMNN 형식 문제 코드 (예: 20261107) */
export const PROBLEM_SEARCH_CODE_RE = /^\d{8}$/;

export function normalizeProblemSearchCode(query: string): string | null {
  const raw = query.trim();
  return PROBLEM_SEARCH_CODE_RE.test(raw) ? raw : null;
}

export function buildProblemSearchKeywords(
  id: string,
  data: { source: string; year: number; month: number; examType: string },
): string {
  const questionMatch = data.source.match(/(\d+)\s*번/);
  const questionNo = questionMatch?.[1] ?? '';
  const parts = [
    id,
    data.source,
    questionNo ? `${data.year}학년도 ${data.month}월 ${data.examType} ${questionNo}번` : '',
    questionNo ? `${data.year}학년도 ${data.month}월(${data.examType}) ${questionNo}번 문제` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

export function resolveProblemSearch(
  query: string,
  index: ProblemSearchIndex,
): SearchResultItem | null {
  const code = normalizeProblemSearchCode(query);
  if (!code) return null;

  const problemTitle = index.problems[code];
  if (problemTitle) {
    return { url: `/problems/${code}`, meta: { title: problemTitle } };
  }

  const essayTitle = index.essayProblems[code];
  if (essayTitle) {
    return { url: `/essay-problems/${code}`, meta: { title: essayTitle } };
  }

  return null;
}

export function mergeProblemCodeResult(
  query: string,
  index: ProblemSearchIndex,
  records: SearchResultItem[],
): SearchResultItem[] {
  const direct = resolveProblemSearch(query, index);
  if (!direct) return records;

  const rest = records.filter((item) => item.url !== direct.url);
  return [direct, ...rest];
}
