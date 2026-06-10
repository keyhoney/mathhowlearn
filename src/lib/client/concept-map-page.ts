import {
  buildConceptActionHref,
  buildConceptListHref,
  summarizeConceptProgress,
  summarizeConceptTotals,
  type ConceptProgressItem,
  type ConceptStatus,
} from '../concept-progress';
import { DASHBOARD_REFRESH_EVENT } from './dashboard-stats';
import { STORAGE_KEYS } from '../storage-keys';

const PROGRESS_SUMMARY_CACHE = 'howlearn-progress-summary-cache';

export type ConceptMapPageConfig = {
  conceptIndex: Record<
    string,
    {
      subject: string;
      chapter: string;
      subChapter: string;
      concept: string;
      problemIds: string[];
    }
  >;
};

type StatusFilter = 'all' | ConceptStatus;

const STATUS_LABEL: Record<ConceptStatus, string> = {
  conquered: '완주',
  'in-progress': '진행 중',
  'not-started': '미시작',
};

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: '전체',
  conquered: '완주',
  'in-progress': '진행 중',
  'not-started': '미시작',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readProgressById(): Record<string, string | { status?: string }> {
  const local = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.PROBLEM_PROGRESS) || '{"v":1,"byId":{}}',
  ) as { byId?: Record<string, string | { status?: string }> };
  const summary = JSON.parse(
    localStorage.getItem(PROGRESS_SUMMARY_CACHE) || '{"v":1,"byId":{}}',
  ) as { byId?: Record<string, string | { status?: string }> };
  const hasCloud = Object.keys(summary.byId ?? {}).length > 0;
  return hasCloud ? (summary.byId ?? {}) : (local.byId ?? {});
}

function readUrlStatus(): StatusFilter {
  const params = new URLSearchParams(window.location.search);
  const statusRaw = params.get('status');
  if (statusRaw === 'conquered' || statusRaw === 'in-progress' || statusRaw === 'not-started') {
    return statusRaw;
  }
  return 'all';
}

function syncUrl(status: StatusFilter): void {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  const qs = params.toString();
  const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, '', next);
}

function renderSummary(
  root: HTMLElement,
  totals: ReturnType<typeof summarizeConceptTotals>,
): void {
  const rate =
    totals.totalConcepts > 0
      ? Math.round((totals.conqueredCount / totals.totalConcepts) * 100)
      : 0;
  root.innerHTML = `
    <div class="concept-map-summary__grid">
      <div class="concept-map-summary__card concept-map-summary__card--conquered">
        <p class="concept-map-summary__label">완주</p>
        <p class="concept-map-summary__value">${totals.conqueredCount}</p>
      </div>
      <div class="concept-map-summary__card concept-map-summary__card--progress">
        <p class="concept-map-summary__label">진행 중</p>
        <p class="concept-map-summary__value">${totals.inProgressCount}</p>
      </div>
      <div class="concept-map-summary__card concept-map-summary__card--none">
        <p class="concept-map-summary__label">미시작</p>
        <p class="concept-map-summary__value">${totals.notStartedCount}</p>
      </div>
      <div class="concept-map-summary__card">
        <p class="concept-map-summary__label">완주율</p>
        <p class="concept-map-summary__value">${rate}<span class="concept-map-summary__unit">%</span></p>
      </div>
    </div>
  `;
}

function renderConceptChip(item: ConceptProgressItem): string {
  const pct =
    item.totalProblems > 0 ? Math.round((item.doneCount / item.totalProblems) * 100) : 0;
  const href = buildConceptActionHref(item);
  const listHref = buildConceptListHref(item);
  const actionLabel =
    item.status === 'conquered'
      ? '기출 목록'
      : item.nextProblemId
        ? '이어 풀기'
        : '기출 목록';

  return `
    <article class="concept-map-chip concept-map-chip--${item.status}">
      <div class="concept-map-chip__head">
        <h3 class="concept-map-chip__title">${escapeHtml(item.concept)}</h3>
        <span class="concept-map-chip__badge">${STATUS_LABEL[item.status]}</span>
      </div>
      <p class="concept-map-chip__meta">${escapeHtml(item.subject)} · ${escapeHtml(item.subChapter)}</p>
      <div class="concept-map-chip__progress" aria-hidden="true">
        <span class="concept-map-chip__progress-fill" style="width:${pct}%"></span>
      </div>
      <p class="concept-map-chip__count">${item.doneCount} / ${item.totalProblems}문항 완료</p>
      <div class="concept-map-chip__actions">
        <a href="${escapeHtml(href)}" class="concept-map-chip__cta">${actionLabel}</a>
        <a href="${escapeHtml(listHref)}" class="concept-map-chip__link">목록</a>
      </div>
    </article>
  `;
}

