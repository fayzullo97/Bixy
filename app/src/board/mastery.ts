import type { Beat, QuizQuestion } from './types';
import type { QuizAnswer } from './Quiz';

// Mastery branching off the end-of-topic test score (§8.4):
//   ≥80%   → passed, advance
//   50–79% → re-teach only the beats tied to the missed questions
//   <50%   → re-teach the whole topic from the start
// Part 04 §6 adds one override on top: from the second consecutive miss, always
// re-teach the whole topic whatever the score.
// Kept pure (no React) so the branch that actually decides a student's path is
// unit-tested directly, not only through the board UI.

export const PASS_THRESHOLD = 0.8;
export const RETEACH_MISSED_THRESHOLD = 0.5;

export type MasteryOutcome = 'passed' | 'reteach_missed' | 'reteach_all';

export interface MasteryDecision {
  scorePct: number;
  outcome: MasteryOutcome;
  /** Beats to re-teach before the next attempt ([] when passed). */
  reteachBeats: Beat[];
  /** Indexes into `quiz` of the questions answered wrong — the retest leads with
   *  these (Part 04 §6). Empty when passed. */
  missedIndexes: number[];
}

export function decideMastery(
  quiz: QuizQuestion[],
  answers: Array<QuizAnswer | undefined>,
  beats: Beat[],
  /** How many retests this topic has already failed (Part 04 §6). 0 = this is
   *  the first attempt at the full test. */
  retestRound = 0,
): MasteryDecision {
  if (quiz.length === 0) return { scorePct: 100, outcome: 'passed', reteachBeats: [], missedIndexes: [] };

  const correct = answers.filter((a) => a?.correct).length;
  const scorePct = Math.round((correct / quiz.length) * 100);
  const missedIndexes = answers.flatMap((a, i) => (!a?.correct && quiz[i] ? [i] : []));

  if (scorePct >= PASS_THRESHOLD * 100) {
    return { scorePct, outcome: 'passed', reteachBeats: [], missedIndexes: [] };
  }

  // Second miss (Part 04 §6): once a retest has already been failed, the next
  // round re-teaches the WHOLE topic regardless of which tier the score lands
  // in. Repeatedly re-teaching only the missed fragments clearly isn't working
  // by that point, so the escalation overrides the tier rather than refining it.
  if (retestRound >= 1) {
    return { scorePct, outcome: 'reteach_all', reteachBeats: beats, missedIndexes };
  }

  const missedBeatIds = new Set(missedIndexes.map((i) => quiz[i]!.tests_beat_id));

  if (scorePct >= RETEACH_MISSED_THRESHOLD * 100) {
    const subset = beats.filter((b) => missedBeatIds.has(b.id));
    // Fall back to the whole topic if tagging somehow left nothing to re-teach.
    return {
      scorePct,
      outcome: 'reteach_missed',
      reteachBeats: subset.length > 0 ? subset : beats,
      missedIndexes,
    };
  }

  return { scorePct, outcome: 'reteach_all', reteachBeats: beats, missedIndexes };
}
