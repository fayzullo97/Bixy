import { describe, expect, it } from 'vitest';
import { variantFingerprint } from '../src/modules/generation/variants';
import type { QuizQuestion, Beat } from '../src/modules/generation/boardScript';

const mc = (over: Partial<QuizQuestion> = {}): QuizQuestion =>
  ({
    quiz_question_id: 1,
    type: 'multiple_choice',
    question: 'Which sentence is correct?',
    options: ['I have went.', 'I have gone.'],
    correct_index: 1,
    tests_beat_id: 3,
    ...over,
  }) as QuizQuestion;

describe('variantFingerprint — pool dedup (Part 04)', () => {
  it('ignores ids that change on every regeneration', () => {
    // A cache miss or rule_version bump regenerates the same question with new
    // ids. Without excluding them the pool would fill with near-duplicates and
    // rotation would stop meaning anything.
    expect(variantFingerprint('quiz_question', mc())).toBe(
      variantFingerprint('quiz_question', mc({ quiz_question_id: 99, tests_beat_id: 12 })),
    );
  });

  it('ignores whitespace and casing noise', () => {
    expect(variantFingerprint('quiz_question', mc())).toBe(
      variantFingerprint('quiz_question', mc({ question: '  which   SENTENCE is correct? ' })),
    );
  });

  it('treats a different stem as a different variant', () => {
    expect(variantFingerprint('quiz_question', mc())).not.toBe(
      variantFingerprint('quiz_question', mc({ question: 'Which one fits?' })),
    );
  });

  it('treats reordered options as a different variant', () => {
    // Option order is part of the identity — `correct_index` points into it, so
    // the same stem with swapped options is a genuinely different question.
    expect(variantFingerprint('quiz_question', mc())).not.toBe(
      variantFingerprint('quiz_question', mc({ options: ['I have gone.', 'I have went.'] })),
    );
  });

  it('treats reordered accepted answers as the SAME variant', () => {
    // Unlike options, accepted answers are a set — ordering noise from the model
    // shouldn't read as a new variant.
    const a = mc({ type: 'fill_in_the_blank', options: undefined, accepted_answers: ['have gone', "have gone to"] });
    const b = mc({ type: 'fill_in_the_blank', options: undefined, accepted_answers: ['have gone to', 'have gone'] });
    expect(variantFingerprint('quiz_question', a)).toBe(variantFingerprint('quiz_question', b));
  });

  it('separates a fill-in-the-blank from a multiple choice with the same stem', () => {
    expect(variantFingerprint('quiz_question', mc())).not.toBe(
      variantFingerprint('quiz_question', mc({ type: 'fill_in_the_blank', options: undefined, accepted_answers: ['x'] })),
    );
  });

  it('fingerprints a re-explanation segment by its spoken/written content', () => {
    const beats: Beat[] = [
      { id: 1, type: 'story_beat', narration: 'Keling, boshqacha koramiz.', doodles: [] },
      { id: 2, type: 'formal_beat', style: 'explanation', note: 'have + past participle' },
    ];
    const renumbered: Beat[] = [
      { id: 7, type: 'story_beat', narration: 'Keling, boshqacha koramiz.', doodles: [] },
      { id: 8, type: 'formal_beat', style: 'explanation', note: 'have + past participle' },
    ];
    expect(variantFingerprint('reexplain_segment', { beats })).toBe(
      variantFingerprint('reexplain_segment', { beats: renumbered }),
    );
  });

  it('distinguishes segments whose wording differs', () => {
    const one: Beat[] = [{ id: 1, type: 'formal_beat', style: 'explanation', note: 'One way to see it.' }];
    const two: Beat[] = [{ id: 1, type: 'formal_beat', style: 'explanation', note: 'Another way to see it.' }];
    expect(variantFingerprint('reexplain_segment', { beats: one })).not.toBe(
      variantFingerprint('reexplain_segment', { beats: two }),
    );
  });

  it('covers both halves of a common_mistake pair', () => {
    const base: Beat[] = [
      { id: 1, type: 'formal_beat', style: 'common_mistake', wrong: 'I have visit.', correct: 'I have visited.', note: 'n' },
    ];
    const changed: Beat[] = [
      { id: 1, type: 'formal_beat', style: 'common_mistake', wrong: 'I have visit.', correct: 'I have been.', note: 'n' },
    ];
    expect(variantFingerprint('reexplain_segment', { beats: base })).not.toBe(
      variantFingerprint('reexplain_segment', { beats: changed }),
    );
  });
});
