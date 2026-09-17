import type { BoardScript, MasteryOutcomeFailing } from './types';

/** The two failing tiers a score reaction is written for (Part 04 §6). */
export type FailingOutcome = MasteryOutcomeFailing;

/**
 * Picks the in-persona line announcing a failing score (Part 04 §6).
 *
 * Phrasings are pre-generated into the board script per tier, so this is a
 * lookup rather than a model call at the moment a student has just failed — no
 * added latency, and no new failure mode at the worst possible time.
 *
 * `round` rotates the choice, so a student who fails the same topic twice
 * doesn't hear the identical sentence back. `{score}` is substituted here
 * because the percentage isn't known until now — which is also why these lines
 * are text-only rather than spoken.
 *
 * Returns null when the script carries no usable phrasing (an older script, or a
 * tier the model returned empty); the board then falls back to plain wording.
 */
export function pickScoreReaction(
  script: BoardScript,
  outcome: FailingOutcome,
  scorePct: number,
  round: number,
): string | null {
  const phrasings = script.score_reactions?.[outcome] ?? [];
  if (phrasings.length === 0) return null;
  const chosen = phrasings[Math.abs(round) % phrasings.length]!;
  return chosen.replace(/\{score\}/g, String(scorePct));
}
