import { LEVELS, type Level } from './levelCheck';
import type { Answered } from './levelCheck';

/**
 * Geometry and scoring for the level test's radar chart (Part 07 §12).
 *
 * Purely a **display layer**. §12 is explicit that the radar "is a display layer
 * only, not a second scoring mechanism — the actual placement decision is still
 * exactly what Part 05 §8 verified". Nothing here feeds back into `decideNext`
 * or `finalPlacement`; it reads the same answer history they do and draws it.
 *
 * The spokes are the six tiers the placement algorithm actually uses. The design
 * frame draws A1/A2/B1/B2/C1/C2 — it drops B1+ and adds a C2 that no content or
 * placement path can reach — so the real tier list is used instead; a spoke a
 * student can never be placed on would be a chart of a level system we don't run.
 */

/** A spoke's filled fraction, 0–1, and the raw tally behind it. */
export interface Spoke {
  level: Level;
  /** Share of this tier's questions answered correctly; 0 when untested. */
  value: number;
  correct: number;
  total: number;
}

/** Radius given to a tier with no answers yet, so the shape reads as a shape. */
export const UNTESTED_RADIUS = 0.08;

/**
 * Per-tier accuracy from the answer history. A tier with no questions asked
 * sits just off the centre rather than at zero — a polygon with several points
 * collapsed onto the origin renders as a spike through the middle, which reads
 * as a score of zero rather than "not asked".
 */
export function spokes(answered: readonly Answered[]): Spoke[] {
  return LEVELS.map((level) => {
    const at = answered.filter((a) => a.level === level);
    const correct = at.filter((a) => a.correct).length;
    const total = at.length;
    return {
      level,
      correct,
      total,
      value: total === 0 ? UNTESTED_RADIUS : correct / total,
    };
  });
}

export interface Point {
  x: number;
  y: number;
}

/**
 * The point for one spoke at a given fill, on a chart of `radius` centred at
 * (cx, cy). Spoke 0 points straight up and the rest run clockwise, matching the
 * design's A1-at-top layout.
 */
export function spokePoint(
  index: number,
  count: number,
  fill: number,
  radius: number,
  cx: number,
  cy: number,
): Point {
  const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
  const r = radius * Math.max(0, Math.min(1, fill));
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** An SVG `points` string for the filled accuracy polygon. */
export function polygonPoints(
  values: readonly number[],
  radius: number,
  cx: number,
  cy: number,
): string {
  return values
    .map((value, i) => {
      const p = spokePoint(i, values.length, value, radius, cx, cy);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(' ');
}
