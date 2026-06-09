import React from 'react';
import { tinaField, useTina } from 'tinacms/dist/react';

interface EssayProblemInlineViewProps {
  query: string;
  variables: Record<string, unknown>;
  meta: {
    source: string;
    year: number;
    examType: string;
    university: string;
    examYear?: number;
  };
  data: {
    essay_problems: {
      body?: string | null;
      _sys?: { filename?: string | null } | null;
    };
  };
}

export default function EssayProblemInlineView(props: EssayProblemInlineViewProps) {
  const { data } = useTina({
    query: props.query,
    variables: props.variables,
    data: props.data,
  });
  const problem = data?.essay_problems;
  if (!problem) return null;
  const field = (key: 'body') => tinaField(problem as any, key);
  const { meta } = props;

  return (
    <>
      <header className="not-prose app-card mb-6 p-5">
        <p className="text-sm font-medium text-[var(--accent)]">
          <a href="/essay-problems" className="hover:underline">대학별 고사 수학 문제</a>
          <span className="mx-2 text-[var(--fg-muted)] opacity-50">/</span>
          <span className="text-[var(--fg-muted)]">{problem?._sys?.filename ?? ''}</span>
        </p>
        <h1 className="mt-3 text-2xl font-bold text-[var(--fg)]">
          {meta.source}
        </h1>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="app-chip">{meta.year}년</span>
          <span className="app-chip">{meta.examType}</span>
          <span className="app-chip">{meta.university}</span>
          {meta.examYear != null && (
            <span className="app-chip">시행연도 {meta.examYear}</span>
          )}
        </div>
      </header>

      <section className="not-prose app-feedback app-feedback-info mb-4">
        본문에서 `## 힌트` 섹션을 여러 번 쓰면 STEP 힌트로 분리되고, `## 풀이` 또는 `## 모범 풀이` 섹션이 최종 풀이로 사용됩니다.
      </section>

      <div className="app-card p-5" data-tina-field={field('body')}>
        <h2 className="mb-4 text-xl font-bold tracking-tight text-[var(--fg)]">문제/힌트/풀이 본문</h2>
        <div className="rounded-sm border border-[var(--card-border)] bg-[var(--surface-2)] p-4">
          <pre className="whitespace-pre-wrap break-words text-sm text-[var(--fg)]">{problem.body ?? ''}</pre>
        </div>
      </div>
    </>
  );
}