function groupBySubject(
  items: ConceptProgressItem[],
): Map<string, Map<string, Map<string, ConceptProgressItem[]>>> {
  const grouped = new Map<string, Map<string, Map<string, ConceptProgressItem[]>>>();
  for (const item of items) {
    if (!grouped.has(item.subject)) grouped.set(item.subject, new Map());
    const chapterMap = grouped.get(item.subject)!;
    if (!chapterMap.has(item.chapter)) chapterMap.set(item.chapter, new Map());
    const subMap = chapterMap.get(item.chapter)!;
    if (!subMap.has(item.subChapter)) subMap.set(item.subChapter, []);
    subMap.get(item.subChapter)!.push(item);
  }
  return grouped;
}

function renderMap(root: HTMLElement, items: ConceptProgressItem[]): void {
  if (items.length === 0) {
    root.innerHTML =
      '<p class="text-sm text-[var(--fg-muted)]">선택한 조건에 해당하는 개념이 없습니다.</p>';
    return;
  }

  const grouped = groupBySubject(items);
  const subjectHtml = Array.from(grouped.entries())
    .map(([subject, chapterMap]) => {
      const chapterHtml = Array.from(chapterMap.entries())
        .map(([chapter, subMap]) => {
          const subHtml = Array.from(subMap.entries())
            .map(([subChapter, concepts]) => {
              const chips = concepts.map(renderConceptChip).join('');
              return `
                <section class="concept-map-subchapter">
                  <h3 class="concept-map-subchapter__title">${escapeHtml(subChapter)}</h3>
                  <div class="concept-map-grid">${chips}</div>
                </section>
              `;
            })
            .join('');
          return `
            <section class="concept-map-chapter">
              <h2 class="concept-map-chapter__title">${escapeHtml(chapter)}</h2>
              ${subHtml}
            </section>
          `;
        })
        .join('');
      return `
        <section class="concept-map-subject">
          <h2 class="concept-map-subject__title">${escapeHtml(subject)}</h2>
          ${chapterHtml}
        </section>
      `;
    })
    .join('');

  root.innerHTML = subjectHtml;
}

export function initConceptMapPage(config: ConceptMapPageConfig): void {
  const { conceptIndex } = config;

  const statusRoot = document.querySelector<HTMLElement>('[data-concept-map-status-filter]');
  const summaryRoot = document.querySelector<HTMLElement>('[data-concept-map-summary]');
  const mapRoot = document.querySelector<HTMLElement>('[data-concept-map-root]');

  if (!statusRoot || !summaryRoot || !mapRoot) return;

  let currentStatus: StatusFilter = readUrlStatus();

  function renderStatusFilters(): void {
    const filters: StatusFilter[] = ['all', 'conquered', 'in-progress', 'not-started'];
    statusRoot.innerHTML = filters
      .map((filter) => {
        const active = filter === currentStatus ? ' concept-map-filter--active' : '';
        return `<button type="button" class="concept-map-filter${active}" data-status-filter="${filter}">${STATUS_FILTER_LABEL[filter]}</button>`;
      })
      .join('');
  }

  function apply(): void {
    const progressById = readProgressById();
    const allItems = summarizeConceptProgress(conceptIndex, progressById);
    const filtered =
      currentStatus === 'all'
        ? allItems
        : allItems.filter((item) => item.status === currentStatus);

    renderSummary(summaryRoot, summarizeConceptTotals(allItems));
    renderMap(mapRoot, filtered);
    syncUrl(currentStatus);
  }

  renderStatusFilters();
  apply();

  statusRoot.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-status-filter]');
    if (!target) return;
    const next = target.getAttribute('data-status-filter') as StatusFilter | null;
    if (!next) return;
    currentStatus = next;
    renderStatusFilters();
    apply();
  });

  window.addEventListener(DASHBOARD_REFRESH_EVENT, apply);
  window.addEventListener('storage', (event) => {
    if (
      event.key === STORAGE_KEYS.PROBLEM_PROGRESS ||
      event.key === PROGRESS_SUMMARY_CACHE
    ) {
      apply();
    }
  });
}
