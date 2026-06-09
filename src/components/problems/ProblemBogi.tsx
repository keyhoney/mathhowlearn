import type { ReactNode } from 'react';

export const EXAM_BOGI_CLASS = 'hl-exam-bogi';

type ProblemBogiProps = {
  title?: string;
  children: ReactNode;
};

/**
 * ㄱ·ㄴ·ㄷ 보기 블록. 기출 본문은 `> **보기**` 인용 + remark 플러그인과 동일 클래스.
 */
export function ProblemBogi({ title = '보기', children }: ProblemBogiProps) {
  return (
    <aside
      className={`${EXAM_BOGI_CLASS} not-prose`}
      data-component="ProblemBogi"
      aria-label={title}
    >
      <p className="hl-exam-bogi__lead m-0">
        <strong>{title}</strong>
      </p>
      <div className="hl-exam-bogi__body">{children}</div>
    </aside>
  );
}

type ProblemBogiItemProps = {
  label: string;
  children: ReactNode;
};

export function ProblemBogiItem({ label, children }: ProblemBogiItemProps) {
  return (
    <p className="hl-exam-bogi__row m-0">
      <strong className="hl-exam-bogi__label">{label}</strong>
      <span className="hl-exam-bogi__text">{children}</span>
    </p>
  );
}
