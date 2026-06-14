type StorageKeys = {
  PROBLEM_PROGRESS: string;
  BOOKMARK: string;
  WRONG_NOTE: string;
};

type SubjectChapterTree = Record<string, Record<string, Record<string, string[]>>>;

type ProgressDetail = {
  status: string;
  hintRevealedCount: number;
  solutionRevealed: boolean;
  lastSeenAt: number;
};

declare global {
  interface Window {
    __howlearnRenderAppPagination?: (
      root: HTMLElement,
      config: { basePath: string; currentPage: number; totalPages: number; perPage: number },
    ) => void;
  }
}

const progressBadgeClass: Record<string, string> = {
  none: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  progress: 'bg-amber-50 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200',
  done: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
};

const progressLabel: Record<string, string> = { none: '미시작', progress: '진행 중', done: '완료' };

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getProgressDetail(raw: unknown): ProgressDetail {
  if (!raw) return { status: 'none', hintRevealedCount: 0, solutionRevealed: false, lastSeenAt: 0 };
  if (typeof raw === 'string') return { status: raw, hintRevealedCount: 0, solutionRevealed: false, lastSeenAt: 0 };
  if (typeof raw !== 'object') return { status: 'none', hintRevealedCount: 0, solutionRevealed: false, lastSeenAt: 0 };
  const o = raw as Record<string, unknown>;
  return {
    status: String(o.status || 'none'),
    hintRevealedCount: Number(o.hintRevealedCount || 0),
    solutionRevealed: Boolean(o.solutionRevealed),
    lastSeenAt: Number(o.lastSeenAt || 0),
  };
}

function renderStateMeta(
  el: Element,
  detail: ProgressDetail,
  extras: { bookmarked?: boolean; hasWrong?: boolean; titleMode?: 'append' | 'replace' },
): void {
  const valueStatus = detail.status;
  const stateEl = el.querySelector('[data-problem-state]');
  const metaEl = el.querySelector('[data-problem-state-meta]');
  const stateBadgeEl = el.querySelector('[data-problem-state-badge]');
  if (stateBadgeEl) {
    stateBadgeEl.className = `type-caption rounded-full px-2 py-0.5 font-medium ${
      progressBadgeClass[valueStatus] || progressBadgeClass.none
    }`;
    stateBadgeEl.textContent = progressLabel[valueStatus] || progressLabel.none;
  }

  const metaParts = [progressLabel[valueStatus] || progressLabel.none];
  if (detail.lastSeenAt > 0) {
    const d = new Date(detail.lastSeenAt);
    metaParts.push(`마지막 ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`);
  }
  if (detail.hintRevealedCount > 0) metaParts.push(`힌트 ${detail.hintRevealedCount}개`);
  if (detail.solutionRevealed) metaParts.push('풀이 열람');
  if (extras.hasWrong) metaParts.push('오답');
  if (extras.bookmarked) metaParts.push('스크랩');

  const metaText = metaParts.join(' · ');
  if (metaEl) metaEl.textContent = metaText;
  if (stateEl) stateEl.textContent = metaText;
  if (metaParts.length > 0) {
    const title =
      extras.titleMode === 'replace'
        ? metaText
        : `${el.getAttribute('title') || ''} · ${metaText}`.replace(/^ · /, '');
    el.setAttribute('title', title);
  }
}

function preserveListStateLinks(): void {
  const currentQuery = window.location.search;
  if (!currentQuery) return;
  document.querySelectorAll('a[data-preserve-list-state-link]').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (!href || href.includes('?')) return;
    anchor.setAttribute('href', `${href}${currentQuery}`);
  });
}

function renderPagination(root: HTMLElement, basePath: string, visibleItems: Element[], page: number, perPage: number): void {
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / perPage));
  const currentPage = Math.min(page, totalPages);
  visibleItems.forEach((li, idx) => {
    const show = idx >= (currentPage - 1) * perPage && idx < currentPage * perPage;
    li.classList.toggle('hidden', !show);
  });

  const render = () => {
    if (typeof window.__howlearnRenderAppPagination !== 'function') return false;
    window.__howlearnRenderAppPagination(root, { basePath, currentPage, totalPages, perPage });
    return true;
  };

  if (!render()) {
    let retries = 0;
    const maxRetries = 20;
    const tick = () => {
      if (render()) return;
      retries += 1;
      if (retries < maxRetries) window.setTimeout(tick, 50);
    };
    tick();
  }
}

