import { describe, expect, it } from 'vitest';
import { BLINK_SCALE_Y, blinkTransform, bowEyePath, eyePathForGaze, subdivideCubicMidpoint } from './eye';
import { LEFT_EYE_ANCHOR, RIGHT_EYE_ANCHOR, EYE_LEFT_ANGRY, EYE_RIGHT_ANGRY } from './assets';
import { GAZE_BOW, GAZE_DIRECTIONS } from './gaze';
import { cubicPointAt, parsePath, pathStructure } from './path';
import { assertMorphable } from './morph';

describe('gaze-curved eye (Part 06 §10)', () => {
  it('is dead straight at front — the source art, not an approximation', () => {
    const d = bowEyePath(LEFT_EYE_ANCHOR, 0);
    // Every x is the anchor's x: no bow at all.
    for (const value of d.match(/-?[\d.]+/g)!.map(Number).filter((_, i) => i % 2 === 0)) {
      expect(value).toBe(LEFT_EYE_ANCHOR.x);
    }
  });

  it('keeps the asset’s own control heights, which are NOT evenly spaced', () => {
    // The right eye's lower control sits at 82 where the left's sits at 74.
    // Even thirds would flatten that and start the morph from geometry the
    // artist never drew.
    expect(RIGHT_EYE_ANCHOR.cy2).toBe(82);
    expect(LEFT_EYE_ANCHOR.cy2).toBe(74);
    expect(RIGHT_EYE_ANCHOR.cy2 - RIGHT_EYE_ANCHOR.y0).not.toBeCloseTo(
      ((RIGHT_EYE_ANCHOR.y1 - RIGHT_EYE_ANCHOR.y0) * 2) / 3,
      1,
    );
  });

  it('bows left or right by the sign, with equal strength', () => {
    const left = bowEyePath(LEFT_EYE_ANCHOR, -7);
    const right = bowEyePath(LEFT_EYE_ANCHOR, 7);
    const xs = (d: string) => d.match(/-?[\d.]+/g)!.map(Number).filter((_, i) => i % 2 === 0);
    const leftMax = Math.max(...xs(left).map((x) => LEFT_EYE_ANCHOR.x - x));
    const rightMax = Math.max(...xs(right).map((x) => x - LEFT_EYE_ANCHOR.x));
    // Symmetric by construction — the old translation-only approach was not.
    expect(leftMax).toBeCloseTo(rightMax, 9);
    expect(leftMax).toBeGreaterThan(0);
  });

  it('pins the eye endpoints wherever it bows', () => {
    for (const bow of Object.values(GAZE_BOW)) {
      const d = bowEyePath(LEFT_EYE_ANCHOR, bow);
      expect(d.startsWith(`M${LEFT_EYE_ANCHOR.x} ${LEFT_EYE_ANCHOR.y0}`)).toBe(true);
      expect(d.endsWith(`${LEFT_EYE_ANCHOR.x} ${LEFT_EYE_ANCHOR.y1}`)).toBe(true);
    }
  });

  it('is two segments at every direction, so it can still morph', () => {
    for (const direction of GAZE_DIRECTIONS) {
      expect(pathStructure(parsePath(eyePathForGaze(LEFT_EYE_ANCHOR, direction)))).toBe('MCC');
    }
  });

  it('stays morph-compatible with the ANGRY eyes at every gaze direction', () => {
    // The whole point of subdividing: Bixy can be angry and mid-glance at once.
    for (const direction of GAZE_DIRECTIONS) {
      expect(() =>
        assertMorphable(eyePathForGaze(LEFT_EYE_ANCHOR, direction), EYE_LEFT_ANGRY, 'eye-left'),
      ).not.toThrow();
      expect(() =>
        assertMorphable(eyePathForGaze(RIGHT_EYE_ANCHOR, direction), EYE_RIGHT_ANGRY, 'eye-right'),
      ).not.toThrow();
    }
  });
});

describe('Bézier subdivision (Part 06 §10)', () => {
  const p0: [number, number] = [96, 58];
  const p1: [number, number] = [89, 63.5];
  const p2: [number, number] = [89, 74];
  const p3: [number, number] = [96, 85];

  it('splits a curve into two that trace it exactly', () => {
    const [a0, a1, a2, a3, b1, b2, b3] = subdivideCubicMidpoint(p0, p1, p2, p3);
    expect(a0).toEqual(p0);
    expect(b3).toEqual(p3);

    const point = (t: number) =>
      cubicPointAt({ x: p0[0], y: p0[1] }, { x: p1[0], y: p1[1] }, { x: p2[0], y: p2[1] }, { x: p3[0], y: p3[1] }, t);

    // The join is the original curve's midpoint.
    expect(a3[0]).toBeCloseTo(point(0.5).x, 9);
    expect(a3[1]).toBeCloseTo(point(0.5).y, 9);

    // And each half traces its share of the original.
    for (const t of [0.25, 0.5, 0.75]) {
      const onFirst = cubicPointAt(
        { x: a0[0], y: a0[1] }, { x: a1[0], y: a1[1] }, { x: a2[0], y: a2[1] }, { x: a3[0], y: a3[1] }, t,
      );
      expect(onFirst.x).toBeCloseTo(point(t / 2).x, 9);
      expect(onFirst.y).toBeCloseTo(point(t / 2).y, 9);

      const onSecond = cubicPointAt(
        { x: a3[0], y: a3[1] }, { x: b1[0], y: b1[1] }, { x: b2[0], y: b2[1] }, { x: b3[0], y: b3[1] }, t,
      );
      expect(onSecond.x).toBeCloseTo(point(0.5 + t / 2).x, 9);
      expect(onSecond.y).toBeCloseTo(point(0.5 + t / 2).y, 9);
    }
  });

  it('subdivides a dead-straight eye without bending it', () => {
    const straight = bowEyePath(LEFT_EYE_ANCHOR, 0);
    const commands = parsePath(straight);
    expect(pathStructure(commands)).toBe('MCC');
    for (const command of commands.slice(1)) {
      for (let i = 0; i < command.values.length; i += 2) {
        expect(command.values[i]).toBe(LEFT_EYE_ANCHOR.x);
      }
    }
  });
});

describe('blink (Part 06 §10)', () => {
  it('does nothing at rest', () => {
    expect(blinkTransform(LEFT_EYE_ANCHOR, false)).toContain('scale(1 1)');
  });

  it('squashes around the eye’s OWN center, not the face’s', () => {
    // Otherwise both eyes slide toward the middle of the face as they close.
    const center = (LEFT_EYE_ANCHOR.y0 + LEFT_EYE_ANCHOR.y1) / 2;
    expect(blinkTransform(LEFT_EYE_ANCHOR, true)).toContain(`translate(0 ${center})`);
    expect(blinkTransform(RIGHT_EYE_ANCHOR, true)).not.toContain(`translate(0 ${center})`);
  });

  it('closes to the reference’s 0.08, never to zero, which would erase the stroke', () => {
    expect(BLINK_SCALE_Y).toBe(0.08);
    expect(blinkTransform(LEFT_EYE_ANCHOR, true)).toContain('scale(1 0.08)');
  });
});
