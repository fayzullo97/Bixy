import type { Beat, QuizQuestion } from './types';
import type { QuizAnswer } from './Quiz';

// Mastery branching off the end-of-topic test score (§8.4):
//   ≥80%  → passed, advance
//   50–79% → re-teach only the beats tied to the missed questions
//   <50%  → re-teach the whole topic from the start
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
}

export function decideMastery(
  quiz: QuizQuestion[],
  answers: Array<QuizAnswer | undefined>,
  beats: Beat[],
): MasteryDecision {
  if (quiz.length === 0) return { scorePct: 100, outcome: 'passed', reteachBeats: [] };

  const correct = answers.filter((a) => a?.correct).length;
  const scorePct = Math.round((correct / quiz.length) * 100);

  if (scorePct >= PASS_THRESHOLD * 100) {
    return { scorePct, outcome: 'passed', reteachBeats: [] };
  }

  const missed = new Set<number>();
  answers.forEach((a, i) => {
    if (!a?.correct && quiz[i]) missed.add(quiz[i].tests_beat_id);
  });

  if (scorePct >= RETEACH_MISSED_THRESHOLD * 100) {
    const subset = beats.filter((b) => missed.has(b.id));
    // Fall back to the whole topic if tagging somehow left nothing to re-teach.
    return { scorePct, outcome: 'reteach_missed', reteachBeats: subset.length > 0 ? subset : beats };
  }

  return { scorePct, outcome: 'reteach_all', reteachBeats: beats };
}