export function initProblemListPage({
  subjectChapterTree,
  storageKeys,
}: {
  subjectChapterTree: SubjectChapterTree;
  storageKeys: StorageKeys;
}): void {
  const tree = subjectChapterTree;
  const sub = document.getElementById('filter-subject') as HTMLSelectElement | null;
  const ch = document.getElementById('filter-chapter') as HTMLSelectElement | null;
  const subCh = document.getElementById('filter-sub-chapter') as HTMLSelectElement | null;
  const co = document.getElementById('filter-concept') as HTMLSelectElement | null;
  const form = document.querySelector<HTMLFormElement>('[data-problem-filter-form]');
  const filteredCountEl = document.querySelector('[data-filtered-count]');
  const paginationRoot = document.getElementById('problems-pagination');
  if (!sub || !ch || !subCh || !co || !tree || !form || !filteredCountEl || !paginationRoot) return;

  const perPageOptions = [12, 24, 48];
  const query = new URLSearchParams(window.location.search);

  function normalizeParams(subject: string, chapter: string, subChapter: string, concept: string) {
    const s = subject.trim();
    const chName = chapter.trim();
    const subChName = subChapter.trim();
    const coName = concept.trim();
    if (!s || !tree[s]) return { subject: '', chapter: '', subChapter: '', concept: '' };
    const chapters = Object.keys(tree[s]);
    if (!chName || !chapters.includes(chName)) return { subject: s, chapter: '', subChapter: '', concept: '' };
    const subChapters = Object.keys(tree[s]?.[chName] ?? {});
    if (!subChName || !subChapters.includes(subChName)) return { subject: s, chapter: chName, subChapter: '', concept: '' };
    const concepts = tree[s]?.[chName]?.[subChName] ?? [];
    if (!coName || !concepts.includes(coName)) return { subject: s, chapter: chName, subChapter: subChName, concept: '' };
    return { subject: s, chapter: chName, subChapter: subChName, concept: coName };
  }

  function setConceptOptions(subj: string, chapterName: string, subChapterName: string, keepConcept: string) {
    co.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = subChapterName ? '전체 소단원' : chapterName ? '중단원을 먼저 선택' : subj ? '단원을 먼저 선택' : '과목을 먼저 선택';
    co.appendChild(opt0);
    co.disabled = !subChapterName;
    if (!subj || !chapterName || !subChapterName || !tree[subj]?.[chapterName]?.[subChapterName]) return;
    for (const name of tree[subj][chapterName][subChapterName]) {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      if (keepConcept && name === keepConcept) o.selected = true;
      co.appendChild(o);
    }
  }

  function setSubChapterOptions(subj: string, chapterName: string, keepSubChapter: string, keepConcept: string) {
    subCh.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = chapterName ? '전체 중단원' : subj ? '단원을 먼저 선택' : '과목을 먼저 선택';
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

  function setChapterOptions(subj: string, keepChapter: string, keepSubChapter: string, keepConcept: string) {
    ch.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = subj ? '전체 단원' : '과목을 먼저 선택';
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

  const normalized = normalizeParams(query.get('subject') ?? '', query.get('chapter') ?? '', query.get('subChapter') ?? '', query.get('concept') ?? '');
  const examType = query.get('examType') ?? '';
  const year = query.get('year') ?? '';
  const month = query.get('month') ?? '';
  const statusFilter = query.get('status') ?? 'all';
  const wrongOnly = query.get('wrongOnly') === '1';
  const bookmarkedOnly = query.get('bookmarkedOnly') === '1';
  const perPageRaw = Number.parseInt(query.get('perPage') ?? '12', 10);
  const perPage = perPageOptions.includes(perPageRaw) ? perPageRaw : 12;
  const pageRaw = Number.parseInt(query.get('page') ?? '1', 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  (form.querySelector('[name="examType"]') as HTMLSelectElement | null)!.value = examType;
  sub.value = normalized.subject;
  setChapterOptions(normalized.subject, normalized.chapter, normalized.subChapter, normalized.concept);
  (form.querySelector('[name="year"]') as HTMLSelectElement | null)!.value = year;
  (form.querySelector('[name="month"]') as HTMLSelectElement | null)!.value = month;
  (form.querySelector('[name="status"]') as HTMLSelectElement | null)!.value = statusFilter;
  (form.querySelector('[name="wrongOnly"]') as HTMLInputElement | null)!.checked = wrongOnly;
  (form.querySelector('[name="bookmarkedOnly"]') as HTMLInputElement | null)!.checked = bookmarkedOnly;

  sub.addEventListener('change', () => setChapterOptions(sub.value, '', '', ''));
  ch.addEventListener('change', () => setSubChapterOptions(sub.value, ch.value, '', ''));
  subCh.addEventListener('change', () => setConceptOptions(sub.value, ch.value, subCh.value, ''));
  form.addEventListener('submit', () => {
    const pageField = document.createElement('input');
    pageField.type = 'hidden';
    pageField.name = 'page';
    pageField.value = '1';
    form.appendChild(pageField);
  });

  const progress = parse<{ byId?: Record<string, unknown> }>(localStorage.getItem(storageKeys.PROBLEM_PROGRESS), { byId: {} });
  const bookmarks = parse<{ byId?: Record<string, unknown> }>(localStorage.getItem(storageKeys.BOOKMARK), { byId: {} });
  const wrongNotes = parse<{ byId?: Record<string, { entries?: unknown[] }> }>(localStorage.getItem(storageKeys.WRONG_NOTE), { byId: {} });
  preserveListStateLinks();

  const visibleItems: Element[] = [];
  document.querySelectorAll('[data-problem-card]').forEach((el) => {
    const id = el.getAttribute('data-problem-id') || '';
    const detail = getProgressDetail(progress.byId?.[id]);
    const valueStatus = detail.status;
    const bookmarked = Boolean(bookmarks.byId?.[id]);
    const hasWrong = Boolean(wrongNotes.byId?.[id]?.entries?.length);
    const mismatchServerFilter =
      (examType && (el.getAttribute('data-exam-type') || '') !== examType) ||
      (normalized.subject && (el.getAttribute('data-subject') || '') !== normalized.subject) ||
      (normalized.chapter && (el.getAttribute('data-chapter') || '') !== normalized.chapter) ||
      (normalized.subChapter && (el.getAttribute('data-sub-chapter') || '') !== normalized.subChapter) ||
      (normalized.concept && (el.getAttribute('data-concept') || '') !== normalized.concept) ||
      (year && (el.getAttribute('data-year') || '') !== year) ||
      (month && (el.getAttribute('data-month') || '') !== month);
    const mismatchStatus = statusFilter !== 'all' && valueStatus !== statusFilter;
    const mismatchWrong = wrongOnly && !hasWrong;
    const mismatchBookmark = bookmarkedOnly && !bookmarked;
    const li = el.parentElement;
    if (!li) return;
    renderStateMeta(el, detail, { bookmarked, hasWrong, titleMode: 'append' });
    const matched = !(mismatchServerFilter || mismatchStatus || mismatchWrong || mismatchBookmark);
    li.classList.toggle('hidden', !matched);
    if (matched) visibleItems.push(li);
  });

  filteredCountEl.textContent = String(visibleItems.length);
  renderPagination(paginationRoot, '/problems', visibleItems, page, perPage);
}

export function initEssayProblemListPage({ storageKeys }: { storageKeys: StorageKeys }): void {
  const query = new URLSearchParams(window.location.search);
  const statusFilter = query.get('status') ?? 'all';
  const bookmarkedOnly = query.get('bookmarked') === '1';
  const university = query.get('university') ?? '';
  const year = query.get('year') ?? '';
  const perPageOptions = [12, 24, 48];
  const perPageRaw = Number.parseInt(query.get('perPage') ?? '12', 10);
  const perPage = perPageOptions.includes(perPageRaw) ? perPageRaw : 12;
  const pageRaw = Number.parseInt(query.get('page') ?? '1', 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const form = document.querySelector<HTMLFormElement>('[data-essay-filter-form]');
  const filteredCountEl = document.querySelector('[data-filtered-count]');
  const paginationRoot = document.getElementById('essay-problems-pagination');
  if (!form || !filteredCountEl || !paginationRoot) return;

  (form.querySelector('[name="university"]') as HTMLSelectElement | null)!.value = university;
  (form.querySelector('[name="year"]') as HTMLSelectElement | null)!.value = year;
  (form.querySelector('[name="status"]') as HTMLSelectElement | null)!.value = statusFilter;
  (form.querySelector('[name="bookmarked"]') as HTMLInputElement | null)!.checked = bookmarkedOnly;
  form.addEventListener('submit', () => {
    const pageField = document.createElement('input');
    pageField.type = 'hidden';
    pageField.name = 'page';
    pageField.value = '1';
    form.appendChild(pageField);
  });

  const progress = parse<{ byId?: Record<string, unknown> }>(localStorage.getItem(storageKeys.PROBLEM_PROGRESS), { byId: {} });
  const bookmarks = parse<{ byId?: Record<string, unknown> }>(localStorage.getItem(storageKeys.BOOKMARK), { byId: {} });
  preserveListStateLinks();

  const visibleItems: Element[] = [];
  document.querySelectorAll('[data-problem-card]').forEach((el) => {
    const id = el.getAttribute('data-problem-id') || '';
    const detail = getProgressDetail(progress.byId?.[id]);
    const valueStatus = detail.status;
    const bookmarked = Boolean(bookmarks.byId?.[id]);
    renderStateMeta(el, detail, { bookmarked, titleMode: 'replace' });

    const mismatchServerFilter =
      (university && (el.getAttribute('data-university') || '') !== university) ||
      (year && (el.getAttribute('data-year') || '') !== year);
    const mismatchStatus = statusFilter !== 'all' && valueStatus !== statusFilter;
    const mismatchBookmark = bookmarkedOnly && !bookmarked;
    const li = el.parentElement;
    if (!li) return;
    const matched = !(mismatchServerFilter || mismatchStatus || mismatchBookmark);
    li.classList.toggle('hidden', !matched);
    if (matched) visibleItems.push(li);
  });
  filteredCountEl.textContent = String(visibleItems.length);
  renderPagination(paginationRoot, '/essay-problems', visibleItems, page, perPage);
}
