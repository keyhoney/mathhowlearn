/** 로컬스토리지 키 상수 (수학 학습 진행·오답·스크랩·집중) */
export const STORAGE_KEYS = {
  PROBLEM_PROGRESS: 'howlearn-problem-progress',
  WRONG_NOTE: 'howlearn-wrong-note',
  BOOKMARK: 'howlearn-bookmark',
  FOCUS_STATE: 'howlearn-focus-state',
  FOCUS_HISTORY: 'howlearn-focus-history',
  FOCUS_GOAL_MS: 'howlearn-focus-goal-ms',
  THEME: 'theme',
  MOCK_EXAM_SESSION: 'howlearn-mock-exam-session',
  LEARNING_ACTIVITY: 'howlearn-learning-activity',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
