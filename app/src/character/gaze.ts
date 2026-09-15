/**
 * Look-Around and Blink scheduling (Part 06 §10).
 *
 * Both loops are randomized and run independently — they're allowed to overlap,
 * because a blink landing mid-glance is exactly what a face does. Kept pure
 * (a random source is injected) so the weighting and the standing suppression
 * rule are testable without watching a character for a minute.
 */

/** The five gaze targets. `front` is Bixy looking at the student. */
export const GAZE_DIRECTIONS = ['top_left', 'left', 'top_right', 'right', 'front'] as const;

export type GazeDirection = (typeof GAZE_DIRECTIONS)[number];

/**
 * How often `front` is chosen, versus the four side targets sharing the rest.
 *
 * Weighted deliberately: with a flat 1-in-5 chance, gaze spends 80% of its time
 * off the student and reads as constant darting. Returning to front roughly
 * every other glance makes the wandering read as thought rather than nerves.
 */
export const FRONT_WEIGHT = 0.5;

/** How long a gaze target is held before releasing back toward front. */
export const GAZE_HOLD_MS = { min: 900, max: 2200 };

/** The gap between one glance ending and the next beginning. */
export const GAZE_GAP_MS = { min: 1600, max: 4200 };

/** Blink cadence — irregular, because a metronome blink reads as a machine. */
export const BLINK_INTERVAL_MS = { min: 2400, max: 6800 };

/** One eye squash. Short enough to be felt rather than watched. */
export const BLINK_DURATION_MS = 130;

type Random = () => number;

function between(range: { min: number; max: number }, random: Random): number {
  return range.min + random() * (range.max - range.min);
}

/**
 * The next gaze target, front-weighted.
 *
 * `speaking` is the standing rule from §10: whenever Bixy is addressing the
 * student — greeting, narrating a lesson, or angry (which is a continuous form
 * of addressing them) — gaze stays front and only the blink loop continues.
 * It's one rule with several triggers, not a behaviour per situation.
 */
export function nextGaze(random: Random, speaking: boolean): GazeDirection {
  if (speaking) return 'front';
  if (random() < FRONT_WEIGHT) return 'front';
  const sides = GAZE_DIRECTIONS.filter((d) => d !== 'front');
  const index = Math.min(sides.length - 1, Math.floor(random() * sides.length));
  return sides[index]!;
}

/** How long to hold that target, and how long to wait before the next glance. */
export function nextGazeTiming(random: Random): { holdMs: number; gapMs: number } {
  return { holdMs: between(GAZE_HOLD_MS, random), gapMs: between(GAZE_GAP_MS, random) };
}

/** The wait before the next blink. Independent of gaze — the loops may overlap. */
export function nextBlinkDelayMs(random: Random): number {
  return between(BLINK_INTERVAL_MS, random);
}

/**
 * Offsets, in the character's own SVG units, for the group that moves together
 * on a glance: eyes, mouth, and the sparkle accent.
 *
 * Moving them as one group — rather than the eyes alone — is what makes the
 * glance read as the character looking somewhere instead of its eyes sliding
 * around inside a static face.
 */
export const GAZE_OFFSETS: Record<GazeDirection, { x: number; y: number }> = {
  front: { x: 0, y: 0 },
  left: { x: -6, y: 0 },
  right: { x: 6, y: 0 },
  top_left: { x: -5, y: -4 },
  top_right: { x: 5, y: -4 },
};

/**
 * How far the eye curve bows for a direction: 0 dead-ahead, signed by side.
 *
 * Zero at front matters structurally, not just visually — the calm source art
 * draws the resting eye as a perfectly straight line, so a bow of exactly 0 has
 * to reproduce that art exactly rather than approximately (§10).
 */
export const GAZE_BOW: Record<GazeDirection, number> = {
  front: 0,
  left: -3.5,
  right: 3.5,
  top_left: -2.5,
  top_right: 2.5,
};
