/** 수능·모의평가 시험 유형 배지 색 (`global.css` `.app-badge-type-mock` / `.app-badge-type-csat`) */
export function getExamTypeBadgeClass(examType: string): string {
  if (examType === '수능') return 'app-badge-type-csat';
  if (examType === '모의평가' || examType === '모평') return 'app-badge-type-mock';
  return 'app-badge-type-problem';
}
