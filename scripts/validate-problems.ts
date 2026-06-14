import fs from 'node:fs/promises';
import path from 'node:path';
import {
  findMcqChoiceBlockRange,
  parseMcqChoiceBodies,
} from '../src/lib/math-mdx-normalize';

type ProblemDoc = {
  id: string;
  collection: 'problems' | 'essay-problems';
  data: Record<string, unknown>;
  filePath: string;
  body: string;
};

const ROOT = process.cwd();
const CONTENT_ROOT = path.join(ROOT, 'src', 'content');

function isInteger(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

async function readMdxFiles(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readMdxFiles(fullPath)));
      continue;
    }
    if (
      entry.isFile() &&
      /\.mdx$/i.test(entry.name) &&
      !entry.name.startsWith('_')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

async function loadProblems(
  collection: 'problems' | 'essay-problems',
): Promise<{ docs: ProblemDoc[]; errors: string[] }> {
  const dir = path.join(CONTENT_ROOT, collection);
  const registryPath = path.join(dir, '_metadata.json');
  const errors: string[] = [];

  let registry: Record<string, Record<string, unknown>>;
  try {
    const raw = await fs.readFile(registryPath, 'utf8');
    const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    registry = JSON.parse(cleaned) as Record<string, Record<string, unknown>>;
  } catch {
    errors.push(`${collection}: cannot read or parse _metadata.json`);
    return { docs: [], errors };
  }

  const filePaths = await readMdxFiles(dir);
  const docs: ProblemDoc[] = [];
  const seenIds = new Set<string>();

  for (const filePath of filePaths) {
    const id = path.basename(filePath).replace(/\.mdx$/i, '');
    seenIds.add(id);
    const data = registry[id];
    if (!data) {
      errors.push(`${collection}/${id}: MDX exists but no _metadata.json entry`);
      continue;
    }
    const body = await fs.readFile(filePath, 'utf8');
    docs.push({ id, collection, data, filePath, body });
  }

  for (const key of Object.keys(registry)) {
    if (!seenIds.has(key)) {
      errors.push(`${collection}: _metadata.json key "${key}" has no matching ${key}.mdx`);
    }
  }

  return { docs, errors };
}

function extractSection(body: string, heading: string): string {
  const marker = `## ${heading}`;
  const start = body.indexOf(marker);
  if (start < 0) return '';
  const after = start + marker.length;
  const next = body.indexOf('\n## ', after);
  return body.slice(after, next < 0 ? undefined : next).trim();
}

function hasHeading(body: string, heading: string): boolean {
  return new RegExp(`^##\\s+${heading}\\s*$`, 'm').test(body);
}

function extractQuestionNumber(source: string): number | null {
  const matched = source.match(/(\d+)\s*번(?!.*\d+\s*번)/);
  if (!matched) return null;
  const n = Number.parseInt(matched[1] ?? '', 10);
  return Number.isFinite(n) ? n : null;
}

function validateProblemBody(problem: ProblemDoc): string[] {
  const errors: string[] = [];
  if (problem.collection !== 'problems') return errors;

  if (!hasHeading(problem.body, '문제')) {
    errors.push(`${problem.collection}/${problem.id}: missing ## 문제 section`);
  }
  if (!hasHeading(problem.body, '풀이')) {
    errors.push(`${problem.collection}/${problem.id}: missing ## 풀이 section`);
  }

  if (String(problem.data.answerType) === 'mcq') {
    const problemSection = extractSection(problem.body, '문제');
    const lines = problemSection.split('\n');
    const range = findMcqChoiceBlockRange(lines);
    const choiceBlock = range
      ? lines
          .slice(range.start, range.end + 1)
          .map((line) => line.trim())
          .filter(Boolean)
          .join(' ')
      : '';
    const choices = choiceBlock ? parseMcqChoiceBodies(choiceBlock) : [];
    if (choices.length !== 5) {
      errors.push(
        `${problem.collection}/${problem.id}: mcq problem must contain 5 choices, found ${choices.length}`,
      );
    }
  }

  return errors;
}

function validateDuplicateProblemKeys(problems: ProblemDoc[]): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const problem of problems) {
    if (problem.collection !== 'problems') continue;
    const { source, year, month } = problem.data;
    const questionNumber = extractQuestionNumber(String(source || ''));
    const key = [
      String(year || ''),
      String(month || ''),
      questionNumber == null ? String(source || '').trim() : String(questionNumber),
    ].join(':');
    const prev = seen.get(key);
    if (prev) {
      errors.push(`${problem.collection}/${problem.id}: duplicate problem key with ${prev} (${key})`);
      continue;
    }
    seen.set(key, problem.id);
  }
  return errors;
}

