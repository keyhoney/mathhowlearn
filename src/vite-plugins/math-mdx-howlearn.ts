import type { Plugin } from 'vite';
import { normalizeMathMdxFileBody } from '../lib/math-mdx-normalize';

const MCQ_IMPORT = `import McqChoices from '@/components/mdx/McqChoices.astro';
import McqChoiceItem from '@/components/mdx/McqChoiceItem.astro';

`;

function isContentMdxId(id: string): boolean {
  const norm = id.replace(/\\/g, '/');
  return norm.includes('/src/content/') && norm.endsWith('.mdx');
}

// src/content/ 이하 MDX에 math_howlearn 과 동일 전처리: \frac→\dfrac, ①~⑤ 한 줄 래핑
export function mathMdxHowlearnPlugin(): Plugin {
  return {
    name: 'math-mdx-howlearn',
    enforce: 'pre',
    transform(code, id) {
      if (!isContentMdxId(id)) {
        return null;
      }
      const next = normalizeMathMdxFileBody(code);
      if (next === code) return null;

      const usesMcq = next.includes('<McqChoices');
      const hasMcqImport =
        /import\s+McqChoices\s+from\s+['"]@\/components\/mdx\/McqChoices\.astro['"]/.test(next);
      const prefix = usesMcq && !hasMcqImport ? MCQ_IMPORT : '';

      return { code: prefix + next, map: null };
    },
  };
}
