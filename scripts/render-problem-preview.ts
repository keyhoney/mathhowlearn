/**
 * 문제 MDX 본문을 Astro 문제 상세와 동일한 파이프라인으로 HTML 미리보기 문서로 출력한다.
 *
 * 사용:
 *   npx tsx scripts/render-problem-preview.ts < body.md
 *   npx tsx scripts/render-problem-preview.ts path/to/body.md
 *   npx tsx scripts/render-problem-preview.ts --assets-base http://127.0.0.1:4321 < body.md
 */

import fs from 'node:fs/promises';
import { renderProblemPreviewDocument } from '../src/lib/problem-preview-render';

function parseArgs(argv: string[]): { filePath?: string; assetsBaseUrl?: string } {
  let filePath: string | undefined;
  let assetsBaseUrl: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--assets-base' || arg === '-b') {
      assetsBaseUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  tsx scripts/render-problem-preview.ts [--assets-base URL] [file.md]

Reads markdown from stdin when no file is given.
Writes a full HTML document to stdout; errors go to stderr.`);
      process.exit(0);
    }
    positional.push(arg);
  }

  if (positional.length > 0) {
    filePath = positional[0];
  }
  return { filePath, assetsBaseUrl };
}

async function readInput(filePath?: string): Promise<string> {
  if (filePath) {
    return fs.readFile(filePath, 'utf8');
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

async function main(): Promise<void> {
  const { filePath, assetsBaseUrl } = parseArgs(process.argv.slice(2));
  const markdown = await readInput(filePath);
  const html = await renderProblemPreviewDocument(markdown, { assetsBaseUrl });
  process.stdout.write(html);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`render-problem-preview: ${message}`);
  process.exit(1);
});
