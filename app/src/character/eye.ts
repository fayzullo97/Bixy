import type { EyeAnchor } from './assets';
import { GAZE_BOW, type GazeDirection } from './gaze';

/**
 * The gaze-curved eye (Part 06 §10) — ported from the reference's `bowEyeD`.
 *
 * Each eye is a vertical cubic from (x, y0) to (x, y1). Bowing displaces both
 * control points horizontally by `bow`: exactly 0 dead ahead, which reproduces
 * the straight source art rather than approximating it, and signed by direction
 * (negative curves left, positive right). Because the curve is generated rather
 * than translated, left and right read with equal strength — the flaw the old
 * translation-only approach accepted — and the character never mirrors.
 *
 * The result is always split into two segments by exact Bézier subdivision, so
 * a bowed eye stays structurally compatible with the two-segment angry eye at
 * any gaze direction. Blink, gaze and the morph therefore compose: Bixy can be
 * angry, mid-blink, and holding a glance all at once.
 */

type P = [number, number];

function mid(p: P, q: P): P {
  return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
}

/**
 * Split one cubic at its midpoint into two cubics tracing the same curve
 * (de Casteljau). Returns the 7 points of the pair: seg1 = p0,a,d,f and
 * seg2 = f,e,c,p3.
 */
export function subdivideCubicMidpoint(p0: P, p1: P, p2: P, p3: P): [P, P, P, P, P, P, P] {
  const a = mid(p0, p1);
  const b = mid(p1, p2);
  const c = mid(p2, p3);
  const d = mid(a, b);
  const e = mid(b, c);
  const f = mid(d, e);
  return [p0, a, d, f, e, c, p3];
}

function fmt(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The eye path for a bow amount, as two cubic segments. */
export function bowEyePath(anchor: EyeAnchor, bow: number): string {
  const { x, y0, cy1, cy2, y1 } = anchor;
  const [p0, p1, p2, p3, p4, p5, p6] = subdivideCubicMidpoint(
    [x, y0],
    [x + bow, cy1],
    [x + bow, cy2],
    [x, y1],
  );
  return (
    `M${fmt(p0[0])} ${fmt(p0[1])}` +
    `C${fmt(p1[0])} ${fmt(p1[1])} ${fmt(p2[0])} ${fmt(p2[1])} ${fmt(p3[0])} ${fmt(p3[1])}` +
    `C${fmt(p4[0])} ${fmt(p4[1])} ${fmt(p5[0])} ${fmt(p5[1])} ${fmt(p6[0])} ${fmt(p6[1])}`
  );
}

/** The eye path for a gaze direction. */
export function eyePathForGaze(anchor: EyeAnchor, direction: GazeDirection): string {
  return bowEyePath(anchor, GAZE_BOW[direction]);
}

/**
 * The blink transform for one eye: squash toward its own vertical center.
 *
 * Around the eye's own center rather than the face's, so the two eyes close
 * onto themselves instead of sliding toward the middle. The reference gets this
 * from CSS (`transform-box: fill-box` + a 50% origin); written out explicitly
 * here so it doesn't depend on a CSS property whose support varies across the
 * react-native-web surface.
 */
export function blinkTransform(anchor: EyeAnchor, closed: boolean): string {
  const centerY = (anchor.y0 + anchor.y1) / 2;
  // 0.08, matching the reference — never 0, which would erase the stroke.
  const scaleY = closed ? BLINK_SCALE_Y : 1;
  return `translate(0 ${centerY}) scale(1 ${scaleY}) translate(0 ${-centerY})`;
}

/** How far a closed eye squashes. From the reference's `.eye-path.blink` rule. */
export const BLINK_SCALE_Y = 0.08;
