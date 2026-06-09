import {
  ANSWER_TYPES,
  DIFFICULTY_LEVELS,
  buildConceptFrequencyMatrix,
  filterConceptFrequencyRows,
  normalizeYearRange,
  sortConceptFrequencyRows,
  type ConceptFrequencyFilters,
  type ConceptFrequencyRow,
  type ExamScope,
} from '../problem-concept-frequency';
import { renderProblemListCardHtml } from './problem-list-card';

export type ProblemSubjectChapterTree = Record<string, Record<string, Record<string, string[]>>>;

export type ConceptFrequencyPageConfig = {
  rows: ConceptFrequencyRow[];
  subjectChapterTree: ProblemSubjectChapterTree;
  /** 데이터에 존재하는 연도 목록 (오름차순) */
  years: number[];
  yearMin: number;
  yearMax: number;
};

/** 최소 연도가 최대를 초과하지 않도록 선택값·옵션을 맞춘다 */
export function syncYearSelects(
  yearMinSelect: HTMLSelectElement,
  yearMaxSelect: HTMLSelectElement,
  years: number[],
  changed?: 'min' | 'max',
): void {
  if (years.length === 0) return;

  const boundMin = years[0]!;
  const boundMax = years[years.length - 1]!;

  let min = Number.parseInt(yearMinSelect.value, 10);
  let max = Number.parseInt(yearMaxSelect.value, 10);
  if (!Number.isFinite(min)) min = boundMin;
  if (!Number.isFinite(max)) max = boundMax;

  if (changed === 'min' && min > max) {
    max = min;
    yearMaxSelect.value = String(max);
  } else if (changed === 'max' && max < min) {
    min = max;
    yearMinSelect.value = String(min);
  } else if (min > max) {
    const normalized = normalizeYearRange(min, max);
    min = normalized.yearMin;
    max = normalized.yearMax;
    yearMinSelect.value = String(min);
    yearMaxSelect.value = String(max);
  }

  for (const opt of yearMinSelect.options) {
    const y = Number.parseInt(opt.value, 10);
    if (!Number.isFinite(y)) continue;
    opt.disabled = y > max;
  }
  for (const opt of yearMaxSelect.options) {
    const y = Number.parseInt(opt.value, 10);
    if (!Number.isFinite(y)) continue;
    opt.disabled = y < min;
  }
}

const ANSWER_LABELS: Record<'mcq' | 'short', string> = {
  short: '단답형',
  mcq: '객관식',
};

const EXAM_SCOPE_LABELS: Record<ExamScope, string> = {
  mock: '모평만',
  csat: '수능만',
  all: '모평·수능 모두',
};

function normalizeParams(
  tree: ProblemSubjectChapterTree,
  subject: string,
  chapter: string,
  subChapter: string,
  concept: string,
) {
  const s = subject.trim();
  let ch = chapter.trim();
  let sub = subChapter.trim();
  let co = concept.trim();
  if (!s || !tree[s]) return { subject: '', chapter: '', subChapter: '', concept: '' };
  const chapters = Object.keys(tree[s]);
  if (!ch || !chapters.includes(ch)) return { subject: s, chapter: '', subChapter: '', concept: '' };
  const subChapters = Object.keys(tree[s][ch] ?? {});
  if (!sub || !subChapters.includes(sub)) return { subject: s, chapter: ch, subChapter: '', concept: '' };
  const concepts = tree[s][ch][sub] ?? [];
  if (!co || !concepts.includes(co)) return { subject: s, chapter: ch, subChapter: sub, concept: '' };
  return { subject: s, chapter: ch, subChapter: sub, concept: co };
}

function readStateFromUrl(yearMinBound: number, yearMaxBound: number) {
  const query = new URLSearchParams(window.location.search);
  const examScopeRaw = query.get('examScope') ?? 'all';
  const examScope: ExamScope =
    examScopeRaw === 'mock' || examScopeRaw === 'csat' ? examScopeRaw : 'all';
  const yearMinRaw = Number.parseInt(query.get('yearMin') ?? String(yearMinBound), 10);
  const yearMaxRaw = Number.parseInt(query.get('yearMax') ?? String(yearMaxBound), 10);
  const yearMin = Number.isFinite(yearMinRaw) ? yearMinRaw : yearMinBound;
  const yearMax = Number.isFinite(yearMaxRaw) ? yearMaxRaw : yearMaxBound;
  const normalizedYears = normalizeYearRange(yearMin, yearMax);
  return {
    subject: query.get('subject') ?? '',
    chapter: query.get('chapter') ?? '',
    subChapter: query.get('subChapter') ?? '',
    concept: query.get('concept') ?? '',
    examScope,
    yearMin: normalizedYears.yearMin,
    yearMax: normalizedYears.yearMax,
  };
}

