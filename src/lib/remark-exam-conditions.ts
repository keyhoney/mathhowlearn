/**
 * `> **조건**` 으로 시작하는 blockquote 에 `hl-exam-conditions` 클래스를 붙인다.
 * `> **박스**` 한 줄만 있는 뒤 본문은 제목 단락을 AST 에서 제거하고 `hl-exam-conditions--no-lead` 를 붙인다.
 * (화면에는 「조건」 문구 없이 카드만, (가)/(나) 행잉 들여쓰기 없음 — 조건·보기와 구분)
 * 시험 문제 MDX는 Markdown 파이프라인으로만 렌더되므로, JSX 대신 이 마크업을 쓴다.
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

const ANONYMOUS_CONDITIONS_LABEL = '박스';

function paragraphIsOnlyStrongLabel(p: Paragraph, label: string): boolean {
  if (p.children.length !== 1) return false;
  const only = p.children[0];
  if (!only || only.type !== 'strong') return false;
  return collectText(only).trim() === label;
}

function paragraphStartsWithConditionTitle(p: Paragraph): boolean {
  const first = p.children[0];
  if (!first || first.type !== 'strong') return false;
  return collectText(first).trim() === '조건';
}

function isAnonymousConditionsBox(node: Blockquote): boolean {
  const first = node.children[0];
  if (!first || first.type !== 'paragraph') return false;
  return paragraphIsOnlyStrongLabel(first, ANONYMOUS_CONDITIONS_LABEL);
}

function isExamConditionsBlockquote(node: Blockquote): boolean {
  const first = node.children[0];
  if (!first || first.type !== 'paragraph') return false;
  return paragraphStartsWithConditionTitle(first);
}

export function remarkExamConditions() {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const anonymous = isAnonymousConditionsBox(node);
      if (anonymous) {
        node.children = node.children.slice(1);
      }
      if (!anonymous && !isExamConditionsBlockquote(node)) return;
      node.data = node.data ?? {};
      const hProps = (node.data.hProperties ?? {}) as Record<string, unknown>;
      const merged = new Set<string>(['hl-exam-conditions']);
      if (anonymous) merged.add('hl-exam-conditions--no-lead');
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
      node.data.hProperties = { ...hProps, class: [...merged].join(' ') };
    });
  };
}
