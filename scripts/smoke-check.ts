import fs from 'node:fs/promises';
import path from 'node:path';

const DIST_DIR = path.join(process.cwd(), 'dist');

const requiredPaths = [
  'index.html',
  path.join('dashboard', 'index.html'),
  path.join('problems', 'index.html'),
  path.join('problems', 'concept-frequency', 'index.html'),
  path.join('essay-problems', 'index.html'),
  path.join('problems', 'wrong-note', 'index.html'),
  path.join('problems', 'bookmarks', 'index.html'),
  path.join('search', 'index.html'),
  'robots.txt',
  'rss.xml',
  'sitemap-index.xml',
  path.join('pagefind', 'pagefind.js'),
];

async function exists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const missing: string[] = [];

  for (const rel of requiredPaths) {
    const full = path.join(DIST_DIR, rel);
    if (!(await exists(full))) {
      missing.push(rel);
    }
  }

  if (missing.length > 0) {
    console.error('smoke-check failed: missing build outputs');
    for (const rel of missing) {
      console.error(`- ${rel}`);
    }
    process.exit(1);
  }

  console.log(`smoke-check passed: ${requiredPaths.length} critical outputs verified`);
}

main().catch((error) => {
  console.error('smoke-check failed unexpectedly');
  console.error(error);
  process.exit(1);
});
