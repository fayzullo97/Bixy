import { describe, expect, it } from 'vitest';
import {
  BLINK_INTERVAL_MS,
  GAZE_BOW,
  GAZE_DIRECTIONS,
  GAZE_HOLD_MS,
  GAZE_OFFSETS,
  GAZE_POOL,
  nextBlinkDelayMs,
  nextGaze,
  nextGazeHoldMs,
} from './gaze';

/** A random source that replays a fixed sequence, then repeats the last value. */
function seeded(values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
}

describe('look-around (Part 06 §10)', () => {
  it('stays front whenever Bixy is addressing the student', () => {
    // The standing rule: greeting, narrating, or angry — gaze does not wander.
    for (const r of [0, 0.5, 0.99]) {
      expect(nextGaze(seeded([r]), true)).toBe('front');
    }
  });

  it('draws from the reference’s pool, which is more than half front', () => {
    // Front has to come up often or the gaze reads as constant darting.
    const fronts = GAZE_POOL.filter((d) => d === 'front').length;
    expect(fronts).toBe(5);
    expect(GAZE_POOL).toHaveLength(9);
    expect(fronts / GAZE_POOL.length).toBeGreaterThan(0.5);
  });

  it('can reach every one of the five directions', () => {
    const seen = new Set(GAZE_POOL);
    expect(seen).toEqual(new Set(GAZE_DIRECTIONS));
  });

  it('picks the pool entry the random source lands on', () => {
    expect(nextGaze(seeded([0]), false)).toBe(GAZE_POOL[0]);
    expect(nextGaze(seeded([2 / 9 + 0.01]), false)).toBe('left');
  });

  it('never runs off the end of the pool at the top of the random range', () => {
    expect(GAZE_DIRECTIONS).toContain(nextGaze(seeded([1]), false));
  });

  it('holds a glance for 700–2100ms, with NO gap before the next draw', () => {
    // `front` is more than half the pool and IS the resting state, so an added
    // pause between glances would be a behaviour the verified version lacks.
    expect(nextGazeHoldMs(seeded([0]))).toBe(GAZE_HOLD_MS.min);
    expect(nextGazeHoldMs(seeded([1]))).toBe(GAZE_HOLD_MS.max);
    expect(GAZE_HOLD_MS).toEqual({ min: 700, max: 2100 });
  });

  it('moves eyes, mouth and sparkle together, and not at all at front', () => {
    expect(GAZE_OFFSETS.front).toEqual({ x: 0, y: 0 });
    expect(GAZE_OFFSETS.left).toEqual({ x: -7, y: 0 });
    expect(GAZE_OFFSETS.right).toEqual({ x: 7, y: 0 });
    expect(GAZE_OFFSETS.top_left).toEqual({ x: -6, y: -5 });
    expect(GAZE_OFFSETS.top_right).toEqual({ x: 6, y: -5 });
  });

  it('bows the eye by direction, exactly zero at front and symmetric', () => {
    // 0 has to be exact: it must reproduce the straight source art.
    expect(GAZE_BOW.front).toBe(0);
    expect(GAZE_BOW.left).toBe(-7);
    expect(GAZE_BOW.right).toBe(7);
    expect(GAZE_BOW.top_left).toBe(-6);
    expect(GAZE_BOW.top_right).toBe(6);
  });
});

describe('blink (Part 06 §10)', () => {
  it('is irregular, so it does not read as a metronome', () => {
    expect(nextBlinkDelayMs(seeded([0]))).toBe(BLINK_INTERVAL_MS.min);
    expect(nextBlinkDelayMs(seeded([1]))).toBe(BLINK_INTERVAL_MS.max);
    expect(BLINK_INTERVAL_MS).toEqual({ min: 2200, max: 5400 });
  });
});
