import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  getContentDomainLabel,
  inferContentDomainFromUrl,
} from '../lib/content-domain-badge';
import {
  mergeProblemCodeResult,
  type ProblemSearchIndex,
} from '../lib/problem-search-code';
import type { SearchResultItem } from '../lib/search-result-card';

type PagefindModule = {
  search: (query: string) => Promise<{ results: Array<{ data: () => Promise<SearchResultItem> }> }>;
};

const PAGEFIND_SCRIPT = `${import.meta.env.BASE_URL}pagefind/pagefind.js`;
const PROBLEM_SEARCH_INDEX_URL = `${import.meta.env.BASE_URL}search/problem-codes.json`;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const pagefindRef = useRef<PagefindModule | null>(null);
  const pagefindFailedRef = useRef(false);
  const problemSearchIndexRef = useRef<ProblemSearchIndex | null>(null);
  const problemSearchIndexFailedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setQuery('');
    setResults([]);
    setStatus('idle');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const ensureProblemSearchIndex = useCallback(async (): Promise<ProblemSearchIndex | null> => {
    if (problemSearchIndexFailedRef.current) return null;
    if (problemSearchIndexRef.current) return problemSearchIndexRef.current;
    try {
      const response = await fetch(PROBLEM_SEARCH_INDEX_URL);
      if (!response.ok) throw new Error('problem search index missing');
      const data = (await response.json()) as ProblemSearchIndex;
      problemSearchIndexRef.current = data;
      return data;
    } catch {
      problemSearchIndexFailedRef.current = true;
      return null;
    }
  }, []);

  const ensurePagefind = useCallback(async (): Promise<PagefindModule | null> => {
    if (pagefindFailedRef.current) return null;
    if (pagefindRef.current) return pagefindRef.current;
    try {
      const mod = (await import(/* @vite-ignore */ PAGEFIND_SCRIPT)) as PagefindModule;
      pagefindRef.current = mod;
      return mod;
    } catch {
      pagefindFailedRef.current = true;
      return null;
    }
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setResults([]);
        setStatus('idle');
        return;
      }

      setStatus('loading');
      const [pf, problemIndex] = await Promise.all([
        ensurePagefind(),
        ensureProblemSearchIndex(),
      ]);

      try {
        let records: SearchResultItem[] = [];
        if (pf) {
          const searched = await pf.search(trimmed);
          records = await Promise.all(searched.results.map((r) => r.data()));
        }
        if (problemIndex) {
          records = mergeProblemCodeResult(trimmed, problemIndex, records);
        }

        const filtered = records.filter((item) => {
          const url = item.url || '';
          return (
            (url.startsWith('/problems/') &&
              !url.startsWith('/problems/wrong-note') &&
              !url.startsWith('/problems/bookmarks') &&
              !url.startsWith('/problems/concept-frequency')) ||
            url.startsWith('/essay-problems/')
          );
        });
        setResults(filtered.slice(0, 8));
        if (filtered.length === 0) {
          setStatus(!pf && !problemIndex ? 'error' : 'empty');
        } else {
          setStatus('idle');
        }
      } catch {
        setResults([]);
        setStatus('error');
      }
    },
    [ensurePagefind, ensureProblemSearchIndex],
  );

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handleClose]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open) return;
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, runSearch]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-900/40 px-4 pt-20 backdrop-blur-sm sm:pt-28"
      role="dialog"
      aria-modal="true"
      aria-label="검색"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <Search className="h-[18px] w-[18px] shrink-0 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="문제 검색… (Ctrl+K)"
            autoComplete="off"
            className="min-w-0 flex-1 border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                window.location.href = `/search?q=${encodeURIComponent(query.trim())}`;
              }
            }}
          />
          <button
            type="button"
            className="hidden rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 sm:block dark:border-slate-600 dark:text-slate-400"
            onClick={handleClose}
          >
            ESC
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 sm:hidden dark:hover:bg-slate-800"
            aria-label="검색 닫기"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
          {status === 'idle' && !query.trim() && (
            <p className="py-10 text-center text-sm text-slate-500">검색어를 입력하세요.</p>
          )}
          {status === 'loading' && (
            <p className="py-10 text-center text-sm text-slate-500">검색 중…</p>
          )}
          {status === 'error' && (
            <p className="py-8 text-center text-sm text-slate-500">
              검색 인덱스를 불러올 수 없습니다.{' '}
              <a
                href={`/search?q=${encodeURIComponent(query.trim())}`}
                className="text-indigo-600 hover:underline dark:text-indigo-400"
              >
                검색 페이지로 이동
              </a>
            </p>
          )}
          {status === 'empty' && query.trim() && (
            <p className="py-10 text-center text-sm text-slate-500">검색 결과가 없습니다.</p>
          )}
          {results.length > 0 && (
            <ul className="flex flex-col gap-1">
              {results.map((item) => {
                const url = item.url || '#';
                const domain = inferContentDomainFromUrl(url);
                const badge = domain === 'other' ? '기타' : getContentDomainLabel(domain);
                return (
                  <li key={url}>
                    <a
                      href={url}
                      className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/70"
                    >
                      <span className="type-caption rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {badge}
                      </span>
                      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.meta?.title || url}
                      </p>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {query.trim() && (
          <div className="border-t border-slate-200 px-4 py-2 dark:border-slate-700">
            <a
              href={`/search?q=${encodeURIComponent(query.trim())}`}
              className="block rounded-lg px-2 py-2 text-center text-xs font-medium text-indigo-600 hover:bg-slate-50 dark:text-indigo-400 dark:hover:bg-slate-800/80"
            >
              전체 결과 보기
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
