/**
 * Float, Breathe and Jump (Part 06 §10) — ported from the reference's CSS
 * keyframes, kept as data so the values are testable and the component just
 * renders them.
 *
 * Float and Breathe are deliberately barely-there: they exist to stop the
 * character reading as a static image, and §10 is explicit that Breathe is not
 * a visible squish.
 */

export interface Keyframe {
  /** Percentage through the animation. */
  at: number;
  scaleX: number;
  scaleY: number;
  /** Positive = downward, matching CSS translateY. */
  translateY: number;
  /** Degrees. */
  skewX?: number;
}

/**
 * Float and Breathe share ONE duration and easing, and must be started
 * together, so the body's breath stays locked to the bob instead of drifting in
 * and out of phase over minutes.
 */
export const IDLE_DURATION_MS = 3000;
export const IDLE_EASING = 'ease-in-out';

/** Float: the whole character bobs UP at the half-way point. */
export const FLOAT_KEYFRAMES: Keyframe[] = [
  { at: 0, scaleX: 1, scaleY: 1, translateY: 0 },
  { at: 50, scaleX: 1, scaleY: 1, translateY: -5 },
  { at: 100, scaleX: 1, scaleY: 1, translateY: 0 },
];

/**
 * Breathe: at the top of the bob the body is WIDER and SHORTER, with a touch
 * of skew.
 *
 * The direction matters and is easy to get backwards — an earlier pass had the
 * body stretching taller exactly when the float lifted it, which reads as the
 * character being pulled upward rather than breathing under its own power.
 */
export const BREATHE_KEYFRAMES: Keyframe[] = [
  { at: 0, scaleX: 1, scaleY: 1, translateY: 0, skewX: 0 },
  { at: 50, scaleX: 1.018, scaleY: 0.982, translateY: 0, skewX: 0.6 },
  { at: 100, scaleX: 1, scaleY: 1, translateY: 0, skewX: 0 },
];

export const JUMP_DURATION_MS = 620;
export const JUMP_EASING = 'cubic-bezier(.3,.2,.2,1)';

/**
 * Jump: squash → launch → settle.
 *
 * The squash and the landing both sit BELOW the resting line (positive
 * translateY): the character compresses into the ground before launching, and
 * dips again as it absorbs the landing. Clamping the motion to never go below
 * rest — the obvious-looking "it can't sink through the floor" reading — is
 * what makes a jump look like a hover.
 */
export const JUMP_KEYFRAMES: Keyframe[] = [
  { at: 0, scaleX: 1, scaleY: 1, translateY: 0 },
  { at: 18, scaleX: 1.1, scaleY: 0.82, translateY: 4 },
  { at: 45, scaleX: 0.88, scaleY: 1.22, translateY: -26 },
  { at: 70, scaleX: 1.05, scaleY: 0.94, translateY: 2 },
  { at: 85, scaleX: 0.97, scaleY: 1.04, translateY: -4 },
  { at: 100, scaleX: 1, scaleY: 1, translateY: 0 },
];

function transformOf(frame: Keyframe): string {
  const skew = frame.skewX ? ` skewX(${frame.skewX}deg)` : '';
  return `scale(${frame.scaleX}, ${frame.scaleY}) translateY(${frame.translateY}px)${skew}`;
}

/** Render a keyframe list as a CSS `@keyframes` block. */
export function keyframesCss(name: string, frames: Keyframe[]): string {
  const steps = frames
    .map((frame) => `  ${frame.at}% { transform: ${transformOf(frame)}; }`)
    .join('\n');
  return `@keyframes ${name} {\n${steps}\n}`;
}
