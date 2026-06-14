import { defineCollection, z } from 'astro:content';
import { problemMdxRegistryLoader } from './content/loaders/problemMdxRegistryLoader';

const examTypeEnum = z.enum(['수능', '모의평가', '교육청', '논술']);

const problemBaseSchema = z.object({
  source: z.string(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  examType: examTypeEnum,
  subject: z.string(),
  chapter: z.string(),
  subChapter: z.string(),
  concept: z.string(),
  difficulty: z.coerce.number().int().min(1).max(5).default(3),
  answerType: z.enum(['mcq', 'short']),
  answer: z.coerce.number().int().min(0).max(999),
});

const essayProblemSchema = z.object({
  source: z.string(),
  year: z.coerce.number().int().min(2000).max(2100),
  examType: z.literal('논술').default('논술'),
  university: z.string(),
  examYear: z.coerce.number().int().optional(),
  difficulty: z.coerce.number().int().min(1).max(5).default(3),
});

const problems = defineCollection({
  loader: problemMdxRegistryLoader({
    collectionDir: 'src/content/problems',
    registryFile: '_metadata.json',
  }),
  schema: problemBaseSchema,
});

const essayProblems = defineCollection({
  loader: problemMdxRegistryLoader({
    collectionDir: 'src/content/essay-problems',
    registryFile: '_metadata.json',
  }),
  schema: essayProblemSchema,
});

export const collections = {
  problems,
  'essay-problems': essayProblems,
};
