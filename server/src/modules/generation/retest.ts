import type { QuizQuestion } from './boardScript.js';
import { variantFingerprint } from './variants.js';

/** Fixed size of the post-re-teach retest (Part 04 §6). */
export const RETEST_SIZE = 8;

/**
 * Builds the retest from what the student actually missed, topped up from the
 * pool (Part 04 §6).
 *
 * Order matters and is part of the spec: missed questions come FIRST. If more
 * than 8 were missed, only 8 are used this round and no new questions are added
 * — the remaining misses wait for the next round rather than making the retest
 * longer than it's meant to be.
 *
 * `pooled` is the topic's variant pool minus the missed set. It's the only
 * source of filler — §6 is explicit that a retest never triggers fresh
 * generation, so a thin pool yields a shorter retest rather than a model call.
 *
 * Pure so the selection rule is unit-tested directly, without a DB.
 */
export function buildRetest(
  missedFingerprints: string[],
  available: QuizQuestion[],
  pooled: QuizQuestion[],
  size: number = RETEST_SIZE,
): QuizQuestion[] {
  const missedSet = new Set(missedFingerprints);
  const seen = new Set<string>();
  const out: QuizQuestion[] = [];

  const push = (q: QuizQuestion): boolean => {
    const fingerprint = variantFingerprint('quiz_question', q);
    if (seen.has(fingerprint) || out.length >= size) return false;
    seen.add(fingerprint);
    out.push({ ...q, quiz_question_id: out.length + 1 });
    return true;
  };

  // 1. The questions they got wrong, in the order they appeared in the test.
  for (const q of available) {
    if (missedSet.has(variantFingerprint('quiz_question', q))) push(q);
  }
  // 2. Top up from the pool — least-served first, already ordered by the repo.
  for (const q of pooled) push(q);
  // 3. Last resort: questions from this topic they answered correctly. Keeps the
  //    retest at full length on a topic whose pool hasn't filled out yet, which
  //    is every topic the first time anyone fails it.
  for (const q of available) push(q);

  return out;
}