function collectWarnings(problem: ProblemDoc): string[] {
  const warnings: string[] = [];
  const currentYear = new Date().getFullYear();
  const year = Number(problem.data.year || 0);
  if (year > currentYear) {
    warnings.push(`${problem.collection}/${problem.id}: future year ${year}`);
  }
  if (problem.collection === 'problems' && !hasHeading(problem.body, '힌트')) {
    warnings.push(`${problem.collection}/${problem.id}: no ## 힌트 section`);
  }
  return warnings;
}

function validateCommon(problem: ProblemDoc): string[] {
  const errors: string[] = [];
  const d = problem.data;
  const reqStrings = ['source'] as const;
  for (const key of reqStrings) {
    if (typeof d[key] !== 'string' || !(d[key] as string).trim()) {
      errors.push(`${problem.collection}/${problem.id}: missing ${key}`);
    }
  }
  return errors;
}

function validateProblem(problem: ProblemDoc): string[] {
  if (problem.collection !== 'problems') return [];
  const d = problem.data;
  const errors: string[] = [];
  const reqStrings = ['subject', 'chapter', 'subChapter', 'concept'] as const;
  for (const key of reqStrings) {
    if (typeof d[key] !== 'string' || !(d[key] as string).trim()) {
      errors.push(`${problem.collection}/${problem.id}: missing ${key}`);
    }
  }
  for (const key of ['year', 'month', 'difficulty'] as const) {
    if (!isInteger(d[key])) errors.push(`${problem.collection}/${problem.id}: ${key} must be integer`);
  }
  const examType = String(d.examType) === '모평' ? '모의평가' : d.examType;
  if (!['수능', '모의평가', '교육청', '논술'].includes(String(examType))) {
    errors.push(`${problem.collection}/${problem.id}: invalid examType`);
  }
  const answerType = String(d.answerType);
  const answer = d.answer;
  if (!['mcq', 'short'].includes(answerType)) {
    errors.push(`${problem.collection}/${problem.id}: invalid answerType`);
  } else if (!isInteger(answer)) {
    errors.push(`${problem.collection}/${problem.id}: answer must be integer`);
  } else if (answerType === 'mcq' && (answer < 1 || answer > 5)) {
    errors.push(`${problem.collection}/${problem.id}: mcq answer must be 1..5`);
  } else if (answerType === 'short' && (answer < 0 || answer > 999)) {
    errors.push(`${problem.collection}/${problem.id}: short answer must be 0..999`);
  }
  return errors;
}

function validateEssay(problem: ProblemDoc): string[] {
  if (problem.collection !== 'essay-problems') return [];
  const d = problem.data;
  const errors: string[] = [];
  if (!isInteger(d.year)) {
    errors.push(`${problem.collection}/${problem.id}: year must be integer`);
  }
  if (d.difficulty !== undefined && !isInteger(d.difficulty)) {
    errors.push(`${problem.collection}/${problem.id}: difficulty must be integer`);
  }
  if (String(d.examType) !== '논술') {
    errors.push(`${problem.collection}/${problem.id}: examType must be 논술`);
  }
  if (typeof d.university !== 'string' || !(d.university as string).trim()) {
    errors.push(`${problem.collection}/${problem.id}: missing university`);
  }
  if (d.examYear !== undefined && !isInteger(d.examYear)) {
    errors.push(`${problem.collection}/${problem.id}: examYear must be integer`);
  }
  return errors;
}

async function main() {
  const p1 = await loadProblems('problems');
  const p2 = await loadProblems('essay-problems');
  const docs = [...p1.docs, ...p2.docs];

  const errors = [
    ...p1.errors,
    ...p2.errors,
    ...validateDuplicateProblemKeys(docs),
    ...docs.flatMap((doc) => [
      ...validateCommon(doc),
      ...validateProblem(doc),
      ...validateEssay(doc),
      ...validateProblemBody(doc),
    ]),
  ];
  const warnings = docs.flatMap(collectWarnings);

  if (errors.length > 0) {
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }

  for (const warning of warnings) console.warn(`- warning: ${warning}`);
  console.log(`problem validation passed: ${docs.length} documents`);
}

main().catch((error) => {
  console.error('problem validation failed');
  console.error(error);
  process.exit(1);
});
