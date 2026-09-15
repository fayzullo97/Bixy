import { describe, expect, it } from 'vitest';
import {
  BREATHE_KEYFRAMES,
  FLOAT_KEYFRAMES,
  IDLE_DURATION_MS,
  JUMP_DURATION_MS,
  JUMP_KEYFRAMES,
  keyframesCss,
} from './idle';

const at = (frames: typeof FLOAT_KEYFRAMES, percent: number) => frames.find((f) => f.at === percent)!;

describe('float (Part 06 §10)', () => {
  it('starts and ends at rest, lifting at the half-way point', () => {
    expect(at(FLOAT_KEYFRAMES, 0).translateY).toBe(0);
    expect(at(FLOAT_KEYFRAMES, 50).translateY).toBe(-5);
    expect(at(FLOAT_KEYFRAMES, 100).translateY).toBe(0);
  });

  it('only translates — the bob never resizes the character', () => {
    for (const frame of FLOAT_KEYFRAMES) {
      expect(frame.scaleX).toBe(1);
      expect(frame.scaleY).toBe(1);
    }
  });
});

describe('breathe (Part 06 §10)', () => {
  it('is phase-locked to float — one duration, both peaking at 50%', () => {
    expect(BREATHE_KEYFRAMES.map((f) => f.at)).toEqual(FLOAT_KEYFRAMES.map((f) => f.at));
    expect(IDLE_DURATION_MS).toBe(3000);
  });

  it('is WIDER and SHORTER at the top of the bob, not taller', () => {
    // The inverted version reads as the character being pulled upward rather
    // than breathing under its own power.
    const peak = at(BREATHE_KEYFRAMES, 50);
    expect(peak.scaleX).toBeGreaterThan(1);
    expect(peak.scaleY).toBeLessThan(1);
    expect(peak.scaleX).toBe(1.018);
    expect(peak.scaleY).toBe(0.982);
  });

  it('is barely-there, never a visible squish', () => {
    for (const frame of BREATHE_KEYFRAMES) {
      expect(Math.abs(frame.scaleX - 1)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(frame.scaleY - 1)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(frame.skewX ?? 0)).toBeLessThanOrEqual(1);
    }
  });

  it('returns to exactly neutral at both ends', () => {
    for (const percent of [0, 100]) {
      const frame = at(BREATHE_KEYFRAMES, percent);
      expect(frame.scaleX).toBe(1);
      expect(frame.scaleY).toBe(1);
      expect(frame.skewX).toBe(0);
    }
  });
});

describe('jump (Part 06 §10)', () => {
  it('runs for the reference’s 620ms', () => {
    expect(JUMP_DURATION_MS).toBe(620);
  });

  it('DIPS below rest on the squash, before launching', () => {
    // Positive translateY is downward. The character compresses into the
    // ground first — clamping this to never sink is what turns a jump into a
    // hover, and an earlier test pinned exactly that wrong behaviour.
    const squash = at(JUMP_KEYFRAMES, 18);
    expect(squash.translateY).toBeGreaterThan(0);
    expect(squash.scaleY).toBeLessThan(1);
    expect(squash.scaleX).toBeGreaterThan(1);
  });

  it('launches high, taller and thinner', () => {
    const launch = at(JUMP_KEYFRAMES, 45);
    expect(launch.translateY).toBe(-26);
    expect(launch.scaleY).toBeGreaterThan(1);
    expect(launch.scaleX).toBeLessThan(1);
  });

  it('DIPS again on landing, then bounces once before settling', () => {
    const land = at(JUMP_KEYFRAMES, 70);
    const bounce = at(JUMP_KEYFRAMES, 85);
    expect(land.translateY).toBeGreaterThan(0); // absorbs the landing
    expect(land.scaleY).toBeLessThan(1);
    expect(bounce.translateY).toBeLessThan(0); // one small rebound
    expect(bounce.scaleY).toBeGreaterThan(1);
  });

  it('settles to exactly rest, leaving nothing offset behind', () => {
    const end = at(JUMP_KEYFRAMES, 100);
    expect(end).toMatchObject({ scaleX: 1, scaleY: 1, translateY: 0 });
  });

  it('crosses the resting line in both directions — it is not a one-way hop', () => {
    const ys = JUMP_KEYFRAMES.map((f) => f.translateY);
    expect(Math.max(...ys)).toBeGreaterThan(0);
    expect(Math.min(...ys)).toBeLessThan(0);
  });
});

describe('keyframe rendering', () => {
  it('emits a CSS block the component can inject', () => {
    const css = keyframesCss('bixy-float', FLOAT_KEYFRAMES);
    expect(css).toContain('@keyframes bixy-float');
    expect(css).toContain('50% { transform: scale(1, 1) translateY(-5px); }');
  });

  it('includes skew only where there is any', () => {
    const css = keyframesCss('bixy-breathe', BREATHE_KEYFRAMES);
    expect(css).toContain('skewX(0.6deg)');
    expect(css).toContain('0% { transform: scale(1, 1) translateY(0px); }');
  });
});
