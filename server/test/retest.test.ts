import { describe, expect, it } from 'vitest';
import { buildRetest, RETEST_SIZE } from '../src/modules/generation/retest';
import { variantFingerprint } from '../src/modules/generation/variants';
import type { QuizQuestion } from '../src/modules/generation/boardScript';

const q = (n: number): QuizQuestion =>
  ({
    quiz_question_id: n,
    type: 'multiple_choice',
    question: `Question ${n}?`,
    options: ['a', 'b'],
    correct_index: 0,
    tests_beat_id: 1,
  }) as QuizQuestion;

const fp = (question: QuizQuestion) => variantFingerprint('quiz_question', question);
const texts = (qs: QuizQuestion[]) => qs.map((x) => x.question);

describe('buildRetest (Part 04 §6)', () => {
  it('leads with the missed questions, in test order', () => {
    const available = [q(1), q(2), q(3), q(4), q(5)];
    const out = buildRetest([fp(q(4)), fp(q(2))], available, []);
    expect(texts(out).slice(0, 2)).toEqual(['Question 2?', 'Question 4?']);
  });

  it('is exactly 8 questions when there is enough material', () => {
    const available = Array.from({ length: 12 }, (_, i) => q(i + 1));
    const pooled = Array.from({ length: 20 }, (_, i) => q(100 + i));
    expect(buildRetest([fp(q(1))], available, pooled)).toHaveLength(RETEST_SIZE);
  });

  it('uses only 8 of the missed ones when more than 8 were wrong, adding nothing new', () => {
    const available = Array.from({ length: 12 }, (_, i) => q(i + 1));
    const missed = available.slice(0, 10).map(fp);
    const pooled = [q(500)];
    const out = buildRetest(missed, available, pooled);
    expect(out).toHaveLength(RETEST_SIZE);
    // Every slot is a missed question — the pooled filler never gets a look in.
    expect(texts(out)).toEqual(available.slice(0, 8).map((x) => x.question));
  });

  it('tops up from the pool when fewer than 8 were missed', () => {
    const available = [q(1), q(2), q(3)];
    const pooled = [q(90), q(91), q(92), q(93), q(94), q(95)];
    const out = buildRetest([fp(q(2))], available, pooled);
    expect(out).toHaveLength(RETEST_SIZE);
    expect(texts(out)[0]).toBe('Question 2?');
    expect(texts(out)).toContain('Question 90?');
  });

  it('prefers the pool over correctly-answered questions from this attempt', () => {
    const available = [q(1), q(2), q(3), q(4)];
    const pooled = [q(90), q(91)];
    const out = buildRetest([fp(q(1))], available, pooled);
    // missed(1) → pooled(90, 91) → then falls back to 2, 3, 4.
    expect(texts(out).slice(0, 3)).toEqual(['Question 1?', 'Question 90?', 'Question 91?']);
  });

  it('falls back to this attempt’s correct answers when the pool is empty', () => {
    // Every topic the first time anyone fails it: nothing pooled beyond the
    // lesson's own quiz. A shorter retest would be worse than a repeat question.
    const available = Array.from({ length: 10 }, (_, i) => q(i + 1));
    const out = buildRetest([fp(q(3))], available, []);
    expect(out).toHaveLength(RETEST_SIZE);
    expect(texts(out)[0]).toBe('Question 3?');
  });

  it('never repeats a question, even if the pool duplicates the lesson’s own', () => {
    const available = [q(1), q(2)];
    const pooled = [q(1), q(2), q(3)];
    const out = buildRetest([fp(q(1))], available, pooled);
    expect(new Set(texts(out)).size).toBe(out.length);
  });

  it('returns a short retest rather than generating, when material runs out', () => {
    // §6 is explicit that a retest never triggers fresh generation.
    const out = buildRetest([], [q(1), q(2)], []);
    expect(out).toHaveLength(2);
  });

  it('renumbers questions sequentially for the retest', () => {
    const out = buildRetest([fp(q(5))], [q(1), q(5), q(9)], []);
    expect(out.map((x) => x.quiz_question_id)).toEqual([1, 2, 3]);
  });
});
