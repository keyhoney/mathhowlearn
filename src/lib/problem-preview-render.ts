import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildHintSteps,
  extractMcqChoices,
  extractProblemStatementMarkdown,
  extractSection,
  extractSections,
  renderTrustedMarkdown,
} from './problem-markdown';

const MCQ_LABELS = ['①', '②', '③', '④', '⑤'] as const;

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(LIB_DIR, '../..');
const PREVIEW_STYLES_PATH = path.join(LIB_DIR, 'problem-preview-styles.css');
const KATEX_PKG_PATH = path.join(PROJECT_ROOT, 'node_modules/katex/package.json');

export type ProblemPreviewOptions = {
  /** `/images/...` 절대 경로를 붙일 때 (예: http://127.0.0.1:4321) */
  assetsBaseUrl?: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** choice HTML에서 단일 <p> 래퍼 제거 (문제 상세 페이지와 동일) */
function unwrapChoiceParagraph(html: string): string {
  return html.replace(/^<p>/, '').replace(/<\/p>\s*$/, '');
}

export function absolutizePreviewAssetUrls(html: string, assetsBaseUrl?: string): string {
  const base = assetsBaseUrl?.trim().replace(/\/$/, '');
  if (!base) return html;
  return html.replace(
    /(<img\b[^>]*\bsrc=")\/([^"]+)"/gi,
    (_match, prefix: string, assetPath: string) => `${prefix}${base}/${assetPath}"`,
  );
}

async function renderChoiceBodies(choices: string[]): Promise<string[]> {
  if (choices.length === 0) return [];
  return Promise.all(
    choices.map(async (choice) => {
      const html = await renderTrustedMarkdown(choice);
      return unwrapChoiceParagraph(html);
    }),
  );
}

function buildMcqPreviewGrid(choicesHtml: string[]): string {
  if (choicesHtml.length === 0) return '';
  const items = choicesHtml
    .map((bodyHtml, idx) => {
      const label = MCQ_LABELS[idx] ?? String(idx + 1);
      return (
        `<div class="mcq-preview-item">` +
        `<span class="mcq-preview-label" aria-hidden="true">${escapeHtml(label)}</span>` +
        `<div class="mcq-preview-body prose prose-sm">${bodyHtml}</div>` +
        `</div>`
      );
    })
    .join('');
  return `<div class="mcq-preview-grid" aria-label="객관식 선지 미리보기">${items}</div>`;
}

/**
 * 문제 상세 페이지([slug].astro)와 동일한 파싱·렌더로 본문 HTML 조각을 만든다.
 */
export async function renderProblemPreviewBody(
  markdown: string,
  options: ProblemPreviewOptions = {},
): Promise<string> {
  const body = markdown.trim();
  if (!body) return '';

  const hasProblemSection = body.includes('## 문제');
  const rawProblemMd = hasProblemSection ? extractProblemStatementMarkdown(body) : body;
  const { statement: problemMd, choices: mcqChoices } = extractMcqChoices(rawProblemMd);

  const problemHtml = await renderTrustedMarkdown(problemMd);
  const choicesHtml = await renderChoiceBodies(mcqChoices);
  const mcqGrid = buildMcqPreviewGrid(choicesHtml);

  const hintSections = hasProblemSection ? extractSections(body, ['힌트']) : [];
  const solutionText = hasProblemSection ? extractSection(body, ['풀이']) : '';
  const hintSteps = hintSections.flatMap((section) => buildHintSteps(section));
  const hintStepsHtml =
    hintSteps.length > 0
      ? await Promise.all(hintSteps.map((step) => renderTrustedMarkdown(step)))
      : [];
  const solutionHtml = solutionText ? await renderTrustedMarkdown(solutionText) : '';

  const applyAssets = (html: string) => absolutizePreviewAssetUrls(html, options.assetsBaseUrl);

  const parts: string[] = [
    '<div class="exam-problem-page docx2mdx-preview">',
    '<p class="preview-banner">Astro 문제 상세와 동일한 remark/rehype 파이프라인 미리보기 (KaTeX strict: warn)</p>',
    '<section class="preview-section">',
    '<h2>문제</h2>',
    `<div class="prose prose-slate">${applyAssets(problemHtml)}</div>`,
  ];

  if (mcqGrid) {
    parts.push(applyAssets(mcqGrid));
  }

  parts.push('</section>');

  if (hintStepsHtml.length > 0) {
    parts.push('<section class="preview-section">', '<h2>힌트</h2>');
    hintStepsHtml.forEach((html, idx) => {
      parts.push(
        '<div class="preview-hint-step">',
        `<strong>STEP ${idx + 1}</strong>`,
        `<div class="prose prose-sm prose-slate">${applyAssets(html)}</div>`,
        '</div>',
      );
    });
    parts.push('</section>');
  }

  if (solutionHtml) {
    parts.push(
      '<section class="preview-section">',
      '<h2>풀이</h2>',
      `<div class="prose prose-sm prose-slate" data-solution>${applyAssets(solutionHtml)}</div>`,
      '</section>',
    );
  }

  parts.push('</div>');
  return parts.join('\n');
}

function readPreviewStyles(): string {
  try {
    return fs.readFileSync(PREVIEW_STYLES_PATH, 'utf8');
  } catch {
    throw new Error(
      `미리보기 CSS를 읽을 수 없습니다: ${PREVIEW_STYLES_PATH}\n` +
        '프로젝트 루트에서 npm install 후 다시 시도하세요.',
    );
  }
}

function resolveKatexVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(KATEX_PKG_PATH, 'utf8')) as { version?: string };
    if (pkg.version) return pkg.version;
  } catch {
    /* fallback */
  }
  return '0.16.11';
}

export function wrapProblemPreviewDocument(
  innerHtml: string,
  options: ProblemPreviewOptions = {},
): string {
  const previewCss = readPreviewStyles();
  const katexVersion = resolveKatexVersion();
  const katexCdn = `https://cdn.jsdelivr.net/npm/katex@${katexVersion}/dist/katex.min.css`;
  const assetsNote = options.assetsBaseUrl
    ? escapeHtml(options.assetsBaseUrl)
    : '(미설정 — /images 경로는 Astro dev 서버 없이는 깨질 수 있음)';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>문제 미리보기</title>
  <link rel="stylesheet" href="${katexCdn}" crossorigin="anonymous" />
  <style>${previewCss}</style>
</head>
<body data-assets-base="${assetsNote}">
${innerHtml}
</body>
</html>`;
}

export async function renderProblemPreviewDocument(
  markdown: string,
  options: ProblemPreviewOptions = {},
): Promise<string> {
  const inner = await renderProblemPreviewBody(markdown, options);
  return wrapProblemPreviewDocument(inner, options);
}
