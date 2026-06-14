import { readFileSync } from 'node:fs';
import { renderTrustedMarkdown, extractProblemStatementMarkdown } from '../src/lib/problem-markdown.ts';

const body = readFileSync('src/content/problems/20260611.mdx', 'utf8');
const problemMd = extractProblemStatementMarkdown(body);
const html = await renderTrustedMarkdown(problemMd);
console.log(html);
