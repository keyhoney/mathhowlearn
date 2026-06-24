import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildProblemPageTitle } from '../src/lib/problem-seo';
import { renderOgPng } from './og-image/render-og-png';

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(ROOT, 'public', 'og', 'auto');

type ProblemMeta = {
  source: string;
  year: number;
  month: number;
  examType: string;
  subject: string;
  concept: string;
  difficulty?: number;
};

type EssayMeta = {
  source: string;
  university: string;
  examYear?: number;
  year?: number;
  examType?: string;
};

async function generateProblems() {
  const raw = (await readFile(path.join(ROOT, 'src/content/problems/_metadata.json'), 'utf8')).replace(
    /^\uFEFF/,
    '',
  );
  const metadata = JSON.parse(raw) as Record<string, ProblemMeta>;
  const outDir = path.join(OUTPUT_ROOT, 'problems');
  await mkdir(outDir, { recursive: true });

  const theme = {
    label: '수능·모평',
    siteName: 'GaeSaeGi Math',
    gradient: ['#4338ca', '#1e1b4b'] as [string, string],
    accent: '#c7d2fe',
  };

  let count = 0;
  for (const [id, meta] of Object.entries(metadata)) {
    const title = buildProblemPageTitle({
      id,
      source: meta.source,
      year: meta.year,
      month: meta.month,
      examType: meta.examType,
      subject: meta.subject,
      concept: meta.concept,
      hintCount: 0,
    });
    const png = await renderOgPng(title, theme);
    await writeFile(path.join(outDir, `${id}.png`), png);
    count++;
  }
  return count;
}

async function generateEssayProblems() {
  const raw = (await readFile(path.join(ROOT, 'src/content/essay-problems/_metadata.json'), 'utf8')).replace(
    /^\uFEFF/,
    '',
  );
  const metadata = JSON.parse(raw) as Record<string, EssayMeta>;
  const outDir = path.join(OUTPUT_ROOT, 'essay-problems');
  await mkdir(outDir, { recursive: true });

  const theme = {
    label: '대학별 고사',
    siteName: 'GaeSaeGi Math',
    gradient: ['#7c3aed', '#312e81'] as [string, string],
    accent: '#ddd6fe',
  };

  let count = 0;
  for (const [id, meta] of Object.entries(metadata)) {
    if (!meta.source || !meta.university) continue;
    const year = meta.examYear ?? meta.year;
    const title = `${year ?? ''} ${meta.university} ${meta.source}`.trim();
    const png = await renderOgPng(title, theme);
    await writeFile(path.join(outDir, `${id}.png`), png);
    count++;
  }
  return count;
}

async function generateDefault() {
  const png = await renderOgPng('수능·모평 수학 기출과 단계별 힌트', {
    label: 'GaeSaeGi Math',
    siteName: '개새기 수학',
    gradient: ['#312e81', '#0f172a'],
    accent: '#a5b4fc',
  });
  await writeFile(path.join(ROOT, 'public', 'og-default.png'), png);
}

async function main() {
  const problems = await generateProblems();
  const essays = await generateEssayProblems();
  await generateDefault();
  console.log(`og: problems ${problems} images`);
  console.log(`og: essay-problems ${essays} images`);
  console.log(`og: generated ${problems + essays} content images + default`);
}

main().catch((error) => {
  console.error('generate-og-images failed');
  console.error(error);
  process.exit(1);
});
