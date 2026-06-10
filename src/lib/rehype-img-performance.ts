import type { Element, Root, Text } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

function appendClass(properties: Record<string, unknown>, className: string): void {
  const existing = properties.className;
  if (Array.isArray(existing)) {
    if (!existing.includes(className)) existing.push(className);
    return;
  }
  if (typeof existing === 'string') {
    const parts = existing.split(/\s+/).filter(Boolean);
    if (!parts.includes(className)) parts.push(className);
    properties.className = parts;
    return;
  }
  properties.className = [className];
}

function isWhitespaceText(node: unknown): boolean {
  return node?.type === 'text' && !(node as Text).value.trim();
}

function paragraphContainsOnlyImage(node: Element): boolean {
  const meaningful = node.children.filter((child) => !isWhitespaceText(child));
  return (
    meaningful.length === 1 &&
    meaningful[0]?.type === 'element' &&
    (meaningful[0] as Element).tagName === 'img'
  );
}

/**
 * Markdown/MDX img: 성능 속성 + 문제 본문 가운데 정렬용 클래스.
 */
export const rehypeImgPerformance: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'img') {
        const properties = (node.properties ??= {});
        if (properties.loading == null) properties.loading = 'lazy';
        if (properties.decoding == null) properties.decoding = 'async';
        appendClass(properties, 'problem-content-image');
        return;
      }

      if (node.tagName === 'p' && paragraphContainsOnlyImage(node)) {
        appendClass((node.properties ??= {}), 'problem-image-paragraph');
      }
    });
  };
};
