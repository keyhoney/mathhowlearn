type StorageKeys = {
  BOOKMARK: string;
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
  year: number;
};

type BookmarkRow = {
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

export function initBookmarksPage({
  candidates,
  storageKeys,
}: {
  candidates: Candidate[];
  storageKeys: StorageKeys;
}): void {
  const listEl = document.getElementById('bookmark-list');
  const emptyEl = document.getElementById('bookmark-empty');
  const totalEl = document.getElementById('bookmark-total');
  const clearBtn = document.getElementById('bookmark-clear');
  const keywordInput = document.getElementById('bookmark-keyword') as HTMLInputElement | null;
  const typeSelect = document.getElementById('bookmark-type') as HTMLSelectElement | null;
  const sortSelect = document.getElementById('bookmark-sort') as HTMLSelectElement | null;
  const byId = new Map(candidates.map((v) => [v.id, v]));

  function readRows(): BookmarkRow[] {
    const store = parse<{ byId?: Record<string, { ts?: number }> }>(
      localStorage.getItem(storageKeys.BOOKMARK),
      { byId: {} },
    );
    const wrongStore = parse<{ byId?: Record<string, { entries?: unknown[] }> }>(
      localStorage.getItem(storageKeys.WRONG_NOTE),
      { byId: {} },
    );
    return Object.entries(store.byId || {})
      .map(([id, value]) => ({
        id,
        ts: value?.ts ?? 0,
        attempts: wrongStore.byId?.[id]?.entries?.length ?? 0,
      }))
      .filter((row) => row.ts > 0);
  }

  function render(): void {
    const keyword = String(keywordInput?.value || '').trim().toLowerCase();
    const selectedType = String(typeSelect?.value || 'all');
    const sortBy = String(sortSelect?.value || 'recent');

    let rows = readRows()
      .map((row) => ({ ...row, item: byId.get(row.id) }))
      .filter((row): row is BookmarkRow & { item: Candidate } => Boolean(row.item));

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
        const meta = it.meta || `${it.year}년`;
        const extra = row.attempts > 0 ? ` · 오답 ${row.attempts}회` : '';
        return `
          <li class="h-full">
            <a href="${it.href}" title="스크랩 · ${escapeHtml(when)}${extra}" class="group flex h-full flex-col book-card border border-slate-200 bg-white transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:bg-slate-800/50">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <h2 class="type-heading group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">${escapeHtml(it.title)}</h2>
                <span class="type-caption shrink-0 rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 dark:border-indigo-800/50 dark:bg-indigo-950/45 dark:text-indigo-200">스크랩</span>
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
    localStorage.removeItem(storageKeys.BOOKMARK);
    render();
  });
  keywordInput?.addEventListener('input', render);
  typeSelect?.addEventListener('change', render);
  sortSelect?.addEventListener('change', render);

  render();
}
