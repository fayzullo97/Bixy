import { describe, expect, it } from 'vitest';
import { assertMorphable, lerpFill, makeMorpher } from './morph';
import {
  BODY_ANGRY,
  BODY_CALM,
  BODY_FILL,
  EYE_LEFT_ANGRY,
  LEFT_EYE_ANCHOR,
  MOUTH_ANGRY,
  MOUTH_CALM,
  SPARKLE_FILL,
} from './assets';
import { bowEyePath } from './eye';
import { parsePath, pathStructure } from './path';

describe('the real assets are morphable (Part 06 §10)', () => {
  it('body: calm and angry share a command structure and point count', () => {
    expect(() => assertMorphable(BODY_CALM, BODY_ANGRY, 'body')).not.toThrow();
    expect(pathStructure(parsePath(BODY_CALM))).toBe('M' + 'C'.repeat(14) + 'Z');
    expect(pathStructure(parsePath(BODY_ANGRY))).toBe(pathStructure(parsePath(BODY_CALM)));
  });

  it('parses the body’s scientific notation rather than splitting it in two', () => {
    // BODY_ANGRY contains `1.17435e-05`; a simpler number pattern would read it
    // as two numbers and shift every point after it.
    expect(BODY_ANGRY).toContain('e-05');
    expect(BODY_CALM.match(/-?\d*\.?\d+(?:e-?\d+)?/gi)).toHaveLength(86);
    expect(BODY_ANGRY.match(/-?\d*\.?\d+(?:e-?\d+)?/gi)).toHaveLength(86);
  });

  it('mouth: a smile and a flat line, same structure', () => {
    expect(() => assertMorphable(MOUTH_CALM, MOUTH_ANGRY, 'mouth')).not.toThrow();
    expect(pathStructure(parsePath(MOUTH_CALM))).toBe('MC');
  });

  it('eye: a generated calm eye matches the angry eye’s two segments', () => {
    expect(() => assertMorphable(bowEyePath(LEFT_EYE_ANCHOR, 0), EYE_LEFT_ANGRY, 'eye')).not.toThrow();
  });
});

describe('makeMorpher (Part 06 §10)', () => {
  const morph = makeMorpher(MOUTH_CALM, MOUTH_ANGRY, 'mouth');

  it('returns the calm and angry paths unchanged at the endpoints', () => {
    expect(morph(0)).toBe(MOUTH_CALM);
    expect(morph(1)).toBe(MOUTH_ANGRY);
  });

  it('keeps the original command letters byte-for-byte', () => {
    // This is what makes it one character transforming rather than two shapes
    // being crossfaded.
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(pathStructure(parsePath(morph(t)))).toBe('MC');
    }
  });

  it('lands halfway between each pair of points', () => {
    const numbers = (d: string) => d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi)!.map(Number);
    const calm = numbers(MOUTH_CALM);
    const angry = numbers(MOUTH_ANGRY);
    const half = numbers(morph(0.5));
    // The morpher rounds to 3 decimals, so compare a hair looser than that.
    half.forEach((value, i) => expect(value).toBeCloseTo((calm[i]! + angry[i]!) / 2, 2));
  });

  it('clamps out-of-range anger rather than extrapolating past the artwork', () => {
    expect(morph(2)).toBe(MOUTH_ANGRY);
    expect(morph(-1)).toBe(MOUTH_CALM);
  });

  it('morphs the whole body without producing NaN', () => {
    const body = makeMorpher(BODY_CALM, BODY_ANGRY, 'body');
    for (const t of [0, 0.3, 0.5, 0.9, 1]) expect(body(t)).not.toContain('NaN');
  });

  it('refuses paths that are not structurally identical', () => {
    // The reference has no such check; an asset edit should surface here, not
    // as a character that morphs into nonsense.
    expect(() => makeMorpher('M0 0 C1 1 2 2 3 3', 'M0 0 L3 3', 'test')).toThrow(/command structures/);
  });

  it('refuses paths whose point counts disagree', () => {
    expect(() => makeMorpher('M0 0 L3 3', 'M0 0 L3 3 L4 4', 'test')).toThrow(/command structures|numbers/);
  });
});

describe('fill blending (Part 06 §10)', () => {
  it('moves the body purple → pink-red, not a generic red', () => {
    expect(lerpFill(BODY_FILL.calm, BODY_FILL.angry, 0)).toBe('rgb(121,80,244)');
    expect(lerpFill(BODY_FILL.calm, BODY_FILL.angry, 1)).toBe('rgb(244,80,132)');
  });

  it('moves the sparkle fill too — the only thing about it that changes', () => {
    // The sparkle never morphs shape; the angry asset's sparkle path is unused.
    expect(lerpFill(SPARKLE_FILL.calm, SPARKLE_FILL.angry, 1)).toBe('rgb(135,2,4)');
  });

  it('blends channel by channel, and clamps', () => {
    expect(lerpFill('#000000', '#ffffff', 0.5)).toBe('rgb(128,128,128)');
    expect(lerpFill('#000000', '#ffffff', 5)).toBe('rgb(255,255,255)');
  });

  it('rejects a color it cannot read', () => {
    expect(() => lerpFill('purple', '#ff0000', 0.5)).toThrow(/hex/);
  });
});
