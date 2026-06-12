import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';

function getClassTokens(node: Element): string[] {
  const cls = node.properties?.className ?? node.properties?.class;
  if (Array.isArray(cls)) return cls.map(String);
  if (typeof cls === 'string') return cls.split(/\s+/).filter(Boolean);
  return [];
}

/** rehype-katex display 수식을 block div 로 감싸 prose 안에서 가운데 정렬되게 한다. */
export function rehypeWrapKatexDisplay() {
  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || index == null) return;
      if (node.tagName !== 'span' || !getClassTokens(node).includes('katex-display')) return;

      const wrapper: Element = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['math-display-block'],
          style:
            'display:flex;justify-content:center;width:100%;margin:1em 0;line-height:normal;overflow:visible',
        },
        children: [node],
      };
      parent.children[index] = wrapper;
    });
  };
}
