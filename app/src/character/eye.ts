import { parsePath, serializePath, subdividePath, type Command, type Point } from './path';
import { GAZE_BOW, type GazeDirection } from './gaze';

/**
 * The gaze-curved eye (Part 06 §10).
 *
 * The eye's SHAPE changes with gaze, rather than the eye merely sliding: the
 * calm source art draws each eye as a perfectly straight line at rest
 * specifically so a curve can be generated from it. The bow amount is 0 dead
 * ahead — which must reproduce that straight art exactly, not approximately —
 * and signed by direction, negative curving left and positive right.
 *
 * This replaces the earlier translation-only approach, whose accepted flaw was
 * that rightward gaze read weaker than leftward. That asymmetry came from
 * moving a fixed curve; a generated curve is symmetric by construction, and the
 * character still never mirrors or flips.
 *
 * Every result is subdivided into two segments, so a bowed eye stays
 * structurally compatible with the two-segment angry eye at any gaze direction
 * — the two effects have to compose, since Bixy can be angry and blinking while
 * the bow sits wherever the last glance left it.
 */

/** Endpoints of one eye at rest, in the character's own coordinates. */
export interface EyeLine {
  from: Point;
  to: Point;
}

/**
 * Build the eye path for a bow amount, as two cubic segments.
 *
 * The curve is a single cubic whose control points are lifted perpendicular to
 * the eye line, so the bow is measured across the eye regardless of how the eye
 * is angled, and `bow === 0` leaves the controls exactly on the line — giving
 * back the straight source art rather than a curve that rounds to it.
 */
export function eyePath(line: EyeLine, bow: number): Command[] {
  const dx = line.to.x - line.from.x;
  const dy = line.to.y - line.from.y;
  const length = Math.hypot(dx, dy);

  // A degenerate eye has no direction to bow across; return the line as-is.
  const nx = length === 0 ? 0 : -dy / length;
  const ny = length === 0 ? 0 : dx / length;

  const control = (t: number): Point => ({
    x: line.from.x + dx * t + nx * bow,
    y: line.from.y + dy * t + ny * bow,
  });

  const c1 = control(1 / 3);
  const c2 = control(2 / 3);

  return subdividePath([
    { type: 'M', values: [line.from.x, line.from.y] },
    { type: 'C', values: [c1.x, c1.y, c2.x, c2.y, line.to.x, line.to.y] },
  ]);
}

/** The eye path for a gaze direction. */
export function eyePathForGaze(line: EyeLine, direction: GazeDirection): Command[] {
  return eyePath(line, GAZE_BOW[direction]);
}

/** Convenience for writing straight into a `d` attribute. */
export function eyePathData(line: EyeLine, bow: number): string {
  return serializePath(eyePath(line, bow));
}

/**
 * Read an eye's endpoints back out of its source path.
 *
 * Lets the rest of the character be driven by the real asset rather than by
 * endpoints copied into code, which would silently disagree the first time the
 * artwork is nudged.
 */
export function eyeLineFromPath(d: string): EyeLine {
  const commands = parsePath(d);
  const move = commands[0];
  const last = commands[commands.length - 1];
  if (!move || move.type !== 'M' || !last || last.type === 'Z' || last.type === 'M') {
    throw new Error('eyeLineFromPath: expected a path that moves then draws');
  }
  const to =
    last.type === 'L'
      ? { x: last.values[0], y: last.values[1] }
      : { x: last.values[4], y: last.values[5] };
  return { from: { x: move.values[0], y: move.values[1] }, to };
}

/**
 * The blink transform for one eye: squash toward its own vertical center.
 *
 * Around the eye's own center rather than the character's, so both eyes close
 * onto themselves instead of sliding toward the middle of the face. `progress`
 * runs 0 → 1 → 0 across one blink.
 */
export function blinkTransform(line: EyeLine, progress: number): string {
  const clamped = Math.max(0, Math.min(1, progress));
  // Never exactly 0: a zero scale collapses the bounding box, and the eye's
  // stroke disappears entirely rather than reading as a closed lid.
  const scaleY = Math.max(0.04, 1 - clamped);
  const centerY = (line.from.y + line.to.y) / 2;
  return `translate(0 ${centerY}) scale(1 ${scaleY}) translate(0 ${-centerY})`;
}
