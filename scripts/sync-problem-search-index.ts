import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

type MetadataEntry = { source: string };

async function loadMetadata(collectionDir: string): Promise<Record<string, MetadataEntry>> {
  const filePath = path.join(root, 'src', 'content', collectionDir, '_metadata.json');
  const raw = (await fs.readFile(filePath, 'utf-8')).replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw) as Record<string, MetadataEntry>;
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function toTitleMap(metadata: Record<string, MetadataEntry>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metadata).map(([id, entry]) => [id, entry.source]),
  );
}

async function main() {
  const [problems, essayProblems] = await Promise.all([
    loadMetadata('problems'),
    loadMetadata('essay-problems'),
  ]);

  const outDir = path.join(root, 'public', 'search');
  const outFile = path.join(outDir, 'problem-codes.json');
  const payload = {
    problems: toTitleMap(problems),
    essayProblems: toTitleMap(essayProblems),
  };

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, `${JSON.stringify(payload)}\n`, 'utf-8');

  console.log(
    `[HowLearn] Problem search index written: ${Object.keys(payload.problems).length} problems, ${Object.keys(payload.essayProblems).length} essay problems`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
