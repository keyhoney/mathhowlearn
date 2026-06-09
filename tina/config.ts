import { defineConfig, defineSchema } from 'tinacms';

// ─── 공통 재사용 필드 ────────────────────────────────────────────

/** 발행 상태 필드 */
const statusField = {
  type: 'string' as const,
  name: 'status',
  label: '발행 상태',
  required: true,
  options: [
    { value: 'draft', label: '초안 (비공개)' },
    { value: 'published', label: '발행' },
  ],
  ui: { defaultValue: 'published' },
};

/** 도메인(학문 분류) 필드 */
const domainsField = {
  type: 'string' as const,
  name: 'domains',
  label: '학문 분류',
  list: true,
  options: [
    { value: 'cognitive-psychology', label: '인지 심리학' },
    { value: 'neuroscience', label: '신경과학' },
    { value: 'educational-psychology', label: '교육 심리학' },
    { value: 'developmental-psychology', label: '발달 심리학' },
    { value: 'motivation-emotion', label: '동기·정서' },
  ],
};

/** 태그 필드 */
const tagsField = {
  type: 'string' as const,
  name: 'tags',
  label: '태그',
  list: true,
  ui: { component: 'tags' },
};

/** 카테고리 필드 */
const categoriesField = {
  type: 'string' as const,
  name: 'categories',
  label: '카테고리',
  list: true,
};

/** 발행일 필드 */
const publishedAtField = {
  type: 'datetime' as const,
  name: 'publishedAt',
  label: '발행일',
};

/** SEO 필드 묶음 */
const seoFields = [
  { type: 'string' as const, name: 'seoTitle', label: 'SEO 제목 (생략 시 title 사용)' },
  { type: 'string' as const, name: 'seoDescription', label: 'SEO 설명', ui: { component: 'textarea' } },
  { type: 'string' as const, name: 'coverImage', label: '커버 이미지 URL' },
];

/** 참고 문헌 필드 */
const referencesField = {
  type: 'object' as const,
  name: 'references',
  label: '참고 문헌',
  list: true,
  fields: [
    { type: 'string' as const, name: 'title', label: '제목 (선택)' },
    { type: 'string' as const, name: 'url', label: 'URL', required: true },
  ],
};

/** FAQ 필드 */
const faqField = {
  type: 'object' as const,
  name: 'faq',
  label: 'FAQ',
  list: true,
  fields: [
    { type: 'string' as const, name: 'question', label: '질문', required: true },
    { type: 'string' as const, name: 'answer', label: '답변', required: true, ui: { component: 'textarea' } },
  ],
};

/** 관련 콘텐츠 ID 필드 */
const relatedContentIdsField = {
  type: 'string' as const,
  name: 'relatedContentIds',
  label: '관련 콘텐츠 ID',
  list: true,
  description: '형식: guide-slug, concept-slug 등 (type-slug)',
};

/** 관련 문제 ID 필드 */
const relatedProblemIdsField = {
  type: 'string' as const,
  name: 'relatedProblemIds',
  label: '관련 문제 ID',
  list: true,
};

/** 문제 공통 필드 묶음 */
const problemFields = [
  { type: 'string' as const, name: 'source', label: '출처', required: true },
  { type: 'number' as const, name: 'year', label: '연도', required: true },
  { type: 'number' as const, name: 'month', label: '월', required: true },
  {
    type: 'string' as const,
    name: 'examType',
    label: '시험 구분',
    required: true,
    options: ['수능', '모의평가', '교육청', '논술'],
  },
  { type: 'string' as const, name: 'subject', label: '과목', required: true },
  { type: 'string' as const, name: 'chapter', label: '단원', required: true },
  { type: 'string' as const, name: 'subChapter', label: '소단원', required: true },
  { type: 'string' as const, name: 'concept', label: '핵심 개념', required: true },
  { type: 'number' as const, name: 'difficulty', label: '난이도(1~5)', required: true },
  {
    type: 'string' as const,
    name: 'answerType',
    label: '정답 타입',
    required: true,
    options: ['mcq', 'short'],
  },
  { type: 'number' as const, name: 'answer', label: '정답값', required: true },
  tagsField,
  relatedProblemIdsField,
];

const essayProblemFields = [
  { type: 'string' as const, name: 'source', label: '출처', required: true },
  { type: 'number' as const, name: 'year', label: '연도', required: true },
  {
    type: 'string' as const,
    name: 'examType',
    label: '시험 구분',
    required: true,
    options: ['논술'],
    ui: { defaultValue: '논술' },
  },
  { type: 'string' as const, name: 'university', label: '대학', required: true },
  { type: 'number' as const, name: 'examYear', label: '논술 시행 연도 (선택)' },
  { type: 'number' as const, name: 'difficulty', label: '난이도(1~5)', required: true },
  tagsField,
  relatedProblemIdsField,
];

// ─── Tina CMS 설정 ───────────────────────────────────────────────

export default defineConfig({
  /**
   * TinaCloud 사용 시 clientId/token을 환경 변수로 설정:
   * NEXT_PUBLIC_TINA_CLIENT_ID / TINA_TOKEN
   * 로컬 개발 시에는 branch="main"만으로 동작.
   */
  branch: process.env.TINA_BRANCH ?? process.env.HEAD ?? 'main',
  clientId: process.env.TINA_CLIENT_ID ?? null,
  token: process.env.TINA_TOKEN ?? null,

  build: {
    outputFolder: 'admin',
    publicFolder: 'public',
  },

  media: {
    tina: {
      mediaRoot: 'uploads',
      publicFolder: 'public',
    },
  },

  schema: defineSchema({
    collections: [
      // ─── 1. 문제 컬렉션 ─────────────────────────────────────────
      {
        name: 'problems',
        label: '문제',
        path: 'src/content/problems',
        format: 'mdx',
        ui: {
          router: ({ document }) => `/edit/problems/${document._sys.filename}`,
        },
        fields: [
          {
            type: 'string',
            name: 'body',
            label: '문제 본문 (Markdown 원문)',
            ui: { component: 'textarea' },
            isBody: true,
          },
        ],
      },

      // ─── 2. 논술 문제 컬렉션 ────────────────────────────────────
      {
        name: 'essay_problems',
        nameOverride: 'essay-problems',
        label: '논술 문제',
        path: 'src/content/essay-problems',
        format: 'mdx',
        ui: {
          router: ({ document }) => `/edit/essay-problems/${document._sys.filename}`,
        },
        fields: [
          {
            type: 'string',
            name: 'body',
            label: '문제 본문 (Markdown 원문)',
            ui: { component: 'textarea' },
            isBody: true,
          },
        ],
      },
    ],
  }),
});
