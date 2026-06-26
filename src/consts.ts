export const SITE_TITLE = 'GaeSaeGi Math';
export const SITE_DESCRIPTION =
  '수능 및 모의평가 수학 기출 문제와 단계별 풀이 힌트, 학습 대시보드·오답노트·스크랩을 제공합니다.';
export const SITE_URL = (import.meta.env.PUBLIC_SITE_URL || 'https://math.howlearn.kr').replace(
  /\/+$/,
  '',
);
export const CONTENT_SITE_URL = (
  import.meta.env.PUBLIC_CONTENT_SITE_URL || 'https://www.howlearn.kr'
).replace(/\/+$/, '');

export const NAV_LINKS = [
  { href: '/dashboard', label: '학습 대시보드' },
  { href: '/problems', label: '수능모평 수학 문제' },
] as const;
