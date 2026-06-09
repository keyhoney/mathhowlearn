import React from 'react';
import { tinaField, useTina } from 'tinacms/dist/react';

interface ProblemInlineViewProps {
  query: string;
  variables: Record<string, unknown>;
  meta: {
    source: string;
    year: number;
    month: number;
    examType: string;
    subject: string;
    chapter: string;
    subChapter: string;
    concept: string;
    difficulty: number;
    answerType: string;
    answer: number;
  };
  data: {
    problems: {
      body?: string | null;
      _sys?: { filename?: string | null } | null;
    };
  };
}

export default function ProblemInlineView(props: ProblemInlineViewProps) {
  const { data } = useTina({
    query: props.query,
    variables: props.variables,
    data: props.data,
  });
  const problem = data?.problems;
  if (!problem) return null;
  const field = (key: 'body') => tinaField(problem as any, key);
  const { meta } = props;

  return (
    <>
      <header className="not-prose app-card mb-6 p-5">
        <p className="text-sm font-medium text-[var(--accent)]">
          <a href="/problems" className="hover:underline">수능·모평 수학 문제</a>
          <span className="mx-2 text-[var(--fg-muted)] opacity-50">/</span>
          <span className="text-[var(--fg-muted)]">{problem?._sys?.filename ?? ''}</span>
        </p>
        <h1 className="mt-3 text-2xl font-bold text-[var(--fg)]">
          {meta.source}
        </h1>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="app-chip">{meta.year}년</span>
          <span className="app-chip">{meta.month}월</span>
          <span className="app-chip">{meta.examType}</span>
          <span className="app-chip">{meta.subject}</span>
          <span className="app-chip">{meta.chapter}</span>
          <span className="app-chip">{meta.subChapter}</span>
          <span className="app-chip">{meta.concept}</span>
          <span className="app-chip">난이도 {meta.difficulty}</span>
          <span className="app-chip">정답 형식 {meta.answerType}</span>
          <span className="app-chip">정답 {meta.answer}</span>
        </div>
      </header>

      <section className="not-prose app-feedback app-feedback-info mb-4">
        본문에서 `## 힌트` 섹션을 여러 번 쓰면 STEP 힌트로 분리되고, `## 풀이` 섹션이 최종 풀이로 사용됩니다.
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