function maxDataCellCount(matrix: ReturnType<typeof buildConceptFrequencyResult>): number {
  let max = 0;
  for (const d of DIFFICULTY_LEVELS) {
    for (const t of ANSWER_TYPES) {
      max = Math.max(max, matrix.cells[d][t]);
    }
  }
  return max;
}

/** 표 본문 셀 값 대비 0~5 단계 (히트맵) */
function heatLevel(count: number, maxData: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (count <= 0 || maxData <= 0) return 0;
  const ratio = count / maxData;
  if (ratio >= 0.85) return 5;
  if (ratio >= 0.65) return 4;
  if (ratio >= 0.45) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

function formatHeatCell(count: number, maxData: number): string {
  const level = heatLevel(count, maxData);
  return `<td class="app-frequency-table__num app-frequency-table__heat app-frequency-table__heat--${level}" data-count="${count}">${count}</td>`;
}

function syncUrl(state: ReturnType<typeof readStateFromUrl>) {
  const params = new URLSearchParams();
  if (state.subject) params.set('subject', state.subject);
  if (state.chapter) params.set('chapter', state.chapter);
  if (state.subChapter) params.set('subChapter', state.subChapter);
  if (state.concept) params.set('concept', state.concept);
  params.set('examScope', state.examScope);
  params.set('yearMin', String(state.yearMin));
  params.set('yearMax', String(state.yearMax));
  const qs = params.toString();
  const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, '', next);
}

function renderMatrix(
  tableRoot: HTMLElement,
  matrix: ReturnType<typeof buildConceptFrequencyResult>,
  showTotals: boolean,
) {
  const headCells = ANSWER_TYPES.map(
    (t) => `<th scope="col">${ANSWER_LABELS[t]}</th>`,
  ).join('');
  const totalHead = showTotals
    ? '<th scope="col" class="app-frequency-table__total-col">행 합계</th>'
    : '';
  const maxData = maxDataCellCount(matrix);

  const bodyRows = DIFFICULTY_LEVELS.map((d) => {
    const cells = ANSWER_TYPES.map((t) => formatHeatCell(matrix.cells[d][t], maxData)).join('');
    const rowTotal = showTotals
      ? `<td class="app-frequency-table__num app-frequency-table__total app-frequency-table__total-col">${matrix.rowTotals[d]}</td>`
      : '';
    return `<tr><th scope="row">난이도 ${d}</th>${cells}${rowTotal}</tr>`;
  }).join('');

  const footer = showTotals
    ? `<tr class="app-frequency-table__foot"><th scope="row">열 합계</th>${ANSWER_TYPES.map(
        (t) =>
          `<td class="app-frequency-table__num app-frequency-table__total">${matrix.colTotals[t]}</td>`,
      ).join('')}<td class="app-frequency-table__num app-frequency-table__grand app-frequency-table__total-col">${matrix.grandTotal}</td></tr>`
    : '';

  tableRoot.innerHTML = `
    <table class="app-frequency-table w-full min-w-[20rem] border-collapse text-sm">
      <thead>
        <tr>
          <th scope="col"></th>
          ${headCells}
          ${totalHead}
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
      ${footer ? `<tfoot>${footer}</tfoot>` : ''}
    </table>
  `;
}

function renderProblemList(
  listRoot: HTMLElement,
  listWrap: HTMLElement,
  listEmpty: HTMLElement,
  matched: ConceptFrequencyRow[],
  listQuery: string,
): void {
  const sorted = sortConceptFrequencyRows(matched);
  listWrap.classList.remove('hidden');

  if (sorted.length === 0) {
    listRoot.innerHTML = '';
    listEmpty.classList.remove('hidden');
    return;
  }

  listEmpty.classList.add('hidden');
  const qs = listQuery || '';
  listRoot.innerHTML = sorted
    .map((row) => {
      const href = `/problems/${encodeURIComponent(row.id)}${qs}`;
      return renderProblemListCardHtml(
        {
          id: row.id,
          source: row.source,
          subject: row.subject,
          chapter: row.chapter,
          subChapter: row.subChapter,
          concept: row.concept,
          year: row.year,
          month: row.month,
          examType: row.examType,
          difficulty: row.difficulty,
        },
        href,
      );
    })
    .join('');
}

