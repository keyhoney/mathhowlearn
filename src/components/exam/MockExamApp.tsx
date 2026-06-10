import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  COMMON_RAW_MAX,
  ELECTIVE_RAW_MAX,
  gradeMockExam,
  lookupConversion,
  MOCK_EXAM_DURATION_MS,
  scaleRawForConversion,
  type GradeCutRow,
  type QuestionResult,
  type SessionConversionBundle,
} from '../../lib/mock-exam-score';
import { recordProblemActivity } from '../../lib/client/learning-streak';
import { STORAGE_KEYS } from '../../lib/storage-keys';

export type MockExamProblemPayload = {
  id: string;
  number: number;
  answerType: 'mcq' | 'short';
  answer: number;
  points: number;
  statementHtml: string;
  choicesHtml: string[];
};

export type MockExamAppProps = {
  sessionId: string;
  label: string;
  year: number;
  month: number;
  problems: MockExamProblemPayload[];
  conversion: SessionConversionBundle | null;
};

type Phase = 'exam' | 'result';

type PersistedState = {
  sessionId: string;
  answers: Record<string, string>;
  currentIndex: number;
  startedAt: number;
  remainingMs: number;
  phase: Phase;
};

function formatTimer(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function readPersisted(sessionId: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MOCK_EXAM_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.sessionId !== sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEYS.MOCK_EXAM_SESSION, JSON.stringify(state));
}

function clearPersisted(): void {
  localStorage.removeItem(STORAGE_KEYS.MOCK_EXAM_SESSION);
}

