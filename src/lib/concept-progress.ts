export type ConceptStatus = 'conquered' | 'in-progress' | 'not-started';

export type ConceptIndexEntry = {
  subject: string;
  chapter: string;
  subChapter: string;
  concept: string;
  problemIds: string[];
};

export type ConceptProgressItem = ConceptIndexEntry & {
  key: string;
  totalProblems: number;
  doneCount: number;
  progressCount: number;
  status: ConceptStatus;
  nextProblemId: string | null;
};

const CONCEPT_KEY_SEP = '\u001f';

export function makeConceptKey(
  subject: string,
  chapter: string,
  subChapter: string,
  concept: string,
): string {
  return [subject, chapter, subChapter, concept].join(CONCEPT_KEY_SEP);
}

export function parseConceptKey(key: string): {
  subject: string;
  chapter: string;
  subChapter: string;
  concept: string;
} {
  const [subject = '', chapter = '', subChapter = '', concept = ''] = key.split(CONCEPT_KEY_SEP);
  return { subject, chapter, subChapter, concept };
}

export function getProblemProgressStatus(
  progressById: Record<string, string | { status?: string }>,
  problemId: string,
): 'none' | 'progress' | 'done' {
  const item = progressById[problemId];
  const status = typeof item === 'string' ? item : item?.status ?? 'none';
  if (status === 'done' || status === 'progress') return status;
  return 'none';
}

export function resolveConceptStatus(
  doneCount: number,
  progressCount: number,
  totalProblems: number,
): ConceptStatus {
  if (totalProblems > 0 && doneCount >= totalProblems) return 'conquered';
  if (doneCount > 0 || progressCount > 0) return 'in-progress';
  return 'not-started';
}

export function buildConceptIndex(
  problems: Array<{
    id: string;
    subject: string;
    chapter: string;
    subChapter: string;
    concept: string;
  }>,
): Record<string, ConceptIndexEntry> {
  const index: Record<string, ConceptIndexEntry> = {};

  for (const problem of problems) {
    const key = makeConceptKey(
      problem.subject,
      problem.chapter,
      problem.subChapter,
      problem.concept,
    );
    if (!index[key]) {
      index[key] = {
        subject: problem.subject,
        chapter: problem.chapter,
        subChapter: problem.subChapter,
        concept: problem.concept,
        problemIds: [],
      };
    }
    index[key].problemIds.push(problem.id);
  }

  for (const entry of Object.values(index)) {
    entry.problemIds.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  return index;
}

export function summarizeConceptProgress(
  conceptIndex: Record<string, ConceptIndexEntry>,
  progressById: Record<string, string | { status?: string }>,
): ConceptProgressItem[] {
  return Object.entries(conceptIndex)
    .map(([key, entry]) => {
      let doneCount = 0;
      let progressCount = 0;
      let nextProblemId: string | null = null;

      for (const problemId of entry.problemIds) {
        const status = getProblemProgressStatus(progressById, problemId);
        if (status === 'done') doneCount += 1;
        else if (status === 'progress') progressCount += 1;
        if (!nextProblemId && status !== 'done') nextProblemId = problemId;
      }

      const totalProblems = entry.problemIds.length;
      return {
        key,
        ...entry,
        totalProblems,
        doneCount,
        progressCount,
        status: resolveConceptStatus(doneCount, progressCount, totalProblems),
        nextProblemId,
      };
    })
    .sort((a, b) => {
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject, 'ko');
      if (a.chapter !== b.chapter) return a.chapter.localeCompare(b.chapter, 'ko');
      if (a.subChapter !== b.subChapter) return a.subChapter.localeCompare(b.subChapter, 'ko');
      return a.concept.localeCompare(b.concept, 'ko');
    });
}

export function summarizeConceptTotals(items: ConceptProgressItem[]): {
  totalConcepts: number;
  conqueredCount: number;
  inProgressCount: number;
  notStartedCount: number;
} {
  let conqueredCount = 0;
  let inProgressCount = 0;
  let notStartedCount = 0;
  for (const item of items) {
    if (item.status === 'conquered') conqueredCount += 1;
    else if (item.status === 'in-progress') inProgressCount += 1;
    else notStartedCount += 1;
  }
  return {
    totalConcepts: items.length,
    conqueredCount,
    inProgressCount,
    notStartedCount,
  };
}

export function buildConceptListHref(item: ConceptProgressItem): string {
  const params = new URLSearchParams({
    subject: item.subject,
    chapter: item.chapter,
    subChapter: item.subChapter,
    concept: item.concept,
  });
  return `/problems?${params.toString()}`;
}

export function buildConceptActionHref(item: ConceptProgressItem): string {
  if (item.status === 'conquered') return buildConceptListHref(item);
  if (item.nextProblemId) return `/problems/${encodeURIComponent(item.nextProblemId)}`;
  return buildConceptListHref(item);
}