export function initConceptFrequencyPage(config: ConceptFrequencyPageConfig): void {
  const {
    rows,
    subjectChapterTree: tree,
    years: availableYears,
    yearMin: yearMinBound,
    yearMax: yearMaxBound,
  } = config;

  const form = document.querySelector<HTMLFormElement>('[data-concept-frequency-form]');
  const sub = document.getElementById('cf-filter-subject') as HTMLSelectElement | null;
  const ch = document.getElementById('cf-filter-chapter') as HTMLSelectElement | null;
  const subCh = document.getElementById('cf-filter-sub-chapter') as HTMLSelectElement | null;
  const co = document.getElementById('cf-filter-concept') as HTMLSelectElement | null;
  const summaryEl = document.querySelector<HTMLElement>('[data-concept-frequency-summary]');
  const emptyEl = document.querySelector<HTMLElement>('[data-concept-frequency-empty]');
  const tableWrap = document.querySelector<HTMLElement>('[data-concept-frequency-table]');
  const tableRoot = document.querySelector<HTMLElement>('[data-concept-frequency-table-root]');
  const totalBadge = document.querySelector<HTMLElement>('[data-concept-frequency-total]');
  const listWrap = document.querySelector<HTMLElement>('[data-concept-frequency-list-wrap]');
  const listRoot = document.querySelector<HTMLElement>('[data-concept-frequency-list]');
  const listEmpty = document.querySelector<HTMLElement>('[data-concept-frequency-list-empty]');

  if (
    !form ||
    !sub ||
    !ch ||
    !subCh ||
    !co ||
    !summaryEl ||
    !emptyEl ||
    !tableWrap ||
    !tableRoot ||
    !listWrap ||
    !listRoot ||
    !listEmpty
  ) {
    return;
  }

  function setChapterOptions(subj: string, keepChapter: string, keepSubChapter: string, keepConcept: string) {
    ch.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = subj ? '단원 선택' : '과목을 먼저 선택';
    ch.appendChild(opt0);
    ch.disabled = !subj;
    if (!subj || !tree[subj]) {
      setSubChapterOptions('', '', '', '');
      return;
    }
    for (const name of Object.keys(tree[subj])) {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      if (keepChapter && name === keepChapter) o.selected = true;
      ch.appendChild(o);
    }
    setSubChapterOptions(subj, ch.value, keepSubChapter, keepConcept);
  }

  function setSubChapterOptions(
    subj: string,
    chapterName: string,
    keepSubChapter: string,
    keepConcept: string,
  ) {
    subCh.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = chapterName ? '중단원 선택' : subj ? '단원을 먼저 선택' : '과목을 먼저 선택';
    subCh.appendChild(opt0);
    subCh.disabled = !chapterName;
    if (!subj || !chapterName || !tree[subj]?.[chapterName]) {
      setConceptOptions('', '', '', '');
      return;
    }
    for (const name of Object.keys(tree[subj][chapterName])) {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      if (keepSubChapter && name === keepSubChapter) o.selected = true;
      subCh.appendChild(o);
    }
    setConceptOptions(subj, chapterName, subCh.value, keepConcept);
  }

  function setConceptOptions(
    subj: string,
    chapterName: string,
    subChapterName: string,
    keepConcept: string,
  ) {
    co.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = subChapterName ? '개념 선택' : chapterName ? '중단원을 먼저 선택' : '단원을 먼저 선택';
    co.appendChild(opt0);
    co.disabled = !subChapterName;
    if (!subj || !chapterName || !subChapterName || !tree[subj]?.[chapterName]?.[subChapterName]) {
      return;
    }
    for (const name of tree[subj][chapterName][subChapterName]) {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      if (keepConcept && name === keepConcept) o.selected = true;
      co.appendChild(o);
    }
  }

  function getFormState() {
    const examScopeRaw = (form.querySelector<HTMLInputElement>('input[name="examScope"]:checked')?.value ??
      'all') as ExamScope;
    const yearMin = Number.parseInt(
      (form.querySelector<HTMLSelectElement>('[name="yearMin"]')?.value ?? String(yearMinBound)),
      10,
    );
    const yearMax = Number.parseInt(
      (form.querySelector<HTMLSelectElement>('[name="yearMax"]')?.value ?? String(yearMaxBound)),
      10,
    );
    const years = normalizeYearRange(
      Number.isFinite(yearMin) ? yearMin : yearMinBound,
      Number.isFinite(yearMax) ? yearMax : yearMaxBound,
    );
    const taxonomy = normalizeParams(tree, sub.value, ch.value, subCh.value, co.value);
    return {
      ...taxonomy,
      examScope: examScopeRaw === 'mock' || examScopeRaw === 'csat' ? examScopeRaw : 'all',
      yearMin: years.yearMin,
      yearMax: years.yearMax,
    };
  }

  function applyFilters() {
    const state = getFormState();
    syncUrl(state);

    const hasConcept = Boolean(state.subject && state.chapter && state.subChapter && state.concept);
    if (!hasConcept) {
      emptyEl.classList.remove('hidden');
      tableWrap.classList.add('hidden');
      listWrap.classList.add('hidden');
      listRoot.innerHTML = '';
      listEmpty.classList.add('hidden');
      summaryEl.textContent = '과목 → 단원 → 중단원 → 개념을 모두 선택하면 집계가 표시됩니다.';
      if (totalBadge) totalBadge.textContent = '—';
      return;
    }

    const filters: ConceptFrequencyFilters = {
      taxonomy: {
        subject: state.subject,
        chapter: state.chapter,
        subChapter: state.subChapter,
        concept: state.concept,
      },
      examScope: state.examScope,
      yearMin: state.yearMin,
      yearMax: state.yearMax,
    };
    const matched = filterConceptFrequencyRows(rows, filters);
    const matrix = buildConceptFrequencyMatrix(matched);
    const listQuery = window.location.search;

    emptyEl.classList.add('hidden');
    tableWrap.classList.remove('hidden');
    summaryEl.textContent = `${state.subject} › ${state.chapter} › ${state.subChapter} › ${state.concept} · ${EXAM_SCOPE_LABELS[state.examScope]} · ${state.yearMin}~${state.yearMax}학년도`;
    if (totalBadge) totalBadge.textContent = String(matrix.grandTotal);
    renderMatrix(tableRoot, matrix, true);
    renderProblemList(listRoot, listWrap, listEmpty, matched, listQuery);
  }

  const urlState = readStateFromUrl(yearMinBound, yearMaxBound);
  const normalized = normalizeParams(
    tree,
    urlState.subject,
    urlState.chapter,
    urlState.subChapter,
    urlState.concept,
  );

  sub.value = normalized.subject;
  setChapterOptions(normalized.subject, normalized.chapter, normalized.subChapter, normalized.concept);

  const yearMinSelect = form.querySelector<HTMLSelectElement>('[name="yearMin"]');
  const yearMaxSelect = form.querySelector<HTMLSelectElement>('[name="yearMax"]');
  if (yearMinSelect) yearMinSelect.value = String(urlState.yearMin);
  if (yearMaxSelect) yearMaxSelect.value = String(urlState.yearMax);
  if (yearMinSelect && yearMaxSelect && availableYears.length > 0) {
    syncYearSelects(yearMinSelect, yearMaxSelect, availableYears);
  }

  const scopeInput = form.querySelector<HTMLInputElement>(
    `input[name="examScope"][value="${urlState.examScope}"]`,
  );
  if (scopeInput) scopeInput.checked = true;

  sub.addEventListener('change', () => setChapterOptions(sub.value, '', '', ''));
  ch.addEventListener('change', () => setSubChapterOptions(sub.value, ch.value, '', ''));
  subCh.addEventListener('change', () => setConceptOptions(sub.value, ch.value, subCh.value, ''));
  form.addEventListener('change', (e) => {
    const target = e.target;
    if (
      yearMinSelect &&
      yearMaxSelect &&
      availableYears.length > 0 &&
      target instanceof HTMLElement
    ) {
      const changed =
        target === yearMinSelect ? 'min' : target === yearMaxSelect ? 'max' : undefined;
      syncYearSelects(yearMinSelect, yearMaxSelect, availableYears, changed);
    }
    applyFilters();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    applyFilters();
  });

  applyFilters();
}
