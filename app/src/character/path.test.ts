import { describe, expect, it } from 'vitest';
import {
  CALM_TO_ANGRY_OFFSET,
  cubicPointAt,
  interpolatePath,
  morphCompatible,
  parsePath,
  pathStructure,
  serializePath,
  subdivideCubic,
  subdividePath,
  translatePath,
  type Point,
} from './path';

describe('path parsing (Part 06 §10)', () => {
  it('normalizes relative commands to absolute', () => {
    expect(pathStructure(parsePath('m10 10 l5 0 z'))).toBe('MLZ');
    expect(serializePath(parsePath('m10 10 l5 0'))).toBe('M10 10 L15 10');
  });

  it('turns H and V into line commands', () => {
    expect(serializePath(parsePath('M0 0 H10 V5'))).toBe('M0 0 L10 0 L10 5');
  });

  it('treats extra pairs after an M as implicit lines, per the spec', () => {
    expect(pathStructure(parsePath('M0 0 5 5 10 10'))).toBe('MLL');
  });

  it('expresses a quadratic as its exact cubic equivalent', () => {
    const [, curve] = parsePath('M0 0 Q6 12 12 0');
    expect(curve!.type).toBe('C');
    // The equivalent cubic's controls sit 2/3 of the way to the quad control.
    expect(curve!.values).toEqual([4, 8, 8, 8, 12, 0]);
  });

  it('expands a smooth curve using the reflected control point', () => {
    const [, , smooth] = parsePath('M0 0 C2 4 6 4 8 0 S14 -4 16 0');
    // Previous control was (6,4) at the point (8,0) → reflection is (10,-4).
    expect(smooth!.values.slice(0, 2)).toEqual([10, -4]);
  });

  it('rejects arcs rather than pretending they can be morphed', () => {
    expect(() => parsePath('M0 0 A5 5 0 0 1 10 10')).toThrow(/arc/i);
  });

  it('rejects a malformed command instead of guessing', () => {
    expect(() => parsePath('M0 0 C1 2 3')).toThrow(/groups of 6/);
  });
});

describe('morph compatibility (Part 06 §10)', () => {
  const calm = parsePath('M10 10 C12 10 14 10 16 10');
  const angry = parsePath('M10 12 C12 8 14 8 16 12');

  it('accepts paths sharing a command sequence', () => {
    expect(morphCompatible(calm, angry)).toBe(true);
  });

  it('rejects paths that do not', () => {
    expect(morphCompatible(calm, parsePath('M10 10 L16 10'))).toBe(false);
  });

  it('interpolates point-by-point between them', () => {
    const half = interpolatePath(calm, angry, 0.5);
    expect(serializePath(half)).toBe('M10 11 C12 9 14 9 16 11');
  });

  it('returns the exact endpoints at 0 and 1', () => {
    expect(serializePath(interpolatePath(calm, angry, 0))).toBe(serializePath(calm));
    expect(serializePath(interpolatePath(calm, angry, 1))).toBe(serializePath(angry));
  });

  it('clamps out-of-range anger rather than extrapolating past the artwork', () => {
    expect(serializePath(interpolatePath(calm, angry, 2))).toBe(serializePath(angry));
    expect(serializePath(interpolatePath(calm, angry, -1))).toBe(serializePath(calm));
  });

  it('throws on a structure mismatch instead of blending partially', () => {
    // A silent partial morph would be debugged as a rendering bug; this makes
    // an asset change surface at the point of breakage.
    expect(() => interpolatePath(calm, parsePath('M10 10 L16 10'), 0.5)).toThrow(/incompatible/);
  });
});

describe('Bézier subdivision (Part 06 §10)', () => {
  const p0: Point = { x: 0, y: 0 };
  const p1: Point = { x: 10, y: 20 };
  const p2: Point = { x: 30, y: 20 };
  const p3: Point = { x: 40, y: 0 };

  it('splits a curve into two that trace it exactly', () => {
    const { first, second } = subdivideCubic(p0, p1, p2, p3, 0.5);
    expect(first[0]).toEqual(p0);
    expect(second[3]).toEqual(p3);
    expect(first[3]).toEqual(second[0]);

    // Sample both halves against the original curve.
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const onFirst = cubicPointAt(first[0], first[1], first[2], first[3], t);
      const original = cubicPointAt(p0, p1, p2, p3, t / 2);
      expect(onFirst.x).toBeCloseTo(original.x, 9);
      expect(onFirst.y).toBeCloseTo(original.y, 9);
    }
  });

  it('doubles a one-segment eye into two segments without changing its shape', () => {
    const one = parsePath('M0 0 C10 20 30 20 40 0');
    const two = subdividePath(one);
    expect(pathStructure(two)).toBe('MCC');

    const midpoint = cubicPointAt(p0, p1, p2, p3, 0.5);
    expect(two[1]!.values[4]).toBeCloseTo(midpoint.x, 9);
    expect(two[1]!.values[5]).toBeCloseTo(midpoint.y, 9);
  });

  it('subdivides a DEAD-STRAIGHT eye the same way, so front-gaze still morphs', () => {
    // The resting eye is a straight line by design (§10) — it still has to
    // reach the angry eye's two-segment structure.
    const straight = subdividePath(parsePath('M0 0 L40 0'));
    expect(pathStructure(straight)).toBe('MCC');
    expect(straight[1]!.values[4]).toBeCloseTo(20, 9);
    expect(straight[1]!.values[5]).toBeCloseTo(0, 9);
    // And it must still be straight: every control point on the line y = 0.
    for (const command of straight.slice(1)) {
      for (let i = 1; i < command.values.length; i += 2) {
        expect(command.values[i]).toBeCloseTo(0, 9);
      }
    }
  });
});

describe('canvas alignment (Part 06 §10)', () => {
  it('shifts calm coordinates onto the angry canvas before interpolating', () => {
    // 241×191 calm vs 245×193 angry — without this the character drifts as
    // anger rises.
    expect(CALM_TO_ANGRY_OFFSET).toEqual({ dx: 2, dy: 1 });
    const shifted = translatePath(parsePath('M10 10 C12 10 14 10 16 10'), 2, 1);
    expect(serializePath(shifted)).toBe('M12 11 C14 11 16 11 18 11');
  });

  it('leaves a close command alone', () => {
    expect(serializePath(translatePath(parsePath('M0 0 L4 0 Z'), 2, 1))).toBe('M2 1 L6 1 Z');
  });
});
