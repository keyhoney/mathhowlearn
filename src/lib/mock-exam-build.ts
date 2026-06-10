import type { CollectionEntry } from 'astro:content';
import probStatRaw from '../data/prob-stat-conversions.json';
import {
  extractMcqChoices,
  extractProblemStatementMarkdown,
  renderTrustedMarkdown,
} from './problem-markdown';
import { extractQuestionNumber, toConversionExamKey } from './exam-session';
import {
  buildSessionConversionBundle,
  SAT_MATH_POINTS,
  type SessionConversionBundle,
} from './mock-exam-score';
import type { MockExamProblemPayload } from '../components/exam/MockExamApp';

type ProblemEntry = CollectionEntry<'problems'>;

export async function buildMockExamProblemPayload(
  entry: ProblemEntry,
): Promise<MockExamProblemPayload> {
  const rawProblemMd = extractProblemStatementMarkdown(entry.body);
  const { statement: problemMd, choices: mcqChoices } = extractMcqChoices(rawProblemMd);
  const problemHtml = await renderTrustedMarkdown(problemMd);
  const choicesHtml =
    mcqChoices.length > 0
      ? await Promise.all(
          mcqChoices.map(async (choice) => {
            const html = await renderTrustedMarkdown(choice);
            return html.replace(/^<p>/, '').replace(/<\/p>\s*$/, '');
          }),
        )
      : [];

  const number = extractQuestionNumber(entry);

  return {
    id: entry.id,
    number,
    answerType: entry.data.answerType,
    answer: entry.data.answer,
    points: SAT_MATH_POINTS[number] ?? 0,
    statementHtml: problemHtml,
    choicesHtml,
  };
}

export function buildConversionForSession(
  year: number,
  month: number,
): SessionConversionBundle | null {
  const examKey = toConversionExamKey(year, month);
  return buildSessionConversionBundle(
    probStatRaw as Parameters<typeof buildSessionConversionBundle>[0],
    examKey,
  );
}
