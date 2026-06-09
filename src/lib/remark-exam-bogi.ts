/**
 * `> **보기**` 로 시작하는 blockquote 에 `hl-exam-bogi` 클래스를 붙인다.
 * ㄱ·ㄴ·ㄷ 선지 박스 스타일은 global.css 의 `.hl-exam-bogi` 와 맞춘다.
 */
import type { Blockquote, Paragraph, PhrasingContent, Root, Strong } from 'mdast';
import { visit } from 'unist-util-visit';

function collectText(node: Strong | PhrasingContent): string {
  if (node.type === 'text') return node.value;
  if ('children' in node && Array.isArray(node.children)) {
    return (node.children as (Strong | PhrasingContent)[])
      .map((c) => collectText(c as Strong | PhrasingContent))
      .join('');
  }
  return '';
}

function paragraphStartsWithBogiTitle(p: Paragraph): boolean {
  const first = p.children[0];
  if (!first || first.type !== 'strong') return false;
  return collectText(first).trim() === '보기';
}

function isExamBogiBlockquote(node: Blockquote): boolean {
  const first = node.children[0];
  if (!first || first.type !== 'paragraph') return false;
  return paragraphStartsWithBogiTitle(first);
}

function mergeClass(
  hProps: Record<string, unknown>,
  add: string,
): Record<string, unknown> {
  const merged = new Set<string>([add]);
  const existing = hProps.class;
  if (typeof existing === 'string') {
    for (const s of existing.split(/\s+/)) {
      if (s) merged.add(s);
    }
  } else if (Array.isArray(existing)) {
    for (const s of existing as string[]) {
      if (s) merged.add(s);
    }
  }
  return { ...hProps, class: [...merged].join(' ') };
}

export function remarkExamBogi() {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      if (!isExamBogiBlockquote(node)) return;
      node.data = node.data ?? {};
      const hProps = (node.data.hProperties ?? {}) as Record<string, unknown>;
      node.data.hProperties = mergeClass(hProps, 'hl-exam-bogi');
    });
  };
}
