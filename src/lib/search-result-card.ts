export type SearchResultItem = {
  url?: string;
  meta?: { title?: string };
  excerpt?: string;
};

import {
  getContentDomainBadgeClass,
  getContentDomainLabel,
  inferContentDomainFromUrl,
} from './content-domain-badge';

export function inferSearchDomain(url: string): string {
  return inferContentDomainFromUrl(url);
}

function escapeHtml(text: string): string {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function highlightEscapedText(escapedText: string, escapedQuery: string): string {
  if (!escapedQuery) return escapedText;
  if (!escapedText.includes(escapedQuery)) return escapedText;
  return escapedText.replaceAll(escapedQuery, `<mark class="bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200">${escapedQuery}</mark>`);
}

function sanitizePagefindExcerptHtml(excerpt: string): string {
  const raw = String(excerpt || '');
  if (!raw) return '';

  const withoutPre = raw.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, (m) => {
    return m.replace(/<\/?pre\b[^>]*>/gi, '');
  });
  const withoutCode = withoutPre.replace(/<\/?code\b[^>]*>/gi, '');
  const keepMarkOnly = withoutCode.replace(/<(?!\/?mark\b)[^>]+>/gi, '');

  return keepMarkOnly.trim();
}

export function buildSearchResultCardHtml(item: SearchResultItem, query?: string): string {
  const url = item.url || '#';
  const domain = inferSearchDomain(url);
  const badgeLabel = domain === 'other' ? '기타' : getContentDomainLabel(domain);
  const titleEscaped = escapeHtml(item.meta?.title || url);
  const q = String(query || '').trim();
  const queryEscaped = q.length >= 2 ? escapeHtml(q) : '';
  const title = highlightEscapedText(titleEscaped, queryEscaped);
  const excerpt = sanitizePagefindExcerptHtml(item.excerpt || '');

  return `
    <li>
      <a href="${url}" class="group block book-card border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:bg-slate-800/50">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <span class="type-overline rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 normal-case tracking-normal font-bold text-indigo-700 dark:border-indigo-800/50 dark:bg-indigo-950/45 dark:text-indigo-200">${badgeLabel}</span>
        </div>
        <h2 class="type-heading mt-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">${title}</h2>
        ${
          excerpt
            ? `<p class="type-lead mt-2 line-clamp-3">${excerpt}</p>`
            : ''
        }
        <div class="mt-4">
          <span class="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            자세히 보기 →
          </span>
        </div>
      </a>
    </li>
  `;
}
