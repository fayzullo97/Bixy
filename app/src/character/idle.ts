import { JUMP_PHASES_MS, JUMP_TOTAL_MS } from './jump';

/**
 * Float, Breathe and the Jump curve (Part 06 §10) — everything driven purely by
 * elapsed time, so the render layer only has to ask "what does this look like
 * now?" once per frame and hold no animation state of its own.
 *
 * Float and Breathe are deliberately barely-there. They exist to stop the
 * character reading as a static image, and the spec is explicit that Breathe is
 * not a visible squish; the numbers here are small on purpose and should be
 * changed by eye, not by reasoning about them.
 */

/** One full up-and-down of the Float bob. */
export const FLOAT_PERIOD_MS = 3800;

/** Peak vertical travel, in the character's own units. */
export const FLOAT_AMPLITUDE = 3.2;

/** Breathe rides the same clock as Float, so the body doesn't fight the bob. */
export const BREATHE_SCALE = 0.014;
export const BREATHE_SKEW = 0.006;

const TAU = Math.PI * 2;

/** Float offset now — a sine bob, zero at t=0 so it starts from rest. */
export function floatOffset(elapsedMs: number): number {
  return Math.sin((elapsedMs / FLOAT_PERIOD_MS) * TAU) * FLOAT_AMPLITUDE;
}

/**
 * Breathe now: a subtle non-uniform scale plus a touch of skew on `body-path`,
 * approximating a breathing curve without morphing the path.
 *
 * Synced to Float and in anti-phase — the body is widest at the bottom of the
 * bob, which is what makes the two read as one movement rather than two loops
 * running at the same speed.
 */
export function breathe(elapsedMs: number): { scaleX: number; scaleY: number; skewX: number } {
  const phase = Math.sin((elapsedMs / FLOAT_PERIOD_MS) * TAU);
  return {
    scaleX: 1 - phase * BREATHE_SCALE,
    scaleY: 1 + phase * BREATHE_SCALE,
    skewX: phase * BREATHE_SKEW,
  };
}

export interface JumpFrame {
  /** Upward travel, in the character's own units (positive = up). */
  lift: number;
  scaleX: number;
  scaleY: number;
  /** False once the jump is over and the character is back at rest. */
  active: boolean;
}

const REST: JumpFrame = { lift: 0, scaleX: 1, scaleY: 1, active: false };

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * The Jump at a given point in its run: squash → launch → settle (§10).
 *
 * Squash compresses in place; launch overshoots upward while thinning; settle
 * drops back with one small bounce. Returns rest outside the run, so a caller
 * can drive it from a start timestamp and stop when `active` goes false.
 */
export function jumpFrame(elapsedMs: number): JumpFrame {
  if (elapsedMs < 0 || elapsedMs >= JUMP_TOTAL_MS) return REST;

  const { squash, launch } = JUMP_PHASES_MS;

  if (elapsedMs < squash) {
    const t = elapsedMs / squash;
    return { lift: 0, scaleX: 1 + 0.08 * t, scaleY: 1 - 0.12 * t, active: true };
  }

  if (elapsedMs < squash + launch) {
    const t = easeOut((elapsedMs - squash) / launch);
    return {
      lift: 26 * t,
      // Out of the squash (1.08 / 0.88) and through to a stretched launch.
      scaleX: 1.08 - 0.2 * t,
      scaleY: 0.88 + 0.26 * t,
      active: true,
    };
  }

  const t = (elapsedMs - squash - launch) / JUMP_PHASES_MS.settle;
  // One decaying bounce on the way down, landing exactly at rest.
  const bounce = Math.sin(t * Math.PI * 2) * (1 - t) * 0.06;
  return {
    lift: 26 * (1 - easeOut(t)),
    scaleX: 0.88 + 0.12 * t - bounce,
    scaleY: 1.14 - 0.14 * t + bounce,
    active: true,
  };
}