function ProblemBody({
  problem,
  answer,
  onAnswer,
  disabled,
}: {
  problem: MockExamProblemPayload;
  answer: string;
  onAnswer: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mock-exam-problem">
      <div
        className="prose prose-slate dark:prose-invert max-w-none prose-headings:tracking-tight prose-img:mx-auto prose-img:block"
        dangerouslySetInnerHTML={{ __html: problem.statementHtml }}
      />
      <div className="mt-5">
        {problem.answerType === 'mcq' ? (
          <fieldset disabled={disabled}>
            <legend className="sr-only">객관식 선택지</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(problem.choicesHtml.length > 0 ? problem.choicesHtml : ['1', '2', '3', '4', '5']).map(
                (choiceHtml, idx) => {
                  const value = String(idx + 1);
                  const selected = answer === value;
                  return (
                    <label
                      key={value}
                      className={`choice-item flex min-h-12 cursor-pointer items-center justify-center rounded-lg border px-3 py-3 text-center text-sm leading-snug shadow-sm transition-colors ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-100'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`mock-${problem.id}`}
                        value={value}
                        checked={selected}
                        onChange={() => onAnswer(value)}
                        className="sr-only"
                      />
                      <span className="whitespace-normal break-words" dangerouslySetInnerHTML={{ __html: choiceHtml }} />
                    </label>
                  );
                },
              )}
            </div>
          </fieldset>
        ) : (
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="정답 입력"
              aria-label={`${problem.number}번 단답형 정답`}
              maxLength={3}
              value={answer}
              onChange={(e) => onAnswer(e.target.value)}
              disabled={disabled}
              className="app-input min-w-0 flex-1"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function OmrSheet({
  problems,
  answers,
  currentIndex,
  onSelect,
  onAnswer,
  onSubmit,
  onClose,
  disabled,
}: {
  problems: MockExamProblemPayload[];
  answers: Record<string, string>;
  currentIndex: number;
  onSelect: (index: number) => void;
  onAnswer: (problemId: string, value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  disabled: boolean;
}) {
  return (
    <div className="mock-exam-omr">
      <div className="mock-exam-omr-grid">
        {problems.map((p, idx) => {
          const answer = answers[p.id] ?? '';
          const isCurrent = idx === currentIndex;
          return (
            <div
              key={p.id}
              className={`mock-exam-omr-row ${isCurrent ? 'mock-exam-omr-row--active' : ''}`}
            >
              <button
                type="button"
                className="mock-exam-omr-num"
                onClick={() => onSelect(idx)}
                aria-current={isCurrent ? 'true' : undefined}
              >
                {p.number}
              </button>
              {p.answerType === 'mcq' ? (
                <div className="mock-exam-omr-mcq" role="group" aria-label={`${p.number}번 선택`}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const val = String(n);
                    const marked = answer === val;
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={disabled}
                        className={`mock-exam-omr-bubble ${marked ? 'mock-exam-omr-bubble--marked' : ''}`}
                        aria-label={`${p.number}번 ${n}번 선택`}
                        aria-pressed={marked}
                        onClick={() => onAnswer(p.id, marked ? '' : val)}
                      >
                        <span aria-hidden="true">{n}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  disabled={disabled}
                  value={answer}
                  placeholder="—"
                  aria-label={`${p.number}번 주관식`}
                  className="mock-exam-omr-short app-input"
                  onChange={(e) => onAnswer(p.id, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
      {!disabled && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" className="gsg-btn-outline px-6 py-2.5" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="gsg-btn-primary px-8 py-2.5" onClick={onSubmit}>
            시험 종료 · 답안 제출
          </button>
        </div>
      )}
    </div>
  );
}

function OmrFloatingPanel({
  open,
  problems,
  answers,
  currentIndex,
  onSelect,
  onAnswer,
  onSubmit,
  onClose,
}: {
  open: boolean;
  problems: MockExamProblemPayload[];
  answers: Record<string, string>;
  currentIndex: number;
  onSelect: (index: number) => void;
  onAnswer: (problemId: string, value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="mock-exam-omr-overlay" role="presentation">
      <button
        type="button"
        className="mock-exam-omr-backdrop"
        aria-label="OMR 카드 닫기"
        onClick={onClose}
      />
      <div
        className="mock-exam-omr-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mock-exam-omr-title"
      >
        <div className="mock-exam-omr-panel__header">
          <h2 id="mock-exam-omr-title" className="type-subhead m-0">
            OMR 답안 카드
          </h2>
          <button type="button" className="mock-exam-omr-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="mock-exam-omr-panel__body">
          <OmrSheet
            problems={problems}
            answers={answers}
            currentIndex={currentIndex}
            onSelect={(idx) => {
              onSelect(idx);
            }}
            onAnswer={onAnswer}
            onSubmit={onSubmit}
            onClose={onClose}
            disabled={false}
          />
        </div>
      </div>
    </div>
  );
}

function GradeCutTable({
  gradeCuts,
  userGrade,
  raw,
}: {
  gradeCuts: GradeCutRow[];
  userGrade: string | null;
  raw: { common: number; elective: number; total: number };
}) {
  return (
    <div className="overflow-x-auto">
      <table className="mock-exam-cut-table w-full text-sm">
        <thead>
          <tr>
            <th>등급</th>
            <th>최소 표준점수</th>
            <th>백분위</th>
            <th>최소 합산 원점수</th>
            <th>예시 (공통/선택)</th>
            <th>내 점수</th>
          </tr>
        </thead>
        <tbody>
          {gradeCuts.map((cut) => {
            const isUserGrade = userGrade === cut.grade;
            const reached = raw.total >= cut.minTotalRaw;
            return (
              <tr
                key={cut.grade}
                className={isUserGrade ? 'mock-exam-cut-table__row--mine' : reached ? 'mock-exam-cut-table__row--reached' : ''}
              >
                <td>{cut.grade}등급</td>
                <td>{cut.minStandard}</td>
                <td>{cut.percentile}</td>
                <td>{cut.minTotalRaw}</td>
                <td>
                  {cut.exampleCommon} / {cut.exampleElective}
                </td>
                <td>{isUserGrade ? '●' : reached ? '○' : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="type-caption chrome-muted mt-3">
        공통 원점수 {raw.common}점 · 확률과 통계 원점수 {raw.elective}점 · 합산 {raw.total}점
      </p>
    </div>
  );
}

function ResultPanel({
  label,
  questions,
  raw,
  conversion,
  onRetry,
}: {
  label: string;
  questions: QuestionResult[];
  raw: { common: number; elective: number; total: number };
  conversion: SessionConversionBundle | null;
  onRetry: () => void;
}) {
  const scaled = scaleRawForConversion(raw);
  const conv = conversion ? lookupConversion(conversion.lookup, scaled.common, scaled.elective) : null;
  const commonCorrect = questions.filter((q) => q.number <= 22 && q.correct).length;
  const electiveCorrect = questions.filter((q) => q.number > 22 && q.correct).length;

  return (
    <div className="mock-exam-result space-y-6">
      <header className="book-card--compact border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/90">
        <h2 className="type-article-title m-0">{label} — 채점 결과</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="mock-exam-stat">
            <p className="mock-exam-stat__label">공통 원점수 (1~22)</p>
            <p className="mock-exam-stat__value">
              {raw.common}
              <span className="text-base font-normal text-slate-500"> / {COMMON_RAW_MAX}</span>
            </p>
            <p className="type-caption chrome-muted">{commonCorrect}문항 정답</p>
          </div>
          <div className="mock-exam-stat">
            <p className="mock-exam-stat__label">확률과 통계 원점수 (23~30)</p>
            <p className="mock-exam-stat__value">
              {raw.elective}
              <span className="text-base font-normal text-slate-500"> / {ELECTIVE_RAW_MAX}</span>
            </p>
            <p className="type-caption chrome-muted">{electiveCorrect}문항 정답</p>
          </div>
          {conv ? (
            <>
              <div className="mock-exam-stat">
                <p className="mock-exam-stat__label">표준점수</p>
                <p className="mock-exam-stat__value">{conv.standard}</p>
              </div>
              <div className="mock-exam-stat">
                <p className="mock-exam-stat__label">백분위 · 등급</p>
                <p className="mock-exam-stat__value">
                  {conv.percentile}
                  <span className="text-base font-normal text-slate-500"> · {conv.grade}등급</span>
                </p>
              </div>
            </>
          ) : (
            <div className="mock-exam-stat sm:col-span-2">
              <p className="mock-exam-stat__label">표준점수 환산</p>
              <p className="type-caption chrome-muted">이 회차의 확률과 통계 환산 데이터가 없습니다.</p>
            </div>
          )}
        </div>
      </header>

      {conversion && conv ? (
        <section className="learn-surface book-card p-6">
          <h3 className="type-subhead mb-4">원점수 · 예상 등급 컷 비교</h3>
          <GradeCutTable gradeCuts={conversion.gradeCuts} userGrade={conv.grade} raw={raw} />
        </section>
      ) : null}

      <section className="learn-surface book-card p-6">
        <h3 className="type-subhead mb-4">문항별 채점</h3>
        <div className="overflow-x-auto">
          <table className="mock-exam-cut-table w-full text-sm">
            <thead>
              <tr>
                <th>번호</th>
                <th>유형</th>
                <th>배점</th>
                <th>내 답</th>
                <th>정답</th>
                <th>결과</th>
                <th>득점</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.problemId} className={q.correct ? '' : 'mock-exam-cut-table__row--wrong'}>
                  <td>{q.number}</td>
                  <td>{q.answerType === 'mcq' ? '객관식' : '주관식'}</td>
                  <td>{q.points}</td>
                  <td>{q.userAnswer || '—'}</td>
                  <td>{q.correctAnswer}</td>
                  <td>{q.correct ? '정답' : '오답'}</td>
                  <td>{q.earned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="gsg-btn-outline" onClick={onRetry}>
          다시 풀기
        </button>
        <a href="/problems/mock-exam" className="gsg-btn-secondary inline-flex items-center justify-center">
          다른 회차 선택
        </a>
      </div>
    </div>
  );
}

export default function MockExamApp({
  sessionId,
  label,
  problems,
  conversion,
}: MockExamAppProps) {
  const [phase, setPhase] = useState<Phase>('exam');
  const [omrOpen, setOmrOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingMs, setRemainingMs] = useState(MOCK_EXAM_DURATION_MS);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [result, setResult] = useState<ReturnType<typeof gradeMockExam> | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef({ answers, currentIndex, startedAt, remainingMs, phase });
  stateRef.current = { answers, currentIndex, startedAt, remainingMs, phase };

  const currentProblem = problems[currentIndex];
  const isLast = currentIndex === problems.length - 1;

  useEffect(() => {
    document.body.classList.add('mock-exam-active');
    return () => document.body.classList.remove('mock-exam-active');
  }, []);

  useEffect(() => {
    if (!omrOpen) return;
    document.body.classList.add('mock-exam-omr-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOmrOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('mock-exam-omr-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [omrOpen]);

  useEffect(() => {
    const saved = readPersisted(sessionId);
    if (saved) {
      setAnswers(saved.answers);
      setCurrentIndex(saved.currentIndex);
      setStartedAt(saved.startedAt);
      setRemainingMs(saved.remainingMs);
      setPhase(saved.phase);
      if (saved.phase === 'result') {
        setResult(
          gradeMockExam(
            problems.map((p) => ({
              id: p.id,
              number: p.number,
              answerType: p.answerType,
              answer: p.answer,
            })),
            saved.answers,
          ),
        );
      }
    }
    setHydrated(true);
  }, [sessionId, problems]);

  const persist = useCallback(
    (patch: Partial<PersistedState>) => {
      const state: PersistedState = {
        sessionId,
        answers: patch.answers ?? answers,
        currentIndex: patch.currentIndex ?? currentIndex,
        startedAt: patch.startedAt ?? startedAt,
        remainingMs: patch.remainingMs ?? remainingMs,
        phase: patch.phase ?? phase,
      };
      writePersisted(state);
    },
    [sessionId, answers, currentIndex, startedAt, remainingMs, phase],
  );

  const setAnswer = useCallback(
    (problemId: string, value: string) => {
      setAnswers((prev) => {
        const next = { ...prev, [problemId]: value };
        persist({ answers: next });
        if (value.trim()) recordProblemActivity(problemId);
        return next;
      });
    },
    [persist],
  );

  const handleSubmit = useCallback(() => {
    const graded = gradeMockExam(
      problems.map((p) => ({
        id: p.id,
        number: p.number,
        answerType: p.answerType,
        answer: p.answer,
      })),
      answers,
    );
    setResult(graded);
    setPhase('result');
    persist({ phase: 'result', answers });
  }, [problems, answers, persist]);

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    if (!hydrated || phase !== 'exam') return;
    const tick = window.setInterval(() => {
      setRemainingMs((prev) => {
        const next = Math.max(0, prev - 1000);
        const snap = stateRef.current;
        writePersisted({
          sessionId,
          answers: snap.answers,
          currentIndex: snap.currentIndex,
          startedAt: snap.startedAt,
          remainingMs: next,
          phase: snap.phase,
        });
        if (next === 0 && prev > 0) {
          window.setTimeout(() => handleSubmitRef.current(), 0);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [hydrated, phase, sessionId]);

  const handleRetry = () => {
    clearPersisted();
    setPhase('exam');
    setOmrOpen(false);
    setCurrentIndex(0);
    setAnswers({});
    setRemainingMs(MOCK_EXAM_DURATION_MS);
    setStartedAt(Date.now());
    setResult(null);
  };

  const answeredCount = useMemo(
    () => problems.filter((p) => (answers[p.id] ?? '').trim()).length,
    [problems, answers],
  );

  if (!hydrated || !currentProblem) {
    return <p className="type-caption chrome-muted p-6">시험을 불러오는 중…</p>;
  }

  if (phase === 'result' && result) {
    return (
      <ResultPanel
        label={label}
        questions={result.questions}
        raw={result.raw}
        conversion={conversion}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="mock-exam-shell max-w-5xl mx-auto">
      <header className="mock-exam-header not-prose sticky top-0 z-20 mb-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="type-caption chrome-muted m-0">{label}</p>
            <h1 className="type-subhead m-0">모의 수능 — 수학(확률과 통계)</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`mock-exam-timer ${remainingMs <= 5 * 60 * 1000 ? 'mock-exam-timer--urgent' : ''}`}
              role="timer"
              aria-live="polite"
            >
              {formatTimer(remainingMs)}
            </div>
            <span className="type-caption chrome-muted">답안 {answeredCount}/30</span>
          </div>
        </div>
      </header>

      <article className="learn-surface book-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="type-subhead m-0">{currentProblem.number}번</h2>
          <span className="type-caption chrome-muted">
            {currentProblem.answerType === 'mcq' ? '객관식' : '주관식'} · {currentProblem.points}점
          </span>
        </div>
        <ProblemBody
          problem={currentProblem}
          answer={answers[currentProblem.id] ?? ''}
          onAnswer={(v) => setAnswer(currentProblem.id, v)}
          disabled={false}
        />
        <nav className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6 dark:border-slate-700">
          <button
            type="button"
            className="gsg-btn-outline"
            disabled={currentIndex === 0}
            onClick={() => {
              const next = currentIndex - 1;
              setCurrentIndex(next);
              persist({ currentIndex: next });
            }}
          >
            ← 이전
          </button>
          <div className="flex flex-wrap gap-2">
            {isLast ? (
              <button type="button" className="gsg-btn-primary" onClick={handleSubmit}>
                시험 종료 · 답안 제출
              </button>
            ) : (
              <button
                type="button"
                className="gsg-btn-primary"
                onClick={() => {
                  const next = currentIndex + 1;
                  setCurrentIndex(next);
                  persist({ currentIndex: next });
                }}
              >
                다음 →
              </button>
            )}
          </div>
        </nav>
      </article>

      <button
        type="button"
        className="mock-exam-omr-fab"
        onClick={() => setOmrOpen(true)}
        aria-label="OMR 답안 카드 열기"
        aria-expanded={omrOpen}
      >
        <span className="mock-exam-omr-fab__icon" aria-hidden="true">
          ▦
        </span>
        <span className="mock-exam-omr-fab__label">OMR</span>
        {answeredCount < 30 ? (
          <span className="mock-exam-omr-fab__badge">{answeredCount}</span>
        ) : null}
      </button>

      <OmrFloatingPanel
        open={omrOpen}
        problems={problems}
        answers={answers}
        currentIndex={currentIndex}
        onSelect={(idx) => {
          setCurrentIndex(idx);
          persist({ currentIndex: idx });
        }}
        onAnswer={setAnswer}
        onSubmit={() => {
          setOmrOpen(false);
          handleSubmit();
        }}
        onClose={() => setOmrOpen(false)}
      />
    </div>
  );
}
