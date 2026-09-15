import { describe, expect, it } from 'vitest';
import { decideMastery } from './mastery';
import type { Beat, QuizQuestion } from './types';
import type { QuizAnswer } from './Quiz';

// Three lesson beats and a 10-question quiz whose questions tag beats 1, 2, 3
// in a repeating cycle — enough to exercise the missed-beat re-teach subset.
const beats: Beat[] = [
  { id: 1, type: 'formal_beat', style: 'title', term: 'A' },
  { id: 2, type: 'formal_beat', style: 'formula', formula: 'B' },
  { id: 3, type: 'formal_beat', style: 'example', sentence: 'C' },
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

describe('second-miss escalation (Part 04 §6)', () => {
  const beats: Beat[] = [
    { id: 1, type: 'formal_beat', style: 'title', term: 'T' },
    { id: 2, type: 'formal_beat', style: 'example', sentence: 'A.' },
    { id: 3, type: 'formal_beat', style: 'example', sentence: 'B.' },
  ];
  const quiz: QuizQuestion[] = [
    { quiz_question_id: 1, type: 'multiple_choice', question: 'q1', options: ['a', 'b'], correct_index: 0, tests_beat_id: 2 },
    { quiz_question_id: 2, type: 'multiple_choice', question: 'q2', options: ['a', 'b'], correct_index: 0, tests_beat_id: 2 },
    { quiz_question_id: 3, type: 'multiple_choice', question: 'q3', options: ['a', 'b'], correct_index: 0, tests_beat_id: 3 },
    { quiz_question_id: 4, type: 'multiple_choice', question: 'q4', options: ['a', 'b'], correct_index: 0, tests_beat_id: 3 },
  ];
  // 50% — squarely in the reteach_missed tier on a first attempt.
  const halfRight = [
    { kind: 'choice' as const, index: 0, correct: true },
    { kind: 'choice' as const, index: 0, correct: true },
    { kind: 'choice' as const, index: 1, correct: false },
    { kind: 'choice' as const, index: 1, correct: false },
  ];

  it('uses the normal tier on the first miss', () => {
    const d = decideMastery(quiz, halfRight, beats, 0);
    expect(d.scorePct).toBe(50);
    expect(d.outcome).toBe('reteach_missed');
    expect(d.reteachBeats.map((b) => b.id)).toEqual([3]);
  });

  it('escalates to the whole topic once a retest has already been failed', () => {
    const d = decideMastery(quiz, halfRight, beats, 1);
    expect(d.scorePct).toBe(50);
    // Same score, same misses — the escalation overrides the tier, because
    // re-teaching only the missed fragments clearly hasn't worked by now.
    expect(d.outcome).toBe('reteach_all');
    expect(d.reteachBeats).toHaveLength(3);
  });

  it('still passes on a good retest, whatever the round', () => {
    const allRight = quiz.map(() => ({ kind: 'choice' as const, index: 0, correct: true }));
    expect(decideMastery(quiz, allRight, beats, 3).outcome).toBe('passed');
  });

  it('reports which questions were missed, for the retest to lead with', () => {
    expect(decideMastery(quiz, halfRight, beats, 0).missedIndexes).toEqual([2, 3]);
    expect(decideMastery(quiz, halfRight, beats, 0).missedIndexes).not.toContain(0);
  });

  it('reports no misses when passed', () => {
    const nearPerfect = [
      { kind: 'choice' as const, index: 0, correct: true },
      { kind: 'choice' as const, index: 0, correct: true },
      { kind: 'choice' as const, index: 0, correct: true },
      { kind: 'choice' as const, index: 0, correct: true },
    ];
    expect(decideMastery(quiz, nearPerfect, beats, 0).missedIndexes).toEqual([]);
  });
});
