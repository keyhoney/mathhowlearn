import fs from 'node:fs/promises';
import path from 'node:path';

type ProblemDoc = {
  id: string;
  collection: 'problems' | 'essay-problems';
  data: Record<string, unknown>;
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
    docs.push({ id, collection, data });
  }

  for (const key of Object.keys(registry)) {
    if (!seenIds.has(key)) {
      errors.push(`${collection}: _metadata.json key "${key}" has no matching ${key}.mdx`);
    }
  }

  return { docs, errors };
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
  if (!isInteger(d.difficulty)) {
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
    ...docs.flatMap((doc) => [
      ...validateCommon(doc),
      ...validateProblem(doc),
      ...validateEssay(doc),
    ]),
  ];

  if (errors.length > 0) {
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }

  console.log(`problem validation passed: ${docs.length} documents`);
}

main().catch((error) => {
  console.error('problem validation failed');
  console.error(error);
  process.exit(1);
});
