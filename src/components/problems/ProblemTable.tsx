import type { ReactNode } from 'react';

export const EXAM_TABLE_CLASS = 'hl-exam-table';

type ProblemTableCell = ReactNode;

type ProblemTableProps = {
  caption?: string;
  headers: ProblemTableCell[];
  rows: ProblemTableCell[][];
};

/**
 * 문제 본문용 표 컴포넌트.
 * - 기본 스타일은 `hl-exam-table` 클래스를 통해 global.css에서 제어
 * - 셀 내용은 중앙 정렬
 */
export function ProblemTable({ caption, headers, rows }: ProblemTableProps) {
  return (
    <div className={`${EXAM_TABLE_CLASS} not-prose`} data-component="ProblemTable">
      <table>
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={`header-${index}`} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
