import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Eye } from 'lucide-react';
import {
  getProgressDetail,
  readProgressStore,
  writeProgressStore,
} from '../../lib/client/problem-state';
import { emitDashboardRefresh } from '../../lib/client/dashboard-stats';
import { STORAGE_KEYS } from '../../lib/storage-keys';

interface Props {
  problemId: string;
  totalHints: number;
  hintContents: string[];
  solutionHtml: string;
}

export function HintReveal({ problemId, totalHints, hintContents, solutionHtml }: Props) {
  const progressKey = STORAGE_KEYS.PROBLEM_PROGRESS;
  const [revealedHints, setRevealedHints] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    const initial = getProgressDetail(readProgressStore(progressKey), problemId);
    setRevealedHints(Math.min(totalHints, Math.max(0, initial.hintRevealedCount)));
    setShowAnswer(initial.solutionRevealed);
  }, [problemId, totalHints, progressKey]);

  const persist = (patch: {
    status?: 'none' | 'progress' | 'done';
    hintRevealedCount?: number;
    solutionRevealed?: boolean;
  }) => {
    const store = readProgressStore(progressKey);
    const prev = getProgressDetail(store, problemId);
    const statusRank = { none: 0, progress: 1, done: 2 } as const;
    const nextStatus = patch.status
      ? statusRank[patch.status] > statusRank[prev.status]
        ? patch.status
        : prev.status
      : prev.status;
    store.byId[problemId] = {
      ...prev,
      ...patch,
      status: nextStatus,
      lastSeenAt: Date.now(),
    };
    writeProgressStore(progressKey, store);
    emitDashboardRefresh();
    void import('../../lib/client/firebase-sync').then(({ enqueueSyncPatch }) => {
      const snapshot = getProgressDetail(store, problemId);
      enqueueSyncPatch('progress', problemId, {
        status: snapshot.status,
        hintRevealedCount: snapshot.hintRevealedCount,
        solutionRevealed: snapshot.solutionRevealed,
        lastAnswer: snapshot.lastAnswer,
        lastSeenAt: snapshot.lastSeenAt,
        attemptCount: snapshot.attemptCount,
        attemptCountMax: snapshot.attemptCount,
      });
    });
  };

  function revealNextHint() {
    const next = Math.min(totalHints, revealedHints + 1);
    setRevealedHints(next);
    persist({ status: 'progress', hintRevealedCount: next });
  }

  function revealSolution() {
    setShowAnswer(true);
    persist({ status: 'done', solutionRevealed: true });
  }

  return (
    <div className="not-prose space-y-6 mt-8" data-hint-reveal-island>
      <div className="space-y-4">
        {hintContents.map((hintHtml, index) => {
          const isRevealed = index < revealedHints;
          const isNext = index === revealedHints;

          return (
            <div
              key={index}
              className={`transition-opacity duration-200 ease-out ${
                isRevealed ? '' : isNext ? '' : 'opacity-[0.35]'
              }`}
            >
              {isRevealed ? (
                <div className="flex flex-col">
                  <button
                    type="button"
                    className="w-full bg-slate-800 text-left px-4 text-white py-3 rounded-lg type-caption font-semibold mb-2 flex items-center justify-between cursor-default dark:bg-slate-700"
                  >
                    <span>STEP {index + 1}</span>
                    <CheckCircle2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  </button>
                  <div
                    className="motion-hint-expand type-body text-slate-600 bg-slate-50 p-4 rounded border-l-4 border-indigo-400 italic dark:text-slate-300 dark:bg-slate-900/60 dark:border-indigo-500 prose prose-book max-w-none"
                    dangerouslySetInnerHTML={{ __html: hintHtml }}
                  />
                </div>
              ) : isNext ? (
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={revealNextHint}
                    className="w-full border-2 border-dashed border-indigo-300 py-3 rounded-lg type-caption font-semibold mb-2 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-500/50 dark:text-indigo-400 dark:hover:bg-indigo-950/40 transition-[background-color,border-color] duration-200 ease-out flex items-center justify-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    STEP {index + 1} 힌트 보기
                  </button>
                </div>
              ) : (
                <div className="flex flex-col">
                  <button
                    type="button"
                    disabled
                    className="w-full border-2 border-dashed border-slate-300 py-3 rounded-lg type-caption font-semibold mb-2 text-slate-400 flex items-center justify-center dark:border-slate-600 dark:text-slate-600"
                  >
                    STEP {index + 1}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(totalHints === 0 || revealedHints >= totalHints) && (
        <div className="motion-block-reveal mt-12 rounded-xl border border-slate-200 learn-surface dark:border-slate-700">
          {!showAnswer ? (
            <div className="book-card--compact sm:px-8 sm:py-8 text-center flex flex-col items-center">
              <div className="mb-5 rounded-full border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800/60 dark:bg-indigo-950/40">
                <CheckCircle2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="type-heading mb-2">
                {totalHints === 0 ? '이 문제는 단계별 힌트가 없습니다' : '모든 힌트를 확인하셨습니다'}
              </h3>
              <p className="type-lead mb-8 max-w-sm">
                {totalHints === 0
                  ? '스스로 충분히 풀어 본 뒤, 필요할 때만 아래에서 풀이를 확인해 보세요.'
                  : '자신의 힘으로 끝까지 답을 계산해 보는 것이 실력 향상의 핵심입니다.'}
              </p>
              <button
                type="button"
                onClick={revealSolution}
                className="flex items-center gap-2 rounded bg-indigo-600 px-6 py-3.5 type-caption font-medium text-white shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 transition-[background-color,box-shadow] duration-200 ease-out"
              >
                최종 풀이 확인하기
              </button>
            </div>
          ) : (
            <div className="book-card sm:px-8 sm:py-8 motion-fade-in learn-emphasis">
              <div className="flex items-center justify-between border-b border-slate-200 pb-5 mb-5 gap-3 dark:border-slate-700">
                <h3 className="type-subhead">최종 풀이</h3>
                <button
                  type="button"
                  onClick={() => setShowAnswer(false)}
                  className="type-caption text-indigo-700 hover:text-indigo-900 font-medium flex items-center gap-1 bg-indigo-100 hover:bg-indigo-200 px-3 py-1.5 rounded transition-colors shrink-0 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-200"
                >
                  가리기 <ChevronDown className="h-4 w-4 rotate-180" />
                </button>
              </div>
              <div
                className="type-body text-slate-900 dark:text-slate-100 font-medium prose prose-book max-w-none"
                dangerouslySetInnerHTML={{ __html: solutionHtml }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
