import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractMcqChoices } from './problem-markdown';
import { wrapFiveChoiceLineInMdx } from './math-mdx-normalize';

describe('extractMcqChoices', () => {
  it('parses single-line five choices', () => {
    const md = '문제 본문\n\n① $7$ ② $9$ ③ $11$ ④ $13$ ⑤ $15$';
    const { statement, choices } = extractMcqChoices(md);
    assert.equal(statement, '문제 본문');
    assert.deepEqual(choices, ['$7$', '$9$', '$11$', '$13$', '$15$']);
  });

  it('parses multi-line choices', () => {
    const md = '문제 본문\n\n① $-5$ ② $-\\sqrt{5}$ ③ $0$\n\n④ $\\sqrt{5}$ ⑤ $5$';
    const { statement, choices } = extractMcqChoices(md);
    assert.equal(statement, '문제 본문');
    assert.deepEqual(choices, ['$-5$', '$-\\sqrt{5}$', '$0$', '$\\sqrt{5}$', '$5$']);
  });
});

describe('wrapFiveChoiceLineInMdx', () => {
  it('wraps multi-line choices into McqChoices', () => {
    const src = '## 문제\n본문\n\n① a ② b ③ c\n\n④ d ⑤ e\n\n## 힌트';
    const out = wrapFiveChoiceLineInMdx(src);
    assert.match(out, /<McqChoices>/);
    assert.match(out, /label="④">d<\/McqChoiceItem>/);
    assert.doesNotMatch(out, /^④ d/m);
  });
});
