type StorageKeys = {
  PROBLEM_PROGRESS: string;
  WRONG_NOTE: string;
};

type Candidate = {
  id: string;
  href: string;
  title: string;
  meta: string;
  type: string;
  chapter: string;
  subChapter: string;
  concept: string;
};

type WrongRow = {
  id: string;
  ts: number;
  attempts: number;
  item?: Candidate;
};

function escapeHtml(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function initWrongNotePage({
  candidates,
  storageKeys,
}: {
  candidates: Candidate[];
  storageKeys: StorageKeys;
}): void {
  const listEl = document.getElementById('wrong-note-list');
  const emptyEl = document.getElementById('wrong-note-empty');
  const totalEl = document.getElementById('wrong-note-total');
  const clearBtn = document.getElementById('wrong-note-clear');
  const keywordInput = document.getElementById('wrong-note-keyword') as HTMLInputElement | null;
  const typeSelect = document.getElementById('wrong-note-type') as HTMLSelectElement | null;
  const sortSelect = document.getElementById('wrong-note-sort') as HTMLSelectElement | null;
  const topConceptsEl = document.getElementById('wrong-note-top-concepts');
  const repeatCountEl = document.getElementById('wrong-note-repeat-count');
  const conversionRateEl = document.getElementById('wrong-note-conversion-rate');
  const byId = new Map(candidates.map((v) => [v.id, v]));

  function readRows(): WrongRow[] {
    const store = parse<{ byId?: Record<string, { entries?: Array<{ ts?: number }> }> }>(
      localStorage.getItem(storageKeys.WRONG_NOTE),
      { byId: {} },
    );
    return Object.entries(store.byId || {})
      .map(([id, bucket]) => {
        const last = Array.isArray(bucket.entries) && bucket.entries.length > 0 ? bucket.entries[0] : null;
        return { id, ts: last?.ts ?? 0, attempts: bucket.entries?.length ?? 0 };
      })
      .filter((row) => row.ts > 0);
  }

  function render(): void {
    const keyword = String(keywordInput?.value || '').trim().toLowerCase();
    const selectedType = String(typeSelect?.value || 'all');
    const sortBy = String(sortSelect?.value || 'recent');

    let rows = readRows()
      .map((row) => ({ ...row, item: byId.get(row.id) }))
      .filter((row): row is WrongRow & { item: Candidate } => Boolean(row.item));

    const progress = parse<{ byId?: Record<string, string | { status?: string }> }>(
      localStorage.getItem(storageKeys.PROBLEM_PROGRESS),
      { byId: {} },
    );
    const fullWrong = parse<{ byId?: Record<string, { entries?: Array<{ ts?: number }> }> }>(
      localStorage.getItem(storageKeys.WRONG_NOTE),
      { byId: {} },
    );
    const last7d = Date.now() - 1000 * 60 * 60 * 24 * 7;
    const conceptCount = new Map<string, number>();
    let repeatCount = 0;
    let converted = 0;
    rows.forEach((row) => {
      const concept = row.item?.concept;
      if (concept) {
        const entries = fullWrong.byId?.[row.id]?.entries || [];
        entries.forEach((entry) => {
          if ((entry?.ts || 0) >= last7d) {
            conceptCount.set(concept, (conceptCount.get(concept) || 0) + 1);
          }
        });
      }
      if ((row.attempts || 0) >= 2) repeatCount += 1;
      const p = progress.byId?.[row.id];
      const status = typeof p === 'string' ? p : p?.status;
      if (status === 'done') converted += 1;
    });
    const topConcepts = Array.from(conceptCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)
      .join(', ');
    if (topConceptsEl) topConceptsEl.textContent = topConcepts || '-';
    if (repeatCountEl) repeatCountEl.textContent = `${repeatCount}문항`;
    if (conversionRateEl) {
      conversionRateEl.textContent = rows.length > 0 ? `${Math.round((converted / rows.length) * 100)}%` : '0%';
    }

    if (selectedType !== 'all') rows = rows.filter((row) => row.item.type === selectedType);
    if (keyword) {
      rows = rows.filter((row) => {
        const target = `${row.item.title} ${row.item.meta} ${row.item.chapter} ${row.item.subChapter} ${row.item.concept}`.toLowerCase();
        return target.includes(keyword);
      });
    }
    rows.sort((a, b) => {
      if (sortBy === 'name') return a.item.title.localeCompare(b.item.title, 'ko');
      if (sortBy === 'attempts') return b.attempts - a.attempts || b.ts - a.ts;
      return b.ts - a.ts;
    });

    if (totalEl) totalEl.textContent = `${rows.length}건`;
    if (!listEl) return;
    if (rows.length === 0) {
      listEl.innerHTML = '';
      emptyEl?.classList.remove('hidden');
      return;
    }

    emptyEl?.classList.add('hidden');
    listEl.innerHTML = rows
      .map((row) => {
        const it = row.item;
        const when = new Date(row.ts).toLocaleString();
        const meta = it.meta || '';
        return `
          <li class="h-full">
            <a href="${it.href}" title="누적 오답 ${row.attempts}회 · 최근 ${escapeHtml(when)}" class="group flex h-full flex-col book-card border border-slate-200 bg-white transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:bg-slate-800/50">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <h2 class="type-heading group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">${escapeHtml(it.title)}</h2>
                <span class="type-caption shrink-0 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/45 dark:text-amber-200">오답 ${row.attempts}회</span>
              </div>
              <p class="type-caption chrome-muted mt-2">${escapeHtml(meta)}</p>
              <div class="mt-auto flex items-center justify-end pt-4">
                <span class="flex h-10 w-10 items-center justify-center rounded bg-slate-50 text-slate-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:bg-slate-800/80 dark:group-hover:bg-indigo-950/50 dark:text-slate-500 dark:group-hover:text-indigo-400">
                  <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd"/></svg>
                </span>
              </div>
            </a>
          </li>
        `;
      })
      .join('');
  }

  clearBtn?.addEventListener('click', () => {
    localStorage.removeItem(storageKeys.WRONG_NOTE);
    render();
  });
  keywordInput?.addEventListener('input', render);
  typeSelect?.addEventListener('change', render);
  sortSelect?.addEventListener('change', render);

  render();
}
