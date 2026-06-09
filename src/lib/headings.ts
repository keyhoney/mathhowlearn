import type { ReactNode } from 'react';

export type HeadingItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

export function extractTextFromNode(node: ReactNode): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromNode).join('');
  if (
    typeof node === 'object' &&
    'props' in node &&
    node.props &&
    typeof node.props === 'object' &&
    'children' in node.props
  ) {
    return extractTextFromNode((node.props as { children?: ReactNode }).children);
  }
  return '';
}

export function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '');
}
