import type { Element, Root } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

/**
 * Markdown/MDX에서 생성되는 img 태그에 기본 성능 속성을 부여한다.
 */
export const rehypeImgPerformance: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'element', (node) => {
      const element = node as Element;
      if (element.tagName !== 'img') return;

      const properties = (element.properties ??= {});
      if (properties.loading == null) properties.loading = 'lazy';
      if (properties.decoding == null) properties.decoding = 'async';
    });
  };
};
