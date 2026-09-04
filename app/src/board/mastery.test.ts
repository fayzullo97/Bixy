import { describe, expect, it } from 'vitest';
import { decideMastery } from './mastery';
import type { Beat, QuizQuestion } from './types';
import type { QuizAnswer } from './Quiz';

// Three lesson beats and a 10-question quiz whose questions tag beats 1, 2, 3
// in a repeating cycle — enough to exercise the missed-beat re-teach subset.
const beats: Beat[] = [
  { id: 1, type: 'formal_beat', style: 'title', content: 'A' },
  { id: 2, type: 'formal_beat', style: 'formula', content: 'B' },
  { id: 3, type: 'formal_beat', style: 'example', content: 'C' },
];

const quiz: QuizQuestion[] = Array.from({ length: 10 }, (_, i) => ({
  quiz_question_id: i + 1,
  type: 'multiple_choice',
  question: `q${i}`,
  options: ['a', 'b'],
  correct_index: 1,
  tests_beat_id: ((i % 3) + 1) as 1 | 2 | 3,
}));

/** Build an answers array where exactly `correctCount` of the first N are correct. */
function answers(correctFlags: boolean[]): Array<QuizAnswer | undefined> {
  return correctFlags.map((correct) => ({ kind: 'choice', index: correct ? 1 : 0, correct }));
}

describe('decideMastery (§8.4)', () => {
  it('passes at 80% and re-teaches nothing', () => {
    const flags = [true, true, true, true, true, true, true, true, false, false]; // 8/10
    const d = decideMastery(quiz, answers(flags), beats);
    expect(d).toMatchObject({ scorePct: 80, outcome: 'passed', reteachBeats: [] });
  });

  it('re-teaches only the missed-question beats between 50% and 79%', () => {
    // 6/10 correct; the wrong ones are indices 6,7,8,9 → beats 1,2,3,1.
    const flags = [true, true, true, true, true, true, false, false, false, false]; // 6/10
    const d = decideMastery(quiz, answers(flags), beats);
    expect(d.scorePct).toBe(60);
    expect(d.outcome).toBe('reteach_missed');
    expect(d.reteachBeats.map((b) => b.id).sort()).toEqual([1, 2, 3]);
  });

  it('re-teaches only the single missed beat when the misses cluster on one concept', () => {
    // Questions tagging beat 2 are indices 1, 4, 7. Miss exactly those → 7/10 = 70%.
    const flags = [true, false, true, true, false, true, true, false, true, true];
    const d = decideMastery(quiz, answers(flags), beats);
    expect(d.scorePct).toBe(70);
    expect(d.outcome).toBe('reteach_missed');
    expect(d.reteachBeats.map((b) => b.id)).toEqual([2]);
  });

  it('re-teaches the whole topic below 50%', () => {
    const flags = [true, true, true, true, false, false, false, false, false, false]; // 4/10
    const d = decideMastery(quiz, answers(flags), beats);
    expect(d.scorePct).toBe(40);
    expect(d.outcome).toBe('reteach_all');
    expect(d.reteachBeats).toHaveLength(3);
  });

  it('treats an empty quiz as passed', () => {
    expect(decideMastery([], [], beats)).toMatchObject({ outcome: 'passed', scorePct: 100 });
  });
});
