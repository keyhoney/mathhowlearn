import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildProblemSearchKeywords,
  mergeProblemCodeResult,
  normalizeProblemSearchCode,
  resolveProblemSearch,
} from './problem-search-code';

const index = {
  problems: {
    '20261107': '2026학년도 수능 7번',
  },
  essayProblems: {},
};

describe('problem-search-code', () => {
  it('normalizes 8-digit problem codes', () => {
    assert.equal(normalizeProblemSearchCode('20261107'), '20261107');
    assert.equal(normalizeProblemSearchCode(' 20261107 '), '20261107');
    assert.equal(normalizeProblemSearchCode('2026117'), null);
    assert.equal(normalizeProblemSearchCode('수능7번'), null);
  });

  it('resolves a direct problem hit from metadata id', () => {
    assert.deepEqual(resolveProblemSearch('20261107', index), {
      url: '/problems/20261107',
      meta: { title: '2026학년도 수능 7번' },
    });
  });

  it('prepends direct code matches ahead of pagefind results', () => {
    const merged = mergeProblemCodeResult('20261107', index, [
      { url: '/problems/20261101', meta: { title: 'other' } },
    ]);
    assert.equal(merged[0]?.url, '/problems/20261107');
    assert.equal(merged.length, 2);
  });

  it('builds searchable keywords for pagefind indexing', () => {
    const keywords = buildProblemSearchKeywords('20261107', {
      source: '2026학년도 수능 7번',
      year: 2026,
      month: 11,
      examType: '수능',
    });
    assert.match(keywords, /20261107/);
    assert.match(keywords, /2026학년도 11월\(수능\) 7번 문제/);
  });
});
