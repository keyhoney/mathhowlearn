/** 문제 검색 결과 도메인 라벨·배지 (`global.css` `.app-badge-type-*`) */

export const CONTENT_DOMAIN_LABELS: Record<string, string> = {
  problems: '수능·모평',
  'essay-problems': '대학별 고사',
};

export const CONTENT_DOMAIN_BADGE_CLASS: Record<string, string> = {
  problems: 'app-badge-type-problem',
  'essay-problems': 'app-badge-type-problem',
};

export function getContentDomainLabel(domain: string): string {
  return CONTENT_DOMAIN_LABELS[domain] ?? '문제';
}

export function getContentDomainBadgeClass(domain: string): string {
  return CONTENT_DOMAIN_BADGE_CLASS[domain] ?? 'app-badge-type-problem';
}

export function inferContentDomainFromUrl(url: string): string {
  if (url.startsWith('/essay-problems/')) return 'essay-problems';
  if (url.startsWith('/problems/')) return 'problems';
  return 'other';
}
