import type { CollectionEntry } from 'astro:content';

export type ProblemEntry = CollectionEntry<'problems'>;

/** 문제 ID 접미사(01~30) 또는 source에서 문항 번호 추출 */
export function extractQuestionNumber(problem: ProblemEntry): number {
  const fromId = Number.parseInt(problem.id.slice(-2), 10);
  if (Number.isFinite(fromId) && fromId >= 1 && fromId <= 30) return fromId;
  const matched = problem.data.source.match(/(\d+)\s*번(?!.*\d+\s*번)/);
  return matched ? Number.parseInt(matched[1] ?? '', 10) : Number.POSITIVE_INFINITY;
}

/** 회차 키: YYYYMM (예: 202206, 202611) */
export function toMockExamSessionId(problem: ProblemEntry): string {
  const month = String(problem.data.month).padStart(2, '0');
  return `${problem.data.year}${month}`;
}

export type MockExamSessionMeta = {
  sessionId: string;
  year: number;
  month: number;
  label: string;
  problemIds: string[];
};

export function buildMockExamSessions(problems: ProblemEntry[]): MockExamSessionMeta[] {
  const grouped = new Map<string, ProblemEntry[]>();

  for (const problem of problems) {
    const sessionId = toMockExamSessionId(problem);
    if (!grouped.has(sessionId)) grouped.set(sessionId, []);
    grouped.get(sessionId)!.push(problem);
  }

  const sessions: MockExamSessionMeta[] = [];

  for (const [sessionId, items] of grouped) {
    if (items.length !== 30) continue;
    const sorted = [...items].sort((a, b) => extractQuestionNumber(a) - extractQuestionNumber(b));
    const numbers = sorted.map(extractQuestionNumber);
    if (numbers.some((n, i) => n !== i + 1)) continue;

    const { year, month } = sorted[0]!.data;
    const monthLabel = month === 11 ? '수능' : `${month}월 모의평가`;
    sessions.push({
      sessionId,
      year,
      month,
      label: `${year}학년도 ${monthLabel}`,
      problemIds: sorted.map((p) => p.id),
    });
  }

  return sessions.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    const monthOrder = (m: number) => (m === 11 ? 0 : m === 9 ? 1 : m === 6 ? 2 : m);
    return monthOrder(a.month) - monthOrder(b.month);
  });
}

/** prob-stat-conversions.json exam key (예: 202206 → 20226sat) */
export function toConversionExamKey(year: number, month: number): string {
  return `${year}${month}sat`;
}
