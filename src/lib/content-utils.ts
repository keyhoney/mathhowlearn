import { getCollection, type CollectionEntry } from 'astro:content';

export type ProblemSubjectChapterTree = Record<string, Record<string, Record<string, string[]>>>;

type WithSubjectChapterConcept = {
  data: { subject: string; chapter: string; subChapter: string; concept: string };
};

export function buildProblemSubjectChapterTree(
  problems: WithSubjectChapterConcept[],
): ProblemSubjectChapterTree {
  const bySubject = new Map<string, Map<string, Map<string, Set<string>>>>();
  for (const p of problems) {
    const { subject, chapter, subChapter, concept } = p.data;
    if (!bySubject.has(subject)) bySubject.set(subject, new Map());
    const byChapter = bySubject.get(subject)!;
    if (!byChapter.has(chapter)) byChapter.set(chapter, new Map());
    const bySubChapter = byChapter.get(chapter)!;
    if (!bySubChapter.has(subChapter)) bySubChapter.set(subChapter, new Set());
    bySubChapter.get(subChapter)!.add(concept);
  }
  const out: ProblemSubjectChapterTree = {};
  const sortedSubjects = Array.from(bySubject.keys()).sort((a, b) => a.localeCompare(b, 'ko'));
  for (const subj of sortedSubjects) {
    const chMap = bySubject.get(subj)!;
    const chapters = Array.from(chMap.keys()).sort((a, b) => a.localeCompare(b, 'ko'));
    out[subj] = {};
    for (const ch of chapters) {
      out[subj][ch] = {};
      const subMap = chMap.get(ch)!;
      const subChapters = Array.from(subMap.keys()).sort((a, b) => a.localeCompare(b, 'ko'));
      for (const subCh of subChapters) {
        out[subj][ch][subCh] = Array.from(subMap.get(subCh)!).sort((a, b) => a.localeCompare(b, 'ko'));
      }
    }
  }
  return out;
}

export function normalizeSubjectChapterConceptParams(
  tree: ProblemSubjectChapterTree,
  subject: string,
  chapter: string,
  subChapter: string,
  concept: string,
): { subject: string; chapter: string; subChapter: string; concept: string } {
  const s = subject.trim();
  let ch = chapter.trim();
  let sub = subChapter.trim();
  let co = concept.trim();
  if (!s || !tree[s]) {
    return { subject: '', chapter: '', subChapter: '', concept: '' };
  }
  const chapters = Object.keys(tree[s]);
  if (!ch || !chapters.includes(ch)) {
    return { subject: s, chapter: '', subChapter: '', concept: '' };
  }
  const subChapters = Object.keys(tree[s][ch] ?? {});
  if (!sub || !subChapters.includes(sub)) {
    return { subject: s, chapter: ch, subChapter: '', concept: '' };
  }
  const concepts = tree[s][ch][sub] ?? [];
  if (!co || !concepts.includes(co)) {
    return { subject: s, chapter: ch, subChapter: sub, concept: '' };
  }
  return { subject: s, chapter: ch, subChapter: sub, concept: co };
}

export async function getPublishedProblems() {
  return await getCollection('problems');
}

export async function getPublishedEssayProblems() {
  return await getCollection('essay-problems');
}

type ProblemTaxonomy = {
  data: {
    source: string;
    subject: string;
    chapter: string;
    subChapter: string;
    concept: string;
    difficulty: number;
    year: number;
    month: number;
    examType: string;
  };
};

export type ProblemOccurrenceStats = {
  totalProblems: number;
  totalExamSessions: number;
  bySubject: { count: number; ratio: number };
  byChapter: { count: number; ratio: number };
  bySubChapter: { count: number; ratio: number };
  byConcept: { count: number; ratio: number };
  byConceptSession: { count: number; ratio: number };
  conceptDifficultyHistogram: Record<1 | 2 | 3 | 4 | 5, number>;
  conceptAverageDifficulty: number;
  conceptModeDifficulty: number;
  conceptRecent3YearsCount: number;
};

export function buildProblemOccurrenceStats<T extends ProblemTaxonomy>(
  target: T,
  problems: T[],
): ProblemOccurrenceStats {
  const totalProblems = Math.max(1, problems.length);
  const bySubjectCount = problems.filter((p) => p.data.subject === target.data.subject).length;
  const byChapterCount = problems.filter(
    (p) =>
      p.data.subject === target.data.subject &&
      p.data.chapter === target.data.chapter,
  ).length;
  const bySubChapterCount = problems.filter(
    (p) =>
      p.data.subject === target.data.subject &&
      p.data.chapter === target.data.chapter &&
      p.data.subChapter === target.data.subChapter,
  ).length;
  const byConcept = problems.filter(
    (p) =>
      p.data.subject === target.data.subject &&
      p.data.chapter === target.data.chapter &&
      p.data.subChapter === target.data.subChapter &&
      p.data.concept === target.data.concept,
  );
  const byConceptCount = byConcept.length;
  const totalExamSessions = Math.max(
    1,
    new Set(problems.map((p) => toExamSessionKey(p.data))).size,
  );
  const byConceptSessionCount = new Set(byConcept.map((p) => toExamSessionKey(p.data))).size;
  const histogram: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const p of byConcept) {
    const d = Number(p.data.difficulty);
    if (d >= 1 && d <= 5) histogram[d as 1 | 2 | 3 | 4 | 5] += 1;
  }
  const safeConceptCount = Math.max(1, byConceptCount);
  const conceptAverageDifficulty =
    byConcept.reduce((acc, p) => acc + Number(p.data.difficulty || 0), 0) / safeConceptCount;
  const conceptModeDifficulty = (Object.entries(histogram) as Array<[`${1 | 2 | 3 | 4 | 5}`, number]>)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return Number(a[0]) - Number(b[0]);
    })[0];
  const latestYear = problems.reduce((max, p) => Math.max(max, Number(p.data.year || 0)), 0);
  const minRecentYear = latestYear > 0 ? latestYear - 2 : 0;
  const conceptRecent3YearsCount = byConcept.filter((p) => Number(p.data.year || 0) >= minRecentYear).length;

  return {
    totalProblems,
    totalExamSessions,
    bySubject: { count: bySubjectCount, ratio: bySubjectCount / totalProblems },
    byChapter: { count: byChapterCount, ratio: byChapterCount / totalProblems },
    bySubChapter: { count: bySubChapterCount, ratio: bySubChapterCount / totalProblems },
    byConcept: { count: byConceptCount, ratio: byConceptCount / totalProblems },
    byConceptSession: {
      count: byConceptSessionCount,
      ratio: byConceptSessionCount / totalExamSessions,
    },
    conceptDifficultyHistogram: histogram,
    conceptAverageDifficulty,
    conceptModeDifficulty: Number(conceptModeDifficulty?.[0] ?? 3),
    conceptRecent3YearsCount,
  };
}

function toExamSessionKey(data: {
  source: string;
  year: number;
  month: number;
  examType: string;
}): string {
  const normalizedSource = String(data.source || '')
    .replace(/\s*\d+\s*번\s*$/u, '')
    .trim();
  return `${data.year}-${data.month}-${data.examType}-${normalizedSource}`;
}

export type ProblemEntry = CollectionEntry<'problems'>;
export type EssayProblemEntry = CollectionEntry<'essay-problems'>;
