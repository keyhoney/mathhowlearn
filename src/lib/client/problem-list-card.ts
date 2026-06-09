import { STORAGE_KEYS } from '../storage-keys';

export type ProblemListCardData = {
  id: string;
  source: string;
  subject: string;
  chapter: string;
  subChapter: string;
  concept: string;
  year: number;
  month: number;
  examType: string;
  difficulty: number;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type ProgressDetail = {
  status: string;
  hintRevealedCount: number;
  solutionRevealed: boolean;
  lastSeenAt: number;
};

function getProgressDetail(raw: unknown): ProgressDetail {
  if (!raw) return { status: 'none', hintRevealedCount: 0, solutionRevealed: false, lastSeenAt: 0 };
  if (typeof raw === 'string') {
    return { status: raw, hintRevealedCount: 0, solutionRevealed: false, lastSeenAt: 0 };
  }
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    return {
      status: String(o.status || 'none'),
      hintRevealedCount: Number(o.hintRevealedCount || 0),
      solutionRevealed: Boolean(o.solutionRevealed),
      lastSeenAt: Number(o.lastSeenAt || 0),
    };
  }
  return { status: 'none', hintRevealedCount: 0, solutionRevealed: false, lastSeenAt: 0 };
}

const progressBadgeClass: Record<string, string> = {
  none: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  progress: 'bg-amber-50 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200',
  done: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
};

const progressLabel: Record<string, string> = { none: '미시작', progress: '진행 중', done: '완료' };

function renderDifficultyStars(value: number): string {
  const n = Math.min(5, Math.max(0, Math.round(Number(value) || 0)));
  const stars = [0, 1, 2, 3, 4]
    .map(
      (i) =>
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-3 w-3 ${i < n ? 'fill-orange-400 text-orange-400' : 'text-orange-200 dark:text-orange-900/50'}" aria-hidden="true"><path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
    )
    .join('');
  return `<span class="type-caption inline-flex items-center gap-0.5 rounded-full bg-orange-50 px-2 py-0.5 font-medium text-orange-800 dark:bg-orange-950/40 dark:text-orange-200" aria-label="난이도 ${n}단계">난이도<span class="ml-0.5 flex">${stars}</span></span>`;
}

function buildProgressMeta(problemId: string): string {
  if (typeof localStorage === 'undefined') return '아직 기록 없음';

  const progress = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.PROBLEM_PROGRESS) || '{"byId":{}}',
  ) as { byId?: Record<string, unknown> };
  const bookmarks = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.BOOKMARK) || '{"byId":{}}',
  ) as { byId?: Record<string, boolean> };
  const wrongNotes = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.WRONG_NOTE) || '{"byId":{}}',
  ) as { byId?: Record<string, { entries?: unknown[] }> };

  const detail = getProgressDetail(progress.byId?.[problemId]);
  const bookmarked = Boolean(bookmarks.byId?.[problemId]);
  const hasWrong = Boolean(wrongNotes.byId?.[problemId]?.entries?.length);

  const parts = [progressLabel[detail.status] || progressLabel.none];
  if (detail.lastSeenAt > 0) {
    const d = new Date(detail.lastSeenAt);
    parts.push(`마지막 ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`);
  }
  if (detail.hintRevealedCount > 0) parts.push(`힌트 ${detail.hintRevealedCount}개`);
  if (detail.solutionRevealed) parts.push('풀이 열람');
  if (hasWrong) parts.push('오답');
  if (bookmarked) parts.push('스크랩');

  return parts.join(' · ');
}

/** @deprecated 목록 카드에 진행 메타가 직접 표시됩니다 */
export function buildProblemStateBadgesHtml(problemId: string): string {
  return buildProgressMeta(problemId);
}

export function renderProblemListCardHtml(row: ProblemListCardData, href: string): string {
  const progress = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.PROBLEM_PROGRESS) || '{"byId":{}}',
  ) as { byId?: Record<string, unknown> };
  const detail = getProgressDetail(progress.byId?.[row.id]);
  const st = detail.status;
  const metaLine = buildProgressMeta(row.id);
  const baseTitle = `${row.subject} · ${row.chapter} · ${row.concept}`;

  return `<li class="h-full">
    <a
      href="${escapeHtml(href)}"
      data-problem-card
      data-problem-id="${escapeHtml(row.id)}"
      title="${escapeHtml(`${baseTitle} · ${metaLine}`)}"
      class="group flex h-full flex-col book-card border border-indigo-500/10 bg-[var(--surface-1)] transition-colors hover:bg-[var(--surface-2)] dark:border-indigo-500/10"
    >
      <div class="flex flex-wrap items-start justify-between gap-2">
        <h2 class="type-heading transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">${escapeHtml(row.source)}</h2>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <span class="type-caption rounded-full px-2 py-0.5 font-medium ${progressBadgeClass[st] || progressBadgeClass.none}">${progressLabel[st] || progressLabel.none}</span>
          <span class="type-caption rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">${row.year}.${String(row.month).padStart(2, '0')}</span>
        </div>
      </div>
      <p class="type-caption chrome-muted mt-2">${escapeHtml(row.subject)} · ${escapeHtml(row.chapter)} · ${escapeHtml(row.concept)}</p>
      <p class="type-caption chrome-muted mt-1">${escapeHtml(row.examType)}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">${renderDifficultyStars(row.difficulty)}</div>
      <p class="type-caption mt-2 text-[var(--fg-muted)]">${escapeHtml(metaLine)}</p>
      <div class="mt-auto flex items-center justify-end pt-3">
        <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--fg-muted)] transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:bg-indigo-950/50 dark:group-hover:text-indigo-400">
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd"/></svg>
        </span>
      </div>
    </a>
  </li>`;
}
