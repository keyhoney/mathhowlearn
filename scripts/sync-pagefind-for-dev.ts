/**
 * astro dev는 public/만 정적 제공하므로, dist 빌드 후 pagefind 인덱스를 public/pagefind로 복사한다.
 * 사용: npm run build:local && npm run dev:search
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const distIndex = path.join(distDir, 'index.html');
const pagefindOut = path.join(distDir, 'pagefind');
const publicPagefind = path.join(root, 'public', 'pagefind');

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(distIndex))) {
    console.error('dist/ 가 없습니다. 먼저 빌드하세요:');
    console.error('  npm run build:local');
    process.exit(1);
  }

  console.log('[HowLearn] Building pagefind index from dist/...');
  const result = spawnSync('npx', ['pagefind', '--site', 'dist', '--quiet'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  if (!(await exists(pagefindOut))) {
    console.error('pagefind 출력이 없습니다:', pagefindOut);
    process.exit(1);
  }

  await fs.rm(publicPagefind, { recursive: true, force: true });
  await fs.cp(pagefindOut, publicPagefind, { recursive: true });

  console.log('[HowLearn] Done. Search index copied to public/pagefind/');
  console.log('[HowLearn] Open http://localhost:4321/search?q=test after npm run dev');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
