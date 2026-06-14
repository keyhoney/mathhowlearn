import fs from 'node:fs/promises';
import path from 'node:path';

type ProblemMeta = {
  source: string;
  year: number;
  month: number;
  examType: string;
  subject: string;
  chapter: string;
  subChapter: string;
  concept: string;
  difficulty?: number;
};

const root = process.cwd();

function conceptKey(meta: ProblemMeta): string {
  return [meta.subject, meta.chapter, meta.subChapter, meta.concept].join('\u001f');
}

async function main() {
  const raw = await fs.readFile(path.join(root, 'src', 'content', 'problems', '_metadata.json'), 'utf8');
  const metadata = JSON.parse(raw.replace(/^\uFEFF/, '')) as Record<string, ProblemMeta>;
  const entries = Object.entries(metadata);
  const conceptStats = new Map<string, { count: number; recentCount: number; averageDifficulty: number; problemIds: string[] }>();
  const latestYear = entries.reduce((max, [, meta]) => Math.max(max, Number(meta.year || 0)), 0);
  const recentMinYear = latestYear > 0 ? latestYear - 2 : 0;

  for (const [id, meta] of entries) {
    const key = conceptKey(meta);
    const current = conceptStats.get(key) ?? { count: 0, recentCount: 0, averageDifficulty: 0, problemIds: [] };
    current.count += 1;
    current.recentCount += Number(meta.year || 0) >= recentMinYear ? 1 : 0;
    current.averageDifficulty += Number(meta.difficulty || 3);
    current.problemIds.push(id);
    conceptStats.set(key, current);
  }

  const conceptPayload = Object.fromEntries(
    Array.from(conceptStats.entries()).map(([key, value]) => [
      key,
      {
        ...value,
        averageDifficulty: value.averageDifficulty / Math.max(1, value.count),
      },
    ]),
  );

  const relatedPayload = Object.fromEntries(
    entries.map(([id, meta]) => {
      const related = entries
        .filter(([otherId]) => otherId !== id)
        .map(([otherId, other]) => {
          let score = 0;
          if (other.subject === meta.subject) score += 30;
          if (other.chapter === meta.chapter) score += 25;
          if (other.subChapter === meta.subChapter) score += 20;
          if (other.concept === meta.concept) score += 25;
          score += Math.max(0, 15 - Math.abs(Number(other.difficulty || 3) - Number(meta.difficulty || 3)) * 5);
          return { id: otherId, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map((item) => item.id);
      return [id, related];
    }),
  );

  const outDir = path.join(root, 'public', 'data');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'concept-stats.json'), `${JSON.stringify(conceptPayload)}\n`, 'utf8');
  await fs.writeFile(path.join(outDir, 'related-problems.json'), `${JSON.stringify(relatedPayload)}\n`, 'utf8');
  console.log(`[HowLearn] Derived data written: ${entries.length} problems`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
