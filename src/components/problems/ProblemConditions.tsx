import type { ReactNode } from 'react';

/** Markdown(remark)이 붙이는 클래스와 동일 — 스타일 공유 */
export const EXAM_CONDITIONS_CLASS = 'hl-exam-conditions';

type ProblemConditionsProps = {
  /** 기본: 조건 */
  title?: string;
  children: ReactNode;
};

/**
 * 가이드·칼럼 등 MDX에서만 사용.
 * 기출 문제 본문은 `> **조건**` 블록 인용 + remark 플러그인과 동일한 클래스로 렌더된다.
 */
export function ProblemConditions({
  title = '조건',
  children,
}: ProblemConditionsProps) {
  return (
    <aside
      className={`${EXAM_CONDITIONS_CLASS} not-prose`}
      data-component="ProblemConditions"
      aria-label={title}
    >
      <p className="hl-exam-conditions__lead m-0">
        <strong>{title}</strong>
      </p>
      <div className="hl-exam-conditions__body">{children}</div>
    </aside>
  );
}

type ProblemConditionItemProps = {
  label: string;
  children: ReactNode;
};

export function ProblemConditionItem({
  label,
  children,
}: ProblemConditionItemProps) {
  return (
    <p className="hl-exam-conditions__row m-0">
      <strong className="hl-exam-conditions__label">{label}</strong>
      <span className="hl-exam-conditions__text">{children}</span>
    </p>
  );
}
