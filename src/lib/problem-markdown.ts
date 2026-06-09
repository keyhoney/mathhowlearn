import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { rehypeKatexSafeOptions } from './katex-shared';
import { rehypeImgPerformance } from './rehype-img-performance';
import {
  findMcqChoiceBlockRange,
  normalizeMathMarkdownSource,
  parseMcqChoiceBodies,
} from './math-mdx-normalize';
import { remarkDfrac } from './remark-dfrac';
import { remarkExamBogi } from './remark-exam-bogi';
import { remarkExamConditions } from './remark-exam-conditions';

let processorPromise: ReturnType<typeof createMarkdownProcessor> | null = null;

async function getProcessor() {
  if (!processorPromise) {
    processorPromise = createMarkdownProcessor({
      remarkPlugins: [remarkExamConditions, remarkExamBogi, remarkMath, remarkDfrac],
      rehypePlugins: [[rehypeKatex, rehypeKatexSafeOptions], rehypeImgPerformance],
      gfm: true,
    });
  }
  return processorPromise;
}

export async function renderTrustedMarkdown(markdown: string): Promise<string> {
  const trimmed = normalizeMathMarkdownSource(markdown).trim();
  if (!trimmed) return '';
  const processor = await getProcessor();
  const { code } = await processor.render(trimmed, {});
  return code;
}

/** `## 문제` 다음부터 다음 `## 제목` 전까지(힌트·풀이 제외). */
export function extractProblemStatementMarkdown(body: string): string {
  const marker = '## 문제';
  const idx = body.indexOf(marker);
  if (idx >= 0) {
    const after = idx + marker.length;
    const rest = body.slice(after);
    const next = rest.search(/\n## [^\n#]/);
    if (next < 0) return rest.trim();
    return rest.slice(0, next).trim();
  }
  let b = body;
  const cuts: number[] = [];
  for (const h of ['힌트', '모범 풀이', '풀이']) {
    const i = b.indexOf(`## ${h}`);
    if (i >= 0) cuts.push(i);
  }
  if (cuts.length === 0) return b.trim();
  return b.slice(0, Math.min(...cuts)).trim();
}

/** 객관식 선지(①, ②...)를 파싱해 문제 본문/선지로 분리한다. 여러 줄에 걸친 선지도 지원한다. */
export function extractMcqChoices(problemMarkdown: string): {
  statement: string;
  choices: string[];
} {
  const rawLines = problemMarkdown.split('\n');
  const range = findMcqChoiceBlockRange(rawLines);

  if (!range) {
    return { statement: problemMarkdown.trim(), choices: [] };
  }

  const choiceBlockText = rawLines
    .slice(range.start, range.end + 1)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
  const choices = parseMcqChoiceBodies(choiceBlockText);

  const statement = [...rawLines.slice(0, range.start), ...rawLines.slice(range.end + 1)]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { statement, choices };
}

export function extractSection(body: string, headings: string[]): string {
  for (const heading of headings) {
    const marker = `## ${heading}`;
    const start = body.indexOf(marker);
    if (start < 0) continue;
    const next = body.indexOf('\n## ', start + marker.length);
    const chunk = body.slice(start + marker.length, next < 0 ? undefined : next).trim();
    if (chunk) return chunk;
  }
  return '';
}

/** 같은 제목(예: `## 힌트`)이 여러 번 등장할 때 순서대로 모두 추출. */
export function extractSections(body: string, headings: string[]): string[] {
  const wanted = new Set(headings.map((h) => h.trim()));
  const headingRegex = /^##\s+(.+)$/gm;
  const matches: Array<{ title: string; start: number; end: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(body))) {
    matches.push({
      title: match[1].trim(),
      start: match.index,
      end: headingRegex.lastIndex,
    });
  }

  const chunks: string[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    if (!wanted.has(current.title)) continue;
    const nextStart = i + 1 < matches.length ? matches[i + 1].start : body.length;
    const chunk = body.slice(current.end, nextStart).trim();
    if (chunk) chunks.push(chunk);
  }

  return chunks;
}

export function buildHintSteps(hintText: string): string[] {
  if (!hintText) return [];
  const stripStepPrefix = (value: string) =>
    value.replace(/^STEP\s*\d+[:.)\-\s]*/i, '').trim();

  const byStepHeading = hintText
    .split(/\n(?=STEP\s*\d+[:.)\-\s])/i)
    .map((v) => v.trim())
    .filter(Boolean);
  if (byStepHeading.length > 1) return byStepHeading.map(stripStepPrefix).filter(Boolean);
  return hintText
    .split(/\n{2,}/)
    .map((v) => v.trim())
    .map(stripStepPrefix)
    .filter(Boolean);
}
