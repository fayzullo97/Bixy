/**
 * Look-Around and Blink (Part 06 §10) — values ported from the reference.
 *
 * Both loops run independently and may overlap: a blink landing mid-glance is
 * exactly what a face does. Kept pure (the random source is injected) so the
 * weighting and the standing suppression rule are testable without watching the
 * character for a minute.
 */

/** The five gaze targets. `front` is Bixy looking at the student. */
export const GAZE_DIRECTIONS = ['top_left', 'left', 'top_right', 'right', 'front'] as const;

export type GazeDirection = (typeof GAZE_DIRECTIONS)[number];

/**
 * The reference's draw pool, kept as a pool rather than collapsed into a
 * probability: `front` appearing five times in nine is the tuned figure, and
 * writing it as 0.5-ish loses that it was chosen by watching the character
 * rather than derived. Front has to come up often or the gaze reads as darting.
 */
export const GAZE_POOL: readonly GazeDirection[] = [
  'front',
  'front',
  'left',
  'front',
  'right',
  'front',
  'top_left',
  'front',
  'top_right',
];

/**
 * How long a target is held before the next draw.
 *
 * There is no separate gap: the next glance is drawn as soon as this elapses,
 * and `front` — which is more than half the pool — IS the resting state. An
 * added pause between glances would be a behaviour the verified version doesn't
 * have.
 */
export const GAZE_HOLD_MS = { min: 700, max: 2100 };

/** How often the suppression rule is re-checked while Bixy is addressing them. */
export const GAZE_SUPPRESSED_RECHECK_MS = 400;

/** Blink cadence — irregular, because a metronome blink reads as a machine. */
export const BLINK_INTERVAL_MS = { min: 2200, max: 5400 };

/** One eye squash. Short enough to be felt rather than watched. */
export const BLINK_DURATION_MS = 130;

type Random = () => number;

function between(range: { min: number; max: number }, random: Random): number {
  return range.min + random() * (range.max - range.min);
}

/**
 * The next gaze target.
 *
 * `addressing` is the standing rule from §10: whenever Bixy is talking to the
 * student — greeting, narrating, or angry, which is a continuous form of
 * addressing them — gaze stays front and only the blink loop continues. One
 * rule with several triggers, not a behaviour per situation.
 */
export function nextGaze(random: Random, addressing: boolean): GazeDirection {
  if (addressing) return 'front';
  const index = Math.min(GAZE_POOL.length - 1, Math.floor(random() * GAZE_POOL.length));
  return GAZE_POOL[index]!;
}

/** How long to hold that target before drawing the next one. */
export function nextGazeHoldMs(random: Random): number {
  return between(GAZE_HOLD_MS, random);
}

/** The wait before the next blink. Independent of gaze — the loops may overlap. */
export function nextBlinkDelayMs(random: Random): number {
  return between(BLINK_INTERVAL_MS, random);
}

/**
 * Offsets for the group that moves together on a glance: eyes, mouth and the
 * sparkle accent. Moving them as one group — rather than the eyes alone — is
 * what makes a glance read as the character looking somewhere instead of its
 * eyes sliding around inside a static face.
 */
export const GAZE_OFFSETS: Record<GazeDirection, { x: number; y: number }> = {
  front: { x: 0, y: 0 },
  left: { x: -7, y: 0 },
  right: { x: 7, y: 0 },
  top_left: { x: -6, y: -5 },
  top_right: { x: 6, y: -5 },
};

/**
 * How far the eye curve bows per direction: 0 dead-ahead, signed by side.
 *
 * Zero at front matters structurally, not just visually — the calm art draws
 * the resting eye as a perfectly straight line, so a bow of exactly 0 has to
 * reproduce that art rather than approximate it.
 */
export const GAZE_BOW: Record<GazeDirection, number> = {
  front: 0,
  left: -7,
  right: 7,
  top_left: -6,
  top_right: 6,
};
