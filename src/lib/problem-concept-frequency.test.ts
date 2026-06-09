import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildConceptFrequencyMatrix,
  buildConceptFrequencyResult,
  filterConceptFrequencyRows,
  normalizeYearRange,
  sortConceptFrequencyRows,
  type ConceptFrequencyRow,
} from './problem-concept-frequency';

const sampleRows: ConceptFrequencyRow[] = [
  {
    id: '20240601',
    source: '2024년 6월 모평 1번',
    subject: '대수',
    chapter: '1. 지수함수와 로그함수',
    subChapter: 'A. 지수와 로그',
    concept: '지수의 연산',
    year: 2024,
    month: 6,
    examType: '모의평가',
    difficulty: 1,
    answerType: 'mcq',
  },
  {
    id: '20231101',
    source: '2023년 수능 1번',
    subject: '대수',
    chapter: '1. 지수함수와 로그함수',
    subChapter: 'A. 지수와 로그',
    concept: '지수의 연산',
    year: 2023,
    month: 11,
    examType: '수능',
    difficulty: 2,
    answerType: 'short',
  },
  {
    id: '20220601',
    source: '2022년 6월 모평 1번',
    subject: '대수',
    chapter: '1. 지수함수와 로그함수',
    subChapter: 'A. 지수와 로그',
    concept: '지수의 연산',
    year: 2022,
    month: 6,
    examType: '모의평가',
    difficulty: 2,
    answerType: 'mcq',
  },
  {
    id: '20241101',
    source: '2024년 수능 1번',
    subject: '미적분Ⅰ',
    chapter: '2. 미분',
    subChapter: 'I. 도함수',
    concept: '곱함수의 미분법',
    year: 2024,
    month: 11,
    examType: '수능',
    difficulty: 3,
    answerType: 'mcq',
  },
];

const taxonomy = {
  subject: '대수',
  chapter: '1. 지수함수와 로그함수',
  subChapter: 'A. 지수와 로그',
  concept: '지수의 연산',
};

describe('normalizeYearRange', () => {
  it('swaps when min is greater than max', () => {
    assert.deepEqual(normalizeYearRange(2026, 2022), { yearMin: 2022, yearMax: 2026 });
  });
});

describe('filterConceptFrequencyRows', () => {
  it('filters by taxonomy, exam scope, and year', () => {
    const filtered = filterConceptFrequencyRows(sampleRows, {
      taxonomy,
      examScope: 'mock',
      yearMin: 2023,
      yearMax: 2024,
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.year, 2024);
    assert.equal(filtered[0]?.examType, '모의평가');
  });

  it('includes both exam types when scope is all', () => {
    const filtered = filterConceptFrequencyRows(sampleRows, {
      taxonomy,
      examScope: 'all',
      yearMin: 2022,
      yearMax: 2024,
    });
    assert.equal(filtered.length, 3);
  });
});

describe('buildConceptFrequencyMatrix', () => {
  it('builds row and column totals', () => {
    const matrix = buildConceptFrequencyMatrix(sampleRows.slice(0, 3));
    assert.equal(matrix.cells[1].mcq, 1);
    assert.equal(matrix.cells[2].short, 1);
    assert.equal(matrix.cells[2].mcq, 1);
    assert.equal(matrix.rowTotals[1], 1);
    assert.equal(matrix.rowTotals[2], 2);
    assert.equal(matrix.colTotals.mcq, 2);
    assert.equal(matrix.colTotals.short, 1);
    assert.equal(matrix.grandTotal, 3);
  });

  it('returns empty matrix for no rows', () => {
    const matrix = buildConceptFrequencyMatrix([]);
    assert.equal(matrix.grandTotal, 0);
    assert.equal(matrix.cells[3].mcq, 0);
  });
});

describe('sortConceptFrequencyRows', () => {
  it('sorts by year desc then exam month priority', () => {
    const sorted = sortConceptFrequencyRows(sampleRows.filter((r) => r.concept === '지수의 연산'));
    assert.equal(sorted[0]?.year, 2024);
    assert.equal(sorted[0]?.month, 6);
    assert.equal(sorted[1]?.year, 2023);
    assert.equal(sorted[2]?.year, 2022);
  });
});

describe('buildConceptFrequencyResult', () => {
  it('combines filter and matrix', () => {
    const matrix = buildConceptFrequencyResult(sampleRows, {
      taxonomy,
      examScope: 'csat',
      yearMin: 2020,
      yearMax: 2025,
    });
    assert.equal(matrix.grandTotal, 1);
    assert.equal(matrix.cells[2].short, 1);
  });
});
