import { morphCompatible, parsePath } from './path';

/**
 * Path morphing (Part 06 §10) — ported from the reference implementation's
 * `makeMorpher`.
 *
 * The interpolation is a string-template numeric lerp: split the calm `d` on its
 * numbers, keep the literal text between them, and blend the numbers pairwise.
 * That keeps the original command letters byte-for-byte, so what renders is the
 * artist's path with moved points and nothing else — the property that makes
 * this a single morphing character rather than two shapes being crossfaded.
 *
 * It is therefore only correct when both paths carry the same commands in the
 * same order. The reference has no check for that; `assertMorphable` adds one,
 * using the real parser, so an asset edit surfaces as a clear error instead of
 * as a character that morphs into nonsense.
 */

// Matches the reference's regex, including the exponent form — the body path
// contains `1.17435e-05`, which a simpler number pattern would split in two.
const NUMBER = /-?\d*\.?\d+(?:e-?\d+)?/gi;

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export type Morpher = (t: number) => string;

/**
 * Check that two paths can morph point-by-point, throwing if they can't.
 *
 * Deliberately parser-based rather than a number count: two paths can hold the
 * same quantity of numbers while spending them on different commands, which
 * would interpolate "successfully" into garbage.
 */
export function assertMorphable(from: string, to: string, label: string): void {
  const a = parsePath(from);
  const b = parsePath(to);
  if (!morphCompatible(a, b)) {
    throw new Error(`${label}: calm and angry paths have different command structures`);
  }
  const counts = [from.match(NUMBER)?.length ?? 0, to.match(NUMBER)?.length ?? 0];
  if (counts[0] !== counts[1]) {
    throw new Error(`${label}: calm and angry paths have ${counts[0]} vs ${counts[1]} numbers`);
  }
}

/**
 * Build the interpolator between two structurally identical paths. Parsing and
 * splitting happen once here, so the returned function is cheap enough to call
 * every frame.
 */
export function makeMorpher(calmD: string, angryD: string, label = 'morph'): Morpher {
  assertMorphable(calmD, angryD, label);

  const calmNums = (calmD.match(NUMBER) ?? []).map(Number);
  const angryNums = (angryD.match(NUMBER) ?? []).map(Number);
  const template = calmD.split(NUMBER);

  return (t: number) => {
    const clamped = Math.max(0, Math.min(1, t));
    let out = template[0] ?? '';
    for (let i = 0; i < calmNums.length; i++) {
      const value = calmNums[i]! + (angryNums[i]! - calmNums[i]!) * clamped;
      out += round(value) + (template[i + 1] ?? '');
    }
    return out;
  };
}

/**
 * Blend two hex colors, as `rgb(...)` — the form the reference writes and
 * browsers accept directly on `fill`.
 */
export function lerpFill(from: string, to: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const parse = (hex: string) => {
    const clean = hex.replace('#', '');
    // Validate the characters, not just the length — "purple" is six letters
    // and would otherwise parse straight through to NaN.
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
      throw new Error(`lerpFill: expected a hex color, got "${hex}"`);
    }
    return clean.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  };
  const a = parse(from);
  const b = parse(to);
  const channel = (i: number) => Math.round(a[i]! + (b[i]! - a[i]!) * clamped);
  return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
}
